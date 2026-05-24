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
