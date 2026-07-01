import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request as ExpressRequest } from "express";
import { AuthenticatedRequest, JwtPayload } from "./types/jwt-payload";

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(private readonly jwtService: JwtService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const token = this.extractTokenFromHeader(request);
		if (!token) {
			throw new UnauthorizedException("No Token");
		}
		try {
			// 💡 Here the JWT secret key that's used for verifying the payload
			// is the key that was passed in the JwtModule
			const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
			// 💡 We're assigning the payload to the request object here
			// so that we can access it in our route handlers
			request.user = payload;
		} catch {
			throw new UnauthorizedException("Invalid Token");
		}
		return true;
	}

	private extractTokenFromHeader(request: ExpressRequest): string | undefined {
		const [type, token] = request.headers.authorization?.split(" ") ?? [];
		return type === "Bearer" ? token : undefined;
	}
}
