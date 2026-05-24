export type UserRole = 'admin' | 'project_manager' | 'technician';
export type JobType = 'maintenance' | 'electrical_upgrade' | 'retrofit' | 'reconstruction';
export type StatusType = 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'cancelled';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Customer {
  id: string;
  companyName: string;
  vatNumber: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address: string;
  createdAt: string;
  _count?: { machines: number; projects: number };
}

export interface Machine {
  id: string;
  customerId?: string;
  customer?: { id: string; companyName: string };
  name: string;
  model?: string;
  serialNumber?: string;
  manufacturer?: string;
  technicalSpecs?: Record<string, unknown>;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  partNumber: string;
  name: string;
  description?: string;
  stockQuantity: number;
  safetyStockLevel: number;
  unitCost: string | number;
  unitPrice: string | number;
  ceCertified: boolean;
  isLowStock?: boolean;
}

export interface ProjectMaterial {
  id: string;
  projectId: string;
  inventoryId?: string;
  inventory?: { id: string; partNumber: string; name: string };
  quantityRequired: number;
  unitCostAtQuote: string | number;
  unitPriceAtQuote: string | number;
}

export interface ServiceReport {
  id: string;
  projectId: string;
  technicianId?: string;
  technician?: { id: string; name: string; email?: string };
  project?: {
    id: string;
    title: string;
    customer?: { companyName: string; address?: string };
    machine?: { name: string; model?: string; serialNumber?: string };
  };
  workPerformed: string;
  hoursLogged: string | number;
  digitalSignature?: string;
  submittedAt: string;
}

export interface Project {
  id: string;
  customerId?: string;
  customer?: { id: string; companyName: string };
  machineId?: string;
  machine?: { id: string; name: string; model?: string };
  title: string;
  type: JobType;
  status: StatusType;
  estimatedLaborHours: string | number;
  actualLaborHours: string | number;
  quotedTotalPrice: string | number;
  termsAndConditions?: string;
  createdBy?: string;
  creator?: { id: string; name: string };
  createdAt: string;
  projectMaterials?: ProjectMaterial[];
  serviceReports?: ServiceReport[];
  _count?: { serviceReports: number; projectMaterials: number };
}

export interface DashboardStats {
  total: number;
  byStatus: { status: StatusType; _count: number }[];
  byType: { type: JobType; _count: number }[];
  recentProjects: (Project & { customer?: { companyName: string } })[];
  lowStockCount: number;
  totalValue: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
