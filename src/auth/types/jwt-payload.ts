import { Request as ExpressRequest } from "express";

export interface JwtPayload {
	sub: number;
	username: string;
	iat?: number;
	exp?: number;
}

export interface AuthenticatedRequest extends ExpressRequest {
	user: JwtPayload;
}
