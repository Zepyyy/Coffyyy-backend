import { Request as ExpressRequest } from "express";

export interface SessionUser {
	sub: number;
	sessionId: string;
}

export interface AuthenticatedRequest extends ExpressRequest {
	user: SessionUser;
}
