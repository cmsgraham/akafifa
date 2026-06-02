import { apiFetch } from './api';

export async function login(email: string, password: string) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string, password: string, displayName: string) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
}

export async function logout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export async function refreshToken() {
  return apiFetch('/auth/refresh', { method: 'POST' });
}

export async function forgotPassword(email: string) {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string) {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export async function getCurrentUser() {
  return apiFetch('/auth/me');
}
