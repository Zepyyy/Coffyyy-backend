import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMachineDto } from "./dto/create-machine.dto";
import { UpdateMachineDto } from "./dto/update-machine.dto";

@Injectable()
export class MachineService {
	constructor(private prisma: PrismaService) {}

	async create(createMachineDto: CreateMachineDto, userId: number) {
		// Ownership is assigned server-side from authenticated session.
		return await this.prisma.machine.create({
			data: { ...createMachineDto, userId },
		});
	}

	async findAll(userId: number) {
		return await this.prisma.machine.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});
	}

	async findOne(id: number, userId: number) {
		const machine = await this.prisma.machine.findFirst({
			where: { id, userId },
		});
		if (!machine) throw new NotFoundException("Machine not found");
		return machine;
	}

	async update(id: number, updateMachineDto: UpdateMachineDto, userId: number) {
		await this.findOne(id, userId);
		return await this.prisma.machine.update({
			where: { id },
			data: updateMachineDto,
		});
	}

	async remove(id: number, userId: number) {
		await this.findOne(id, userId);
		return await this.prisma.machine.delete({
			where: { id },
		});
	}
}
