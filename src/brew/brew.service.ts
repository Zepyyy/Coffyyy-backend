import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBrewDto } from "./dto/create-brew.dto";
import { UpdateBrewDto } from "./dto/update-brew.dto";

@Injectable()
export class BrewService {
	constructor(private prisma: PrismaService) {}

	async create(dto: CreateBrewDto, userId: number) {
		// Both foreign records must belong to same workspace as brew.
		await this.assertReferencesBelongToUser(dto.beanId, dto.machineId, userId);
		return await this.prisma.brew.create({
			data: { ...dto, date: new Date(dto.date), userId },
		});
	}

	async findAll(userId: number) {
		return await this.prisma.brew.findMany({
			where: { userId },
			orderBy: { date: "desc" },
		});
	}

	async findOne(id: number, userId: number) {
		const brew = await this.prisma.brew.findFirst({
			where: { id, userId },
		});
		if (!brew) throw new NotFoundException("Brew not found");
		return brew;
	}

	async update(id: number, dto: UpdateBrewDto, userId: number) {
		const existing = await this.findOne(id, userId);
		await this.assertReferencesBelongToUser(
			dto.beanId ?? existing.beanId,
			dto.machineId ?? existing.machineId,
			userId,
		);
		return await this.prisma.brew.update({
			where: { id },
			data: {
				...dto,
				...(dto.date ? { date: new Date(dto.date) } : {}),
			},
		});
	}

	async remove(id: number, userId: number) {
		await this.findOne(id, userId);
		return await this.prisma.brew.delete({ where: { id } });
	}

	private async assertReferencesBelongToUser(
		beanId: number,
		machineId: number,
		userId: number,
	) {
		const [bean, machine] = await Promise.all([
			this.prisma.bean.findFirst({ where: { id: beanId, userId } }),
			this.prisma.machine.findFirst({ where: { id: machineId, userId } }),
		]);
		if (!bean || !machine) {
			throw new NotFoundException("Bean or machine not found");
		}
	}
}
