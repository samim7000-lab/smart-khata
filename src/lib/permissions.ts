import { UserRole } from '../types';

export type PermissionAction =
  | 'view_dashboard'
  | 'view_customers'
  | 'add_customer'
  | 'edit_customer'
  | 'delete_customer'
  | 'view_transactions'
  | 'add_transaction'
  | 'void_transaction'
  | 'view_reports'
  | 'download_reports'
  | 'edit_shop_profile'
  | 'manage_staff'
  | 'manage_subscription'
  | 'switch_shop'
  | 'create_shop'
  | 'export_backup'
  | 'restore_backup';

// Role Permissions Matrix
const ROLE_PERMISSIONS: Record<UserRole, Set<PermissionAction>> = {
  owner: new Set<PermissionAction>([
    'view_dashboard',
    'view_customers',
    'add_customer',
    'edit_customer',
    'delete_customer',
    'view_transactions',
    'add_transaction',
    'void_transaction',
    'view_reports',
    'download_reports',
    'edit_shop_profile',
    'manage_staff',
    'manage_subscription',
    'switch_shop',
    'create_shop',
    'export_backup',
    'restore_backup',
  ]),
  admin: new Set<PermissionAction>([
    'view_dashboard',
    'view_customers',
    'add_customer',
    'edit_customer',
    'view_transactions',
    'add_transaction',
    'void_transaction',
    'view_reports',
    'download_reports',
    'edit_shop_profile',
    'manage_staff',
    'switch_shop',
    'export_backup',
  ]),
  manager: new Set<PermissionAction>([
    'view_dashboard',
    'view_customers',
    'add_customer',
    'edit_customer',
    'view_transactions',
    'add_transaction',
    'void_transaction',
    'view_reports',
    'download_reports',
    'switch_shop',
  ]),
  staff: new Set<PermissionAction>([
    'view_dashboard',
    'view_customers',
    'add_customer',
    'view_transactions',
    'add_transaction',
  ]),
  viewer: new Set<PermissionAction>([
    'view_dashboard',
    'view_customers',
    'view_transactions',
    'view_reports',
  ]),
};

/**
 * Validates if a user role has permission to execute an action
 */
export const hasPermission = (role: UserRole = 'owner', action: PermissionAction): boolean => {
  const allowedSet = ROLE_PERMISSIONS[role];
  if (!allowedSet) return false;
  return allowedSet.has(action);
};

/**
 * Returns human-readable label for a role
 */
export const getRoleLabel = (role: UserRole): string => {
  switch (role) {
    case 'owner':
      return 'Shop Owner 👑';
    case 'admin':
      return 'Administrator 🛡️';
    case 'manager':
      return 'Store Manager 👔';
    case 'staff':
      return 'Cashier / Staff 🧑‍💼';
    case 'viewer':
      return 'Auditor / Viewer 👁️';
    default:
      return role;
  }
};
