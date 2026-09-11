import { UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SessionLifecycle } from "./session-lifecycle";

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
describe("SessionLifecycle", () => {
	const prisma = {
		session: {
			create: jest.fn(),
			findUnique: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn(),
		},
	};
	const sessions = new SessionLifecycle(prisma as unknown as PrismaService);

	beforeEach(() => jest.clearAllMocks());

	it("creates hashed session credentials", async () => {
		const result = await sessions.create(7, new Date("2026-08-01T00:00:00Z"));
		expect(result).toEqual(
			expect.objectContaining({
				workspaceId: 7,
				sessionToken: expect.any(String),
			}),
		);
		expect(prisma.session.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				userId: 7,
				tokenHash: expect.any(String),
				csrfTokenHash: expect.any(String),
			}),
		});
	});

	it("rejects expired sessions", async () => {
		prisma.session.findUnique.mockResolvedValue({
			revokedAt: null,
			expiresAt: new Date(0),
			absoluteExpiresAt: new Date(0),
		});
		await expect(
			sessions.validate("coffyyy_session=expired"),
		).rejects.toBeInstanceOf(UnauthorizedException);
	});
});
