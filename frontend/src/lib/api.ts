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
