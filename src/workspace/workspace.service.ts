import {
	BadRequestException,
	ConflictException,
	Injectable,
} from "@nestjs/common";
import type { InputJsonValue } from "../generated/prisma/internal/prismaNamespace";
import { PrismaService } from "../prisma/prisma.service";
import {
	type Snapshot,
	SnapshotDocument,
	SnapshotValidationError,
} from "./snapshot";

@Injectable()
export class WorkspaceService {
	private readonly snapshotDocument = new SnapshotDocument();

	constructor(private readonly prisma: PrismaService) {}

	async getSnapshot(userId: number) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { snapshot: true, snapshotVersion: true },
		});
		if (!user) throw new BadRequestException("Workspace not found");
		return {
			snapshot: this.snapshotDocument.fromStored(user.snapshot),
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
					this.sameSnapshot(
						this.snapshotDocument.fromStored(latest.snapshot),
						snapshot,
					)
				)
					return {
						snapshot: this.snapshotDocument.fromStored(latest.snapshot),
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
				snapshot: this.snapshotDocument.fromStored(updatedUser.snapshot),
				version: updatedUser.snapshotVersion,
			};
		});
	}

	private sameSnapshot(left: Snapshot, right: Snapshot) {
		return this.snapshotDocument.equivalent(left, right);
	}

	private validateSnapshot(value: unknown): Snapshot {
		try {
			return this.snapshotDocument.validate(value);
		} catch (error) {
			if (error instanceof SnapshotValidationError)
				throw new BadRequestException(error.message);
			throw error;
		}
	}
}
