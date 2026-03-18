export interface Employee {
  id: string;
  soldierId?: string;
  name: string;
  email: string;
  department: string;
  position: string;
  startDate: string;
  status: 'Active' | 'Inactive';
  phone?: string;
  privateId?: string;
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
