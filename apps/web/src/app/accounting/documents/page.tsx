'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Sparkles,
  Building2,
  ShieldCheck,
  RefreshCw,
  Search,
  Check,
  X,
  FileCheck,
} from 'lucide-react';

interface AiDocItem {
  id: string;
  fileName: string;
  documentType: string;
  direction: 'PURCHASE' | 'SALE' | 'UNKNOWN';
  status: 'PENDING' | 'PROCESSING' | 'REQUIRES_REVIEW' | 'DRAFTED' | 'APPROVED' | 'REJECTED' | 'FAILED';
  confidenceScore: string | null;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
  suggestions?: Array<{
    id: string;
    status: string;
    confidenceLevel: string;
    confidenceScore: string;
  }>;
}

interface DetailedDoc {
  id: string;
  fileName: string;
  documentType: string;
  direction: 'PURCHASE' | 'SALE' | 'UNKNOWN';
  status: string;
  confidenceScore: string;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  extractions?: Array<{
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string;
    currency?: string;
    issuerName?: string;
    issuerTaxId?: string;
    recipientName?: string;
    recipientTaxId?: string;
    subtotal?: string;
    taxAmount?: string;
    totalAmount?: string;
  }>;
  classifications?: Array<{
    direction: string;
    entityType: string;
    entityId?: string;
    entityMatchReason?: string;
    classification: string;
    reasoning?: string;
  }>;
  lineClassifications?: Array<{
    id: string;
    lineNumber: number;
    rawDescription: string;
    quantity: string;
    unit?: string;
    unitPrice: string;
    netAmount: string;
    taxAmount: string;
    totalAmount: string;
    productType: string;
    productClassification: string;
    taxClassification: string;
    accountingCategory: string;
    resolvedAccountId?: string;
    account?: { id: string; code: string; name: string };
  }>;
  suggestions?: Array<{
    id: string;
    suggestionType: string;
    status: string;
    payload: any;
  }>;
  auditEvents?: Array<{
    id: string;
    eventType: string;
    actorId?: string;
    metadata?: any;
    createdAt: string;
  }>;
}

export default function DocumentIntelligencePage() {
  const { activeOrg } = useAuth();
  const [documents, setDocuments] = useState<AiDocItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DetailedDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('INV-10482-ABC-Fuel.txt');
  const [uploadText, setUploadText] = useState(
    `ABC Fuel Ltd\nInvoice: INV-10482\nDate: 2026-10-08\nVAT: GB123456789\n\nBill To:\nBlynt Petrol Station\nVAT: GB987654321\n\n10,000 litres Diesel @ £1.20 = £12,000.00\nVAT (20%): £2,400.00\nTotal: £14,400.00`,
  );
  const [autoDraft, setAutoDraft] = useState(false);

  const loadDocDetails = useCallback(async (id: string) => {
    try {
      setDetailLoading(true);
      const doc = await apiRequest<DetailedDoc>(`/ai/documents/${id}`);
      setSelectedDoc(doc);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch document details');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<AiDocItem[]>(`/ai/documents`);
      setDocuments(Array.isArray(data) ? data : []);
      if (data && data.length > 0) {
        setSelectedDoc((prev) => {
          if (!prev) {
            loadDocDetails(data[0].id);
          }
          return prev;
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load intelligence documents');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, loadDocDetails]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileName) return;
    try {
      setActionLoading(true);
      setError(null);
      const created = await apiRequest<DetailedDoc>('/ai/documents', {
        method: 'POST',
        body: JSON.stringify({
          fileName: uploadFileName,
          text: uploadText,
          mimeType: 'text/plain',
          autoDraftIfHighConfidence: autoDraft,
        }),
      });
      setShowUploadModal(false);
      setSuccessMsg(`Document ${uploadFileName} uploaded and processed.`);
      await loadDocuments();
      if (created?.id) {
        await loadDocDetails(created.id);
      }
    } catch (err: any) {
      setError(err.message || 'Upload processing failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedDoc) return;
    try {
      setActionLoading(true);
      setError(null);
      await apiRequest(`/ai/documents/${selectedDoc.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSuccessMsg('Document suggestion successfully approved and drafted into Blynt.');
      await loadDocDetails(selectedDoc.id);
      await loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to approve suggestion');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDoc) return;
    const reason = prompt('Please specify rejection reason:');
    if (!reason) return;
    try {
      setActionLoading(true);
      setError(null);
      await apiRequest(`/ai/documents/${selectedDoc.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setSuccessMsg('Document suggestion rejected.');
      await loadDocDetails(selectedDoc.id);
      await loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to reject suggestion');
    } finally {
      setActionLoading(false);
    }
  };

  const extraction = selectedDoc?.extractions?.[0];
  const classification = selectedDoc?.classifications?.[0];
  const lines = selectedDoc?.lineClassifications || [];
  const suggestion = selectedDoc?.suggestions?.[0];
  const accountingIntent = suggestion?.payload?.accountingIntent;

  return (
    <AppShell>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              Document Intelligence
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#EEF2FF',
                color: '#4F46E5',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
              }}
            >
              <Sparkles size={12} />
              Blynt AI Core
            </span>
          </div>
          <p
            className="page-subtitle"
            style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.875rem' }}
          >
            Background accounting classification engine. Deterministic double-entry validation with human
            review oversight.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => loadDocuments()}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Upload size={14} />
            Upload Document
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: '#F0FDF4',
            border: '1px solid #86EFAC',
            color: '#166534',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Grid: Document List on Left, Detailed Review Screen on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', minHeight: '650px' }}>
        {/* Document Ingestion Stream */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid #E2E8F0',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: '#334155',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>INGESTED DOCUMENTS</span>
            <span style={{ color: '#64748B' }}>{documents.length}</span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && documents.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                No documents found. Upload a test invoice above to trigger the pipeline.
              </div>
            ) : (
              documents.map((d) => {
                const isSelected = selectedDoc?.id === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => loadDocDetails(d.id)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderBottom: '1px solid #F1F5F9',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#F4F7FC' : '#FFFFFF',
                      borderLeft: isSelected ? '3px solid #2563EB' : '3px solid transparent',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          color: '#0F172A',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          maxWidth: '170px',
                        }}
                      >
                        {d.fileName}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                          backgroundColor:
                            d.direction === 'PURCHASE'
                              ? '#FEF3C7'
                              : d.direction === 'SALE'
                                ? '#DCFCE7'
                                : '#F1F5F9',
                          color:
                            d.direction === 'PURCHASE'
                              ? '#92400E'
                              : d.direction === 'SALE'
                                ? '#166534'
                                : '#64748B',
                        }}
                      >
                        {d.direction}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '0.4rem',
                        fontSize: '0.75rem',
                        color: '#64748B',
                      }}
                    >
                      <span>{d.documentType.replace('_', ' ')}</span>
                      <span
                        style={{
                          color:
                            d.status === 'APPROVED' || d.status === 'DRAFTED'
                              ? '#16A34A'
                              : d.status === 'REQUIRES_REVIEW'
                                ? '#D97706'
                                : '#475569',
                          fontWeight: 500,
                        }}
                      >
                        {d.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detailed Review Workspace */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {detailLoading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>
              Loading document inspection...
            </div>
          ) : !selectedDoc ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>
              Select a document from the stream on the left to review intelligence suggestions.
            </div>
          ) : (
            <>
              {/* Document Overview Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderBottom: '1px solid #F1F5F9',
                  paddingBottom: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                      {extraction?.invoiceNumber || selectedDoc.fileName}
                    </h2>
                    <span
                      style={{
                        padding: '0.2rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: selectedDoc.direction === 'PURCHASE' ? '#FEF3C7' : '#DCFCE7',
                        color: selectedDoc.direction === 'PURCHASE' ? '#92400E' : '#166534',
                      }}
                    >
                      DIRECTION: {selectedDoc.direction}
                    </span>
                    <span
                      style={{
                        padding: '0.2rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor:
                          selectedDoc.confidenceLevel === 'HIGH'
                            ? '#DCFCE7'
                            : selectedDoc.confidenceLevel === 'MEDIUM'
                              ? '#FEF3C7'
                              : '#FEE2E2',
                        color:
                          selectedDoc.confidenceLevel === 'HIGH'
                            ? '#166534'
                            : selectedDoc.confidenceLevel === 'MEDIUM'
                              ? '#92400E'
                              : '#991B1B',
                      }}
                    >
                      {selectedDoc.confidenceLevel} CONFIDENCE (
                      {Math.round(Number(selectedDoc.confidenceScore || 0) * 100)}%)
                    </span>
                  </div>

                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                    {classification?.reasoning ||
                      'Transaction direction determined by 5-tier legal hierarchy.'}
                  </p>
                </div>

                {/* Review Actions */}
                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  {selectedDoc.status === 'REQUIRES_REVIEW' || selectedDoc.status === 'PENDING' ? (
                    <>
                      <button
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="btn btn-secondary"
                        style={{ color: '#DC2626', borderColor: '#FECACA' }}
                      >
                        <X size={15} style={{ marginRight: '0.35rem' }} />
                        Reject
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="btn btn-primary"
                        style={{ backgroundColor: '#16A34A', borderColor: '#16A34A' }}
                      >
                        <Check size={15} style={{ marginRight: '0.35rem' }} />
                        Approve & Post Draft
                      </button>
                    </>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: '#16A34A',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                      }}
                    >
                      <CheckCircle2 size={16} />
                      {selectedDoc.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Extraction & Resolved Entity Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {selectedDoc.direction === 'PURCHASE' ? 'Supplier (Issuer)' : 'Seller (Issuer)'}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0F172A' }}>
                    {extraction?.issuerName || 'Unknown Issuer'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>
                    VAT: {extraction?.issuerTaxId || 'None detected'}
                  </div>
                  {classification?.entityMatchReason && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <CheckCircle2 size={13} />
                      {classification.entityMatchReason}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {selectedDoc.direction === 'PURCHASE' ? 'Buyer (Recipient)' : 'Customer (Recipient)'}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0F172A' }}>
                    {extraction?.recipientName || 'Unknown Recipient'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>
                    VAT: {extraction?.recipientTaxId || 'None detected'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.5rem' }}>
                    Total:{' '}
                    <strong>
                      {extraction?.currency ?? '£'} {extraction?.totalAmount ?? '0.00'}
                    </strong>{' '}
                    (VAT: {extraction?.taxAmount ?? '0.00'})
                  </div>
                </div>
              </div>

              {/* Line Items & Product Classification Table */}
              <div>
                <h3
                  style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.65rem' }}
                >
                  Line Items & Semantic Classification
                </h3>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                    <thead>
                      <tr
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderBottom: '1px solid #E2E8F0',
                          textAlign: 'left',
                          color: '#64748B',
                        }}
                      >
                        <th style={{ padding: '0.65rem 0.85rem' }}>#</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Description</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Product Type</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Accounting Category</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Resolved Account</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Net</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Tax</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#64748B' }}>{l.lineNumber}</td>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#0F172A' }}>
                            {l.rawDescription}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                fontSize: '0.725rem',
                                fontWeight: 600,
                                backgroundColor: l.productType === 'INVENTORY' ? '#E0F2FE' : '#F1F5F9',
                                color: l.productType === 'INVENTORY' ? '#0369A1' : '#475569',
                              }}
                            >
                              {l.productType}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#4338CA', fontWeight: 500 }}>
                            {l.accountingCategory}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#334155' }}>
                            {l.account ? `${l.account.code} - ${l.account.name}` : 'Default Ledger'}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>£{l.netAmount}</td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>£{l.taxAmount}</td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 600 }}>
                            £{l.totalAmount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Proposed Double-Entry Accounting Invariant Screen */}
              {accountingIntent && (
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShieldCheck size={18} color="#059669" />
                      <h3 style={{ fontSize: '0.925rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                        Proposed Double-Entry Journal Lines
                      </h3>
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        backgroundColor: accountingIntent.isBalanced ? '#DCFCE7' : '#FEE2E2',
                        color: accountingIntent.isBalanced ? '#166534' : '#991B1B',
                      }}
                    >
                      {accountingIntent.isBalanced ? '✓ DOUBLE-ENTRY BALANCED' : '⚠ UNBALANCED'}
                    </span>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #CBD5E1', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '0.5rem' }}>Account Code</th>
                        <th style={{ padding: '0.5rem' }}>Account Name</th>
                        <th style={{ padding: '0.5rem' }}>Classification / Purpose</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Debit</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountingIntent.lines?.map((pl: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>
                            {pl.accountCode}
                          </td>
                          <td style={{ padding: '0.5rem', fontWeight: 500 }}>{pl.accountName}</td>
                          <td style={{ padding: '0.5rem', color: '#64748B' }}>{pl.description}</td>
                          <td
                            style={{
                              padding: '0.5rem',
                              textAlign: 'right',
                              fontWeight: Number(pl.debit) > 0 ? 600 : 400,
                            }}
                          >
                            {Number(pl.debit) > 0 ? `£${pl.debit}` : '-'}
                          </td>
                          <td
                            style={{
                              padding: '0.5rem',
                              textAlign: 'right',
                              fontWeight: Number(pl.credit) > 0 ? 600 : 400,
                            }}
                          >
                            {Number(pl.credit) > 0 ? `£${pl.credit}` : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr
                        style={{
                          fontWeight: 700,
                          borderTop: '2px solid #CBD5E1',
                          backgroundColor: '#EDF2F7',
                        }}
                      >
                        <td colSpan={3} style={{ padding: '0.5rem' }}>
                          Total Verified Invariant
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          £{accountingIntent.totalDebit}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          £{accountingIntent.totalCredit}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {accountingIntent.inventoryValuationNotice && (
                    <div
                      style={{
                        marginTop: '0.85rem',
                        padding: '0.65rem 0.85rem',
                        backgroundColor: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        borderRadius: '6px',
                        fontSize: '0.775rem',
                        color: '#1E40AF',
                      }}
                    >
                      <strong>Inventory Guardrail:</strong> {accountingIntent.inventoryValuationNotice}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '1.75rem',
              width: '100%',
              maxWidth: '560px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Upload Document for Intelligence Processing
              </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpload}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}
                >
                  Document File Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}
                >
                  Document Text / OCR Content
                </label>
                <textarea
                  className="form-input"
                  rows={8}
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="autodraft"
                  checked={autoDraft}
                  onChange={(e) => setAutoDraft(e.target.checked)}
                />
                <label
                  htmlFor="autodraft"
                  style={{ fontSize: '0.825rem', color: '#475569', cursor: 'pointer' }}
                >
                  Auto-draft into invoices if confidence is HIGH (&gt;90%)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowUploadModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary">
                  {actionLoading ? 'Processing...' : 'Process Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
