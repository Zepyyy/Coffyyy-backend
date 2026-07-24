import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ChangeRetentionService } from "./change-retention.service";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
	imports: [AuthModule, PrismaModule],
	controllers: [SyncController],
	providers: [SyncService, ChangeRetentionService],
})
export class SyncModule {}
