import { BadRequestException, ConflictException } from "@nestjs/common";
import { ChangeOperation, SyncedEntityType } from "../generated/prisma/enums";
import { PrismaService } from "../prisma/prisma.service";
import { SyncService } from "./sync.service";

describe("SyncService", () => {
	let service: SyncService;
	let prisma: { $transaction: jest.Mock; change: { findMany: jest.Mock } };
	// biome-ignore lint/suspicious/noExplicitAny: test file
	let tx: any;
	const dto = {
		operationId: "op-1",
		entityType: SyncedEntityType.BEAN,
		operation: ChangeOperation.CREATE,
		clientId: "local-1",
		payload: { name: "Ethiopia" },
	};

	beforeEach(() => {
		tx = {
			pushOperation: { findUnique: jest.fn(), create: jest.fn() },
			user: { update: jest.fn().mockResolvedValue({ revisionCounter: 7 }) },
			bean: {
				create: jest.fn().mockResolvedValue({ id: 42, name: "Ethiopia" }),
				findFirst: jest.fn(),
				updateMany: jest.fn(),
			},
			brew: { create: jest.fn(), findFirst: jest.fn() },
			machine: { create: jest.fn(), findFirst: jest.fn() },
			change: { create: jest.fn(), findFirst: jest.fn() },
		};
		prisma = {
			$transaction: jest.fn((callback) => callback(tx)),
			change: { findMany: jest.fn() },
		};
		service = new SyncService(prisma as unknown as PrismaService);
	});

	it("returns owner-scoped changes after the cursor with a next page cursor", async () => {
		const rows = [
			{ id: 2, userId: 9, revision: 8 },
			{ id: 3, userId: 9, revision: 9 },
			{ id: 4, userId: 9, revision: 10 },
		];
		prisma.change.findMany.mockResolvedValue(rows);

		await expect(service.changes(7, 2, 9)).resolves.toEqual({
			changes: rows.slice(0, 2),
			nextSince: 9,
			hasMore: true,
		});
		expect(prisma.change.findMany).toHaveBeenCalledWith({
			where: { userId: 9, revision: { gt: 7 }, accepted: true },
			orderBy: { revision: "asc" },
			take: 3,
		});
	});

	it("returns losing versions through history without exposing them as changes", async () => {
		const rows = [{ id: 5, userId: 9, revision: 8, accepted: false }];
		prisma.change.findMany.mockResolvedValue(rows);

		await expect(service.history(7, 2, 9)).resolves.toEqual({
			changes: rows,
			nextSince: 8,
			hasMore: false,
		});
		expect(prisma.change.findMany).toHaveBeenCalledWith({
			where: { userId: 9, revision: { gt: 7 } },
			orderBy: { revision: "asc" },
			take: 3,
		});
	});

	it("applies a create, records one change, and increments revision", async () => {
		tx.bean.create.mockResolvedValue({ id: 42, name: "Ethiopia", revision: 7 });
		await expect(service.push(dto, 9)).resolves.toEqual({
			operationId: "op-1",
			status: "applied",
			serverId: 42,
			revision: 7,
			canonicalRevision: 7,
			canonical: { id: 42, name: "Ethiopia", revision: 7 },
		});

		expect(tx.user.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 9 },
				data: { revisionCounter: { increment: 1 } },
			}),
		);
		expect(tx.change.create).toHaveBeenCalledTimes(1);
		expect(tx.pushOperation.create).toHaveBeenCalledTimes(1);
	});

	it("replays an identical operation without writing again", async () => {
		const original = {
			operationId: "op-1",
			status: "applied",
			serverId: 42,
			revision: 7,
		};
		tx.pushOperation.findUnique.mockResolvedValue({
			payloadHash: expect.any(String),
			result: original,
		});
		// biome-ignore lint/suspicious/noExplicitAny: test file
		const hash = (service as any).hash({
			entityType: dto.entityType,
			operation: dto.operation,
			clientId: dto.clientId,
			serverId: undefined,
			payload: dto.payload,
		});
		tx.pushOperation.findUnique.mockResolvedValue({
			payloadHash: hash,
			result: original,
		});

		await expect(service.push(dto, 9)).resolves.toEqual(original);
		expect(tx.user.update).not.toHaveBeenCalled();
		expect(tx.bean.create).not.toHaveBeenCalled();
	});

	it("rejects a reused operation id with a different payload", async () => {
		tx.pushOperation.findUnique.mockResolvedValue({
			payloadHash: "different",
			result: {},
		});

		await expect(service.push(dto, 9)).rejects.toBeInstanceOf(
			ConflictException,
		);
		expect(tx.user.update).not.toHaveBeenCalled();
		expect(tx.bean.create).not.toHaveBeenCalled();
	});

	it("rejects a stale update and returns the canonical record", async () => {
		const update = {
			...dto,
			operationId: "op-stale",
			operation: ChangeOperation.UPDATE,
			serverId: 42,
			baseRevision: 4,
			payload: { name: "stale" },
		};
		tx.bean.findFirst.mockResolvedValue({
			id: 42,
			name: "newer",
			revision: 5,
			deletedAt: null,
		});
		tx.change.findFirst.mockResolvedValue({
			payload: { id: 42, name: "before-newer", revision: 4 },
		});
		tx.user.update.mockResolvedValue({ revisionCounter: 6 });

		await expect(service.push(update, 9)).resolves.toEqual({
			operationId: "op-stale",
			status: "rejected",
			serverId: 42,
			revision: 6,
			canonicalRevision: 5,
			reason: "stale_revision",
			canonical: {
				id: 42,
				name: "newer",
				revision: 5,
				deletedAt: null,
			},
		});
		expect(tx.bean.updateMany).not.toHaveBeenCalled();
		expect(tx.change.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				accepted: false,
				revision: 6,
				operation: ChangeOperation.UPDATE,
			}),
		});
	});

	it("applies an update only when baseRevision still matches", async () => {
		const update = {
			...dto,
			operationId: "op-update",
			operation: ChangeOperation.UPDATE,
			serverId: 42,
			baseRevision: 4,
			payload: { name: "newer" },
		};
		tx.bean.findFirst
			.mockResolvedValueOnce({
				id: 42,
				name: "old",
				revision: 4,
				deletedAt: null,
			})
			.mockResolvedValueOnce({
				id: 42,
				name: "newer",
				revision: 5,
				deletedAt: null,
			});
		tx.bean.updateMany.mockResolvedValue({ count: 1 });
		tx.user.update.mockResolvedValue({ revisionCounter: 5 });

		await expect(service.push(update, 9)).resolves.toEqual({
			operationId: "op-update",
			status: "applied",
			serverId: 42,
			revision: 5,
			canonicalRevision: 5,
			canonical: {
				id: 42,
				name: "newer",
				revision: 5,
				deletedAt: null,
			},
		});
		expect(tx.bean.updateMany).toHaveBeenCalledWith({
			where: { id: 42, userId: 9, revision: 4, deletedAt: null },
			data: { name: "newer", revision: 5 },
		});
	});

	it("keeps a newer update authoritative when a delete races it", async () => {
		const deletion = {
			...dto,
			operationId: "op-delete-stale",
			operation: ChangeOperation.DELETE,
			serverId: 42,
			baseRevision: 4,
			payload: {},
		};
		const canonical = {
			id: 42,
			name: "newer",
			revision: 5,
			deletedAt: null,
		};
		tx.bean.findFirst.mockResolvedValue(canonical);
		tx.change.findFirst.mockResolvedValue({
			payload: { ...canonical, name: "before-newer", revision: 4 },
		});
		tx.user.update.mockResolvedValue({ revisionCounter: 6 });

		await expect(service.push(deletion, 9)).resolves.toMatchObject({
			status: "rejected",
			serverId: 42,
			revision: 6,
			canonicalRevision: 5,
			reason: "stale_revision",
			canonical,
		});
		expect(tx.bean.updateMany).not.toHaveBeenCalled();
	});

	it("rejects when the revision guard loses an update race", async () => {
		const update = {
			...dto,
			operationId: "op-race",
			operation: ChangeOperation.UPDATE,
			serverId: 42,
			baseRevision: 4,
			payload: { name: "stale" },
		};
		tx.bean.findFirst
			.mockResolvedValueOnce({
				id: 42,
				name: "old",
				revision: 4,
				deletedAt: null,
			})
			.mockResolvedValueOnce({
				id: 42,
				name: "newer",
				revision: 5,
				deletedAt: null,
			});
		tx.bean.updateMany.mockResolvedValue({ count: 0 });
		tx.change.findFirst.mockResolvedValue({
			payload: { id: 42, name: "old", revision: 4 },
		});
		tx.user.update.mockResolvedValue({ revisionCounter: 6 });

		await expect(service.push(update, 9)).resolves.toMatchObject({
			status: "rejected",
			serverId: 42,
			revision: 6,
			canonicalRevision: 5,
			reason: "stale_revision",
		});
	});

	it("replays a stale rejection without allocating another revision", async () => {
		const stale = {
			...dto,
			operationId: "op-stale-retry",
			operation: ChangeOperation.UPDATE,
			serverId: 42,
			baseRevision: 4,
			payload: { name: "stale" },
		};
		const result = {
			operationId: "op-stale-retry",
			status: "rejected",
			serverId: 42,
			revision: 6,
			canonicalRevision: 5,
			canonical: { id: 42, name: "newer", revision: 5 },
			reason: "stale_revision",
		} as const;
		tx.pushOperation.findUnique.mockResolvedValue({
			payloadHash: (
				service as unknown as { payloadHash(value: unknown): string }
			).payloadHash(stale),
			result,
		});

		await expect(service.push(stale, 9)).resolves.toEqual(result);
		expect(tx.user.update).not.toHaveBeenCalled();
		expect(tx.change.create).not.toHaveBeenCalled();
	});

	it("applies an ordered batch and resolves create dependencies", async () => {
		const brew = {
			...dto,
			operationId: "op-2",
			entityType: SyncedEntityType.BREW,
			clientId: "brew-1",
			payload: { beanId: "local-1", machineId: 8, date: "2026-07-24" },
		};
		tx.bean.findFirst
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: 42 });
		tx.bean.create.mockResolvedValue({ id: 42, name: "Ethiopia", revision: 7 });
		tx.machine.findFirst.mockResolvedValue({ id: 8 });
		tx.bean.findFirst.mockResolvedValue({ id: 42 });
		tx.brew.create.mockResolvedValue({ id: 43, revision: 8 });
		tx.user.update
			.mockResolvedValueOnce({ revisionCounter: 7 })
			.mockResolvedValueOnce({ revisionCounter: 8 });

		await expect(service.push([dto, brew], 9)).resolves.toEqual([
			{
				operationId: "op-1",
				status: "applied",
				serverId: 42,
				revision: 7,
				canonicalRevision: 7,
				canonical: { id: 42, name: "Ethiopia", revision: 7 },
			},
			{
				operationId: "op-2",
				status: "applied",
				serverId: 43,
				revision: 8,
				canonicalRevision: 8,
				canonical: { id: 43, revision: 8 },
			},
		]);
		expect(tx.brew.create).toHaveBeenCalledWith({
			data: expect.objectContaining({ beanId: 42, machineId: 8 }),
		});
	});

	it("rejects an unresolved dependency before applying later operations", async () => {
		const brew = {
			...dto,
			operationId: "op-2",
			entityType: SyncedEntityType.BREW,
			clientId: "brew-1",
			payload: { beanId: "missing", machineId: 8, date: "2026-07-24" },
		};

		await expect(service.push([dto, brew], 9)).rejects.toBeInstanceOf(
			BadRequestException,
		);
		expect(tx.bean.create).toHaveBeenCalledTimes(1);
		expect(tx.brew.create).not.toHaveBeenCalled();
	});

	it("replays every operation in a batch without writing", async () => {
		const brew = {
			...dto,
			operationId: "op-2",
			clientId: "local-2",
		};
		const first = {
			operationId: "op-1",
			status: "applied",
			serverId: 42,
			revision: 7,
		};
		const second = {
			operationId: "op-2",
			status: "applied",
			serverId: 43,
			revision: 8,
		};
		const existing = (operation: typeof dto, result: typeof first) => ({
			payloadHash: (
				service as unknown as { payloadHash(value: unknown): string }
			).payloadHash(operation),
			result,
		});
		tx.pushOperation.findUnique
			.mockResolvedValueOnce(existing(dto, first))
			.mockResolvedValueOnce(existing(brew, second));

		await expect(service.push([dto, brew], 9)).resolves.toEqual([
			first,
			second,
		]);
		expect(tx.user.update).not.toHaveBeenCalled();
		expect(tx.bean.create).not.toHaveBeenCalled();
	});
});
