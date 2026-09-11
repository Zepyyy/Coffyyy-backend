import { Body, Controller, Get, Headers, Put, Req } from "@nestjs/common";
import { AuthenticatedRequest } from "src/auth/types/session-user";
import { WorkspaceService } from "./workspace.service";

@Controller("workspace")
export class WorkspaceController {
	constructor(private readonly workspaceService: WorkspaceService) {}

	@Get("snapshot")
	getSnapshot(@Req() req: AuthenticatedRequest) {
		return this.workspaceService.getSnapshot(req.user.sub);
	}

	@Put("snapshot")
	putSnapshot(
		@Body() body: unknown,
		@Headers("if-match") ifMatch: string | undefined,
		@Req() req: AuthenticatedRequest,
	) {
		return this.workspaceService.putSnapshot(req.user.sub, body, ifMatch);
	}
}
