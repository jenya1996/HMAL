export interface Employee {
  id: string;
  soldierId?: string;
  name: string;
  email: string;
  department: string;
  position: string;
  startDate: string;
  status: 'Active' | 'Inactive' | 'Annexation';
  phone?: string;
  privateId?: string;
  role?: string;
  customFields?: Record<string, string>;
}

export interface Department {
  id: string;
  name: string;
}

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type LeaveType = 'Vacation' | 'Sick Leave' | 'Personal' | 'Other';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  reason: string;
}

export type FieldType = 'text' | 'number' | 'dropdown' | 'multiselect';

export interface ColumnDef {
  key: string;
  label: string;
  visible: boolean;
  builtin: boolean; // built-in columns cannot be deleted
  fieldType?: FieldType; // custom columns only, defaults to 'text'
  options?: string[];    // for dropdown and multiselect
}

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'id',        label: 'ID',         visible: true, builtin: true },
  { key: 'name',      label: 'Name',       visible: true, builtin: true },
  { key: 'email',     label: 'Email',      visible: true, builtin: true },
  { key: 'phone',     label: 'Phone',      visible: true, builtin: true },
  { key: 'privateId', label: 'Private ID', visible: true, builtin: true },
  { key: 'role',      label: 'Role',       visible: true, builtin: true },
  { key: 'status',    label: 'Status',     visible: true, builtin: true },
];
