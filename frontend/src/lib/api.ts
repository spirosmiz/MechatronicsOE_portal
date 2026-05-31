import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

// Users
export const usersApi = {
  list: () => api.get('/users'),
  create: (data: Record<string, unknown>) => api.post('/users', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// Customers
export const customersApi = {
  list: () => api.get('/customers'),
  get: (id: string) => api.get(`/customers/${id}`),
  create: (data: Record<string, unknown>) => api.post('/customers', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  setupDrive: (id: string) => api.post(`/customers/${id}/setup-drive`),
};

// Machines
export const machinesApi = {
  list: (customerId?: string) => api.get('/machines', { params: customerId ? { customerId } : undefined }),
  get: (id: string) => api.get(`/machines/${id}`),
  create: (data: Record<string, unknown>) => api.post('/machines', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/machines/${id}`, data),
  delete: (id: string) => api.delete(`/machines/${id}`),
};

// Inventory
export const inventoryApi = {
  list: (lowStock?: boolean) => api.get('/inventory', { params: lowStock ? { lowStock: 'true' } : undefined }),
  get: (id: string) => api.get(`/inventory/${id}`),
  create: (data: Record<string, unknown>) => api.post('/inventory', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/inventory/${id}`, data),
  adjustStock: (id: string, adjustment: number) => api.patch(`/inventory/${id}/stock`, { adjustment }),
  setupDrive: (id: string) => api.post(`/inventory/${id}/setup-drive`),
  delete: (id: string) => api.delete(`/inventory/${id}`),
  listQuotes: (id: string) => api.get(`/inventory/${id}/quotes`),
  createQuote: (id: string, data: Record<string, unknown>) => api.post(`/inventory/${id}/quotes`, data),
  updateQuote: (id: string, quoteId: string, data: Record<string, unknown>) => api.put(`/inventory/${id}/quotes/${quoteId}`, data),
  deleteQuote: (id: string, quoteId: string) => api.delete(`/inventory/${id}/quotes/${quoteId}`),
};

// Projects
export const projectsApi = {
  list: (params?: { status?: string; type?: string; customerId?: string }) =>
    api.get('/projects', { params }),
  dashboardStats: () => api.get('/projects/dashboard-stats'),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: Record<string, unknown>) => api.post('/projects', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/projects/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/projects/${id}/status`, { status }),
  addMaterial: (id: string, data: Record<string, unknown>) => api.post(`/projects/${id}/materials`, data),
  removeMaterial: (projectId: string, materialId: string) =>
    api.delete(`/projects/${projectId}/materials/${materialId}`),
  generateInvoice: (id: string, data?: Record<string, unknown>) => api.post(`/projects/${id}/generate-invoice`, data ?? {}),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

// Service Reports
export const serviceReportsApi = {
  list: (params?: { projectId?: string; technicianId?: string }) =>
    api.get('/service-reports', { params }),
  get: (id: string) => api.get(`/service-reports/${id}`),
  create: (data: Record<string, unknown>) => api.post('/service-reports', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/service-reports/${id}`, data),
  delete: (id: string) => api.delete(`/service-reports/${id}`),
};

// Offers
export const offersApi = {
  list: () => api.get('/offers'),
  stats: () => api.get('/offers/stats'),
  get: (id: string) => api.get(`/offers/${id}`),
  create: (data: Record<string, unknown>) => api.post('/offers', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/offers/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/offers/${id}/status`, { status }),
  updatePayment: (id: string, paymentStatus: string) => api.patch(`/offers/${id}/payment`, { paymentStatus }),
  addItem: (id: string, data: Record<string, unknown>) => api.post(`/offers/${id}/items`, data),
  updateItem: (offerId: string, itemId: string, data: Record<string, unknown>) =>
    api.put(`/offers/${offerId}/items/${itemId}`, data),
  removeItem: (offerId: string, itemId: string) => api.delete(`/offers/${offerId}/items/${itemId}`),
  delete: (id: string) => api.delete(`/offers/${id}`),
  downloadPdf: (id: string) => api.get(`/offers/${id}/pdf`, { responseType: 'blob' }),
  downloadDocx: (id: string) => api.get(`/offers/${id}/docx`, { responseType: 'blob' }),
};

// Suppliers
export const suppliersApi = {
  list: () => api.get('/suppliers'),
  get: (id: string) => api.get(`/suppliers/${id}`),
  create: (data: Record<string, unknown>) => api.post('/suppliers', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/suppliers/${id}`, data),
  delete: (id: string) => api.delete(`/suppliers/${id}`),
};

// Labor Rates
export const laborRatesApi = {
  list: () => api.get('/labor-rates'),
  current: () => api.get('/labor-rates/current'),
  create: (data: Record<string, unknown>) => api.post('/labor-rates', data),
  delete: (id: string) => api.delete(`/labor-rates/${id}`),
};

// Invoices
export const invoicesApi = {
  list: (params?: Record<string, string>) => api.get('/invoices', { params }),
  stats: () => api.get('/invoices/stats'),
  get: (id: string) => api.get(`/invoices/${id}`),
  create: (data: Record<string, unknown>) => api.post('/invoices', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/invoices/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/invoices/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/invoices/${id}`),
  addPayment: (id: string, data: Record<string, unknown>) => api.post(`/invoices/${id}/payments`, data),
  deletePayment: (id: string, paymentId: string) => api.delete(`/invoices/${id}/payments/${paymentId}`),
  downloadPdf: (id: string) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  extract: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/invoices/extract', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// Media
export const mediaApi = {
  list: (entityType: string, entityId: string) =>
    api.get('/media', { params: { entityType, entityId } }),
  upload: (entityType: string, entityId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entityType', entityType);
    form.append('entityId', entityId);
    return api.post('/media', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  delete: (id: string) => api.delete(`/media/${id}`),
};
