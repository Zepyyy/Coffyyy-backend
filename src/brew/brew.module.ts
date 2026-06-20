import { Module } from "@nestjs/common";
import { BrewController } from "./brew.controller";
import { BrewService } from "./brew.service";

@Module({
	controllers: [BrewController],
	providers: [BrewService],
})
export class BrewModule {}
