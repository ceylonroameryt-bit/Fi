/** Every field is optional: absent on the document means absent here, never a default. */
export interface RawExtractedLine {
  description: string;
  quantity?: string;
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

export interface ILlmProvider {
  extractDocumentData(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    text?: string;
  }): Promise<RawExtractionResult>;
}
