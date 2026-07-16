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
import { BrewService } from "./brew.service";
import { CreateBrewDto } from "./dto/create-brew.dto";
import { UpdateBrewDto } from "./dto/update-brew.dto";

// All brew routes require session; service also validates bean/machine ownership.
@Controller("brew")
export class BrewController {
	constructor(private readonly brewService: BrewService) {}

	@Post()
	async create(
		@Body() createBrewDto: CreateBrewDto,
		@Req() req: AuthenticatedRequest,
	) {
		return await this.brewService.create(createBrewDto, req.user.sub);
	}

	@Get()
	async findAll(@Req() req: AuthenticatedRequest) {
		return await this.brewService.findAll(req.user.sub);
	}

	@Get(":id")
	async findOne(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
		return await this.brewService.findOne(+id, req.user.sub);
	}

	@Patch(":id")
	async update(
		@Param("id") id: string,
		@Body() updateBrewDto: UpdateBrewDto,
		@Req() req: AuthenticatedRequest,
	) {
		return await this.brewService.update(+id, updateBrewDto, req.user.sub);
	}

	@Delete(":id")
	async remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
		return await this.brewService.remove(+id, req.user.sub);
	}
}
