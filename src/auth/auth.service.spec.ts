import { createHash } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
	let service: AuthService;
	let prisma: {
		session: { update: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
		syncCode: { findUnique: jest.Mock; upsert: jest.Mock };
		user: { create: jest.Mock };
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [AuthService, { provide: PrismaService, useValue: {} }],
		}).compile();

		service = module.get<AuthService>(AuthService);
		prisma = (service as unknown as { prisma: typeof prisma }).prisma;
		prisma.session = {
			update: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn().mockResolvedValue({}),
		};
		prisma.syncCode = { findUnique: jest.fn(), upsert: jest.fn() };
		prisma.user = { create: jest.fn() };
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("refreshes the session CSRF hash when a session exists", async () => {
		prisma.session.update = jest.fn().mockResolvedValue({});
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

	it("pairs repeatedly with the same permanent code and workspace", async () => {
		const code = "permanent-code";
		prisma.syncCode.findUnique.mockResolvedValue({ userId: 7 });

		const first = await service.pair({ ip: "test" } as never, code);
		const second = await service.pair({ ip: "test" } as never, code);

		expect(first.workspaceId).toBe(7);
		expect(second.workspaceId).toBe(7);
		expect(prisma.syncCode.findUnique).toHaveBeenCalledWith({
			where: {
				codeHash: createHash("sha256").update(code).digest("hex"),
			},
		});
		expect(prisma.session.create).toHaveBeenCalledTimes(2);
		expect(prisma.user.create).not.toHaveBeenCalled();
	});

	it("stores only a hash when creating a sync code", async () => {
		const value = await (
			service as unknown as {
				createSyncCode: (
					userId: number,
					now: Date,
				) => Promise<{ value: string }>;
			}
		).createSyncCode(7, new Date("2026-07-31T00:00:00Z"));

		expect(value.value).toEqual(expect.any(String));
		expect(prisma.syncCode.upsert).toHaveBeenCalledWith({
			where: { userId: 7 },
			create: { userId: 7, codeHash: expect.any(String) },
			update: {
				codeHash: expect.any(String),
				createdAt: new Date("2026-07-31T00:00:00Z"),
			},
		});
		const args = prisma.syncCode.upsert.mock.calls[0][0] as {
			create: { codeHash: string };
		};
		expect(args.create.codeHash).not.toBe(value.value);
	});

	it("does not reject a code based on a legacy expiry value", async () => {
		prisma.syncCode.findUnique.mockResolvedValue({
			userId: 11,
			expiresAt: new Date(0),
		});

		await expect(
			service.pair({ ip: "test" } as never, "old-code"),
		).resolves.toEqual(expect.objectContaining({ workspaceId: 11 }));
	});

	it("rejects invalid pairing codes", async () => {
		prisma.syncCode.findUnique.mockResolvedValue(null);

		await expect(
			service.pair({ ip: "test" } as never, "invalid"),
		).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it("allows pairing after the current session expires", async () => {
		prisma.session.findUnique.mockResolvedValue({
			revokedAt: null,
			expiresAt: new Date(0),
			absoluteExpiresAt: new Date(0),
		});
		prisma.syncCode.findUnique.mockResolvedValue({ userId: 19 });

		await expect(
			service.validateSession({
				headers: { cookie: "coffyyy_session=expired" },
			} as never),
		).rejects.toBeInstanceOf(UnauthorizedException);
		await expect(
			service.pair({ ip: "test" } as never, "saved-code"),
		).resolves.toEqual(expect.objectContaining({ workspaceId: 19 }));
	});
});
