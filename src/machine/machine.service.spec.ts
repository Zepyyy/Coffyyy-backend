import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { MachineService } from "./machine.service";

describe("MachineService", () => {
	let service: MachineService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [MachineService, { provide: PrismaService, useValue: {} }],
		}).compile();

		service = module.get<MachineService>(MachineService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
