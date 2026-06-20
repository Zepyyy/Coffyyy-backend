import { Module } from "@nestjs/common";
import { BeansController } from "./beans.controller";
import { BeansService } from "./beans.service";

@Module({
	controllers: [BeansController],
	providers: [BeansService],
})
export class BeansModule {}
