/** Background job types for the document pipeline (UPLOADED -> ... -> AWAITING_REVIEW). */
export const DOCUMENT_JOB = {
  /** UPLOADED -> TEXT_EXTRACTED: PDF text layer or OCR, word positions stored. */
  EXTRACT_TEXT: 'document.extract_text',
  /** TEXT_EXTRACTED -> AI_EXTRACTED -> VALIDATED -> AWAITING_REVIEW. */
  ANALYSE: 'document.analyse',
} as const;
