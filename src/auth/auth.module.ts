import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { RequestProtection } from "./request-protection";
import { SessionLifecycle } from "./session-lifecycle";
import { WorkspaceEnrollment } from "./workspace-enrollment";

@Module({
	imports: [PrismaModule, ConfigModule.forRoot({ isGlobal: true })],
	// APP_GUARD protects every controller unless route explicitly uses @Public.
	providers: [
		SessionLifecycle,
		RequestProtection,
		WorkspaceEnrollment,
		{ provide: APP_GUARD, useClass: AuthGuard },
	],
	controllers: [AuthController],
	exports: [SessionLifecycle, RequestProtection, WorkspaceEnrollment],
})
export class AuthModule {}
