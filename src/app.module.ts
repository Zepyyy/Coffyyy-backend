import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { BeanModule } from "./bean/bean.module";
import { BrewModule } from "./brew/brew.module";
import { MachineModule } from "./machine/machine.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
	imports: [PrismaModule, BeanModule, BrewModule, MachineModule],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
