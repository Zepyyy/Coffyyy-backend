import { createHash, randomBytes } from "node:crypto";
import {
	HttpException,
	HttpStatus,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { SessionLifecycle, type SessionResult } from "./session-lifecycle";
import type { SessionUser } from "./types/session-user";

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_PAIR_ATTEMPTS = 10;

@Injectable()
export class WorkspaceEnrollment {
	private readonly rateLimits = new Map<string, RateLimitEntry>();

	constructor(
		private readonly prisma: PrismaService,
		private readonly sessions: SessionLifecycle,
	) {}

	async enable(
		clientKey: string,
	): Promise<SessionResult & { syncCode: string }> {
		this.checkRateLimit(`enable:${clientKey}`, 5);
		const now = new Date();
		const workspace = await this.prisma.user.create({
			data: {
				username: `workspace_${randomBytes(18).toString("hex")}`,
				password: await bcrypt.hash(randomBytes(32).toString("base64url"), 12),
			},
		});
		const session = await this.sessions.create(workspace.id, now);
		const syncCode = await this.createSyncCode(workspace.id, now);
		return { ...session, syncCode: syncCode.value };
	}

	async pair(
		clientKey: string,
		code: string | undefined,
	): Promise<SessionResult> {
		this.checkRateLimit(`pair:${clientKey}`, MAX_PAIR_ATTEMPTS);
		if (!code || code.length > 200)
			throw new UnauthorizedException("Unable to pair workspace");
		const syncCode = await this.prisma.syncCode.findUnique({
			where: { codeHash: this.hash(code) },
		});
		if (!syncCode) throw new UnauthorizedException("Unable to pair workspace");
		return this.sessions.create(syncCode.userId);
	}

	async rotateCode(user: SessionUser) {
		const syncCode = await this.createSyncCode(user.sub, new Date());
		return { syncCode: syncCode.value };
	}

	private async createSyncCode(userId: number, now: Date) {
		const value = randomBytes(32).toString("base64url");
		await this.prisma.syncCode.upsert({
			where: { userId },
			create: { userId, codeHash: this.hash(value) },
			update: { codeHash: this.hash(value), createdAt: now },
		});
		return { value };
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
		if (current.count >= limit)
			throw new HttpException(
				"Too many attempts",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		current.count += 1;
	}

	private hash(value: string) {
		return createHash("sha256").update(value).digest("hex");
	}
}
