import { PrismaClient } from '@prisma/client';

interface ValidationReport {
  databaseUrlMasked: string;
  tableCounts: Record<string, number>;
  totalDebit: string;
  totalCredit: string;
  balanceDifference: string;
  isBalanced: boolean;
  orphanedLinesCount: number;
  duplicateJournalsCount: number;
}

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}`;
  } catch {
    return '***';
  }
}

async function inspectDatabase(connectionUrl: string): Promise<ValidationReport> {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: connectionUrl },
    },
  });

  try {
    const [
      organizations,
      users,
      sessions,
      members,
      roles,
      accounts,
      financialYears,
      periods,
      journalEntries,
      journalLines,
      contacts,
      invoices,
      invoiceLines,
      auditLogs,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.session.count(),
      prisma.organizationMember.count(),
      prisma.role.count(),
      prisma.account.count(),
      prisma.financialYear.count(),
      prisma.accountingPeriod.count(),
      prisma.journalEntry.count(),
      prisma.journalLine.count(),
      prisma.contact.count(),
      prisma.invoice.count(),
      prisma.invoiceLine.count(),
      prisma.auditLog.count(),
    ]);

    const tableCounts = {
      Organization: organizations,
      User: users,
      Session: sessions,
      OrganizationMember: members,
      Role: roles,
      Account: accounts,
      FinancialYear: financialYears,
      AccountingPeriod: periods,
      JournalEntry: journalEntries,
      JournalLine: journalLines,
      Contact: contacts,
      Invoice: invoices,
      InvoiceLine: invoiceLines,
      AuditLog: auditLogs,
    };

    // Calculate sum of debits and credits for posted/reversed journals
    const sumsResult = await prisma.$queryRaw<Array<{ total_debit: string | null; total_credit: string | null }>>`
      SELECT 
        COALESCE(SUM(jl.debit), 0)::text as total_debit,
        COALESCE(SUM(jl.credit), 0)::text as total_credit
      FROM "journal_lines" jl
      INNER JOIN "journal_entries" je ON je.id = jl.journal_entry_id
      WHERE je.status IN ('POSTED', 'REVERSED');
    `;

    const totalDebit = sumsResult[0]?.total_debit || '0';
    const totalCredit = sumsResult[0]?.total_credit || '0';
    const numDebit = parseFloat(totalDebit);
    const numCredit = parseFloat(totalCredit);
    const diff = Math.abs(numDebit - numCredit);
    const isBalanced = diff < 0.0001;

    // Check for orphaned journal lines
    const orphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count
      FROM "journal_lines" jl
      LEFT JOIN "journal_entries" je ON je.id = jl.journal_entry_id
      WHERE je.id IS NULL;
    `;
    const orphanedLinesCount = Number(orphans[0]?.count ?? 0);

    // Check for duplicate journal numbers within same organization
    const dupes = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count FROM (
        SELECT organization_id, journal_number
        FROM "journal_entries"
        GROUP BY organization_id, journal_number
        HAVING COUNT(*) > 1
      ) duplicates;
    `;
    const duplicateJournalsCount = Number(dupes[0]?.count ?? 0);

    return {
      databaseUrlMasked: maskUrl(connectionUrl),
      tableCounts,
      totalDebit,
      totalCredit,
      balanceDifference: diff.toFixed(4),
      isBalanced,
      orphanedLinesCount,
      duplicateJournalsCount,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
  const sourceUrl = process.env.SOURCE_DATABASE_URL;

  if (!targetUrl) {
    console.error('[-] ERROR: TARGET_DATABASE_URL or DATABASE_URL must be specified.');
    process.exit(1);
  }

  console.log('\n=============================================================');
  console.log('       BLYNT DATABASE MIGRATION VALIDATION RUNNER');
  console.log('=============================================================\n');

  console.log(`[+] Validating target database: ${maskUrl(targetUrl)}`);
  const targetReport = await inspectDatabase(targetUrl);

  console.log('\n--- TARGET DATABASE TABLE ROW COUNTS ---');
  for (const [tbl, cnt] of Object.entries(targetReport.tableCounts)) {
    console.log(`  - ${tbl.padEnd(20)}: ${cnt}`);
  }

  console.log('\n--- FINANCIAL INTEGRITY CONTROLS ---');
  console.log(`  - Total Debits (posted) : £${targetReport.totalDebit}`);
  console.log(`  - Total Credits (posted): £${targetReport.totalCredit}`);
  console.log(`  - Difference            : £${targetReport.balanceDifference}`);
  console.log(`  - Status Balanced       : ${targetReport.isBalanced ? 'PASS [MATCH]' : 'FAIL [DISCREPANCY]'}`);
  console.log(`  - Orphan Journal Lines  : ${targetReport.orphanedLinesCount === 0 ? 'PASS [0]' : `FAIL [${targetReport.orphanedLinesCount}]`}`);
  console.log(`  - Duplicate Journal Nos : ${targetReport.duplicateJournalsCount === 0 ? 'PASS [0]' : `FAIL [${targetReport.duplicateJournalsCount}]`}`);

  let hasDiscrepancy = false;

  if (!targetReport.isBalanced || targetReport.orphanedLinesCount > 0 || targetReport.duplicateJournalsCount > 0) {
    hasDiscrepancy = true;
  }

  if (sourceUrl) {
    console.log(`\n[+] Comparing against source database: ${maskUrl(sourceUrl)}`);
    const sourceReport = await inspectDatabase(sourceUrl);

    console.log('\n--- SOURCE VS TARGET ROW COMPARISON ---');
    console.log(`  ${'Table'.padEnd(20)} | ${'Source'.padStart(10)} | ${'Target'.padStart(10)} | Status`);
    console.log(`  ${'-'.repeat(20)} | ${'-'.repeat(10)} | ${'-'.repeat(10)} | ------`);

    for (const tbl of Object.keys(targetReport.tableCounts)) {
      const srcCnt = sourceReport.tableCounts[tbl] ?? 0;
      const tgtCnt = targetReport.tableCounts[tbl] ?? 0;
      const match = srcCnt === tgtCnt;
      if (!match) hasDiscrepancy = true;
      console.log(
        `  ${tbl.padEnd(20)} | ${String(srcCnt).padStart(10)} | ${String(tgtCnt).padStart(10)} | ${match ? 'MATCH' : 'MISMATCH'}`
      );
    }
  }

  console.log('\n=============================================================');
  if (hasDiscrepancy) {
    console.error('[-] VALIDATION FAILED: Integrity checks or row counts do not match!');
    console.log('=============================================================\n');
    process.exit(1);
  } else {
    console.log('[+] VALIDATION PASSED: All accounting integrity and row checks verified successfully.');
    console.log('=============================================================\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[-] Fatal validation error:', err);
  process.exit(1);
});
