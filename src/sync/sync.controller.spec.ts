import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "../auth/auth.service";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

describe("SyncController", () => {
	let controller: SyncController;
	const syncService = { changes: jest.fn(), history: jest.fn() };
	const authService = { assertCsrf: jest.fn() };

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [SyncController],
			providers: [
				{ provide: SyncService, useValue: syncService },
				{ provide: AuthService, useValue: authService },
			],
		}).compile();

		controller = module.get<SyncController>(SyncController);
		syncService.changes.mockReset();
		syncService.history.mockReset();
		authService.assertCsrf.mockReset();
	});

	it("gets changes for the authenticated workspace", async () => {
		const result = { changes: [], nextSince: 7, hasMore: false };
		const request = { user: { sub: 9 } };
		syncService.changes.mockResolvedValue(result);

		await expect(controller.changes(7, 25, request as never)).resolves.toBe(
			result,
		);
		expect(authService.assertCsrf).toHaveBeenCalledWith(request, request.user);
		expect(syncService.changes).toHaveBeenCalledWith(7, 25, 9);
	});

	it("gets recoverable history for the authenticated workspace", async () => {
		const result = {
			changes: [{ accepted: false }],
			nextSince: 8,
			hasMore: false,
		};
		const request = { user: { sub: 9 } };
		syncService.history.mockResolvedValue(result);

		await expect(
			controller.history(7, 25, "BEAN", "42", request as never),
		).resolves.toBe(result);
		expect(authService.assertCsrf).toHaveBeenCalledWith(request, request.user);
		expect(syncService.history).toHaveBeenCalledWith(7, 25, 9, {
			entityType: "BEAN",
			serverId: 42,
		});
	});
});
