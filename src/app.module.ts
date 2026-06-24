import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { BeanModule } from "./bean/bean.module";
import { BrewModule } from "./brew/brew.module";
import { MachineModule } from "./machine/machine.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
	imports: [ConfigModule.forRoot({ isGlobal: true })],
	controllers: [AppController],
	providers: [AppService, PrismaModule, BeanModule, BrewModule, MachineModule],
})
export class AppModule {}
