import { ConflictException } from "@nestjs/common";
import { ChangeOperation, SyncedEntityType } from "../generated/prisma/enums";
import { PrismaService } from "../prisma/prisma.service";
import { SyncService } from "./sync.service";

describe("SyncService", () => {
	let service: SyncService;
	let prisma: { $transaction: jest.Mock };
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
		bean: { create: jest.fn().mockResolvedValue({ id: 42, name: "Ethiopia" }) },
		brew: { create: jest.fn() },
		machine: { create: jest.fn() },
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

		expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
			where: { id: 9 },
			data: { revisionCounter: { increment: 1 } },
		}));
		expect(tx.change.create).toHaveBeenCalledTimes(1);
		expect(tx.pushOperation.create).toHaveBeenCalledTimes(1);
	});

	it("replays an identical operation without writing again", async () => {
		const original = { operationId: "op-1", status: "applied", serverId: 42, revision: 7 };
		tx.pushOperation.findUnique.mockResolvedValue({ payloadHash: expect.any(String), result: original });
		const hash = (service as any).hash({
			entityType: dto.entityType, operation: dto.operation, clientId: dto.clientId,
			serverId: undefined, payload: dto.payload,
		});
		tx.pushOperation.findUnique.mockResolvedValue({ payloadHash: hash, result: original });

		await expect(service.push(dto, 9)).resolves.toEqual(original);
		expect(tx.user.update).not.toHaveBeenCalled();
		expect(tx.bean.create).not.toHaveBeenCalled();
	});

	it("rejects a reused operation id with a different payload", async () => {
		tx.pushOperation.findUnique.mockResolvedValue({ payloadHash: "different", result: {} });

		await expect(service.push(dto, 9)).rejects.toBeInstanceOf(ConflictException);
		expect(tx.user.update).not.toHaveBeenCalled();
		expect(tx.bean.create).not.toHaveBeenCalled();
	});
});
