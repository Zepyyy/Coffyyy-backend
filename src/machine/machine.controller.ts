import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
} from "@nestjs/common";
import { CreateMachineDto } from "./dto/create-machine.dto";
import { UpdateMachineDto } from "./dto/update-machine.dto";
import { MachineService } from "./machine.service";

@Controller("machine")
export class MachineController {
	constructor(private readonly machineService: MachineService) {}

	@Post()
	async create(@Body() createMachineDto: CreateMachineDto) {
		return await this.machineService.create(createMachineDto);
	}

	@Get()
	async findAll() {
		return await this.machineService.findAll();
	}

	@Get(":id")
	async findOne(@Param("id") id: string) {
		return await this.machineService.findOne(+id);
	}

	@Patch(":id")
	async update(
		@Param("id") id: string,
		@Body() updateMachineDto: UpdateMachineDto,
	) {
		return await this.machineService.update(+id, updateMachineDto);
	}

	@Delete(":id")
	async remove(@Param("id") id: string) {
		return await this.machineService.remove(+id);
	}
}
