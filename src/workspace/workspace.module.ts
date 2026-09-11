import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WorkspaceController } from "./workspace.controller";
import { WorkspaceService } from "./workspace.service";

@Module({
	imports: [AuthModule, PrismaModule],
	controllers: [WorkspaceController],
	providers: [WorkspaceService],
})
export class WorkspaceModule {}
