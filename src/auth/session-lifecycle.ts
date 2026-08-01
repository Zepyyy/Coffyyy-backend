import { createHash, randomBytes } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { getCookie, SESSION_COOKIE } from "./cookies";
import type { SessionUser } from "./types/jwt-payload";

export interface SessionResult {
	sessionToken: string;
	csrfToken: string;
	workspaceId: number;
	expiresAt: Date;
}

const SESSION_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_ABSOLUTE_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionLifecycle {
	constructor(private readonly prisma: PrismaService) {}

	async create(userId: number, now = new Date()): Promise<SessionResult> {
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

	async validate(cookieHeader: string | undefined): Promise<SessionUser> {
		const token = getCookie(cookieHeader, SESSION_COOKIE);
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
		)
			throw new UnauthorizedException("Session required");

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

	async inspect(user: SessionUser) {
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

	async logout(user: SessionUser) {
		await this.prisma.session.updateMany({
			where: { id: user.sessionId, userId: user.sub, revokedAt: null },
			data: { revokedAt: new Date() },
		});
	}

	async revokeAll(user: SessionUser) {
		await this.prisma.session.updateMany({
			where: { userId: user.sub, revokedAt: null },
			data: { revokedAt: new Date() },
		});
	}

	private hash(value: string) {
		return createHash("sha256").update(value).digest("hex");
	}
}
