import { Test, TestingModule } from "@nestjs/testing";
import { BeansController } from "./beans.controller";
import { BeansService } from "./beans.service";

describe("BeansController", () => {
	let controller: BeansController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [BeansController],
			providers: [BeansService],
		}).compile();

		controller = module.get<BeansController>(BeansController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
