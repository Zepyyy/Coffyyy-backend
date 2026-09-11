import { ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RequestProtection } from "./request-protection";
import { SessionLifecycle } from "./session-lifecycle";

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
describe("RequestProtection", () => {
	const prisma = { session: { update: jest.fn(), findUnique: jest.fn() } };
	const sessions = { validate: jest.fn() };
	const protection = new RequestProtection(
		prisma as unknown as PrismaService,
		sessions as unknown as SessionLifecycle,
	);

	it("rejects a public CSRF cookie/header mismatch", () => {
		expect(() => protection.assertPublic("coffyyy_csrf=one", "two")).toThrow(
			new ForbiddenException("CSRF validation failed"),
		);
	});

	it("refreshes a session CSRF token", async () => {
		sessions.validate.mockResolvedValue({ sub: 7, sessionId: "session-id" });
		await expect(
			protection.refreshCsrf("coffyyy_session=token"),
		).resolves.toEqual(expect.any(String));
		expect(prisma.session.update).toHaveBeenCalledWith({
			where: { id: "session-id" },
			data: { csrfTokenHash: expect.any(String) },
		});
	});
});
