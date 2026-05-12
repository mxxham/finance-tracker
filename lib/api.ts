const BASE = '/api';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;
}

function headers(extra?: Record<string, string>) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...((options?.headers as Record<string, string>) || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  getTransactions: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/transactions${qs}`);
  },
  createTransaction: (body: object) =>
    request('/transactions', { method: 'POST', body: JSON.stringify(body) }),
  updateTransaction: (id: number, body: object) =>
    request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTransaction: (id: number) =>
    request(`/transactions/${id}`, { method: 'DELETE' }),

  getCategories: () => request('/categories'),
  createCategory: (body: object) =>
    request('/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id: number, body: object) =>
    request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: (id: number) =>
    request(`/categories/${id}`, { method: 'DELETE' }),

  getStats: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/stats${qs}`);
  },

  getSettings: () => request('/settings'),
  updateSettings: (body: object) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(body) }),

  updateProfile: (body: object) =>
    request('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (body: object) =>
    request('/auth/password', { method: 'PUT', body: JSON.stringify(body) }),

  getBudgets: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/budgets${qs}`);
  },
  deleteBudget: (id: number) =>
    request(`/budgets/${id}`, { method: 'DELETE' }),
  createBudget: (body: object) =>
    request('/budgets', { method: 'POST', body: JSON.stringify(body) }),
};

export const scanScreenshot = async (imageBase64: string, mimeType: string) => {
  return request('/scan', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType }),
  });
};