import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  customersApi, machinesApi, inventoryApi, projectsApi,
  serviceReportsApi, usersApi, offersApi, mediaApi,
} from '../lib/api';
import { Customer, Machine, InventoryItem, Project, ServiceReport, User, DashboardStats, Offer, OfferStats, MediaFile } from '../types';

// ─── Keys ───────────────────────────────────────────────────────────────────
export const KEYS = {
  customers: ['customers'] as const,
  customer: (id: string) => ['customers', id] as const,
  machines: (customerId?: string) => ['machines', customerId ?? 'all'] as const,
  machine: (id: string) => ['machines', 'detail', id] as const,
  inventory: ['inventory'] as const,
  inventoryItem: (id: string) => ['inventory', id] as const,
  projects: (params?: object) => ['projects', params ?? {}] as const,
  project: (id: string) => ['projects', 'detail', id] as const,
  dashboardStats: ['dashboard-stats'] as const,
  serviceReports: (params?: object) => ['service-reports', params ?? {}] as const,
  serviceReport: (id: string) => ['service-reports', 'detail', id] as const,
  users: ['users'] as const,
  offers: ['offers'] as const,
  offer: (id: string) => ['offers', id] as const,
  offerStats: ['offer-stats'] as const,
  media: (entityType: string, entityId: string) => ['media', entityType, entityId] as const,
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: KEYS.dashboardStats,
    queryFn: () => projectsApi.dashboardStats().then((r) => r.data),
  });
}

// ─── Customers ───────────────────────────────────────────────────────────────
export function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: KEYS.customers,
    queryFn: () => customersApi.list().then((r) => r.data),
  });
}

export function useCustomer(id: string) {
  return useQuery<Customer>({
    queryKey: KEYS.customer(id),
    queryFn: () => customersApi.get(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => customersApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.customers }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      customersApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.customers });
      qc.invalidateQueries({ queryKey: KEYS.customer(id) });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.customers }),
  });
}

export function useSetupCustomerDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.setupDrive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.customers }),
  });
}

// ─── Machines ────────────────────────────────────────────────────────────────
export function useMachines(customerId?: string) {
  return useQuery<Machine[]>({
    queryKey: KEYS.machines(customerId),
    queryFn: () => machinesApi.list(customerId).then((r) => r.data),
  });
}

export function useMachine(id: string) {
  return useQuery<Machine>({
    queryKey: KEYS.machine(id),
    queryFn: () => machinesApi.get(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => machinesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['machines'] }),
  });
}

export function useUpdateMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      machinesApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['machines'] });
      qc.invalidateQueries({ queryKey: KEYS.machine(id) });
    },
  });
}

export function useDeleteMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => machinesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['machines'] }),
  });
}

// ─── Inventory ───────────────────────────────────────────────────────────────
export function useInventory() {
  return useQuery<InventoryItem[]>({
    queryKey: KEYS.inventory,
    queryFn: () => inventoryApi.list().then((r) => r.data),
  });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => inventoryApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.inventory }),
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      inventoryApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.inventory }),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.inventory }),
  });
}

export function useSetupInventoryDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.setupDrive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.inventory }),
  });
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export function useProjects(params?: { status?: string; type?: string; customerId?: string }) {
  return useQuery<Project[]>({
    queryKey: KEYS.projects(params),
    queryFn: () => projectsApi.list(params).then((r) => r.data),
  });
}

export function useProject(id: string) {
  return useQuery<Project>({
    queryKey: KEYS.project(id),
    queryFn: () => projectsApi.get(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: KEYS.dashboardStats });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      projectsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: KEYS.project(id) });
      qc.invalidateQueries({ queryKey: KEYS.dashboardStats });
    },
  });
}

export function useUpdateProjectStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      projectsApi.updateStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: KEYS.project(id) });
      qc.invalidateQueries({ queryKey: KEYS.dashboardStats });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: KEYS.dashboardStats });
    },
  });
}

// ─── Service Reports ─────────────────────────────────────────────────────────
export function useServiceReports(params?: { projectId?: string }) {
  return useQuery<ServiceReport[]>({
    queryKey: KEYS.serviceReports(params),
    queryFn: () => serviceReportsApi.list(params).then((r) => r.data),
  });
}

export function useServiceReport(id: string) {
  return useQuery<ServiceReport>({
    queryKey: KEYS.serviceReport(id),
    queryFn: () => serviceReportsApi.get(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateServiceReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => serviceReportsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-reports'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteServiceReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => serviceReportsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-reports'] }),
  });
}

// ─── Users ───────────────────────────────────────────────────────────────────
export function useUsers() {
  return useQuery<User[]>({
    queryKey: KEYS.users,
    queryFn: () => usersApi.list().then((r) => r.data),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => usersApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.users }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.users }),
  });
}

// ─── Offers ───────────────────────────────────────────────────────────────────
export function useOffers() {
  return useQuery<Offer[]>({
    queryKey: KEYS.offers,
    queryFn: () => offersApi.list().then((r) => r.data),
  });
}

export function useOffer(id: string) {
  return useQuery<Offer>({
    queryKey: KEYS.offer(id),
    queryFn: () => offersApi.get(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useOfferStats() {
  return useQuery<OfferStats>({
    queryKey: KEYS.offerStats,
    queryFn: () => offersApi.stats().then((r) => r.data),
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => offersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.offers });
      qc.invalidateQueries({ queryKey: KEYS.offerStats });
    },
  });
}

export function useUpdateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      offersApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.offers });
      qc.invalidateQueries({ queryKey: KEYS.offer(id) });
    },
  });
}

export function useUpdateOfferStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      offersApi.updateStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.offers });
      qc.invalidateQueries({ queryKey: KEYS.offer(id) });
      qc.invalidateQueries({ queryKey: KEYS.offerStats });
    },
  });
}

export function useUpdateOfferPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: string }) =>
      offersApi.updatePayment(id, paymentStatus),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.offers });
      qc.invalidateQueries({ queryKey: KEYS.offer(id) });
      qc.invalidateQueries({ queryKey: KEYS.offerStats });
    },
  });
}

export function useDeleteOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => offersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.offers });
      qc.invalidateQueries({ queryKey: KEYS.offerStats });
    },
  });
}

// ─── Media ────────────────────────────────────────────────────────────────────
export function useMedia(entityType: string, entityId: string) {
  return useQuery<MediaFile[]>({
    queryKey: KEYS.media(entityType, entityId),
    queryFn: () => mediaApi.list(entityType, entityId).then((r) => r.data),
    enabled: !!entityType && !!entityId,
  });
}

export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, entityId, file }: { entityType: string; entityId: string; file: File }) =>
      mediaApi.upload(entityType, entityId, file),
    onSuccess: (_data, { entityType, entityId }) => {
      qc.invalidateQueries({ queryKey: KEYS.media(entityType, entityId) });
    },
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; entityType: string; entityId: string }) =>
      mediaApi.delete(id),
    onSuccess: (_data, { entityType, entityId }) => {
      qc.invalidateQueries({ queryKey: KEYS.media(entityType, entityId) });
    },
  });
}
