import { Prisma } from '@prisma/client';

/** USD per million tokens. Cache writes are 1.25x input (5-minute cache). */
interface ModelPrice {
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
}

/** Anthropic first-party list prices (2026-10). Unknown models get a null cost, never 0. */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-opus-5-5': { input: '4', output: '20', cacheRead: '0.20', cacheWrite: '5' },
  'claude-sonnet-5-5': { input: '2', output: '10', cacheRead: '0.20', cacheWrite: '2.5' },
};

const MILLION = new Prisma.Decimal(1_000_000);

export function costUsd(
  model: string,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number },
): Prisma.Decimal | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;
  return new Prisma.Decimal(usage.inputTokens)
    .mul(price.input)
    .plus(new Prisma.Decimal(usage.outputTokens).mul(price.output))
    .plus(new Prisma.Decimal(usage.cacheReadTokens).mul(price.cacheRead))
    .plus(new Prisma.Decimal(usage.cacheWriteTokens).mul(price.cacheWrite))
    .div(MILLION)
    .toDecimalPlaces(6);
}
