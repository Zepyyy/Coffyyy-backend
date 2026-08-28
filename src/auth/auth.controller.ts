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
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
import type { Request, Response } from "express";
import {
	clearSessionCookies,
	setCsrfCookie,
	setSessionCookies,
} from "./cookies";
import { SyncRequestDto } from "./dto/sync-request.dto";
import { Public } from "./public.decorator";
import { RequestProtection } from "./request-protection";
import { SessionLifecycle } from "./session-lifecycle";
import type { AuthenticatedRequest } from "./types/session-user";
import { WorkspaceEnrollment } from "./workspace-enrollment";

const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Route contract: public CSRF/bootstrap and pairing; session required for state and mutations.
// No username/password login or signup routes exist by design.
@Controller("auth")
export class AuthController {
	constructor(
		private readonly protection: RequestProtection,
		private readonly sessions: SessionLifecycle,
		private readonly enrollment: WorkspaceEnrollment,
	) {}

	// Bootstrap public token, or refresh the token for an existing session.
	@Public()
	@Get("sync/csrf")
	async getCsrf(
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response,
	) {
		const csrfToken = await this.protection.refreshCsrf(request.headers.cookie);
		setCsrfCookie(response, csrfToken, SESSION_COOKIE_MAX_AGE_SECONDS);
		return { csrfRequired: true, csrfToken };
	}

	// Enable creates internal owner, session cookie, and one copyable sync code.
	@Public()
	@Post("sync/enable")
	@ApiOperation({ summary: "Create a workspace and permanent sync code" })
	@ApiResponse({ status: 201, description: "Workspace enrollment created" })
	async enableSync(
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response,
	) {
		this.protection.assertPublic(
			request.headers.cookie,
			request.headers["x-csrf-token"],
		);
		const session = await this.enrollment.enable(this.clientKey(request));
		setSessionCookies(
			response,
			session.sessionToken,
			session.csrfToken,
			SESSION_COOKIE_MAX_AGE_SECONDS,
		);
		return {
			workspaceId: session.workspaceId,
			syncCode: session.syncCode,
			csrfToken: session.csrfToken,
		};
	}

	// Pair accepts the reusable code in any browser; code remains server-side hashed.
	@Public()
	@Post("sync/pair")
	@ApiOperation({
		summary: "Reconnect to an existing workspace",
		description:
			"Reusable sync codes do not expire. Pairing creates a new session for the existing workspace.",
	})
	@ApiResponse({
		status: 201,
		description: "Existing workspace session created",
	})
	async pair(
		@Body() body: SyncRequestDto,
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response,
	) {
		this.protection.assertPublic(
			request.headers.cookie,
			request.headers["x-csrf-token"],
		);
		const session = await this.enrollment.pair(
			this.clientKey(request),
			body?.code,
		);
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
		return this.sessions.inspect(request.user);
	}

	// Logout revokes only current session; revoke endpoint below handles all sessions.
	@HttpCode(HttpStatus.NO_CONTENT)
	@Post("sync/logout")
	async logout(
		@Req() request: AuthenticatedRequest,
		@Res({ passthrough: true }) response: Response,
	) {
		await this.sessions.logout(request.user);
		clearSessionCookies(response);
	}

	// Rotation invalidates previous code through the per-workspace unique row.
	@Post("sync/code/rotate")
	@ApiOperation({ summary: "Explicitly replace the reusable sync code" })
	rotateCode(@Req() request: AuthenticatedRequest) {
		return this.enrollment.rotateCode(request.user);
	}

	// Revoke all sessions, then clear current browser cookies.
	@HttpCode(HttpStatus.NO_CONTENT)
	@Post("sync/sessions/revoke")
	async revokeSessions(
		@Req() request: AuthenticatedRequest,
		@Res({ passthrough: true }) response: Response,
	) {
		await this.sessions.revokeAll(request.user);
		clearSessionCookies(response);
	}

	private clientKey(request: Request) {
		return request.ip || request.socket.remoteAddress || "unknown";
	}
}
