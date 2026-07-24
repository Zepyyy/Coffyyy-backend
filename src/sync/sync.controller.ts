import {
	Body,
	Controller,
	DefaultValuePipe,
	Get,
	ParseIntPipe,
	Post,
	Query,
	Req,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import type { AuthenticatedRequest } from "../auth/types/jwt-payload";
import { PushOperationDto } from "./dto/push-operation.dto";
import { SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
	constructor(
		private readonly syncService: SyncService,
		private readonly authService: AuthService,
	) {}

	@Get("changes")
	async changes(
		@Query("since", new DefaultValuePipe(0), ParseIntPipe) since: number,
		@Query("limit", new DefaultValuePipe(100), ParseIntPipe) limit: number,
		@Req() req: AuthenticatedRequest,
	) {
		await this.authService.assertCsrf(req, req.user);
		return this.syncService.changes(since, limit, req.user.sub);
	}

	@Get("history")
	async history(
		@Query("since", new DefaultValuePipe(0), ParseIntPipe) since: number,
		@Query("limit", new DefaultValuePipe(100), ParseIntPipe) limit: number,
		@Req() req: AuthenticatedRequest,
	) {
		await this.authService.assertCsrf(req, req.user);
		return this.syncService.history(since, limit, req.user.sub);
	}

	@Post("push")
	push(
		@Body() dto: PushOperationDto | PushOperationDto[],
		@Req() req: AuthenticatedRequest,
	) {
		return this.syncService.push(dto, req.user.sub);
	}
}
