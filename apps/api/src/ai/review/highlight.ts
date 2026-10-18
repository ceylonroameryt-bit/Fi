export interface HighlightBox {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PageWords {
  pageNumber: number;
  words: Array<{ text: string; x0: number; y0: number; x1: number; y1: number }>;
}

/** Lower-case, drop currency symbols, thousands separators and surrounding punctuation. */
function token(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[£$€,]/g, '')
    .replace(/^[^a-z0-9]+|[^a-z0-9%]+$/g, '');
}

const tokens = (text: string) => text.split(/\s+/).map(token).filter(Boolean);

const round = (v: number) => Number(v.toFixed(5));

function union(page: number, words: PageWords['words']): HighlightBox {
  return {
    page,
    x0: round(Math.min(...words.map((w) => w.x0))),
    y0: round(Math.min(...words.map((w) => w.y0))),
    x1: round(Math.max(...words.map((w) => w.x1))),
    y1: round(Math.max(...words.map((w) => w.y1))),
  };
}

/**
 * Where a value (or its source quote) appears on the document, as word-box rectangles
 * normalised to the page. First the whole phrase; failing that, its most distinctive word.
 */
export function findBoxes(pages: PageWords[], text: string): HighlightBox[] {
  const wanted = tokens(text);
  if (wanted.length === 0) return [];

  for (const page of pages) {
    const words = page.words.map((w) => ({ ...w, t: token(w.text) })).filter((w) => w.t);
    for (let i = 0; i + wanted.length <= words.length; i++) {
      if (wanted.every((t, k) => words[i + k].t === t)) return [union(page.pageNumber, words.slice(i, i + wanted.length))];
    }
  }

  if (wanted.length > 1) {
    const distinctive = [...wanted].sort((a, b) => b.length - a.length)[0];
    if (distinctive.length >= 3) return findBoxes(pages, distinctive);
  }
  return [];
}
