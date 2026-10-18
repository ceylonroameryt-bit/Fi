import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  BankTransactionStatus,
  Prisma,
  StatementImportStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { ImportStatementDto } from './dto/import-statement.dto';
import { parseStatementFile } from './parsers/statement-parser';
import { BankRulesService } from './bank-rules.service';

@Injectable()
export class StatementImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly bankRules: BankRulesService,
  ) {}

  async importStatement(
    organizationId: string,
    dto: ImportStatementDto,
    actor: Actor,
  ) {
    // 1. Verify bank account exists in organization
    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, organizationId },
    });
    if (!bankAccount) {
      throw new DomainException('BANK_ACCOUNT_NOT_FOUND', 'Bank account not found in this organisation');
    }

    // 2. Decode content if base64 or plain string
    let rawContent = dto.fileContent;
    if (!rawContent.includes('\n') && !rawContent.includes('<') && rawContent.length > 50) {
      try {
        const decoded = Buffer.from(rawContent, 'base64').toString('utf-8');
        if (decoded.length > 0) rawContent = decoded;
      } catch {
        // use rawContent
      }
    }

    // 3. Compute SHA-256 for duplicate file detection
    const sha256 = crypto.createHash('sha256').update(rawContent).digest('hex');

    const existingImport = await this.prisma.bankStatementImport.findFirst({
      where: { organizationId, fileSha256: sha256 },
    });
    if (existingImport) {
      throw new DomainException(
        'BANK_STATEMENT_DUPLICATE',
        `This statement file has already been imported on ${new Date(existingImport.importedAt).toLocaleDateString('en-GB')} (${existingImport.fileName})`,
      );
    }

    // 4. Parse statement
    const parsed = parseStatementFile(rawContent, dto.fileFormat, dto.columnMapping);

    if (parsed.lines.length === 0) {
      throw new DomainException(
        'BANK_STATEMENT_INVALID_FORMAT',
        `No valid transaction lines could be parsed from ${dto.fileName}. Please verify file format or column mappings.`,
      );
    }

    // 5. In database transaction: create import header and lines
    return this.prisma.$transaction(async (tx) => {
      const dates = parsed.lines.map((l) => l.transactionDate.getTime());
      const fromDate = new Date(Math.min(...dates));
      const toDate = new Date(Math.max(...dates));

      const statementImport = await tx.bankStatementImport.create({
        data: {
          organizationId,
          bankAccountId: bankAccount.id,
          fileName: dto.fileName,
          fileFormat: dto.fileFormat,
          fileSha256: sha256,
          lineCount: parsed.lines.length,
          fromDate,
          toDate,
          openingBalance: parsed.openingBalance ? new Prisma.Decimal(parsed.openingBalance.toString()) : null,
          closingBalance: parsed.closingBalance ? new Prisma.Decimal(parsed.closingBalance.toString()) : null,
          status: StatementImportStatus.IMPORTED,
          columnMapping: (dto.columnMapping ?? {}) as Prisma.InputJsonValue,
          importedById: actor.userId!,
        },
      });

      // 6. Pre-evaluate bank rules
      const rules = await this.bankRules.getActiveRules(organizationId, bankAccount.id, tx);

      const createdLines = [];
      for (const parsedLine of parsed.lines) {
        // Line-level deduplication: check if same transaction exists
        const duplicateLine = await tx.bankStatementLine.findFirst({
          where: {
            organizationId,
            bankAccountId: bankAccount.id,
            transactionDate: parsedLine.transactionDate,
            amount: new Prisma.Decimal(parsedLine.amount.toFixed(4)),
            ...(parsedLine.externalId ? { externalId: parsedLine.externalId } : {}),
          },
        });

        if (duplicateLine) {
          // Skip duplicate line to ensure idempotency
          continue;
        }

        const matchResult = this.bankRules.matchLineAgainstRules(parsedLine, rules);

        const line = await tx.bankStatementLine.create({
          data: {
            organizationId,
            bankAccountId: bankAccount.id,
            importId: statementImport.id,
            transactionDate: parsedLine.transactionDate,
            description: parsedLine.description,
            payee: parsedLine.payee ?? null,
            reference: parsedLine.reference ?? null,
            amount: new Prisma.Decimal(parsedLine.amount.toFixed(4)),
            balance: parsedLine.balance ? new Prisma.Decimal(parsedLine.balance.toFixed(4)) : null,
            currency: bankAccount.currency,
            externalId: parsedLine.externalId ?? null,
            rawData: (parsedLine.rawData ?? {}) as Prisma.InputJsonValue,
            status: matchResult.autoCategorise
              ? BankTransactionStatus.CATEGORISED
              : BankTransactionStatus.UNMATCHED,
            suggestedAccountId: matchResult.suggestedAccountId ?? null,
            suggestedTaxCodeId: matchResult.suggestedTaxCodeId ?? null,
            suggestedContactId: matchResult.suggestedContactId ?? null,
            matchConfidence: matchResult.confidence ? new Prisma.Decimal(matchResult.confidence.toString()) : null,
            matchExplanation: matchResult.explanation ?? null,
          },
        });

        if (matchResult.matchedRuleId) {
          await tx.bankRule.update({
            where: { id: matchResult.matchedRuleId },
            data: { timesApplied: { increment: 1 } },
          });
        }

        createdLines.push(line);
      }

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.BANK_STATEMENT_IMPORTED,
        entityType: 'bank_statement_import',
        entityId: statementImport.id,
        newValues: {
          fileName: statementImport.fileName,
          totalLines: parsed.lines.length,
          importedLines: createdLines.length,
        },
      });

      return {
        import: statementImport,
        linesImported: createdLines.length,
        linesSkippedDuplicates: parsed.lines.length - createdLines.length,
      };
    });
  }

  async listStatementLines(
    organizationId: string,
    bankAccountId?: string,
    status?: BankTransactionStatus,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.BankStatementLineWhereInput = {
      organizationId,
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.bankStatementLine.findMany({
        where,
        include: {
          bankAccount: { select: { id: true, name: true, currency: true } },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.bankStatementLine.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listImports(organizationId: string, bankAccountId?: string) {
    return this.prisma.bankStatementImport.findMany({
      where: {
        organizationId,
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      include: {
        bankAccount: { select: { id: true, name: true } },
      },
      orderBy: { importedAt: 'desc' },
    });
  }
}
