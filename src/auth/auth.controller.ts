import { randomBytes } from "node:crypto";
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService, type SyncRequest } from "./auth.service";
import {
	clearSessionCookies,
	setCsrfCookie,
	setSessionCookies,
} from "./cookies";
import { Public } from "./public.decorator";
import type { AuthenticatedRequest } from "./types/jwt-payload";

const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Route contract: public CSRF/bootstrap and pairing; session required for state and mutations.
// No username/password login or signup routes exist by design.
@Controller("auth")
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	// Bootstrap token lets browser send CSRF-protected enable/pair requests.
	@Public()
	@Get("sync/csrf")
    getCsrf(@Res({ passthrough: true }) response: Response) {
        const csrfToken = randomBytes(32).toString("base64url");
		setCsrfCookie(
			response,
			csrfToken,
			SESSION_COOKIE_MAX_AGE_SECONDS,
		);
		return { csrfRequired: true, csrfToken };
	}

	// Enable creates internal owner, session cookie, and one copyable sync code.
	@Public()
	@Post("sync/enable")
	async enableSync(
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response,
	) {
		this.authService.assertPublicCsrf(request);
		const session = await this.authService.enableSync(request);
		setSessionCookies(
			response,
			session.sessionToken,
			session.csrfToken,
			SESSION_COOKIE_MAX_AGE_SECONDS,
		);
		return {
			workspaceId: session.workspaceId,
			syncCode: session.syncCode,
            syncCodeExpiresAt: session.syncCodeExpiresAt,
			csrfToken: session.csrfToken,
		};
	}

	// Pair accepts code once per browser; code remains server-side hashed.
	@Public()
	@Post("sync/pair")
	async pair(
		@Body() body: SyncRequest,
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response,
	) {
		this.authService.assertPublicCsrf(request);
		const session = await this.authService.pair(request, body?.code);
		setSessionCookies(
			response,
			session.sessionToken,
			session.csrfToken,
			SESSION_COOKIE_MAX_AGE_SECONDS,
		);
		return {
			connected: true,
			workspaceId: session.workspaceId,
            expiresAt: session.expiresAt,
			csrfToken: session.csrfToken,
		};
	}

	// Guard resolves current workspace from HttpOnly session cookie.
	@Get("sync/session")
	getSession(@Req() request: AuthenticatedRequest) {
		return this.authService.getSession(request.user);
	}

	// Logout revokes only current session; revoke endpoint below handles all sessions.
	@HttpCode(HttpStatus.NO_CONTENT)
	@Post("sync/logout")
	async logout(
		@Req() request: AuthenticatedRequest,
		@Res({ passthrough: true }) response: Response,
	) {
		await this.authService.logout(request.user);
		clearSessionCookies(response);
	}

	// Rotation invalidates previous code through the per-workspace unique row.
	@Post("sync/code/rotate")
	rotateCode(@Req() request: AuthenticatedRequest) {
		return this.authService.rotateSyncCode(request.user);
	}

	// Revoke all sessions, then clear current browser cookies.
	@HttpCode(HttpStatus.NO_CONTENT)
	@Post("sync/sessions/revoke")
	async revokeSessions(
		@Req() request: AuthenticatedRequest,
		@Res({ passthrough: true }) response: Response,
	) {
		await this.authService.revokeAllSessions(request.user);
		clearSessionCookies(response);
	}
}
