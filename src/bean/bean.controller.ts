import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
} from "@nestjs/common";
import { BeanService } from "./bean.service";
import { CreateBeanDto } from "./dto/create-bean.dto";
import { UpdateBeanDto } from "./dto/update-bean.dto";

@Controller("bean")
export class BeanController {
	constructor(private readonly beanService: BeanService) {}

	@Post()
	async create(@Body() createBeanDto: CreateBeanDto) {
		return await this.beanService.create(createBeanDto);
	}

	@Get()
	async findAll() {
		return await this.beanService.findAll();
	}

	@Get(":id")
	async findOne(@Param("id") id: string) {
		return await this.beanService.findOne(+id);
	}

	@Patch(":id")
	async update(@Param("id") id: string, @Body() updateBeanDto: UpdateBeanDto) {
		return await this.beanService.update(+id, updateBeanDto);
	}

	@Delete(":id")
	async remove(@Param("id") id: string) {
		return await this.beanService.remove(+id);
	}
}
