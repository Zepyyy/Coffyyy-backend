import { Test, TestingModule } from '@nestjs/testing';
import { BrewController } from './brew.controller';
import { BrewService } from './brew.service';

describe('BrewController', () => {
  let controller: BrewController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrewController],
      providers: [BrewService],
    }).compile();

    controller = module.get<BrewController>(BrewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
