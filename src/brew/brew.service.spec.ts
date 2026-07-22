import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { BrewService } from "./brew.service";

describe("BrewService", () => {
	let service: BrewService;
	let prisma: {
		brew: {
			findMany: jest.Mock;
			findFirst: jest.Mock;
			update: jest.Mock;
			delete: jest.Mock;
		};
		bean: { findFirst: jest.Mock };
		machine: { findFirst: jest.Mock };
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [BrewService, { provide: PrismaService, useValue: {} }],
		}).compile();

		service = module.get<BrewService>(BrewService);
		prisma = (service as unknown as { prisma: typeof prisma }).prisma;
		prisma.brew = {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};
		prisma.bean = { findFirst: jest.fn() };
		prisma.machine = { findFirst: jest.fn() };
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("excludes soft-deleted brews from findAll", async () => {
		prisma.brew.findMany.mockResolvedValue([]);

		await service.findAll(1);

		expect(prisma.brew.findMany).toHaveBeenCalledWith({
			where: { userId: 1, deletedAt: null },
			orderBy: { date: "desc" },
		});
	});

	it("excludes soft-deleted brews from findOne", async () => {
		prisma.brew.findFirst.mockResolvedValue(null);

		await expect(service.findOne(1, 1)).rejects.toThrow(NotFoundException);

		expect(prisma.brew.findFirst).toHaveBeenCalledWith({
			where: { id: 1, userId: 1, deletedAt: null },
		});
	});

	it("soft-deletes instead of removing the row", async () => {
		prisma.brew.findFirst.mockResolvedValue({ id: 1, userId: 1 });
		prisma.brew.update.mockResolvedValue({ id: 1, deletedAt: new Date() });

		await service.remove(1, 1);

		expect(prisma.brew.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { deletedAt: expect.any(Date) },
		});
		expect(prisma.brew.delete).not.toHaveBeenCalled();
	});

	it("refuses to create a brew against a soft-deleted bean or machine", async () => {
		prisma.bean.findFirst.mockResolvedValue(null);
		prisma.machine.findFirst.mockResolvedValue({ id: 2, userId: 1 });

		await expect(
			service.create(
				{ beanId: 1, machineId: 2, date: "2026-07-22" } as never,
				1,
			),
		).rejects.toThrow(NotFoundException);

		expect(prisma.bean.findFirst).toHaveBeenCalledWith({
			where: { id: 1, userId: 1, deletedAt: null },
		});
		expect(prisma.machine.findFirst).toHaveBeenCalledWith({
			where: { id: 2, userId: 1, deletedAt: null },
		});
	});
});
