import { findBoxes } from './highlight';

const w = (text: string, x0: number, y0: number) => ({ text, x0, y0, x1: x0 + 0.05, y1: y0 + 0.01 });
const PAGES = [
  {
    pageNumber: 1,
    words: [
      w('Invoice', 0.1, 0.1),
      w('No:', 0.16, 0.1),
      w('ABC-1001', 0.22, 0.1),
      w('Total', 0.1, 0.8),
      w('due', 0.16, 0.8),
      w('£1,440.00', 0.22, 0.8),
    ],
  },
  { pageNumber: 2, words: [w('Total', 0.1, 0.5), w('£99.00', 0.2, 0.5)] },
];

describe('findBoxes (locate a value on the document for highlighting)', () => {
  it('finds a multi-word quote and returns one box spanning it', () => {
    expect(findBoxes(PAGES, 'Invoice No: ABC-1001')).toEqual([{ page: 1, x0: 0.1, y0: 0.1, x1: 0.27, y1: 0.11 }]);
  });

  it('ignores currency symbols, thousands separators and case', () => {
    expect(findBoxes(PAGES, 'total DUE 1440.00')).toEqual([{ page: 1, x0: 0.1, y0: 0.8, x1: 0.27, y1: 0.81 }]);
  });

  it('falls back to the most distinctive word when the exact phrase is not present', () => {
    expect(findBoxes(PAGES, 'Ref ABC-1001')).toEqual([{ page: 1, x0: 0.22, y0: 0.1, x1: 0.27, y1: 0.11 }]);
  });

  it('can match on a later page and returns nothing when absent', () => {
    expect(findBoxes(PAGES, '99.00')).toEqual([{ page: 2, x0: 0.2, y0: 0.5, x1: 0.25, y1: 0.51 }]);
    expect(findBoxes(PAGES, 'Nowhere')).toEqual([]);
    expect(findBoxes(PAGES, '')).toEqual([]);
  });
});
