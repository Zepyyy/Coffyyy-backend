import { BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspaceService } from "./workspace.service";

describe("WorkspaceService", () => {
	const snapshot = {
		schemaVersion: 2 as const,
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
				method: "espresso",
				purchaseDate: "",
				model: "",
				grindRange: "",
				capacity: "",
			},
		],
		brews: [
			{
				localId: "brew-1",
				method: "espresso",
				beanLocalId: "bean-1",
				machineLocalId: "machine-1",
				beanWeight: 18,
				brewWeight: 36,
				extractionTime: "30s",
				flow: "",
				overallRating: 4,
				tasteScore: 1,
				strengthScore: 0,
				grindSize: 12,
				date: "2026-07-31T00:00:00.000Z",
			},
		],
		recipes: [] as Array<Record<string, unknown>>,
	};
	const v1Snapshot = {
		schemaVersion: 1 as const,
		beans: snapshot.beans,
		machines: [
			{
				localId: "machine-1",
				name: "Linea Mini",
				brand: "",
				type: "Moka",
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
			snapshot: {
				schemaVersion: 2,
				beans: [],
				machines: [],
				brews: [],
				recipes: [],
			},
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

	it("accepts an equivalent retry with reordered object keys", async () => {
		const reordered = {
			...snapshot,
			beans: [
				Object.fromEntries(
					Object.entries(snapshot.beans[0]).reverse(),
				) as Record<string, unknown>,
			],
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

	it("maps Snapshot validation errors to bad requests before persistence", async () => {
		await expect(service.putSnapshot(7, {}, "0")).rejects.toEqual(
			new BadRequestException("Invalid workspace snapshot"),
		);
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	it("reads a stored v1 snapshot as v2", async () => {
		prisma.user.findUnique.mockResolvedValue({
			snapshot: structuredClone(v1Snapshot),
			snapshotVersion: 3,
		});
		const { snapshot: read, version } = await service.getSnapshot(7);
		expect(version).toBe(3);
		expect(read.schemaVersion).toBe(2);
		expect(read.recipes).toEqual([]);
		expect(read.machines[0]).toMatchObject({ method: "moka" });
		expect(read.machines[0]).not.toHaveProperty("type");
		expect(read.brews[0]).toMatchObject({ method: "moka", brewWeight: 36 });
		expect(read.brews[0]).not.toHaveProperty("espressoWeight");
	});

	it("rejects a v1 PUT as an outdated client with 409", async () => {
		await expect(
			service.putSnapshot(7, structuredClone(v1Snapshot), "0"),
		).rejects.toEqual(
			new ConflictException(
				"Client outdated: snapshot schema 1 is no longer accepted",
			),
		);
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	it("accepts a retry equivalent to the upgraded stored v1 snapshot", async () => {
		tx.user.findUnique.mockResolvedValue({
			snapshot: {
				...v1Snapshot,
				machines: [{ ...v1Snapshot.machines[0], type: "Espresso" }],
			},
			snapshotVersion: 2,
		});
		tx.user.updateMany.mockResolvedValue({ count: 0 });
		await expect(service.putSnapshot(7, snapshot, "1")).resolves.toEqual({
			snapshot,
			version: 2,
		});
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
