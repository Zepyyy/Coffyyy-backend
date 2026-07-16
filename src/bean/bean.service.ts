import { Injectable, NotFoundException } from "@nestjs/common";
import { Bean } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBeanDto } from "./dto/create-bean.dto";
import { UpdateBeanDto } from "./dto/update-bean.dto";

@Injectable()
export class BeanService {
	constructor(private prisma: PrismaService) {}

	async create(dto: CreateBeanDto, userId: number): Promise<Bean> {
		// userId comes from validated session, never client payload.
		return await this.prisma.bean.create({
			data: { ...dto, userId },
		});
	}

	async findAll(userId: number) {
		return await this.prisma.bean.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});
	}

	async findOne(id: number, userId: number) {
		const bean = await this.prisma.bean.findFirst({
			where: { id, userId },
		});
		if (!bean) throw new NotFoundException("Bean not found");
		return bean;
	}

	async update(id: number, dto: UpdateBeanDto, userId: number) {
		await this.findOne(id, userId);
		return await this.prisma.bean.update({
			where: { id },
			data: dto,
		});
	}

	async remove(id: number, userId: number) {
		await this.findOne(id, userId);
		return await this.prisma.bean.delete({
			where: { id },
		});
	}
}
