import Ajv, { type ErrorObject } from "ajv";
import {
	type BREW_METHODS,
	SNAPSHOT_SCHEMA_VERSION,
	snapshotJsonSchema,
} from "./snapshot.schema";

type Row = Record<string, unknown>;

export type Snapshot = {
	schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
	beans: Row[];
	machines: Row[];
	brews: Row[];
	recipes: Row[];
};

export class SnapshotValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SnapshotValidationError";
	}
}

// A well-formed snapshot from an older schema: the client must upgrade first.
export class SnapshotOutdatedError extends Error {
	constructor(readonly schemaVersion: number) {
		super(
			`Client outdated: snapshot schema ${schemaVersion} is no longer accepted`,
		);
		this.name = "SnapshotOutdatedError";
	}
}

type BrewMethod = (typeof BREW_METHODS)[number];

// Legacy free-text Machine.type -> Brew method. Unknown text reads as espresso.
export function methodFromMachineType(type: unknown): BrewMethod {
	const text = typeof type === "string" ? type.toLowerCase() : "";
	if (text.includes("espresso")) return "espresso";
	if (text.includes("pour")) return "pour-over";
	if (text.includes("moka")) return "moka";
	return "espresso";
}

const isRow = (value: unknown): value is Row =>
	!!value && typeof value === "object" && !Array.isArray(value);

const rows = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// Pure v1 -> v2 upgrade. Anything not a v1 snapshot is returned untouched.
export function upgradeSnapshot(value: unknown): unknown {
	if (!isRow(value) || value.schemaVersion !== 1) return value;
	const methods = new Map<unknown, BrewMethod>();
	const machines = rows(value.machines).map((machine) => {
		if (!isRow(machine)) return machine;
		const { type, ...rest } = machine;
		const method = methodFromMachineType(type);
		methods.set(machine.localId, method);
		return { ...rest, method };
	});
	const brews = rows(value.brews).map((brew) => {
		if (!isRow(brew)) return brew;
		const { espressoWeight, ...rest } = brew;
		return {
			...rest,
			method: methods.get(brew.machineLocalId) ?? "espresso",
			brewWeight: espressoWeight,
		};
	});
	return {
		...value,
		schemaVersion: SNAPSHOT_SCHEMA_VERSION,
		machines,
		brews,
		recipes: [],
	};
}

const validateSchema = new Ajv({
	removeAdditional: true,
}).compile<Snapshot>(snapshotJsonSchema);

const ENTITIES: Record<string, string> = {
	beans: "bean",
	machines: "machine",
	brews: "brew",
	recipes: "recipe",
};

const OUTDATED_SCHEMA_VERSIONS: unknown[] = [1];

const emptySnapshot = (): Snapshot => ({
	schemaVersion: SNAPSHOT_SCHEMA_VERSION,
	beans: [],
	machines: [],
	brews: [],
	recipes: [],
});

export class SnapshotDocument {
	// Accepts the current schema only. Older snapshots are rejected before Ajv
	// runs, so `removeAdditional` never silently strips their legacy fields.
	validate(value: unknown): Snapshot {
		if (isRow(value) && OUTDATED_SCHEMA_VERSIONS.includes(value.schemaVersion))
			throw new SnapshotOutdatedError(value.schemaVersion as number);
		const snapshot = structuredClone(value);
		if (!validateSchema(snapshot))
			throw new SnapshotValidationError(
				this.schemaErrorMessage(validateSchema.errors?.[0]),
			);
		const beanIds = this.uniqueIds(snapshot.beans, "bean");
		const machineIds = this.uniqueIds(snapshot.machines, "machine");
		this.uniqueIds(snapshot.recipes, "recipe");
		this.uniqueIds(snapshot.brews, "brew");
		const recipeMethods = new Map(
			snapshot.recipes.map((recipe) => [
				recipe.localId as string,
				recipe.method,
			]),
		);
		for (const recipe of snapshot.recipes)
			if (
				recipe.beanLocalId !== undefined &&
				!beanIds.has(recipe.beanLocalId as string)
			)
				throw new SnapshotValidationError("Invalid recipe relationship");
		for (const brew of snapshot.brews) {
			if (Number.isNaN(Date.parse(String(brew.date))))
				throw new SnapshotValidationError("Invalid brew date");
			for (const [field, ids] of [
				["beanLocalId", beanIds],
				["machineLocalId", machineIds],
				["recipeLocalId", recipeMethods],
			] as const)
				if (brew[field] !== undefined && !ids.has(brew[field] as string))
					throw new SnapshotValidationError("Invalid brew relationship");
			if (
				brew.recipeLocalId !== undefined &&
				recipeMethods.get(brew.recipeLocalId as string) !== brew.method
			)
				throw new SnapshotValidationError("Brew method differs from recipe");
		}
		return snapshot;
	}

	// Stored snapshots may predate the current schema; upgrade them in memory
	// (persisted on the next PUT) so reads always return the current schema.
	fromStored(value: unknown): Snapshot {
		return value && typeof value === "object"
			? this.validate(upgradeSnapshot(value))
			: emptySnapshot();
	}

	equivalent(left: Snapshot, right: Snapshot) {
		return (
			JSON.stringify(this.canonicalize(this.canonicalSnapshot(left))) ===
			JSON.stringify(this.canonicalize(this.canonicalSnapshot(right)))
		);
	}

	private canonicalize(value: unknown): unknown {
		if (Array.isArray(value))
			return value.map((item) => this.canonicalize(item));
		if (!value || typeof value !== "object") return value;
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, this.canonicalize(entry)]),
		);
	}

	private canonicalSnapshot(snapshot: Snapshot) {
		return {
			...snapshot,
			beans: [...snapshot.beans].sort((left, right) =>
				this.compareLocalIds(left, right),
			),
			machines: [...snapshot.machines].sort((left, right) =>
				this.compareLocalIds(left, right),
			),
			brews: [...snapshot.brews].sort((left, right) =>
				this.compareLocalIds(left, right),
			),
			recipes: [...snapshot.recipes].sort((left, right) =>
				this.compareLocalIds(left, right),
			),
		};
	}

	private compareLocalIds(left: Row, right: Row) {
		return String(left.localId).localeCompare(String(right.localId));
	}

	private schemaErrorMessage(error: ErrorObject | undefined) {
		const path = error?.instancePath.split("/").slice(1) ?? [];
		if (path.length < 2) return "Invalid workspace snapshot";
		if (path.length > 2) return `Invalid ${path[2]}`;
		const missing = error?.params.missingProperty as string | undefined;
		return missing ? `Invalid ${missing}` : `Invalid ${ENTITIES[path[0]]}`;
	}

	private uniqueIds(entities: Row[], entity: string) {
		const ids = entities.map((row) => row.localId as string);
		if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
			throw new SnapshotValidationError(
				`Duplicate or missing ${entity} local ID`,
			);
		return new Set(ids);
	}
}
