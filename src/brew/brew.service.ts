import { Injectable } from "@nestjs/common";
import { CreateBrewDto } from "./dto/create-brew.dto";
import { UpdateBrewDto } from "./dto/update-brew.dto";

@Injectable()
export class BrewService {
	create(createBrewDto: CreateBrewDto) {
		return "This action adds a new brew";
	}

	findAll() {
		return `This action returns all brew`;
	}

	findOne(id: number) {
		return `This action returns a #${id} brew`;
	}

	update(id: number, updateBrewDto: UpdateBrewDto) {
		return `This action updates a #${id} brew`;
	}

	remove(id: number) {
		return `This action removes a #${id} brew`;
	}
}
