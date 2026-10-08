import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Contact, ContactType } from '@prisma/client';
import { RawExtractedEntity } from '../providers/llm-provider.interface';

export interface EntityMatchResult {
  contact: Contact | null;
  matchType: 'EXACT_VAT' | 'EXACT_COMPANY_NO' | 'EXACT_NAME' | 'FUZZY_NAME' | 'EMAIL' | 'NONE';
  confidence: number;
  reason: string;
}

@Injectable()
export class EntityResolutionService {
  constructor(private readonly db: PrismaService) {}

  async resolveEntity(
    organizationId: string,
    extractedEntity?: RawExtractedEntity,
    expectedRole?: 'SUPPLIER' | 'CUSTOMER',
  ): Promise<EntityMatchResult> {
    if (
      !extractedEntity ||
      (!extractedEntity.name && !extractedEntity.vatNumber && !extractedEntity.companyNumber)
    ) {
      return {
        contact: null,
        matchType: 'NONE',
        confidence: 0,
        reason: 'No entity identifiers present in document extraction.',
      };
    }

    // 1. VAT Number Match (Strongest deterministic identifier)
    if (extractedEntity.vatNumber) {
      const cleanVat = extractedEntity.vatNumber.replace(/[\s-]/g, '').toUpperCase();
      const match = await this.db.contact.findFirst({
        where: {
          organizationId,
          vatNumber: {
            equals: cleanVat,
            mode: 'insensitive',
          },
          status: 'ACTIVE',
        },
      });

      if (match) {
        return {
          contact: match,
          matchType: 'EXACT_VAT',
          confidence: 0.99,
          reason: `Exact VAT identifier match (${cleanVat}).`,
        };
      }
    }

    // 2. Company Registration Number Match
    if (extractedEntity.companyNumber) {
      const cleanReg = extractedEntity.companyNumber.replace(/[\s-]/g, '').toUpperCase();
      const match = await this.db.contact.findFirst({
        where: {
          organizationId,
          companyNumber: {
            equals: cleanReg,
            mode: 'insensitive',
          },
          status: 'ACTIVE',
        },
      });

      if (match) {
        return {
          contact: match,
          matchType: 'EXACT_COMPANY_NO',
          confidence: 0.98,
          reason: `Exact company registration number match (${cleanReg}).`,
        };
      }
    }

    // 3. Exact Name Match
    if (extractedEntity.name) {
      const name = extractedEntity.name.trim();
      const match = await this.db.contact.findFirst({
        where: {
          organizationId,
          name: {
            equals: name,
            mode: 'insensitive',
          },
          status: 'ACTIVE',
        },
      });

      if (match) {
        return {
          contact: match,
          matchType: 'EXACT_NAME',
          confidence: 0.95,
          reason: `Exact contact name match ("${match.name}").`,
        };
      }

      // 4. Fuzzy Name Match with corporate suffix normalization
      // e.g. "ABC Fuel Ltd" matches "ABC Fuel Limited"
      const contacts = await this.db.contact.findMany({
        where: {
          organizationId,
          status: 'ACTIVE',
          ...(expectedRole
            ? {
                type: {
                  in: [
                    expectedRole === 'SUPPLIER' ? ContactType.SUPPLIER : ContactType.CUSTOMER,
                    ContactType.BOTH,
                  ],
                },
              }
            : {}),
        },
      });

      const normalizedSearch = this.normalizeCompanyName(name);

      for (const contact of contacts) {
        const normalizedExisting = this.normalizeCompanyName(contact.name);
        if (
          normalizedSearch === normalizedExisting ||
          normalizedSearch.includes(normalizedExisting) ||
          normalizedExisting.includes(normalizedSearch)
        ) {
          return {
            contact,
            matchType: 'FUZZY_NAME',
            confidence: 0.88,
            reason: `Normalized company name match ("${extractedEntity.name}" ~ "${contact.name}").`,
          };
        }
      }
    }

    // 5. Email Match via contact person
    if (extractedEntity.email) {
      const person = await this.db.contactPerson.findFirst({
        where: {
          organizationId,
          email: {
            equals: extractedEntity.email,
            mode: 'insensitive',
          },
        },
        include: {
          contact: true,
        },
      });

      if (person?.contact && person.contact.status === 'ACTIVE') {
        return {
          contact: person.contact,
          matchType: 'EMAIL',
          confidence: 0.92,
          reason: `Contact person email match (${extractedEntity.email}).`,
        };
      }
    }

    return {
      contact: null,
      matchType: 'NONE',
      confidence: 0,
      reason: 'Entity not found in organisation contact directory.',
    };
  }

  private normalizeCompanyName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\blimited\b/g, 'ltd')
      .replace(/\bcorporation\b/g, 'corp')
      .replace(/\bincorporated\b/g, 'inc')
      .replace(/\bcompany\b/g, 'co')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
}
