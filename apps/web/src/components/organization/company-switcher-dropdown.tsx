'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ChevronDown,
  Check,
  Plus,
  Search,
  ExternalLink,
  Shield,
  Briefcase,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { AddCompanyModal } from './add-company-modal';

interface CompanySwitcherDropdownProps {
  className?: string;
}

const COUNTRY_FLAGS: Record<string, string> = {
  GB: '🇬🇧',
  US: '🇺🇸',
  IE: '🇮🇪',
  DE: '🇩🇪',
  FR: '🇫🇷',
  CA: '🇨🇦',
  AU: '🇦🇺',
};

export function CompanySwitcherDropdown({ className }: CompanySwitcherDropdownProps) {
  const router = useRouter();
  const { user, activeOrg, activeRole, userOrgs, switchOrg, refreshOrgs } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) return userOrgs;
    const q = searchQuery.toLowerCase();
    return userOrgs.filter(
      (m) =>
        m.organization.name.toLowerCase().includes(q) ||
        (m.organization.legalName && m.organization.legalName.toLowerCase().includes(q)) ||
        (m.role?.name && m.role.name.toLowerCase().includes(q)),
    );
  }, [userOrgs, searchQuery]);

  const handleSelectCompany = async (orgId: string) => {
    if (orgId === activeOrg?.id) {
      setIsOpen(false);
      return;
    }

    try {
      setSwitchingOrgId(orgId);
      await switchOrg(orgId);
      await refreshOrgs();
      setIsOpen(false);
      // Refresh router components to pull new company state
      router.refresh();
    } catch (err) {
      console.error('Failed to switch company:', err);
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const companyCount = userOrgs.length;

  return (
    <>
      <div style={{ position: 'relative' }} ref={dropdownRef} className={className}>
        {/* Topbar Pill Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.42rem 0.85rem',
            backgroundColor: isOpen ? '#F1F5F9' : '#FFFFFF',
            border: isOpen ? '1px solid #94A3B8' : '1px solid #E2E8F0',
            borderRadius: '9999px',
            fontSize: '0.825rem',
            fontWeight: 600,
            color: '#0F172A',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: isOpen ? '0 0 0 3px rgba(14, 165, 233, 0.15)' : '0 1px 2px rgba(0,0,0,0.04)',
          }}
          title={`Active company: ${activeOrg?.name || 'Select Company'}`}
        >
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            <Building2 size={13} />
          </div>

          <span
            style={{
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
            }}
          >
            {activeOrg?.name || 'Select Company'}
          </span>

          {companyCount > 1 && (
            <span
              style={{
                fontSize: '0.675rem',
                fontWeight: 700,
                color: '#2563EB',
                backgroundColor: '#EFF6FF',
                padding: '0.1rem 0.45rem',
                borderRadius: '9999px',
                border: '1px solid #DBEAFE',
              }}
            >
              {companyCount}
            </span>
          )}

          <ChevronDown
            size={14}
            style={{
              color: '#64748B',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {/* Dropdown Popover */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '360px',
              backgroundColor: '#FFFFFF',
              borderRadius: '0.85rem',
              boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.08)',
              overflow: 'hidden',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'linear-gradient(135deg, #041F46 0%, #082E64 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={16} color="#FF705B" />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Your Companies
                </span>
                <span
                  style={{
                    fontSize: '0.675rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '9999px',
                  }}
                >
                  {companyCount} {companyCount === 1 ? 'Entity' : 'Entities'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowAddModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  backgroundColor: '#FF705B',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
                title="Add a new company or subsidiary"
              >
                <Plus size={13} />
                <span>Add Company</span>
              </button>
            </div>

            {/* Search Filter (shown if user has 2 or more companies) */}
            {companyCount > 1 && (
              <div style={{ padding: '0.65rem 0.85rem', borderBottom: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                  }}
                >
                  <Search size={14} style={{ color: '#94A3B8' }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search your companies..."
                    style={{
                      border: 'none',
                      outline: 'none',
                      fontSize: '0.775rem',
                      color: '#0F172A',
                      width: '100%',
                      backgroundColor: 'transparent',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Companies List */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '0.45rem' }}>
              {filteredOrgs.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748B', fontSize: '0.8rem' }}>
                  No companies found matching &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                filteredOrgs.map((m) => {
                  const isActive = m.organization.id === activeOrg?.id;
                  const isSwitching = switchingOrgId === m.organization.id;
                  const flag = COUNTRY_FLAGS[m.organization.country] || '🏢';
                  const initials = m.organization.name.slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={m.organization.id}
                      onClick={() => !isSwitching && handleSelectCompany(m.organization.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.75rem',
                        borderRadius: '8px',
                        cursor: isSwitching ? 'wait' : 'pointer',
                        backgroundColor: isActive ? '#F0FDF4' : 'transparent',
                        border: isActive ? '1px solid #BBF7D0' : '1px solid transparent',
                        transition: 'all 0.15s ease',
                        marginBottom: '0.25rem',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        {/* Company Avatar */}
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            backgroundColor: isActive ? '#DCFCE7' : '#F1F5F9',
                            color: isActive ? '#15803D' : '#334155',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            border: isActive ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                          }}
                        >
                          {initials}
                        </div>

                        {/* Company Details */}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.825rem',
                              fontWeight: 700,
                              color: '#0F172A',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '180px',
                            }}
                          >
                            {m.organization.name}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.7rem',
                              color: '#64748B',
                              marginTop: '0.15rem',
                            }}
                          >
                            <span>{flag}</span>
                            <span>{m.organization.baseCurrency || 'GBP'}</span>
                            <span>•</span>
                            <span style={{ fontWeight: 600, color: '#475569' }}>
                              {m.role?.name || 'Owner'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {isActive ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.675rem',
                              fontWeight: 700,
                              color: '#166534',
                              backgroundColor: '#DCFCE7',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '9999px',
                            }}
                          >
                            <Check size={11} strokeWidth={3} />
                            Active
                          </span>
                        ) : isSwitching ? (
                          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Switching...</span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: '#94A3B8',
                              fontWeight: 600,
                              opacity: 0.7,
                            }}
                          >
                            Switch
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Link
                href="/organizations"
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#2563EB',
                  textDecoration: 'none',
                }}
              >
                <span>Manage All Companies</span>
                <ArrowRight size={12} />
              </Link>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowAddModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#FF705B',
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} />
                <span>New Company</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Company Quick Modal */}
      <AddCompanyModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          // Newly created company is already switched & selected
        }}
      />
    </>
  );
}
