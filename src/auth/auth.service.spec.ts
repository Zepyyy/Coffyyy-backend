import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
	let service: AuthService;
	let prisma: { session: { update: jest.Mock } };

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [AuthService, { provide: PrismaService, useValue: {} }],
		}).compile();

		service = module.get<AuthService>(AuthService);
		prisma = (service as unknown as { prisma: typeof prisma }).prisma;
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("refreshes the session CSRF hash when a session exists", async () => {
		prisma.session = { update: jest.fn().mockResolvedValue({}) };
		jest.spyOn(service, "validateSession").mockResolvedValue({
			sub: 7,
			sessionId: "session-id",
		});

		const token = await service.refreshCsrf({ headers: {} } as never);

		expect(token).toEqual(expect.any(String));
		expect(prisma.session.update).toHaveBeenCalledWith({
			where: { id: "session-id" },
			data: { csrfTokenHash: expect.any(String) },
		});
	});

	it("returns a public bootstrap token without a session", async () => {
		jest
			.spyOn(service, "validateSession")
			.mockRejectedValue(new UnauthorizedException());

		const token = await service.refreshCsrf({ headers: {} } as never);

		expect(token).toEqual(expect.any(String));
	});
});
