import { PartialType } from "@nestjs/mapped-types";
import { CreateBrewDto } from "./create-brew.dto";

export class UpdateBrewDto extends PartialType(CreateBrewDto) {}
