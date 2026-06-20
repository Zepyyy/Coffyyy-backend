import { Test, TestingModule } from "@nestjs/testing";
import { BeansService } from "./beans.service";

describe("BeansService", () => {
	let service: BeansService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [BeansService],
		}).compile();

		service = module.get<BeansService>(BeansService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
