import { PartialType } from '@nestjs/mapped-types';
import { CreateBeanDto } from './create-bean.dto';

export class UpdateBeanDto extends PartialType(CreateBeanDto) {}
