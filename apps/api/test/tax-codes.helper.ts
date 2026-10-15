import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';

/** Maps seeded UK VAT code (e.g. UK_SR) to its id. */
export async function loadTaxCodeIds(app: INestApplication): Promise<Record<string, string>> {
  const codes = await app.get(PrismaService).taxCode.findMany({ select: { id: true, code: true } });
  return Object.fromEntries(codes.map((c) => [c.code, c.id]));
}
