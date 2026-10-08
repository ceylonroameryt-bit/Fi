'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../lib/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin?: boolean;
  status?: string;
}

export interface Organization {
  id: string;
  name: string;
  legalName?: string;
  taxNumber?: string;
  country: string;
  baseCurrency: string;
  timezone: string;
}

export interface UserOrgMembership {
  organization: Organization;
  memberId: string;
  role: {
    id: string;
    name: string;
    systemKey: string | null;
    isSystemRole: boolean;
    permissions: string[];
  };
}

interface AuthContextType {
  user: User | null;
  activeOrg: Organization | null;
  activeRole: UserOrgMembership['role'] | null;
  userOrgs: UserOrgMembership[];
  isLoading: boolean;
  login: (userData: User, token?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  refreshOrgs: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userOrgs, setUserOrgs] = useState<UserOrgMembership[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [activeRole, setActiveRole] = useState<UserOrgMembership['role'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = useCallback(async () => {
    try {
      // Query /auth/me with HttpOnly ambient credentials
      const currentUser = await apiRequest<User>('/auth/me');
      setUser(currentUser);

      const orgs = await apiRequest<UserOrgMembership[]>('/organizations');
      setUserOrgs(orgs);

      const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('active_org_id') : null;
      const matchingMembership = orgs.find((m) => m.organization.id === savedOrgId) || orgs[0];

      if (matchingMembership) {
        setActiveOrg(matchingMembership.organization);
        setActiveRole(matchingMembership.role);
        localStorage.setItem('active_org_id', matchingMembership.organization.id);
      }
    } catch {
      setUser(null);
      setActiveOrg(null);
      setActiveRole(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const login = async (userData: User, _token?: string) => {
    setUser(userData);
    await loadUserData();
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('active_org_id');
    }
    setUser(null);
    setActiveOrg(null);
    setActiveRole(null);
    setUserOrgs([]);
  };

  const switchOrg = async (orgId: string) => {
    const membership = userOrgs.find((m) => m.organization.id === orgId);
    if (!membership) return;

    try {
      await apiRequest(`/organizations/${orgId}/switch`, { method: 'POST' });
      setActiveOrg(membership.organization);
      setActiveRole(membership.role);
      localStorage.setItem('active_org_id', orgId);
    } catch (err) {
      console.error('Failed to switch organisation on server:', err);
      throw err;
    }
  };

  const refreshOrgs = async () => {
    const orgs = await apiRequest<UserOrgMembership[]>('/organizations');
    setUserOrgs(orgs);
    if (activeOrg) {
      const updated = orgs.find((m) => m.organization.id === activeOrg.id);
      if (updated) {
        setActiveOrg(updated.organization);
        setActiveRole(updated.role);
      }
    }
  };

  const hasPermission = (code: string): boolean => {
    if (!activeRole) return false;
    if (activeRole.systemKey === 'OWNER') return true;
    const dotCode = code.replace(':', '.');
    const colonCode = code.replace('.', ':');
    return (
      activeRole.permissions.includes(code) ||
      activeRole.permissions.includes(dotCode) ||
      activeRole.permissions.includes(colonCode) ||
      activeRole.permissions.includes('*')
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeOrg,
        activeRole,
        userOrgs,
        isLoading,
        login,
        logout,
        switchOrg,
        refreshOrgs,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
