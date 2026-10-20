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
            backgroundColor: isOpen ? 'var(--bg-soft)' : '#FFFFFF',
            border: isOpen ? '1px solid var(--text-muted)' : '1px solid var(--border-subtle)',
            borderRadius: '9999px',
            fontSize: '0.825rem',
            fontWeight: 600,
            color: 'var(--text-main)',
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
              backgroundColor: 'var(--info-bg)',
              color: 'var(--primary)',
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
                color: 'var(--primary)',
                backgroundColor: 'var(--info-bg)',
                padding: '0.1rem 0.45rem',
                borderRadius: '9999px',
                border: '1px solid var(--info-border)',
              }}
            >
              {companyCount}
            </span>
          )}

          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-muted)',
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
                background: 'linear-gradient(135deg, var(--nav-bg) 0%, var(--nav-bg) 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={16} color="#B8432F" />
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
                  backgroundColor: 'var(--action)',
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
              <div style={{ padding: '0.65rem 0.85rem', borderBottom: '1px solid var(--bg-soft)', backgroundColor: 'var(--bg-app)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                  }}
                >
                  <Search size={14} style={{ color: 'var(--text-muted)' }} />
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
                      color: 'var(--text-main)',
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
                        color: 'var(--text-muted)',
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
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
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
                        backgroundColor: isActive ? 'var(--success-bg)' : 'transparent',
                        border: isActive ? '1px solid var(--success-border)' : '1px solid transparent',
                        transition: 'all 0.15s ease',
                        marginBottom: '0.25rem',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-app)';
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
                            backgroundColor: isActive ? 'var(--success-bg)' : 'var(--bg-soft)',
                            color: isActive ? 'var(--success-text)' : 'var(--ink-2)',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            border: isActive ? '1px solid var(--success-border)' : '1px solid var(--border-subtle)',
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
                              color: 'var(--text-main)',
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
                              color: 'var(--text-muted)',
                              marginTop: '0.15rem',
                            }}
                          >
                            <span>{flag}</span>
                            <span>{m.organization.baseCurrency || 'GBP'}</span>
                            <span>•</span>
                            <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>
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
                              color: 'var(--success-text)',
                              backgroundColor: 'var(--success-bg)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '9999px',
                            }}
                          >
                            <Check size={11} strokeWidth={3} />
                            Active
                          </span>
                        ) : isSwitching ? (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Switching...</span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
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
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
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
                  color: 'var(--primary)',
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
                  color: 'var(--action-text)',
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
