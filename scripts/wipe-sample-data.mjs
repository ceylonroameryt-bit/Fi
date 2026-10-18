import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function wipeSampleData() {
  console.log('--- Wiping Sample Transactional Data ---');

  const tablesToTruncate = [
    'payment_allocations',
    'payments',
    'invoice_lines',
    'invoices',
    'bill_lines',
    'bills',
    'credit_note_lines',
    'credit_notes',
    'journal_lines',
    'journal_entries',
    'bank_statement_lines',
    'bank_statement_imports',
    'bank_accounts',
    'bank_rules',
    'ai_audit_events',
    'ai_classifications',
    'ai_document_pages',
    'ai_documents',
    'ai_extractions',
    'ai_feedbacks',
    'ai_line_classifications',
    'ai_review_decisions',
    'ai_suggestions',
    'ai_usage_logs',
    'jobs',
    'contact_people',
    'contacts',
  ];

  const truncateSql = `TRUNCATE TABLE ${tablesToTruncate.map((t) => `"${t}"`).join(', ')} CASCADE;`;

  console.log('Executing TRUNCATE CASCADE...');
  await prisma.$executeRawUnsafe(truncateSql);

  // Reset numbering sequences to 0 so fresh documents start at 1
  console.log('Resetting organization document sequence counters...');
  await prisma.$executeRawUnsafe(`UPDATE "organization_sequences" SET "current_value" = 0;`);

  console.log('--- Sample Transactional Data Successfully Wiped ---');

  // Verify counts
  const [
    invCount,
    billCount,
    journalCount,
    stmtLineCount,
    contactCount,
    bankAccCount,
    userCount,
    orgCount,
    accountCount,
  ] = await Promise.all([
    prisma.invoice.count(),
    prisma.bill.count(),
    prisma.journalEntry.count(),
    prisma.bankStatementLine.count(),
    prisma.contact.count(),
    prisma.bankAccount.count(),
    prisma.user.count(),
    prisma.organization.count(),
    prisma.account.count(),
  ]);

  console.log('Post-wipe verification counts:');
  console.log({
    invoices: invCount,
    bills: billCount,
    journals: journalCount,
    bankStatementLines: stmtLineCount,
    contacts: contactCount,
    bankAccounts: bankAccCount,
    preservedUsers: userCount,
    preservedOrganizations: orgCount,
    preservedAccounts: accountCount,
  });
}

wipeSampleData()
  .catch((err) => {
    console.error('Failed to wipe sample data:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
