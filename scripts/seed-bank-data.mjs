import { PrismaClient, BankAccountStatus, BankStatementStatus, BankStatementLineStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo bank accounts and statement lines...');

  const orgs = await prisma.organization.findMany({
    where: {
      name: { in: ['Alpha Consulting Ltd Hardened', 'Demo Consulting Ltd'] },
    },
    include: {
      accounts: true,
      contacts: true,
      bankAccounts: true,
    },
  });

  for (const org of orgs) {
    console.log(`Processing org: ${org.name} (${org.id})`);

    // Find bank nominal account (usually code 1200 or ASSET)
    const bankNominal = org.accounts.find((a) => a.code === '1200' || a.accountType === 'BANK' || a.accountType === 'CURRENT_ASSET') || org.accounts[0];
    if (!bankNominal) {
      console.log(`No nominal accounts found for org ${org.name}, skipping`);
      continue;
    }

    // Check if bank account already exists
    let bankAccount = org.bankAccounts[0];
    if (!bankAccount) {
      bankAccount = await prisma.bankAccount.create({
        data: {
          organizationId: org.id,
          name: 'Barclays Business Current Account',
          accountNumber: '83920184',
          sortCode: '20-45-11',
          currency: org.baseCurrency || 'GBP',
          glAccountId: bankNominal.id,
          openingBalance: 12500.00,
          currentBalance: 19970.00,
          status: BankAccountStatus.ACTIVE,
        },
      });
      console.log(`Created bank account: ${bankAccount.name} (${bankAccount.id})`);
    }

    // Check if bank statements exist
    const existingStatements = await prisma.bankStatement.findMany({
      where: { bankAccountId: bankAccount.id },
    });

    if (existingStatements.length === 0) {
      const statement = await prisma.bankStatement.create({
        data: {
          organizationId: org.id,
          bankAccountId: bankAccount.id,
          statementNumber: 'STMT-2026-10',
          startDate: new Date('2026-10-01'),
          endDate: new Date('2026-10-18'),
          openingBalance: 12500.00,
          closingBalance: 19970.00,
          status: BankStatementStatus.POSTED,
          sourceType: 'CSV_IMPORT',
        },
      });

      // Find nominals for auto-categorisation
      const salesAccount = org.accounts.find((a) => a.code.startsWith('4') || a.accountType === 'REVENUE') || bankNominal;
      const softwareAccount = org.accounts.find((a) => a.name.toLowerCase().includes('software') || a.code === '7500' || a.accountType === 'EXPENSE') || bankNominal;
      const officeAccount = org.accounts.find((a) => a.name.toLowerCase().includes('office') || a.code === '7100' || a.accountType === 'EXPENSE') || bankNominal;

      // Find sample contacts
      const clientContact = org.contacts.find((c) => c.contactType === 'CUSTOMER') || org.contacts[0];
      const vendorContact = org.contacts.find((c) => c.contactType === 'SUPPLIER') || org.contacts[1];

      const lines = [
        {
          transactionDate: new Date('2026-10-03'),
          description: 'Tech Innovations Ltd - Q4 Retainer INV-2026-001',
          amount: 4500.00,
          payee: 'Tech Innovations Ltd',
          reference: 'INV-2026-001',
          status: BankStatementLineStatus.CATEGORISED,
          suggestedAccountId: salesAccount.id,
          suggestedContactId: clientContact?.id || null,
          aiConfidence: 0.96,
          aiReasoning: 'Invoice reference INV-2026-001 matches Customer Tech Innovations Ltd retainers.',
        },
        {
          transactionDate: new Date('2026-10-05'),
          description: 'Amazon Web Services AWS Cloud Infrastructure',
          amount: -250.00,
          payee: 'AWS EMEA SARL',
          reference: 'AWS-9382104',
          status: BankStatementLineStatus.CATEGORISED,
          suggestedAccountId: softwareAccount.id,
          suggestedContactId: vendorContact?.id || null,
          aiConfidence: 0.94,
          aiReasoning: 'Recognised recurring cloud hosting service provider. Categorised under Software & IT.',
        },
        {
          transactionDate: new Date('2026-10-08'),
          description: 'Paper & Co - Office Printer Supplies',
          amount: -85.00,
          payee: 'Paper & Co Ltd',
          reference: 'POS-19284',
          status: BankStatementLineStatus.CATEGORISED,
          suggestedAccountId: officeAccount.id,
          suggestedContactId: vendorContact?.id || null,
          aiConfidence: 0.91,
          aiReasoning: 'Merchant keyword "Office Supplies" matches Office Expenses nominal code.',
        },
        {
          transactionDate: new Date('2026-10-10'),
          description: 'Global Media Agency - Digital Strategy Payment',
          amount: 2400.00,
          payee: 'Global Media Agency',
          reference: 'BACS-GMA-44',
          status: BankStatementLineStatus.CATEGORISED,
          suggestedAccountId: salesAccount.id,
          suggestedContactId: clientContact?.id || null,
          aiConfidence: 0.89,
          aiReasoning: 'Inbound client BACS settlement for strategic consulting fee.',
        },
        {
          transactionDate: new Date('2026-10-12'),
          description: 'British Telecom BT Business Broadband',
          amount: -120.00,
          payee: 'British Telecom PLC',
          reference: 'DD-BT-202610',
          status: BankStatementLineStatus.CATEGORISED,
          suggestedAccountId: officeAccount.id,
          suggestedContactId: vendorContact?.id || null,
          aiConfidence: 0.95,
          aiReasoning: 'Direct Debit identifier matches recurring telecommunications utility.',
        },
        {
          transactionDate: new Date('2026-10-15'),
          description: 'Google Workspace Cloud Email & Drive 15 Users',
          amount: -45.00,
          payee: 'Google Ireland Ltd',
          reference: 'GOOG-WORKSPACE-01',
          status: BankStatementLineStatus.CATEGORISED,
          suggestedAccountId: softwareAccount.id,
          suggestedContactId: vendorContact?.id || null,
          aiConfidence: 0.98,
          aiReasoning: 'Known SaaS subscription platform. Automatically routed to IT Subscriptions.',
        },
        {
          transactionDate: new Date('2026-10-16'),
          description: 'Bright Ideas Design Co - Workshop Deposit',
          amount: 1250.00,
          payee: 'Bright Ideas Design Co',
          reference: 'DEP-88301',
          status: BankStatementLineStatus.CATEGORISED,
          suggestedAccountId: salesAccount.id,
          suggestedContactId: clientContact?.id || null,
          aiConfidence: 0.88,
          aiReasoning: 'Customer prepayment deposit received via bank transfer.',
        },
        {
          transactionDate: new Date('2026-10-17'),
          description: 'Adobe Creative Cloud Team License',
          amount: -180.00,
          payee: 'Adobe Systems Software',
          reference: 'ADOBE-CC-994',
          status: BankStatementLineStatus.CATEGORISED,
          suggestedAccountId: softwareAccount.id,
          suggestedContactId: vendorContact?.id || null,
          aiConfidence: 0.97,
          aiReasoning: 'High confidence match for design software subscription.',
        },
      ];

      for (let i = 0; i < lines.length; i++) {
        const item = lines[i];
        await prisma.bankStatementLine.create({
          data: {
            statementId: statement.id,
            bankAccountId: bankAccount.id,
            organizationId: org.id,
            lineNumber: i + 1,
            transactionDate: item.transactionDate,
            description: item.description,
            amount: item.amount,
            currency: org.baseCurrency || 'GBP',
            payee: item.payee,
            reference: item.reference,
            status: item.status,
            suggestedAccountId: item.suggestedAccountId,
            suggestedContactId: item.suggestedContactId,
            aiConfidence: item.aiConfidence,
            aiReasoning: item.aiReasoning,
          },
        });
      }

      console.log(`Created 8 demo statement lines with AI categorisations for ${org.name}`);
    }
  }

  console.log('Demo bank data seeding complete!');
}

main()
  .catch((err) => {
    console.error('Error seeding bank data:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
