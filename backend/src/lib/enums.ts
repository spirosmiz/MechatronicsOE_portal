export const UserRole = {
  admin: 'admin',
  project_manager: 'project_manager',
  technician: 'technician',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const JobType = {
  maintenance: 'maintenance',
  electrical_upgrade: 'electrical_upgrade',
  retrofit: 'retrofit',
  reconstruction: 'reconstruction',
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

export const StatusType = {
  draft: 'draft',
  pending_approval: 'pending_approval',
  approved: 'approved',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
} as const;

export type StatusType = (typeof StatusType)[keyof typeof StatusType];

export const OfferStatus = {
  draft: 'draft',
  sent: 'sent',
  accepted: 'accepted',
  rejected: 'rejected',
  expired: 'expired',
} as const;

export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];

export const PaymentStatus = {
  unpaid: 'unpaid',
  invoiced: 'invoiced',
  partially_paid: 'partially_paid',
  paid: 'paid',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const InvoiceDirection = {
  OUTGOING: 'OUTGOING',
  INCOMING: 'INCOMING',
} as const;

export type InvoiceDirection = (typeof InvoiceDirection)[keyof typeof InvoiceDirection];

export const InvoiceCategory = {
  // OUTGOING
  PROJECT_BILLING: 'PROJECT_BILLING',
  SERVICE_BILLING: 'SERVICE_BILLING',
  PARTS_SALE: 'PARTS_SALE',
  // INCOMING
  LABOR_SERVICE_ENGINEER: 'LABOR_SERVICE_ENGINEER',
  LABOR_DESIGN_ENGINEER: 'LABOR_DESIGN_ENGINEER',
  MACHINING_SUBCONTRACT: 'MACHINING_SUBCONTRACT',
  SPARE_PARTS_PURCHASE: 'SPARE_PARTS_PURCHASE',
  OPERATIONAL: 'OPERATIONAL',
} as const;

export type InvoiceCategory = (typeof InvoiceCategory)[keyof typeof InvoiceCategory];

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  SENT: 'SENT',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentMethod = {
  BANK_TRANSFER: 'BANK_TRANSFER',
  CASH: 'CASH',
  CHECK: 'CHECK',
  CARD: 'CARD',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const LaborRoleType = {
  SERVICE_ENGINEER: 'SERVICE_ENGINEER',
  DESIGN_ENGINEER: 'DESIGN_ENGINEER',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
} as const;

export type LaborRoleType = (typeof LaborRoleType)[keyof typeof LaborRoleType];

export const SupplierCategory = {
  PARTS: 'PARTS',
  MACHINING: 'MACHINING',
  SERVICES: 'SERVICES',
  ENGINEERING: 'ENGINEERING',
} as const;

export type SupplierCategory = (typeof SupplierCategory)[keyof typeof SupplierCategory];
