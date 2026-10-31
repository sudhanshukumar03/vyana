import { describe, it, expect, beforeEach } from 'vitest';
import { useAdminAccessStore, isUserAdminOrDev } from './useAdminAccess';

describe('useAdminAccess', () => {
  beforeEach(() => {
    localStorage.clear();
    useAdminAccessStore.getState().setDevToolsEnabled(false);
  });

  it('hides back-office by default for null or patient users', () => {
    expect(isUserAdminOrDev(null, false)).toBe(false);
    expect(isUserAdminOrDev('patient@example.com', false)).toBe(false);
    expect(isUserAdminOrDev('john.doe@gmail.com', false)).toBe(false);
  });

  it('shows back-office automatically for admin accounts', () => {
    expect(isUserAdminOrDev('admin@vyana.health', false)).toBe(true);
    expect(isUserAdminOrDev('clinic-admin@hospital.org', false)).toBe(true);
    expect(isUserAdminOrDev('dev@tech.internal', false)).toBe(true);
    expect(isUserAdminOrDev('lead-technician@lab.io', false)).toBe(true);
  });

  it('shows back-office when dev tools mode is enabled for a patient', () => {
    expect(isUserAdminOrDev('patient@example.com', false)).toBe(false);
    expect(isUserAdminOrDev('patient@example.com', true)).toBe(true);
  });

  it('toggles dev tools state and persists to localStorage', () => {
    expect(useAdminAccessStore.getState().devToolsEnabled).toBe(false);

    useAdminAccessStore.getState().toggleDevTools();
    expect(useAdminAccessStore.getState().devToolsEnabled).toBe(true);
    expect(localStorage.getItem('vyana_dev_tools')).toBe('true');

    useAdminAccessStore.getState().toggleDevTools();
    expect(useAdminAccessStore.getState().devToolsEnabled).toBe(false);
    expect(localStorage.getItem('vyana_dev_tools')).toBeNull();
  });

  it('explicitly sets dev tools enabled and disabled', () => {
    useAdminAccessStore.getState().setDevToolsEnabled(true);
    expect(useAdminAccessStore.getState().devToolsEnabled).toBe(true);
    expect(localStorage.getItem('vyana_dev_tools')).toBe('true');

    useAdminAccessStore.getState().setDevToolsEnabled(false);
    expect(useAdminAccessStore.getState().devToolsEnabled).toBe(false);
    expect(localStorage.getItem('vyana_dev_tools')).toBeNull();
  });
});
