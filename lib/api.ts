const BASE = '/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ft_token');
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
  const token = getToken();

  // If we have no token on the client, redirect to login immediately
  if (!token && typeof window !== 'undefined') {
    localStorage.removeItem('ft_token');
    localStorage.removeItem('ft_user');
    window.location.href = '/';
    const err = new Error('Unauthorized: missing token');
    (err as { code?: string }).code = 'NO_TOKEN';
    (err as { status?: number }).status = 401;
    throw err;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...((options?.headers as Record<string, string>) || {}) },
  });

  const data = await res.json().catch(() => ({}));

  // If the server returns 401 (token expired / invalid JWT_SECRET mismatch),
  // clear local storage and redirect to login so the user isn't stuck
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('ft_token');
    localStorage.removeItem('ft_user');
    window.location.href = '/';
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    (err as { status?: number }).status = res.status;
    throw err;
  }

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

  convertCurrency: (fromCurrency: string, toCurrency: string) =>
    request('/convert-currency', { method: 'POST', body: JSON.stringify({ fromCurrency, toCurrency }) }),

  getSavingsGoals: () => request('/savings-goals'),
  createSavingsGoal: (body: object) =>
    request('/savings-goals', { method: 'POST', body: JSON.stringify(body) }),
  updateSavingsGoal: (id: number, body: object) =>
    request(`/savings-goals/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSavingsGoal: (id: number) =>
    request(`/savings-goals/${id}`, { method: 'DELETE' }),
  contributeToGoal: (id: number, amount: number, note?: string, date?: string) =>
    request(`/savings-goals/${id}`, { method: 'PUT', body: JSON.stringify({ action: 'contribute', amount, note, date }) }),
  withdrawFromGoal: (id: number, amount: number, note?: string, date?: string) =>
    request(`/savings-goals/${id}`, { method: 'PUT', body: JSON.stringify({ action: 'withdraw', amount, note, date }) }),
};

export const scanScreenshot = async (imageBase64: string, mimeType: string) => {
  return request('/scan', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType }),
  });
};