import { Body, Controller, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/types/jwt-payload";
import { PushOperationDto } from "./dto/push-operation.dto";
import { SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
	constructor(private readonly syncService: SyncService) {}

	@Post("push")
	push(@Body() dto: PushOperationDto, @Req() req: AuthenticatedRequest) {
		return this.syncService.push(dto, req.user.sub);
	}
}
