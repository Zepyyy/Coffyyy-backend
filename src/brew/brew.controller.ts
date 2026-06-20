import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { BrewService } from './brew.service';
import { CreateBrewDto } from './dto/create-brew.dto';
import { UpdateBrewDto } from './dto/update-brew.dto';

@Controller('brew')
export class BrewController {
  constructor(private readonly brewService: BrewService) {}

  @Post()
  create(@Body() createBrewDto: CreateBrewDto) {
    return this.brewService.create(createBrewDto);
  }

  @Get()
  findAll() {
    return this.brewService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.brewService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBrewDto: UpdateBrewDto) {
    return this.brewService.update(+id, updateBrewDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.brewService.remove(+id);
  }
}
