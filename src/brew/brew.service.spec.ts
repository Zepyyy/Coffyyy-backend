import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BrewService } from './brew.service';

describe('BrewService', () => {
  let service: BrewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BrewService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<BrewService>(BrewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
