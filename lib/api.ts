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

// Custom error class so callers can distinguish auth failures
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path: string, options?: RequestInit) {
  const token = getToken();

  // No token — throw so DashboardLayout can handle the redirect cleanly
  // Never redirect from here: that causes a glitch loop because AuthContext
  // hasn't finished reading localStorage yet on first render
  if (!token && typeof window !== 'undefined') {
    throw new ApiError('No token', 401, 'NO_TOKEN');
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...((options?.headers as Record<string, string>) || {}) },
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    const err = new ApiError(data.error || 'Unauthorized', 401, 'INVALID_TOKEN');
    // Dispatch event so DashboardLayout can log out + redirect without a loop
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('api:unauthorized', { detail: err }));
    }
    throw err;
  }

  if (!res.ok) {
    throw new ApiError(data.error || 'Request failed', res.status);
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

  getRecurring: () => request('/recurring'),
  createRecurring: (body: object) =>
    request('/recurring', { method: 'POST', body: JSON.stringify(body) }),
  updateRecurring: (id: number, body: object) =>
    request(`/recurring/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRecurring: (id: number) =>
    request(`/recurring/${id}`, { method: 'DELETE' }),
  postRecurringNow: (id: number) =>
    request(`/recurring/${id}/post`, { method: 'POST' }),
  skipRecurring: (id: number) =>
    request(`/recurring/${id}/skip`, { method: 'POST' }),
};

export const scanScreenshot = async (imageBase64: string, mimeType: string) => {
  return request('/scan', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType }),
  });
};