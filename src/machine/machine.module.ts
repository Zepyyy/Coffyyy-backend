import { Module } from "@nestjs/common";
import { MachineController } from "./machine.controller";
import { MachineService } from "./machine.service";

@Module({
	controllers: [MachineController],
	providers: [MachineService],
})
export class MachineModule {}
