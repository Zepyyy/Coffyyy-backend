import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { RequestProtection } from "./request-protection";
import { SessionLifecycle } from "./session-lifecycle";
import { WorkspaceEnrollment } from "./workspace-enrollment";

describe("AuthController", () => {
	let controller: AuthController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{ provide: RequestProtection, useValue: {} },
				{ provide: SessionLifecycle, useValue: {} },
				{ provide: WorkspaceEnrollment, useValue: {} },
				{ provide: AuthGuard, useValue: {} },
			],
		}).compile();

		controller = module.get<AuthController>(AuthController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
