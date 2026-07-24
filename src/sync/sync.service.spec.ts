import { BadRequestException, ConflictException } from "@nestjs/common";
import { ChangeOperation, SyncedEntityType } from "../generated/prisma/enums";
import { PrismaService } from "../prisma/prisma.service";
import { SyncService } from "./sync.service";

describe("SyncService", () => {
	let service: SyncService;
	let prisma: { $transaction: jest.Mock };
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
			},
			brew: { create: jest.fn(), findFirst: jest.fn() },
			machine: { create: jest.fn(), findFirst: jest.fn() },
			change: { create: jest.fn() },
		};
		prisma = { $transaction: jest.fn((callback) => callback(tx)) };
		service = new SyncService(prisma as unknown as PrismaService);
	});

	it("applies a create, records one change, and increments revision", async () => {
		await expect(service.push(dto, 9)).resolves.toEqual({
			operationId: "op-1",
			status: "applied",
			serverId: 42,
			revision: 7,
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

	it("applies an ordered batch and resolves create dependencies", async () => {
		const brew = {
			...dto,
			operationId: "op-2",
			entityType: SyncedEntityType.BREW,
			clientId: "brew-1",
			payload: { beanId: "local-1", machineId: 8, date: "2026-07-24" },
		};
		tx.bean.create.mockResolvedValue({ id: 42, name: "Ethiopia" });
		tx.machine.findFirst.mockResolvedValue({ id: 8 });
		tx.bean.findFirst.mockResolvedValue({ id: 42 });
		tx.brew.create.mockResolvedValue({ id: 43 });
		tx.user.update
			.mockResolvedValueOnce({ revisionCounter: 7 })
			.mockResolvedValueOnce({ revisionCounter: 8 });

		await expect(service.push([dto, brew], 9)).resolves.toEqual([
			{ operationId: "op-1", status: "applied", serverId: 42, revision: 7 },
			{ operationId: "op-2", status: "applied", serverId: 43, revision: 8 },
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
		const first = { operationId: "op-1", status: "applied", serverId: 42, revision: 7 };
		const second = { operationId: "op-2", status: "applied", serverId: 43, revision: 8 };
		const existing = (operation: typeof dto, result: typeof first) => ({
			payloadHash: (service as any).payloadHash(operation),
			result,
		});
		tx.pushOperation.findUnique
			.mockResolvedValueOnce(existing(dto, first))
			.mockResolvedValueOnce(existing(brew, second));

		await expect(service.push([dto, brew], 9)).resolves.toEqual([first, second]);
		expect(tx.user.update).not.toHaveBeenCalled();
		expect(tx.bean.create).not.toHaveBeenCalled();
	});
});
