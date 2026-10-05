/**
 * CSV Utility:
 * - Implements RFC 4180 standard escaping for CSV cells (quotes doubled, wrapped in quotes).
 * - Neutralizes spreadsheet formula injection (CWE-1236) by prepending a single quote (')
 *   to user-controlled text cells that begin with =, +, -, @, \t, or \r.
 */

export function escapeCsvField(val: unknown, isText = true): string {
  if (val === null || val === undefined) {
    return '""';
  }

  let str = String(val);

  // If text field starts with formula trigger characters, neutralize it
  // Do not neutralize pure signed numbers like -100.50 or +42.00
  if (isText && typeof val === 'string' && /^[=+@\t\r-]/.test(str)) {
    if (!/^[+-]?\d+(\.\d+)?$/.test(str)) {
      str = `'${str}`;
    }
  }

  // Double internal quotes per RFC 4180
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function toCsvRow(cells: Array<{ value: unknown; isText?: boolean } | unknown>): string {
  return cells
    .map((cell) => {
      if (cell !== null && typeof cell === 'object' && 'value' in cell) {
        const item = cell as { value: unknown; isText?: boolean };
        return escapeCsvField(item.value, item.isText ?? true);
      }
      return escapeCsvField(cell, typeof cell === 'string');
    })
    .join(',');
}
