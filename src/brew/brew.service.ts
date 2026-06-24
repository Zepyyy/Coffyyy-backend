import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBrewDto } from "./dto/create-brew.dto";
import { UpdateBrewDto } from "./dto/update-brew.dto";

@Injectable()
export class BrewService {
	constructor(private prisma: PrismaService) {}

	async create(dto: CreateBrewDto) {
		return await this.prisma.brew.create({ data: dto });
	}

	async findAll() {
		return await this.prisma.brew.findMany();
	}

	async findOne(id: number) {
		return await this.prisma.brew.findUnique({ where: { id } });
	}

	async update(id: number, dto: UpdateBrewDto) {
		return await this.prisma.brew.update({ where: { id }, data: dto });
	}

	async remove(id: number) {
		return await this.prisma.brew.delete({ where: { id } });
	}
}
