import { Injectable } from "@nestjs/common";
import { Bean } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBeanDto } from "./dto/create-bean.dto";
import { UpdateBeanDto } from "./dto/update-bean.dto";

@Injectable()
export class BeanService {
	constructor(private prisma: PrismaService) {}

	async create(dto: CreateBeanDto): Promise<Bean> {
		return await this.prisma.bean.create({
			data: dto,
		});
	}

	async findAll() {
		return await this.prisma.bean.findMany();
	}

	async findOne(id: number) {
		return await this.prisma.bean.findUnique({
			where: { id },
		});
	}

	async update(id: number, dto: UpdateBeanDto) {
		return await this.prisma.bean.update({
			where: { id },
			data: dto,
		});
	}

	async remove(id: number) {
		return await this.prisma.bean.delete({
			where: { id },
		});
	}
}
