import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(@Res() res: Response) {
    const isDbConnected = await this.prisma.ping();

    const data = {
      status: isDbConnected ? 'healthy' : 'unhealthy',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: isDbConnected ? 'up' : 'down',
      },
    };

    return res.status(isDbConnected ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(data);
  }
}
