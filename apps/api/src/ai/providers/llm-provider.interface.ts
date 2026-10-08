export interface RawExtractedLine {
  description: string;
  quantity?: number | string;
  unit?: string;
  unitPrice?: string;
  net?: string;
  vat?: string;
  total?: string;
}

export interface RawExtractedEntity {
  name?: string;
  vatNumber?: string;
  companyNumber?: string;
  address?: string;
  email?: string;
}

export interface RawExtractionResult {
  documentTypeHint?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  issuer?: RawExtractedEntity;
  recipient?: RawExtractedEntity;
  lines: RawExtractedLine[];
  subtotal?: string;
  vatTotal?: string;
  total?: string;
  rawText?: string;
}

export interface PromptContext {
  extracted: RawExtractionResult;
  organizationName: string;
  organizationTaxId?: string;
  industry: string;
  inventoryEnabled: boolean;
  knownContacts: Array<{ id: string; name: string; type: string; vatNumber?: string | null }>;
}

export interface LLMInterpretationResult {
  detectedDirection: 'PURCHASE' | 'SALE' | 'UNKNOWN';
  reasoning: string;
  lineInterpretations: Array<{
    lineNumber: number;
    productType: 'INVENTORY' | 'EXPENSE' | 'FIXED_ASSET' | 'SERVICE' | 'UNKNOWN';
    semanticCategory: string;
    confidence: number;
  }>;
}

export interface ILlmProvider {
  extractDocumentData(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    text?: string;
  }): Promise<RawExtractionResult>;

  interpretClassification(context: PromptContext): Promise<LLMInterpretationResult>;
}
