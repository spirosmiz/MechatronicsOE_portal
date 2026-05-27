export type UserRole = 'admin' | 'project_manager' | 'technician';
export type JobType = 'maintenance' | 'electrical_upgrade' | 'retrofit' | 'reconstruction';
export type StatusType = 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type PaymentStatus = 'unpaid' | 'invoiced' | 'partially_paid' | 'paid';

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
  driveFolderId?: string;
  driveMediaFolderId?: string;
  driveOffersFolderId?: string;
  driveContractsFolderId?: string;
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
  brand?: string;
  name: string;
  description?: string;
  stockQuantity: number;
  safetyStockLevel: number;
  unitCost: string | number;
  unitPrice: string | number;
  ceCertified: boolean;
  driveFolderId?: string;
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
  offerId?: string;
  offer?: { id: string; title: string };
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

// ─── Offers ───────────────────────────────────────────────────────────────────

export interface OfferItem {
  id: string;
  offerId: string;
  description: string;
  quantity: number;
  unitPrice: string | number;
}

export interface OfferMachine {
  id: string;
  offerId: string;
  machineId: string;
  machine: { id: string; name: string; model?: string };
  notes?: string;
}

export interface Offer {
  id: string;
  customerId?: string;
  customer?: { id: string; companyName: string; email?: string; contactPerson?: string };
  machines?: OfferMachine[];
  title: string;
  description?: string;
  offerDate: string;
  validUntil: string;
  status: OfferStatus;
  paymentStatus: PaymentStatus;
  totalAmount: string | number;
  notes?: string;
  createdBy?: string;
  creator?: { id: string; name: string };
  createdAt: string;
  items?: OfferItem[];
  drivePdfId?: string;
  drivePdfUrl?: string;
  _count?: { items: number };
}

export interface OfferStats {
  byStatus: { status: OfferStatus; _count: number }[];
  byPayment: { paymentStatus: PaymentStatus; _count: number }[];
  totalValue: string | null;
  pendingCount: number;
}

// ─── Media ────────────────────────────────────────────────────────────────────

export interface MediaFile {
  id: string;
  entityType: string;
  entityId: string;
  driveFileId: string;
  name: string;
  mimeType: string;
  driveUrl: string;
  thumbnailUrl?: string;
  uploadedBy?: string;
  uploader?: { id: string; name: string };
  uploadedAt: string;
}
