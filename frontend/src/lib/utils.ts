import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(Number(value));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const JOB_TYPE_LABELS: Record<string, string> = {
  maintenance: 'Maintenance',
  electrical_upgrade: 'Electrical Upgrade',
  retrofit: 'Retrofit',
  reconstruction: 'Reconstruction',
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const OFFER_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
};

export const OFFER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-800',
  invoiced: 'bg-yellow-100 text-yellow-800',
  partially_paid: 'bg-orange-100 text-orange-800',
  paid: 'bg-green-100 text-green-800',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  invoiced: 'Invoiced',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT:           'bg-gray-100 text-gray-700',
  ISSUED:          'bg-blue-100 text-blue-800',
  SENT:            'bg-indigo-100 text-indigo-800',
  PARTIALLY_PAID:  'bg-orange-100 text-orange-800',
  PAID:            'bg-green-100 text-green-800',
  OVERDUE:         'bg-red-100 text-red-800',
  CANCELLED:       'bg-gray-200 text-gray-500',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT:          'Draft',
  ISSUED:         'Issued',
  SENT:           'Sent',
  PARTIALLY_PAID: 'Partially Paid',
  PAID:           'Paid',
  OVERDUE:        'Overdue',
  CANCELLED:      'Cancelled',
};

export const INVOICE_CATEGORY_LABELS: Record<string, string> = {
  PROJECT_BILLING:        'Project Billing',
  SERVICE_BILLING:        'Service Billing',
  PARTS_SALE:             'Parts Sale',
  LABOR_SERVICE_ENGINEER: 'Service Engineer Labor',
  LABOR_DESIGN_ENGINEER:  'Design Engineer Labor',
  MACHINING_SUBCONTRACT:  'Machining',
  SPARE_PARTS_PURCHASE:   'Spare Parts',
  OPERATIONAL:            'Operational',
};

export const INVOICE_CATEGORY_COLORS: Record<string, string> = {
  PROJECT_BILLING:        'bg-emerald-100 text-emerald-800',
  SERVICE_BILLING:        'bg-teal-100 text-teal-800',
  PARTS_SALE:             'bg-cyan-100 text-cyan-800',
  LABOR_SERVICE_ENGINEER: 'bg-violet-100 text-violet-800',
  LABOR_DESIGN_ENGINEER:  'bg-purple-100 text-purple-800',
  MACHINING_SUBCONTRACT:  'bg-orange-100 text-orange-800',
  SPARE_PARTS_PURCHASE:   'bg-yellow-100 text-yellow-800',
  OPERATIONAL:            'bg-gray-100 text-gray-700',
};

export const LABOR_ROLE_LABELS: Record<string, string> = {
  SERVICE_ENGINEER: 'Service Engineer',
  DESIGN_ENGINEER:  'Design Engineer',
  PROJECT_MANAGER:  'Project Manager',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CASH:          'Cash',
  CHECK:         'Check',
  CARD:          'Card',
};
