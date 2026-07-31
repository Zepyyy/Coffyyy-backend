import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { WorkspaceModule } from "./workspace/workspace.module";

@Module({
	imports: [
		PrismaModule,
		ConfigModule.forRoot({ isGlobal: true }),
		AuthModule,
		WorkspaceModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
