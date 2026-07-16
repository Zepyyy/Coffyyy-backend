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
import { BeanService } from "./bean.service";
import { CreateBeanDto } from "./dto/create-bean.dto";
import { UpdateBeanDto } from "./dto/update-bean.dto";

// All bean routes require session; service scopes every query by request.user.sub.
@Controller("bean")
export class BeanController {
	constructor(private readonly beanService: BeanService) {}

	@Post()
	async create(
		@Body() createBeanDto: CreateBeanDto,
		@Req() req: AuthenticatedRequest,
	) {
		return await this.beanService.create(createBeanDto, req.user.sub);
	}

	@Get()
	async findAll(@Req() req: AuthenticatedRequest) {
		return await this.beanService.findAll(req.user.sub);
	}

	@Get(":id")
	async findOne(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
		return await this.beanService.findOne(+id, req.user.sub);
	}

	@Patch(":id")
	async update(
		@Param("id") id: string,
		@Body() updateBeanDto: UpdateBeanDto,
		@Req() req: AuthenticatedRequest,
	) {
		return await this.beanService.update(+id, updateBeanDto, req.user.sub);
	}

	@Delete(":id")
	async remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
		return await this.beanService.remove(+id, req.user.sub);
	}
}
