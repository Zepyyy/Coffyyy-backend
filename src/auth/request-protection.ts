import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CSRF_COOKIE, getCookie } from "./cookies";
import { SessionLifecycle } from "./session-lifecycle";
import type { SessionUser } from "./types/jwt-payload";

@Injectable()
export class RequestProtection {
	constructor(
		private readonly prisma: PrismaService,
		private readonly sessions: SessionLifecycle,
	) {}

	async refreshCsrf(cookieHeader: string | undefined) {
		try {
			const user = await this.sessions.validate(cookieHeader);
			const csrfToken = randomBytes(32).toString("base64url");
			await this.prisma.session.update({
				where: { id: user.sessionId },
				data: { csrfTokenHash: this.hash(csrfToken) },
			});
			return csrfToken;
		} catch (error) {
			if (!(error instanceof UnauthorizedException)) throw error;
			return randomBytes(32).toString("base64url");
		}
	}

	async assertMutation(
		cookieHeader: string | undefined,
		headerValue: string | string[] | undefined,
		user: SessionUser,
	) {
		this.assertTokens(cookieHeader, headerValue);
		const headerToken = this.firstHeaderValue(headerValue);
		if (!headerToken) throw new ForbiddenException("CSRF validation failed");
		const session = await this.prisma.session.findUnique({
			where: { id: user.sessionId },
		});
		if (
			!session ||
			session.revokedAt ||
			!this.matchesHash(headerToken, session.csrfTokenHash)
		)
			throw new ForbiddenException("CSRF validation failed");
	}

	assertPublic(
		cookieHeader: string | undefined,
		headerValue: string | string[] | undefined,
	) {
		this.assertTokens(cookieHeader, headerValue);
	}

	private assertTokens(
		cookieHeader: string | undefined,
		headerValue: string | string[] | undefined,
	) {
		const cookieToken = getCookie(cookieHeader, CSRF_COOKIE);
		const headerToken = this.firstHeaderValue(headerValue);
		if (!cookieToken || !headerToken || cookieToken !== headerToken)
			throw new ForbiddenException("CSRF validation failed");
	}

	private firstHeaderValue(value: string | string[] | undefined) {
		return Array.isArray(value) ? value[0] : value;
	}

	private hash(value: string) {
		return createHash("sha256").update(value).digest("hex");
	}

	private matchesHash(value: string, expectedHash: string) {
		const actual = Buffer.from(this.hash(value), "utf8");
		const expected = Buffer.from(expectedHash, "utf8");
		return (
			actual.length === expected.length && timingSafeEqual(actual, expected)
		);
	}
}
