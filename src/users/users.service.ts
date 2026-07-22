import { Injectable } from "@nestjs/common";
import { User } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
	constructor(private prisma: PrismaService) {}

	async findOne(username: string): Promise<User | null> {
		return await this.prisma.user.findUnique({ where: { username } });
	}

	async createUser(username: string, password: string): Promise<User> {
		return await this.prisma.user.create({
			data: {
				username,
				password,
			},
		});
	}
}
