const API_URL = '/api';

interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('accessToken');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('auth-storage');
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Erro na requisição');
  }

  return data;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<ApiResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  refresh: (refreshToken: string) =>
    request<ApiResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<ApiResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Dashboard
  getDashboardStats: () => request('/dashboard/stats'),

  // Products
  getProducts: () => request('/products'),
  createProduct: (data: any) =>
    request('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProduct: (id: string, data: any) =>
    request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProduct: (id: string) =>
    request(`/products/${id}`, {
      method: 'DELETE',
    }),

  // Sales
  getSales: () => request('/sales'),
  createSale: (data: any) =>
    request('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Accounts
  getAccounts: () => request('/accounts'),
  createAccount: (data: any) =>
    request('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAccount: (id: string, data: any) =>
    request(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteAccount: (id: string) =>
    request(`/accounts/${id}`, {
      method: 'DELETE',
    }),
  syncAccount: (id: string) =>
    request(`/accounts/${id}/sync`, {
      method: 'POST',
    }),

  // Bling OAuth
  startBlingOAuth: (accountId: string) =>
    request('/bling/start-oauth', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    }),
};

export default api;
