import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { BeanService } from "./bean.service";

describe("BeanService", () => {
	let service: BeanService;
	let prisma: {
		bean: {
			findMany: jest.Mock;
			findFirst: jest.Mock;
			update: jest.Mock;
			delete: jest.Mock;
		};
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [BeanService, { provide: PrismaService, useValue: {} }],
		}).compile();

		service = module.get<BeanService>(BeanService);
		prisma = (service as unknown as { prisma: typeof prisma }).prisma;
		prisma.bean = {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("excludes soft-deleted beans from findAll", async () => {
		prisma.bean.findMany.mockResolvedValue([]);

		await service.findAll(1);

		expect(prisma.bean.findMany).toHaveBeenCalledWith({
			where: { userId: 1, deletedAt: null },
			orderBy: { createdAt: "desc" },
		});
	});

	it("excludes soft-deleted beans from findOne", async () => {
		prisma.bean.findFirst.mockResolvedValue(null);

		await expect(service.findOne(1, 1)).rejects.toThrow(NotFoundException);

		expect(prisma.bean.findFirst).toHaveBeenCalledWith({
			where: { id: 1, userId: 1, deletedAt: null },
		});
	});

	it("soft-deletes instead of removing the row", async () => {
		prisma.bean.findFirst.mockResolvedValue({ id: 1, userId: 1 });
		prisma.bean.update.mockResolvedValue({ id: 1, deletedAt: new Date() });

		await service.remove(1, 1);

		expect(prisma.bean.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { deletedAt: expect.any(Date) },
		});
		expect(prisma.bean.delete).not.toHaveBeenCalled();
	});
});
