import { BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspaceService } from "./workspace.service";

describe("WorkspaceService", () => {
	const snapshot = {
		schemaVersion: 1 as const,
		beans: [
			{
				localId: "bean-1",
				name: "Ethiopia",
				rating: 0,
				roastLevel: 3,
				origin: [],
				process: [],
				variety: [],
				brand: "",
				flavors: [],
				status: "New",
				dominantNote: "Fruity",
				botanic: "Arabica",
				designation: "Pure Origin",
				finished: false,
			},
		],
		machines: [
			{
				localId: "machine-1",
				name: "Linea Mini",
				brand: "",
				type: "",
				purchaseDate: "",
				model: "",
				grindRange: "",
				capacity: "",
			},
		],
		brews: [
			{
				localId: "brew-1",
				beanLocalId: "bean-1",
				machineLocalId: "machine-1",
				beanWeight: 18,
				espressoWeight: 36,
				extractionTime: "30s",
				flow: "",
				overallRating: 4,
				tasteScore: 1,
				strengthScore: 0,
				grindSize: 12,
				date: "2026-07-31T00:00:00.000Z",
			},
		],
	};
	let service: WorkspaceService;
	let tx: { user: { findUnique: jest.Mock; updateMany: jest.Mock } };
	let prisma: { user: { findUnique: jest.Mock }; $transaction: jest.Mock };

	beforeEach(() => {
		tx = {
			user: {
				findUnique: jest.fn(),
				updateMany: jest.fn().mockResolvedValue({ count: 1 }),
			},
		};
		prisma = {
			user: { findUnique: jest.fn() },
			$transaction: jest.fn((callback) => callback(tx)),
		};
		service = new WorkspaceService(prisma as unknown as PrismaService);
	});

	it("returns an empty snapshot for a new workspace", async () => {
		prisma.user.findUnique.mockResolvedValue({
			snapshot: null,
			snapshotVersion: 0,
		});
		expect(await service.getSnapshot(7)).toEqual({
			snapshot: { schemaVersion: 1, beans: [], machines: [], brews: [] },
			version: 0,
		});
	});

	it("replaces a snapshot atomically and increments its version", async () => {
		tx.user.findUnique.mockResolvedValue({
			snapshot: null,
			snapshotVersion: 0,
		});
		tx.user.findUnique
			.mockResolvedValueOnce({ snapshot: null, snapshotVersion: 0 })
			.mockResolvedValueOnce({ snapshot, snapshotVersion: 1 });
		expect(await service.putSnapshot(7, snapshot, "0")).toEqual({
			snapshot,
			version: 1,
		});
		expect(tx.user.updateMany).toHaveBeenCalledWith({
			where: { id: 7, snapshotVersion: 0 },
			data: { snapshot: expect.anything(), snapshotVersion: { increment: 1 } },
		});
	});

	it("rejects stale replacement unless it is an idempotent retry", async () => {
		tx.user.findUnique.mockResolvedValue({
			snapshot: {
				...snapshot,
				beans: [{ ...snapshot.beans[0], localId: "bean-2" }],
				brews: [{ ...snapshot.brews[0], beanLocalId: "bean-2" }],
			},
			snapshotVersion: 2,
		});
		tx.user.updateMany.mockResolvedValue({ count: 0 });
		await expect(service.putSnapshot(7, snapshot, "1")).rejects.toBeInstanceOf(
			ConflictException,
		);
	});

	it("accepts an equivalent retry with reordered entities", async () => {
		const reordered = {
			...snapshot,
			beans: [...snapshot.beans].reverse(),
			machines: [...snapshot.machines].reverse(),
			brews: [...snapshot.brews].reverse(),
		};
		tx.user.findUnique.mockResolvedValue({
			snapshot: reordered,
			snapshotVersion: 2,
		});
		tx.user.updateMany.mockResolvedValue({ count: 0 });
		await expect(service.putSnapshot(7, snapshot, "1")).resolves.toEqual({
			snapshot: reordered,
			version: 2,
		});
	});

	it("rejects invalid relationships before update", async () => {
		const invalid = {
			...snapshot,
			brews: [{ ...snapshot.brews[0], beanLocalId: "missing" }],
		};
		await expect(service.putSnapshot(7, invalid, "0")).rejects.toBeInstanceOf(
			BadRequestException,
		);
		expect(tx.user.findUnique).not.toHaveBeenCalled();
	});

	it("rejects invalid entity fields and duplicate brew IDs", async () => {
		const invalid = {
			...snapshot,
			beans: [{ ...snapshot.beans[0], rating: "bad" }],
		};
		await expect(service.putSnapshot(7, invalid, "0")).rejects.toBeInstanceOf(
			BadRequestException,
		);

		const duplicate = {
			...snapshot,
			brews: [
				snapshot.brews[0],
				{
					...snapshot.brews[0],
					beanLocalId: undefined,
					machineLocalId: undefined,
				},
			],
		};
		await expect(service.putSnapshot(7, duplicate, "0")).rejects.toBeInstanceOf(
			BadRequestException,
		);
		expect(tx.user.findUnique).not.toHaveBeenCalled();
	});

	it("passes the authenticated workspace ID to reads", async () => {
		prisma.user.findUnique.mockResolvedValue({
			snapshot: null,
			snapshotVersion: 0,
		});
		await service.getSnapshot(42);
		expect(prisma.user.findUnique).toHaveBeenCalledWith({
			where: { id: 42 },
			select: { snapshot: true, snapshotVersion: true },
		});
	});
});
