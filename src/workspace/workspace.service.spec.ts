import { BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspaceService } from "./workspace.service";

describe("WorkspaceService", () => {
	const snapshot = {
		schemaVersion: 1 as const,
		beans: [{ localId: "bean-1" }],
		machines: [{ localId: "machine-1" }],
		brews: [{ localId: "brew-1", beanLocalId: "bean-1", machineLocalId: "machine-1" }],
	};
	let service: WorkspaceService;
	let tx: { user: { findUnique: jest.Mock; update: jest.Mock } };
	let prisma: { user: { findUnique: jest.Mock }; $transaction: jest.Mock };

	beforeEach(() => {
		tx = { user: { findUnique: jest.fn(), update: jest.fn() } };
		prisma = {
			user: { findUnique: jest.fn() },
			$transaction: jest.fn((callback) => callback(tx)),
		};
		service = new WorkspaceService(prisma as unknown as PrismaService);
	});

	it("returns an empty snapshot for a new workspace", async () => {
		prisma.user.findUnique.mockResolvedValue({ snapshot: null, snapshotVersion: 0 });
		expect(await service.getSnapshot(7)).toEqual({ snapshot: { schemaVersion: 1, beans: [], machines: [], brews: [] }, version: 0 });
	});

	it("replaces a snapshot atomically and increments its version", async () => {
		tx.user.findUnique.mockResolvedValue({ snapshot: null, snapshotVersion: 0 });
		tx.user.update.mockResolvedValue({ snapshot, snapshotVersion: 1 });
		expect(await service.putSnapshot(7, snapshot, "0")).toEqual({ snapshot, version: 1 });
		expect(tx.user.update).toHaveBeenCalled();
	});

	it("rejects stale replacement unless it is an idempotent retry", async () => {
		tx.user.findUnique.mockResolvedValue({ snapshot: { ...snapshot, beans: [{ localId: "bean-2" }], brews: [{ ...snapshot.brews[0], beanLocalId: "bean-2" }] }, snapshotVersion: 2 });
		await expect(service.putSnapshot(7, snapshot, "1")).rejects.toBeInstanceOf(ConflictException);
	});

	it("rejects invalid relationships before update", async () => {
		const invalid = { ...snapshot, brews: [{ ...snapshot.brews[0], beanLocalId: "missing" }] };
		await expect(service.putSnapshot(7, invalid, "0")).rejects.toBeInstanceOf(BadRequestException);
		expect(tx.user.findUnique).not.toHaveBeenCalled();
	});
});
