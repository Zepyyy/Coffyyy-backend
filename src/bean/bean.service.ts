import { Injectable } from "@nestjs/common";
import { CreateBeanDto } from "./dto/create-bean.dto";
import { UpdateBeanDto } from "./dto/update-bean.dto";

@Injectable()
export class BeanService {
	create(createBeanDto: CreateBeanDto) {
		return "This action adds a new bean";
	}

	findAll() {
		return `This action returns all bean`;
	}

	findOne(id: number) {
		return `This action returns a #${id} bean`;
	}

	update(id: number, updateBeanDto: UpdateBeanDto) {
		return `This action updates a #${id} bean`;
	}

	remove(id: number) {
		return `This action removes a #${id} bean`;
	}
}
