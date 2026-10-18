import { StatementFileFormat } from '@prisma/client';

export interface ParsedStatementLine {
  transactionDate: Date;
  description: string;
  payee?: string;
  reference?: string;
  amount: number; // positive = credit/in, negative = debit/out
  balance?: number;
  externalId?: string;
  rawData?: Record<string, unknown>;
}

export interface ParsedStatement {
  format: StatementFileFormat;
  openingBalance?: number;
  closingBalance?: number;
  fromDate?: Date;
  toDate?: Date;
  lines: ParsedStatementLine[];
}

export function parseStatementFile(
  content: string,
  format: StatementFileFormat,
  columnMapping?: Record<string, string>,
): ParsedStatement {
  switch (format) {
    case StatementFileFormat.OFX:
      return parseOfx(content);
    case StatementFileFormat.QIF:
      return parseQif(content);
    case StatementFileFormat.CSV:
    default:
      return parseCsv(content, columnMapping);
  }
}

/** Parses OFX (SGML / XML format standard) */
export function parseOfx(content: string): ParsedStatement {
  const lines: ParsedStatementLine[] = [];

  // Match all <STMTTRN>...</STMTTRN> blocks
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1];

    const getTag = (tag: string): string | undefined => {
      // Tags can be <TAG>value or <TAG>value</TAG>
      const r = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
      const m = block.match(r);
      return m ? m[1].trim() : undefined;
    };

    const trnAmtStr = getTag('TRNAMT');
    const dtPostedStr = getTag('DTPOSTED');
    const fitid = getTag('FITID');
    const name = getTag('NAME') || getTag('PAYEE');
    const memo = getTag('MEMO');
    const checkNum = getTag('CHECKNUM');

    if (trnAmtStr && dtPostedStr) {
      const amount = parseFloat(trnAmtStr);
      // OFX dates are typically YYYYMMDD or YYYYMMDDHHMMSS
      const year = parseInt(dtPostedStr.substring(0, 4), 10);
      const month = parseInt(dtPostedStr.substring(4, 6), 10) - 1;
      const day = parseInt(dtPostedStr.substring(6, 8), 10);
      const date = new Date(Date.UTC(year, month, day));

      const desc = memo ? (name ? `${name} - ${memo}` : memo) : (name || 'Bank Transaction');

      lines.push({
        transactionDate: date,
        description: desc,
        payee: name,
        reference: checkNum,
        amount,
        externalId: fitid,
        rawData: { dtPosted: dtPostedStr, fitid, trnAmt: trnAmtStr },
      });
    }
  }

  // Parse ledger balance if present
  let closingBalance: number | undefined;
  const balMatch = content.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i);
  if (balMatch) {
    closingBalance = parseFloat(balMatch[1].trim());
  }

  return {
    format: StatementFileFormat.OFX,
    closingBalance,
    fromDate: lines.length > 0 ? lines[lines.length - 1].transactionDate : undefined,
    toDate: lines.length > 0 ? lines[0].transactionDate : undefined,
    lines,
  };
}

/** Parses QIF (Quicken Interchange Format) */
export function parseQif(content: string): ParsedStatement {
  const lines: ParsedStatementLine[] = [];
  const records = content.split('^');

  for (const rec of records) {
    const trimmed = rec.trim();
    if (!trimmed) continue;

    let dateStr: string | undefined;
    let amountStr: string | undefined;
    let payee: string | undefined;
    let memo: string | undefined;
    let checkNum: string | undefined;

    const rowLines = trimmed.split(/\r?\n/).filter((r) => !r.startsWith('!'));
    for (const r of rowLines) {
      if (!r || r.length < 2) continue;
      const code = r[0];
      const val = r.substring(1).trim();

      if (code === 'D') dateStr = val;
      else if (code === 'T' || code === 'U') amountStr = val;
      else if (code === 'P') payee = val;
      else if (code === 'M') memo = val;
      else if (code === 'N') checkNum = val;
    }

    if (dateStr && amountStr) {
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      const parsedDate = parseAnyDate(dateStr);
      const desc = memo ? (payee ? `${payee} - ${memo}` : memo) : (payee || 'Bank Transaction');

      lines.push({
        transactionDate: parsedDate,
        description: desc,
        payee,
        reference: checkNum,
        amount,
        rawData: { rawRecord: trimmed },
      });
    }
  }

  return {
    format: StatementFileFormat.QIF,
    lines,
  };
}

/** Parses CSV with auto-detection or explicit column mapping */
export function parseCsv(
  content: string,
  mapping?: Record<string, string>,
): ParsedStatement {
  const lines: ParsedStatementLine[] = [];
  const rows = parseCsvRows(content);
  if (rows.length < 2) {
    return { format: StatementFileFormat.CSV, lines: [] };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());

  // Auto-detect column indexes if mapping not specified
  let dateIdx = mapping?.date !== undefined ? header.indexOf(mapping.date.toLowerCase()) : -1;
  let descIdx = mapping?.description !== undefined ? header.indexOf(mapping.description.toLowerCase()) : -1;
  let amountIdx = mapping?.amount !== undefined ? header.indexOf(mapping.amount.toLowerCase()) : -1;
  let inIdx = mapping?.in !== undefined ? header.indexOf(mapping.in.toLowerCase()) : -1;
  let outIdx = mapping?.out !== undefined ? header.indexOf(mapping.out.toLowerCase()) : -1;
  let balanceIdx = mapping?.balance !== undefined ? header.indexOf(mapping.balance.toLowerCase()) : -1;
  let refIdx = mapping?.reference !== undefined ? header.indexOf(mapping.reference.toLowerCase()) : -1;
  let payeeIdx = mapping?.payee !== undefined ? header.indexOf(mapping.payee.toLowerCase()) : -1;

  if (dateIdx === -1) {
    dateIdx = header.findIndex((h) => h.includes('date') || h.includes('time'));
  }
  if (descIdx === -1) {
    descIdx = header.findIndex((h) => h.includes('desc') || h.includes('narrative') || h.includes('memo') || h.includes('details'));
  }
  if (payeeIdx === -1) {
    payeeIdx = header.findIndex((h) => h.includes('payee') || h.includes('beneficiary') || h.includes('name'));
  }
  if (amountIdx === -1) {
    amountIdx = header.findIndex((h) => h === 'amount' || h === 'value');
  }
  if (inIdx === -1) {
    inIdx = header.findIndex((h) => h.includes('credit') || h.includes('in') || h.includes('paid in') || h.includes('receipt'));
  }
  if (outIdx === -1) {
    outIdx = header.findIndex((h) => h.includes('debit') || h.includes('out') || h.includes('paid out') || h.includes('payment'));
  }
  if (balanceIdx === -1) {
    balanceIdx = header.findIndex((h) => h.includes('balance'));
  }
  if (refIdx === -1) {
    refIdx = header.findIndex((h) => h.includes('ref') || h.includes('reference') || h.includes('trans id') || h.includes('id'));
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;

    const dateVal = dateIdx !== -1 && row[dateIdx] ? parseAnyDate(row[dateIdx].trim()) : null;
    if (!dateVal || isNaN(dateVal.getTime())) continue;

    const descVal = descIdx !== -1 && row[descIdx] ? row[descIdx].trim() : '';
    const payeeVal = payeeIdx !== -1 && row[payeeIdx] ? row[payeeIdx].trim() : undefined;
    const refVal = refIdx !== -1 && row[refIdx] ? row[refIdx].trim() : undefined;

    let amount = 0;
    if (amountIdx !== -1 && row[amountIdx]) {
      amount = parseFloat(row[amountIdx].replace(/[£$,]/g, '').trim()) || 0;
    } else if (inIdx !== -1 || outIdx !== -1) {
      const inVal = inIdx !== -1 && row[inIdx] ? parseFloat(row[inIdx].replace(/[£$,]/g, '').trim()) || 0 : 0;
      const outVal = outIdx !== -1 && row[outIdx] ? parseFloat(row[outIdx].replace(/[£$,]/g, '').trim()) || 0 : 0;
      amount = inVal > 0 ? inVal : -Math.abs(outVal);
    }

    if (amount === 0) continue;

    let balance: number | undefined;
    if (balanceIdx !== -1 && row[balanceIdx]) {
      const b = parseFloat(row[balanceIdx].replace(/[£$,]/g, '').trim());
      if (!isNaN(b)) balance = b;
    }

    lines.push({
      transactionDate: dateVal,
      description: descVal || payeeVal || 'Bank Transaction',
      payee: payeeVal,
      reference: refVal,
      amount,
      balance,
      externalId: refVal,
    });
  }

  return {
    format: StatementFileFormat.CSV,
    lines,
  };
}

/** Robust CSV line tokenizer handling quotes, commas and newlines */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      currentRow.push(currentVal);
      currentVal = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      currentRow.push(currentVal);
      currentVal = '';
      if (currentRow.some((val) => val.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += c;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    if (currentRow.some((val) => val.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/** Parses dates in ISO, UK (DD/MM/YYYY), US (MM/DD/YYYY) or YYYYMMDD formats */
function parseAnyDate(val: string): Date {
  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    return new Date(val);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = val.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (ukMatch) {
    const day = parseInt(ukMatch[1], 10);
    const month = parseInt(ukMatch[2], 10) - 1;
    const year = parseInt(ukMatch[3], 10);
    return new Date(Date.UTC(year, month, day));
  }

  return new Date(val);
}
