import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { RequestProtection } from "./request-protection";
import { SessionLifecycle } from "./session-lifecycle";
import type { AuthenticatedRequest } from "./types/session-user";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly protection: RequestProtection,
		private readonly sessions: SessionLifecycle,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Only explicit @Public routes bypass session authentication.
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (isPublic) return true;

		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		try {
			// Session sub becomes sole owner source for every protected controller.
			request.user = await this.sessions.validate(request.headers.cookie);
			if (MUTATING_METHODS.has(request.method)) {
				// Cookies authenticate; header token blocks cross-site mutations.
				await this.protection.assertMutation(
					request.headers.cookie,
					request.headers["x-csrf-token"],
					request.user,
				);
			}
			return true;
		} catch (error) {
			if (
				error instanceof UnauthorizedException ||
				error instanceof ForbiddenException
			)
				throw error;
			throw new UnauthorizedException("Session required");
		}
	}
}
