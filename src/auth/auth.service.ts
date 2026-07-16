import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { CSRF_COOKIE, getCookie, SESSION_COOKIE } from "./cookies";
import type { SessionUser } from "./types/jwt-payload";

export interface SyncRequest {
	code?: string;
}

export interface SessionResult {
	sessionToken: string;
	csrfToken: string;
	workspaceId: number;
	expiresAt: Date;
}

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const SESSION_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_ABSOLUTE_MS = 90 * 24 * 60 * 60 * 1000;
const SYNC_CODE_TTL_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_PAIR_ATTEMPTS = 10;

@Injectable()
export class AuthService {
	private readonly rateLimits = new Map<string, RateLimitEntry>();

	constructor(private readonly prisma: PrismaService) {}

	async enableSync(
		request: Request,
	): Promise<SessionResult & { syncCode: string; syncCodeExpiresAt: Date }> {
		this.checkRateLimit(`enable:${this.clientKey(request)}`, 5);
		const now = new Date();
		// User remains internal workspace owner; random password cannot start public auth.
		const workspace = await this.prisma.user.create({
			data: {
				username: `workspace_${randomBytes(18).toString("hex")}`,
				password: await bcrypt.hash(randomBytes(32).toString("base64url"), 12),
			},
		});

		const session = await this.createSession(workspace.id, now);
		const syncCode = await this.createSyncCode(workspace.id, now);
		return {
			...session,
			syncCode: syncCode.value,
			syncCodeExpiresAt: syncCode.expiresAt,
		};
	}

	async pair(
		request: Request,
		code: string | undefined,
	): Promise<SessionResult> {
		// Rate-limit before lookup so invalid codes cannot become an oracle or DB flood.
		this.checkRateLimit(`pair:${this.clientKey(request)}`, MAX_PAIR_ATTEMPTS);
		if (!code || code.length > 200)
			throw new UnauthorizedException("Unable to pair workspace");

		const syncCode = await this.prisma.syncCode.findUnique({
			where: { codeHash: this.hash(code) },
		});
		if (!syncCode || syncCode.expiresAt <= new Date()) {
			throw new UnauthorizedException("Unable to pair workspace");
		}

		return this.createSession(syncCode.userId, new Date());
	}

	async validateSession(request: Request): Promise<SessionUser> {
		// Cookie contains bearer secret; database stores only its SHA-256 digest.
		const token = getCookie(request.headers.cookie, SESSION_COOKIE);
		if (!token) throw new UnauthorizedException("Session required");

		const session = await this.prisma.session.findUnique({
			where: { tokenHash: this.hash(token) },
		});
		const now = new Date();
		if (
			!session ||
			session.revokedAt ||
			session.expiresAt <= now ||
			session.absoluteExpiresAt <= now
		) {
			throw new UnauthorizedException("Session required");
		}

		const expiresAt = new Date(
			Math.min(
				now.getTime() + SESSION_IDLE_MS,
				session.absoluteExpiresAt.getTime(),
			),
		);
		await this.prisma.session.update({
			where: { id: session.id },
			data: { lastSeenAt: now, expiresAt },
		});
		return { sub: session.userId, sessionId: session.id };
	}

	async getSession(user: SessionUser) {
		const session = await this.prisma.session.findUnique({
			where: { id: user.sessionId },
		});
		if (!session || session.revokedAt)
			throw new UnauthorizedException("Session required");
		return {
			authenticated: true,
			workspaceId: user.sub,
			expiresAt: session.expiresAt,
			absoluteExpiresAt: session.absoluteExpiresAt,
		};
	}

	async rotateSyncCode(user: SessionUser) {
		const syncCode = await this.createSyncCode(user.sub, new Date());
		return { syncCode: syncCode.value, expiresAt: syncCode.expiresAt };
	}

	async logout(user: SessionUser) {
		await this.prisma.session.updateMany({
			where: { id: user.sessionId, userId: user.sub, revokedAt: null },
			data: { revokedAt: new Date() },
		});
	}

	async revokeAllSessions(user: SessionUser) {
		await this.prisma.session.updateMany({
			where: { userId: user.sub, revokedAt: null },
			data: { revokedAt: new Date() },
		});
	}

	async assertCsrf(request: Request, user: SessionUser) {
		this.assertCsrfTokens(request);
		const headerToken = this.headerValue(request.headers["x-csrf-token"]);
		if (!headerToken) throw new ForbiddenException("CSRF validation failed");
		return await this.prisma.session
			.findUnique({ where: { id: user.sessionId } })
			.then((session) => {
				if (
					!session ||
					session.revokedAt ||
					!this.matchesHash(headerToken, session.csrfTokenHash)
				) {
					throw new ForbiddenException("CSRF validation failed");
				}
			});
	}

	assertPublicCsrf(request: Request) {
		this.assertCsrfTokens(request);
	}

	private async createSession(
		userId: number,
		now: Date,
	): Promise<SessionResult> {
		// Plaintext token exists only in memory long enough to set HttpOnly cookie.
		const sessionToken = randomBytes(32).toString("base64url");
		const csrfToken = randomBytes(32).toString("base64url");
		const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
		const expiresAt = new Date(
			Math.min(now.getTime() + SESSION_IDLE_MS, absoluteExpiresAt.getTime()),
		);

		await this.prisma.session.create({
			data: {
				tokenHash: this.hash(sessionToken),
				csrfTokenHash: this.hash(csrfToken),
				userId,
				expiresAt,
				absoluteExpiresAt,
			},
		});
		return { sessionToken, csrfToken, workspaceId: userId, expiresAt };
	}

	private async createSyncCode(userId: number, now: Date) {
		// Return plaintext once for copy/paste; persist hash only.
		const value = randomBytes(32).toString("base64url");
		const expiresAt = new Date(now.getTime() + SYNC_CODE_TTL_MS);
		await this.prisma.syncCode.upsert({
			where: { userId },
			create: { userId, codeHash: this.hash(value), expiresAt },
			update: { codeHash: this.hash(value), createdAt: now, expiresAt },
		});
		return { value, expiresAt };
	}

	private checkRateLimit(key: string, limit: number) {
		const now = Date.now();
		const current = this.rateLimits.get(key);
		if (!current || current.resetAt <= now) {
			this.rateLimits.set(key, {
				count: 1,
				resetAt: now + RATE_LIMIT_WINDOW_MS,
			});
			return;
		}
		if (current.count >= limit) {
			throw new HttpException(
				"Too many attempts",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}
		current.count += 1;
	}

	private clientKey(request: Request) {
		return request.ip || request.socket.remoteAddress || "unknown";
	}

	private assertCsrfTokens(request: Request) {
		const cookieToken = getCookie(request.headers.cookie, CSRF_COOKIE);
		const headerToken = this.headerValue(request.headers["x-csrf-token"]);
		if (!cookieToken || !headerToken || cookieToken !== headerToken) {
			throw new ForbiddenException("CSRF validation failed");
		}
	}

	private headerValue(value: string | string[] | undefined) {
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
