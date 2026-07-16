import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Module({
	imports: [PrismaModule, ConfigModule.forRoot({ isGlobal: true })],
	// APP_GUARD protects every controller unless route explicitly uses @Public.
	providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
	controllers: [AuthController],
	exports: [AuthService],
})
export class AuthModule {}
