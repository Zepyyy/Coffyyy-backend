import { Injectable } from "@nestjs/common";
import { CreateBeanDto } from "./dto/create-bean.dto";
import { UpdateBeanDto } from "./dto/update-bean.dto";

@Injectable()
export class BeansService {
	create(createBeanDto: CreateBeanDto) {
		return `Bean created: ${JSON.stringify(createBeanDto)}`;
	}

	findAll() {
		return `This action returns all beans`;
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
