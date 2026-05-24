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
