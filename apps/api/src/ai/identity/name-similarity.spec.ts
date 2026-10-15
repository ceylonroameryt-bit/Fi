import { nameSimilarity } from './name-similarity';

describe('nameSimilarity (pg_trgm-style trigram similarity on normalised company names)', () => {
  it('is 1 for names that differ only by legal suffix, case or punctuation', () => {
    expect(nameSimilarity('ABC Fuel Ltd', 'abc fuel limited')).toBe(1);
    expect(nameSimilarity('The A&B Company', 'A and B Co.')).toBe(1);
  });

  it('scores small spelling differences high but below 1', () => {
    const s = nameSimilarity('Northwind Traders Ltd', 'Northwind Trader Ltd');
    expect(s).toBeGreaterThan(0.75);
    expect(s).toBeLessThan(1);
  });

  it('scores different businesses low, including one name contained in another', () => {
    expect(nameSimilarity('ABC', 'ABC Supplies Ltd')).toBeLessThan(0.5);
    expect(nameSimilarity('Acme Fuels', 'Zenith Plumbing')).toBeLessThan(0.1);
  });

  it('is 0 when either name is empty after normalisation', () => {
    expect(nameSimilarity('Ltd', 'ABC')).toBe(0);
  });
});
