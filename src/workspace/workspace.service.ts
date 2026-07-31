import {
	BadRequestException,
	ConflictException,
	Injectable,
} from "@nestjs/common";
import type { InputJsonValue } from "../generated/prisma/internal/prismaNamespace";
import { PrismaService } from "../prisma/prisma.service";

type Snapshot = {
	schemaVersion: 1;
	beans: Array<Record<string, unknown>>;
	machines: Array<Record<string, unknown>>;
	brews: Array<Record<string, unknown>>;
};

const BEAN_STATUSES = new Set([
	"Excellent",
	"Good",
	"Mid",
	"Horrible",
	"New",
	"",
]);
const DOMINANT_NOTES = new Set([
	"Fruity",
	"Nutty",
	"Floral",
	"Sweet",
	"Sour",
	"Spices",
	"Roasted",
	"Green",
]);
const BOTANICS = new Set(["Arabica", "Robusta", ""]);
const DESIGNATIONS = new Set(["Pure Origin", "Blend", ""]);

const EMPTY_SNAPSHOT: Snapshot = {
	schemaVersion: 1,
	beans: [],
	machines: [],
	brews: [],
};

@Injectable()
export class WorkspaceService {
	constructor(private readonly prisma: PrismaService) {}

	async getSnapshot(userId: number) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { snapshot: true, snapshotVersion: true },
		});
		if (!user) throw new BadRequestException("Workspace not found");
		return {
			snapshot: this.parseSnapshot(user.snapshot),
			version: user.snapshotVersion,
		};
	}

	async putSnapshot(userId: number, value: unknown, ifMatch?: string) {
		const snapshot = this.validateSnapshot(value);
		const expectedVersion = Number(ifMatch);
		if (!Number.isInteger(expectedVersion) || expectedVersion < 0)
			throw new BadRequestException("If-Match snapshot version required");

		return await this.prisma.$transaction(async (tx) => {
			const current = await tx.user.findUnique({
				where: { id: userId },
				select: { snapshot: true, snapshotVersion: true },
			});
			if (!current) throw new BadRequestException("Workspace not found");
			const updated = await tx.user.updateMany({
				where: { id: userId, snapshotVersion: expectedVersion },
				data: {
					snapshot: snapshot as unknown as InputJsonValue,
					snapshotVersion: { increment: 1 },
				},
			});
			if (updated.count === 0) {
				const latest = await tx.user.findUnique({
					where: { id: userId },
					select: { snapshot: true, snapshotVersion: true },
				});
				if (
					latest &&
					this.sameSnapshot(this.parseSnapshot(latest.snapshot), snapshot)
				)
					return {
						snapshot: this.parseSnapshot(latest.snapshot),
						version: latest.snapshotVersion,
					};
				throw new ConflictException("Cloud snapshot changed");
			}
			const updatedUser = await tx.user.findUnique({
				where: { id: userId },
				select: { snapshot: true, snapshotVersion: true },
			});
			if (!updatedUser) throw new BadRequestException("Workspace not found");
			return {
				snapshot: this.parseSnapshot(updatedUser.snapshot),
				version: updatedUser.snapshotVersion,
			};
		});
	}

	private parseSnapshot(value: unknown): Snapshot {
		return value && typeof value === "object"
			? this.validateSnapshot(value)
			: EMPTY_SNAPSHOT;
	}

	private sameSnapshot(left: Snapshot, right: Snapshot) {
		return (
			JSON.stringify(this.canonicalize(this.canonicalSnapshot(left))) ===
			JSON.stringify(this.canonicalize(this.canonicalSnapshot(right)))
		);
	}

	private canonicalize(value: unknown): unknown {
		if (Array.isArray(value)) return value.map((item) => this.canonicalize(item));
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

	private validateSnapshot(value: unknown): Snapshot {
		if (!value || typeof value !== "object")
			throw new BadRequestException("Invalid workspace snapshot");
		const snapshot = value as Partial<Snapshot>;
		if (
			snapshot.schemaVersion !== 1 ||
			!Array.isArray(snapshot.beans) ||
			!Array.isArray(snapshot.machines) ||
			!Array.isArray(snapshot.brews)
		)
			throw new BadRequestException("Invalid workspace snapshot");
		const beanIds = this.validateBeans(snapshot.beans);
		const machineIds = this.validateMachines(snapshot.machines);
		const brewIds = snapshot.brews.map((brew) =>
			this.validateBrew(brew, beanIds, machineIds),
		);
		this.uniqueIds(brewIds, "brew");
		return snapshot as Snapshot;
	}

	private validateBeans(rows: Array<Record<string, unknown>>) {
		const ids = rows.map((row) => {
			const value = this.record(row, "bean");
			this.string(value, "localId");
			this.string(value, "name");
			this.number(value, "rating");
			this.number(value, "roastLevel");
			this.stringArray(value, "origin");
			this.stringArray(value, "process");
			this.stringArray(value, "variety");
			this.string(value, "brand");
			this.stringArray(value, "flavors");
			this.enumValue(value, "status", BEAN_STATUSES);
			this.enumValue(value, "dominantNote", DOMINANT_NOTES);
			this.enumValue(value, "botanic", BOTANICS);
			this.enumValue(value, "designation", DESIGNATIONS);
			this.boolean(value, "finished");
			return value.localId as string;
		});
		return this.uniqueIds(ids, "bean");
	}

	private validateMachines(rows: Array<Record<string, unknown>>) {
		const ids = rows.map((row) => {
			const value = this.record(row, "machine");
			this.string(value, "localId");
			for (const field of [
				"name",
				"brand",
				"type",
				"purchaseDate",
				"model",
				"grindRange",
				"capacity",
			])
				this.string(value, field);
			return value.localId as string;
		});
		return this.uniqueIds(ids, "machine");
	}

	private validateBrew(
		row: Record<string, unknown>,
		beanIds: Set<string>,
		machineIds: Set<string>,
	) {
		const value = this.record(row, "brew");
		this.string(value, "localId");
		for (const field of ["beanWeight", "espressoWeight", "grindSize"])
			this.number(value, field);
		for (const field of ["overallRating", "tasteScore", "strengthScore"])
			this.optionalNumber(value, field);
		for (const field of ["extractionTime", "flow"])
			this.optionalString(value, field);
		this.string(value, "date");
		if (Number.isNaN(Date.parse(String(value.date))))
			throw new BadRequestException("Invalid brew date");
		for (const [field, ids] of [
			["beanLocalId", beanIds],
			["machineLocalId", machineIds],
		] as const) {
			this.optionalString(value, field);
			if (value[field] !== undefined && !ids.has(value[field] as string))
				throw new BadRequestException("Invalid brew relationship");
		}
		return value.localId as string;
	}

	private record(value: unknown, entity: string) {
		if (!value || typeof value !== "object" || Array.isArray(value))
			throw new BadRequestException(`Invalid ${entity}`);
		return value as Record<string, unknown>;
	}

	private string(value: Record<string, unknown>, field: string) {
		if (typeof value[field] !== "string")
			throw new BadRequestException(`Invalid ${field}`);
	}

	private optionalString(value: Record<string, unknown>, field: string) {
		if (value[field] !== undefined && typeof value[field] !== "string")
			throw new BadRequestException(`Invalid ${field}`);
	}

	private number(value: Record<string, unknown>, field: string) {
		if (typeof value[field] !== "number" || !Number.isFinite(value[field]))
			throw new BadRequestException(`Invalid ${field}`);
	}

	private optionalNumber(value: Record<string, unknown>, field: string) {
		if (value[field] !== undefined) this.number(value, field);
	}

	private boolean(value: Record<string, unknown>, field: string) {
		if (typeof value[field] !== "boolean")
			throw new BadRequestException(`Invalid ${field}`);
	}

	private stringArray(value: Record<string, unknown>, field: string) {
		if (
			!Array.isArray(value[field]) ||
			value[field].some((item) => typeof item !== "string")
		)
			throw new BadRequestException(`Invalid ${field}`);
	}

	private enumValue(
		value: Record<string, unknown>,
		field: string,
		allowed: Set<string>,
	) {
		if (typeof value[field] !== "string" || !allowed.has(value[field]))
			throw new BadRequestException(`Invalid ${field}`);
	}

	private uniqueIds(ids: string[], entity: string) {
		if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
			throw new BadRequestException(`Duplicate or missing ${entity} local ID`);
		return new Set(ids);
	}
}
