import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { BeanModule } from "./bean/bean.module";
import { BrewModule } from "./brew/brew.module";
import { ImportModule } from "./import/import.module";
import { MachineModule } from "./machine/machine.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		PrismaModule,
		BeanModule,
		BrewModule,
		MachineModule,
		ConfigModule.forRoot({ isGlobal: true }),
		AuthModule,
		UsersModule,
		ImportModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
