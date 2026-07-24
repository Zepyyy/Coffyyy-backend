import { BadRequestException, ConflictException } from "@nestjs/common";
import { ChangeOperation, SyncedEntityType } from "../generated/prisma/enums";
import { PrismaService } from "../prisma/prisma.service";
import { SyncService } from "./sync.service";

describe("SyncService", () => {
	let service: SyncService;
	let prisma: {
		$transaction: jest.Mock;
		change: { findMany: jest.Mock; findFirst: jest.Mock };
		user: { findUnique: jest.Mock };
	};
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
			user: {
				update: jest.fn().mockResolvedValue({ revisionCounter: 7 }),
				findUnique: jest.fn(),
			},
			bean: {
				create: jest.fn().mockResolvedValue({ id: 42, name: "Ethiopia" }),
				findFirst: jest.fn(),
				updateMany: jest.fn(),
			},
			brew: { create: jest.fn(), findFirst: jest.fn() },
			machine: { create: jest.fn(), findFirst: jest.fn() },
			change: {
				create: jest.fn(),
				findFirst: jest.fn(),
				findMany: jest.fn(),
			},
		};
		prisma = {
			$transaction: jest.fn((callback) => callback(tx)),
			change: { findMany: jest.fn(), findFirst: jest.fn() },
			user: { findUnique: jest.fn() },
		};
		service = new SyncService(prisma as unknown as PrismaService);
	});

	it("returns owner-scoped changes after the cursor with a next page cursor", async () => {
		const rows = [
			{
				id: 2,
				userId: 9,
				revision: 8,
				entityType: SyncedEntityType.BEAN,
				serverId: 42,
				clientId: "bean-1",
				operation: ChangeOperation.CREATE,
				accepted: true,
				payload: { id: 42, name: "Ethiopia", revision: 8 },
			},
			{
				id: 3,
				userId: 9,
				revision: 9,
				entityType: SyncedEntityType.BEAN,
				serverId: 42,
				clientId: "bean-1",
				operation: ChangeOperation.UPDATE,
				accepted: true,
				payload: { id: 42, name: "Kenya", revision: 9 },
			},
			{
				id: 4,
				userId: 9,
				revision: 10,
				entityType: SyncedEntityType.MACHINE,
				serverId: 7,
				clientId: "machine-1",
				operation: ChangeOperation.DELETE,
				accepted: true,
				payload: { id: 7, deletedAt: "2026-07-24T12:00:00.000Z", revision: 10 },
			},
		];
		tx.change.findFirst.mockResolvedValue({ revision: 8 });
		tx.user.findUnique.mockResolvedValue({ revisionCounter: 10 });
		tx.change.findMany.mockResolvedValue(rows);

		await expect(service.changes(7, 2, 9)).resolves.toEqual({
			changes: [
				{
					revision: 8,
					entityType: SyncedEntityType.BEAN,
					serverId: 42,
					clientId: "bean-1",
					operation: ChangeOperation.CREATE,
					payload: { id: 42, name: "Ethiopia", revision: 8 },
				},
				{
					revision: 9,
					entityType: SyncedEntityType.BEAN,
					serverId: 42,
					clientId: "bean-1",
					operation: ChangeOperation.UPDATE,
					payload: { id: 42, name: "Kenya", revision: 9 },
				},
			],
			nextCursor: 9,
			hasMore: true,
			fullResyncRequired: false,
		});
		const firstPage = await service.changes(7, 2, 9);
		await expect(service.changes(7, 2, 9)).resolves.toEqual(firstPage);
		tx.change.findMany.mockResolvedValue([rows[2]]);
		await expect(service.changes(9, 2, 9)).resolves.toMatchObject({
			changes: [expect.objectContaining({ revision: 10 })],
			nextCursor: 10,
			hasMore: false,
		});
		expect(tx.change.findMany).toHaveBeenCalledWith({
			where: { userId: 9, revision: { gt: 7 }, accepted: true },
			orderBy: { revision: "asc" },
			take: 3,
		});
	});

	it("returns a full-resync signal instead of partial expired history", async () => {
		tx.change.findFirst.mockResolvedValue({ revision: 8 });
		tx.user.findUnique.mockResolvedValue({ revisionCounter: 10 });

		await expect(service.changes(3, 25, 9)).resolves.toEqual({
			changes: [],
			nextCursor: null,
			hasMore: false,
			fullResyncRequired: true,
		});
		expect(tx.change.findMany).not.toHaveBeenCalled();
	});

	it("does not return changes from another workspace", async () => {
		const ownerChange = {
			revision: 4,
			entityType: SyncedEntityType.BEAN,
			serverId: 42,
			clientId: "owner-bean",
			operation: ChangeOperation.CREATE,
			payload: { id: 42, name: "Owner bean", revision: 4 },
		};
		const foreignChange = {
			...ownerChange,
			serverId: 99,
			clientId: "foreign-bean",
			payload: { id: 99, name: "Foreign bean", revision: 4 },
		};
		tx.change.findFirst.mockResolvedValue({ revision: 4 });
		tx.user.findUnique.mockResolvedValue({ revisionCounter: 4 });
		tx.change.findMany.mockImplementation(
			({ where }: { where: { userId?: number } }) =>
				Promise.resolve(where.userId === 9 ? [ownerChange] : [foreignChange]),
		);

		await expect(service.changes(3, 25, 9)).resolves.toMatchObject({
			changes: [ownerChange],
		});
		expect(tx.change.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ userId: 9 }),
			}),
		);
	});

	it("keeps a cursor at the retained-history boundary valid", async () => {
		tx.change.findFirst.mockResolvedValue({ revision: 8 });
		tx.user.findUnique.mockResolvedValue({ revisionCounter: 8 });
		tx.change.findMany.mockResolvedValue([]);

		await expect(service.changes(7, 25, 9)).resolves.toMatchObject({
			nextCursor: 7,
			fullResyncRequired: false,
		});
	});

	it("returns delete changes with their tombstone payload", async () => {
		const deletedAt = "2026-07-24T12:00:00.000Z";
		tx.change.findFirst.mockResolvedValue({ revision: 12 });
		tx.user.findUnique.mockResolvedValue({ revisionCounter: 12 });
		tx.change.findMany.mockResolvedValue([
			{
				id: 6,
				userId: 9,
				revision: 12,
				entityType: SyncedEntityType.MACHINE,
				serverId: 7,
				clientId: "machine-1",
				operation: ChangeOperation.DELETE,
				accepted: true,
				payload: { id: 7, name: "C40", deletedAt, revision: 12 },
			},
		]);

		await expect(service.changes(11, 25, 9)).resolves.toMatchObject({
			changes: [
				expect.objectContaining({
					operation: ChangeOperation.DELETE,
					payload: { id: 7, name: "C40", deletedAt, revision: 12 },
				}),
			],
		});
	});

	it("returns retained versions for one record with a retention boundary", async () => {
		const now = new Date("2026-07-24T12:00:00.000Z");
		const boundary = new Date("2026-07-17T12:00:00.000Z");
		const rows = [
			{
				id: 5,
				userId: 9,
				entityType: SyncedEntityType.BEAN,
				serverId: 42,
				clientId: "bean-1",
				revision: 8,
				operation: ChangeOperation.UPDATE,
				accepted: false,
				payload: { id: 42, name: "Ethiopia", revision: 8 },
				createdAt: new Date("2026-07-20T12:00:00.000Z"),
			},
			{
				id: 6,
				userId: 9,
				entityType: SyncedEntityType.BEAN,
				serverId: 42,
				clientId: "bean-1",
				revision: 9,
				operation: ChangeOperation.DELETE,
				accepted: true,
				payload: { id: 42, name: "Ethiopia", deletedAt: "2026-07-21" },
				createdAt: new Date("2026-07-21T12:00:00.000Z"),
			},
		];
		tx.change.findFirst.mockResolvedValue({
			revision: 8,
			createdAt: boundary,
		});
		tx.change.findMany.mockResolvedValue(rows);

		await expect(
			service.history(
				0,
				25,
				9,
				{ entityType: SyncedEntityType.BEAN, serverId: 42 },
				now,
			),
		).resolves.toEqual({
			changes: [
				{
					entityType: SyncedEntityType.BEAN,
					serverId: 42,
					clientId: "bean-1",
					revision: 8,
					operation: ChangeOperation.UPDATE,
					accepted: false,
					payload: { id: 42, name: "Ethiopia", revision: 8 },
					createdAt: rows[0].createdAt,
				},
				{
					entityType: SyncedEntityType.BEAN,
					serverId: 42,
					clientId: "bean-1",
					revision: 9,
					operation: ChangeOperation.DELETE,
					accepted: true,
					payload: { id: 42, name: "Ethiopia", deletedAt: "2026-07-21" },
					createdAt: rows[1].createdAt,
				},
			],
			nextCursor: 9,
			hasMore: false,
			retentionBoundary: boundary,
		});
		expect(tx.change.findMany).toHaveBeenCalledWith({
			where: {
				userId: 9,
				entityType: SyncedEntityType.BEAN,
				serverId: 42,
				revision: { gt: 0 },
				createdAt: { gte: boundary },
			},
			orderBy: { revision: "asc" },
			take: 26,
		});
	});

	it("excludes expired history at query time", async () => {
		const now = new Date("2026-07-24T12:00:00.000Z");
		const boundary = new Date("2026-07-17T12:00:00.000Z");
		tx.change.findFirst.mockResolvedValue({ revision: 10 });
		tx.change.findMany.mockResolvedValue([]);

		await expect(service.history(0, 25, 9, undefined, now)).resolves.toEqual({
			changes: [],
			nextCursor: 0,
			hasMore: false,
			retentionBoundary: boundary,
		});
		expect(tx.change.findMany).toHaveBeenCalledWith({
			where: {
				userId: 9,
				revision: { gt: 0 },
				createdAt: { gte: boundary },
			},
			orderBy: { revision: "asc" },
			take: 26,
		});
	});

	it("rejects a partial record filter", () => {
		expect(() =>
			service.history(0, 25, 9, {
				entityType: SyncedEntityType.BEAN,
			}),
		).toThrow("must be provided together");
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
