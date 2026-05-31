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
  latitude?: number;
  longitude?: number;
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

export interface SupplierQuote {
  id: string;
  inventoryId: string;
  supplierId?: string | null;
  supplier?: { id: string; companyName: string } | null;
  vendorName?: string | null;
  quoteRef?: string | null;
  unitPrice: string | number;
  currency: string;
  quoteDate: string;
  validUntil?: string | null;
  invoiceId?: string | null;
  invoice?: { id: string; invoiceNumber: string; totalAmount: string | number } | null;
  notes?: string | null;
  documentUrl?: string | null;
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
  supplierId?: string | null;
  supplier?: { id: string; companyName: string } | null;
  supplierQuotes?: SupplierQuote[];
}

export interface ProjectMaterial {
  id: string;
  projectId: string;
  inventoryId?: string;
  inventory?: { id: string; partNumber: string; name: string };
  description?: string | null;
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
  workType?: string | null;
  digitalSignature?: string;
  transportationCost?: string | number | null;
  submittedAt: string;
}

export interface Project {
  id: string;
  customerId?: string;
  offerId?: string;
  offer?: { id: string; title: string; items?: OfferItem[] };
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

// ─── Financials ───────────────────────────────────────────────────────────────

export type InvoiceDirection = 'OUTGOING' | 'INCOMING';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type InvoiceCategory =
  | 'PROJECT_BILLING' | 'SERVICE_BILLING' | 'PARTS_SALE'
  | 'LABOR_SERVICE_ENGINEER' | 'LABOR_DESIGN_ENGINEER'
  | 'MACHINING_SUBCONTRACT' | 'SPARE_PARTS_PURCHASE' | 'OPERATIONAL';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CHECK' | 'CARD';
export type LaborRoleType = 'SERVICE_ENGINEER' | 'DESIGN_ENGINEER' | 'PROJECT_MANAGER';

export interface Supplier {
  id: string;
  companyName: string;
  vatNumber?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  categories: string; // JSON string[]
  createdAt: string;
  _count?: { invoices: number };
}

export interface LaborRate {
  id: string;
  role: LaborRoleType;
  ratePerHour: string | number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
  hoursLogged?: string | number | null;
  hourlyRate?: string | number | null;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: string | number;
  paidAt: string;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  recordedById: string;
  recordedBy?: { id: string; name: string };
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  direction: InvoiceDirection;
  category: InvoiceCategory;
  customerId?: string | null;
  customer?: { id: string; companyName: string; vatNumber?: string } | null;
  supplierId?: string | null;
  supplier?: { id: string; companyName: string; vatNumber?: string } | null;
  projectId?: string | null;
  project?: { id: string; title: string } | null;
  offerId?: string | null;
  offer?: { id: string; title: string } | null;
  subtotal: string | number;
  taxRate: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  currency: string;
  status: InvoiceStatus;
  issueDate?: string | null;
  dueDate?: string | null;
  driveFileId?: string | null;
  driveUrl?: string | null;
  notes?: string | null;
  createdById: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  _count?: { items: number; payments: number };
}

export interface InvoiceStats {
  totalIncome: string | number;
  totalExpenses: string | number;
  outgoingCount: number;
  incomingCount: number;
  outstanding: string | number;
  byStatus: { status: InvoiceStatus; _count: number; _sum: { totalAmount: string | number } }[];
  byCategory: { category: InvoiceCategory; _count: number; _sum: { totalAmount: string | number } }[];
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
