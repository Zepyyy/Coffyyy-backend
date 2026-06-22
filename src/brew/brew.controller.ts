import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
} from "@nestjs/common";
import { BrewService } from "./brew.service";
import { CreateBrewDto } from "./dto/create-brew.dto";
import { UpdateBrewDto } from "./dto/update-brew.dto";

@Controller("brew")
export class BrewController {
	constructor(private readonly brewService: BrewService) {}

	@Post()
	async create(@Body() createBrewDto: CreateBrewDto) {
		return await this.brewService.create(createBrewDto);
	}

	@Get()
	async findAll() {
		return await this.brewService.findAll();
	}

	@Get(":id")
	async findOne(@Param("id") id: string) {
		return await this.brewService.findOne(+id);
	}

	@Patch(":id")
	async update(@Param("id") id: string, @Body() updateBrewDto: UpdateBrewDto) {
		return await this.brewService.update(+id, updateBrewDto);
	}

	@Delete(":id")
	async remove(@Param("id") id: string) {
		return await this.brewService.remove(+id);
	}
}
