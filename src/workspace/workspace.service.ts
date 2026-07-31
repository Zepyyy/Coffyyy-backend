import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type Snapshot = {
	schemaVersion: 1;
	beans: Array<Record<string, unknown>>;
	machines: Array<Record<string, unknown>>;
	brews: Array<Record<string, unknown>>;
};

const EMPTY_SNAPSHOT: Snapshot = { schemaVersion: 1, beans: [], machines: [], brews: [] };

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

		return this.prisma.$transaction(async (tx) => {
			const current = await tx.user.findUnique({
				where: { id: userId },
				select: { snapshot: true, snapshotVersion: true },
			});
			if (!current) throw new BadRequestException("Workspace not found");
			const currentSnapshot = this.parseSnapshot(current.snapshot);
			if (current.snapshotVersion !== expectedVersion) {
				if (JSON.stringify(currentSnapshot) === JSON.stringify(snapshot))
					return { snapshot: currentSnapshot, version: current.snapshotVersion };
				throw new ConflictException("Cloud snapshot changed");
			}
			const updated = await tx.user.update({
				where: { id: userId },
				data: { snapshot: snapshot as object, snapshotVersion: { increment: 1 } },
				select: { snapshot: true, snapshotVersion: true },
			});
			return { snapshot: this.parseSnapshot(updated.snapshot), version: updated.snapshotVersion };
		});
	}

	private parseSnapshot(value: unknown): Snapshot {
		return value && typeof value === "object" ? this.validateSnapshot(value) : EMPTY_SNAPSHOT;
	}

	private validateSnapshot(value: unknown): Snapshot {
		if (!value || typeof value !== "object") throw new BadRequestException("Invalid workspace snapshot");
		const snapshot = value as Partial<Snapshot>;
		if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.beans) || !Array.isArray(snapshot.machines) || !Array.isArray(snapshot.brews))
			throw new BadRequestException("Invalid workspace snapshot");
		const beanIds = this.uniqueIds(snapshot.beans);
		const machineIds = this.uniqueIds(snapshot.machines);
		for (const brew of snapshot.brews) {
			if (!brew || typeof brew !== "object" || typeof (brew as Record<string, unknown>).localId !== "string")
				throw new BadRequestException("Invalid brew local ID");
			const row = brew as Record<string, unknown>;
			if ((typeof row.beanLocalId === "string" && !beanIds.has(row.beanLocalId)) || (typeof row.machineLocalId === "string" && !machineIds.has(row.machineLocalId)))
				throw new BadRequestException("Invalid brew relationship");
		}
		return snapshot as Snapshot;
	}

	private uniqueIds(rows: Array<Record<string, unknown>>) {
		const ids = rows.map((row) => row && typeof row.localId === "string" ? row.localId : "");
		if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
			throw new BadRequestException("Duplicate or missing local ID");
		return new Set(ids);
	}
}
