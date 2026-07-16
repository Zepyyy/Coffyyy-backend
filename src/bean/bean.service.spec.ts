import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BeanService } from './bean.service';

describe('BeanService', () => {
  let service: BeanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BeanService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<BeanService>(BeanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
