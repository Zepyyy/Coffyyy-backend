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
	findAll() {
		return this.beanService.findAll();
	}

	@Get(":id")
	findOne(@Param("id") id: string) {
		return this.beanService.findOne(+id);
	}

	@Patch(":id")
	update(@Param("id") id: string, @Body() updateBeanDto: UpdateBeanDto) {
		return this.beanService.update(+id, updateBeanDto);
	}

	@Delete(":id")
	remove(@Param("id") id: string) {
		return this.beanService.remove(+id);
	}
}
