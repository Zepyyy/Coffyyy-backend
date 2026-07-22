import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { MachineService } from "./machine.service";

describe("MachineService", () => {
	let service: MachineService;
	let prisma: {
		machine: {
			findMany: jest.Mock;
			findFirst: jest.Mock;
			update: jest.Mock;
			delete: jest.Mock;
		};
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [MachineService, { provide: PrismaService, useValue: {} }],
		}).compile();

		service = module.get<MachineService>(MachineService);
		prisma = (service as unknown as { prisma: typeof prisma }).prisma;
		prisma.machine = {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("excludes soft-deleted machines from findAll", async () => {
		prisma.machine.findMany.mockResolvedValue([]);

		await service.findAll(1);

		expect(prisma.machine.findMany).toHaveBeenCalledWith({
			where: { userId: 1, deletedAt: null },
			orderBy: { createdAt: "desc" },
		});
	});

	it("excludes soft-deleted machines from findOne", async () => {
		prisma.machine.findFirst.mockResolvedValue(null);

		await expect(service.findOne(1, 1)).rejects.toThrow(NotFoundException);

		expect(prisma.machine.findFirst).toHaveBeenCalledWith({
			where: { id: 1, userId: 1, deletedAt: null },
		});
	});

	it("soft-deletes instead of removing the row", async () => {
		prisma.machine.findFirst.mockResolvedValue({ id: 1, userId: 1 });
		prisma.machine.update.mockResolvedValue({ id: 1, deletedAt: new Date() });

		await service.remove(1, 1);

		expect(prisma.machine.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { deletedAt: expect.any(Date) },
		});
		expect(prisma.machine.delete).not.toHaveBeenCalled();
	});
});
