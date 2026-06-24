import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMachineDto } from "./dto/create-machine.dto";
import { UpdateMachineDto } from "./dto/update-machine.dto";

@Injectable()
export class MachineService {
	constructor(private prisma: PrismaService) {}

	async create(createMachineDto: CreateMachineDto) {
		return await this.prisma.machine.create({
			data: createMachineDto,
		});
	}

	async findAll() {
		return await this.prisma.machine.findMany();
	}

	async findOne(id: number) {
		return await this.prisma.machine.findUnique({
			where: { id },
		});
	}

	async update(id: number, updateMachineDto: UpdateMachineDto) {
		return await this.prisma.machine.update({
			where: { id },
			data: updateMachineDto,
		});
	}

	async remove(id: number) {
		return await this.prisma.machine.delete({
			where: { id },
		});
	}
}
