import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Req,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/types/jwt-payload";
import { CreateMachineDto } from "./dto/create-machine.dto";
import { UpdateMachineDto } from "./dto/update-machine.dto";
import { MachineService } from "./machine.service";

// All machine routes require session; service assigns owner server-side.
@Controller("machine")
export class MachineController {
	constructor(private readonly machineService: MachineService) {}

	@Post()
	async create(
		@Body() createMachineDto: CreateMachineDto,
		@Req() req: AuthenticatedRequest,
	) {
		return await this.machineService.create(createMachineDto, req.user.sub);
	}

	@Get()
	async findAll(@Req() req: AuthenticatedRequest) {
		return await this.machineService.findAll(req.user.sub);
	}

	@Get(":id")
	async findOne(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
		return await this.machineService.findOne(+id, req.user.sub);
	}

	@Patch(":id")
	async update(
		@Param("id") id: string,
		@Body() updateMachineDto: UpdateMachineDto,
		@Req() req: AuthenticatedRequest,
	) {
		return await this.machineService.update(
			+id,
			updateMachineDto,
			req.user.sub,
		);
	}

	@Delete(":id")
	async remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
		return await this.machineService.remove(+id, req.user.sub);
	}
}
