import Ajv, { type ErrorObject } from "ajv";
import { snapshotJsonSchema } from "./snapshot.schema";

export type Snapshot = {
	schemaVersion: 1;
	beans: Array<Record<string, unknown>>;
	machines: Array<Record<string, unknown>>;
	brews: Array<Record<string, unknown>>;
};

export class SnapshotValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SnapshotValidationError";
	}
}

const validateSchema = new Ajv({
	removeAdditional: true,
}).compile<Snapshot>(snapshotJsonSchema);

const ENTITIES: Record<string, string> = {
	beans: "bean",
	machines: "machine",
	brews: "brew",
};

const EMPTY_SNAPSHOT: Snapshot = {
	schemaVersion: 1,
	beans: [],
	machines: [],
	brews: [],
};

export class SnapshotDocument {
	validate(value: unknown): Snapshot {
		const snapshot = structuredClone(value);
		if (!validateSchema(snapshot))
			throw new SnapshotValidationError(
				this.schemaErrorMessage(validateSchema.errors?.[0]),
			);
		const beanIds = this.uniqueIds(snapshot.beans, "bean");
		const machineIds = this.uniqueIds(snapshot.machines, "machine");
		this.uniqueIds(snapshot.brews, "brew");
		for (const brew of snapshot.brews) {
			if (Number.isNaN(Date.parse(String(brew.date))))
				throw new SnapshotValidationError("Invalid brew date");
			for (const [field, ids] of [
				["beanLocalId", beanIds],
				["machineLocalId", machineIds],
			] as const)
				if (brew[field] !== undefined && !ids.has(brew[field] as string))
					throw new SnapshotValidationError("Invalid brew relationship");
		}
		return snapshot;
	}

	fromStored(value: unknown): Snapshot {
		return value && typeof value === "object"
			? this.validate(value)
			: EMPTY_SNAPSHOT;
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
		};
	}

	private compareLocalIds(
		left: Record<string, unknown>,
		right: Record<string, unknown>,
	) {
		return String(left.localId).localeCompare(String(right.localId));
	}

	private schemaErrorMessage(error: ErrorObject | undefined) {
		const path = error?.instancePath.split("/").slice(1) ?? [];
		if (path.length < 2) return "Invalid workspace snapshot";
		if (path.length > 2) return `Invalid ${path[2]}`;
		const missing = error?.params.missingProperty as string | undefined;
		return missing ? `Invalid ${missing}` : `Invalid ${ENTITIES[path[0]]}`;
	}

	private uniqueIds(rows: Array<Record<string, unknown>>, entity: string) {
		const ids = rows.map((row) => row.localId as string);
		if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
			throw new SnapshotValidationError(
				`Duplicate or missing ${entity} local ID`,
			);
		return new Set(ids);
	}
}
