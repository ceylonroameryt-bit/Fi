import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveEndpoint, getApiBaseUrl, ApiError } from './api';

describe('Web API Client & Endpoint Resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('resolveEndpoint', () => {
    it('returns raw endpoint when activeOrgId is not provided', () => {
      expect(resolveEndpoint('/accounts')).toBe('/accounts');
      expect(resolveEndpoint('invoices')).toBe('/invoices');
      expect(resolveEndpoint('/journals')).toBe('/journals');
    });

    it('prefixes tenant-scoped accounting endpoints with organization path when activeOrgId is present', () => {
      const orgId = 'org-12345';
      expect(resolveEndpoint('/accounts', orgId)).toBe(`/organizations/${orgId}/accounts`);
      expect(resolveEndpoint('/invoices', orgId)).toBe(`/organizations/${orgId}/invoices`);
      expect(resolveEndpoint('/journals', orgId)).toBe(`/organizations/${orgId}/journals`);
      expect(resolveEndpoint('/contacts', orgId)).toBe(`/organizations/${orgId}/contacts`);
      expect(resolveEndpoint('/reports', orgId)).toBe(`/organizations/${orgId}/reports`);
      expect(resolveEndpoint('/financial-years', orgId)).toBe(`/organizations/${orgId}/financial-years`);
      expect(resolveEndpoint('/accounting-periods', orgId)).toBe(`/organizations/${orgId}/periods`);
      expect(resolveEndpoint('/organization-members', orgId)).toBe(`/organizations/${orgId}/members`);
    });

    it('does not double-prefix endpoints already starting with /organizations, /auth, /health, or /admin', () => {
      const orgId = 'org-12345';
      expect(resolveEndpoint('/organizations', orgId)).toBe('/organizations');
      expect(resolveEndpoint('/organizations/org-999', orgId)).toBe('/organizations/org-999');
      expect(resolveEndpoint('/auth/login', orgId)).toBe('/auth/login');
      expect(resolveEndpoint('/auth/me', orgId)).toBe('/auth/me');
      expect(resolveEndpoint('/health', orgId)).toBe('/health');
      expect(resolveEndpoint('/admin/overview', orgId)).toBe('/admin/overview');
    });
  });

  describe('getApiBaseUrl', () => {
    it('uses NEXT_PUBLIC_API_URL when provided and appends /api/v1 if missing', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
      expect(getApiBaseUrl()).toBe('https://api.example.com/api/v1');

      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/api/v1';
      expect(getApiBaseUrl()).toBe('https://api.example.com/api/v1');
    });

    it('falls back to API_URL or default localhost in server environment', () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      process.env.API_URL = 'http://backend-service:4000/api/v1';
      expect(getApiBaseUrl()).toBe('http://backend-service:4000/api/v1');

      delete process.env.API_URL;
      expect(getApiBaseUrl()).toBe('http://localhost:4000/api/v1');
    });
  });

  describe('ApiError', () => {
    it('constructs an error with code, status, message, and optional details', () => {
      const err = new ApiError('FORBIDDEN', 'Access denied to organization', 403, { tenantId: 'org-abc' });
      expect(err.name).toBe('ApiError');
      expect(err.code).toBe('FORBIDDEN');
      expect(err.message).toBe('Access denied to organization');
      expect(err.status).toBe(403);
      expect(err.details).toEqual({ tenantId: 'org-abc' });
    });
  });
});
