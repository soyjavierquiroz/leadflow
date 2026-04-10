import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BlockDefinitionsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.blockDefinition.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }
}
