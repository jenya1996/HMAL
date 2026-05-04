import { Employee, ColumnDef } from '../types';

export function getVal(emp: Employee, key: string): string {
  switch (key) {
    case 'id':         return emp.soldierId ?? '';
    case 'name':       return emp.name;
    case 'email':      return emp.email;
    case 'phone':      return emp.phone ?? '';
    case 'privateId':  return emp.privateId ?? '';
    case 'role':       return emp.role ?? '';
    case 'department': return emp.department ?? '';
    case 'status':     return emp.status;
    default:           return emp.customFields?.[key] ?? '';
  }
}

export function getFilterOptions(col: ColumnDef): string[] {
  if (col.key === 'status') return ['Active', 'Inactive', 'Annexation'];
  if (col.fieldType === 'dropdown' || col.fieldType === 'multiselect') return col.options ?? [];
  return [];
}

export function matchesFilters(
  emp: Employee,
  filters: Record<string, string>,
  columnDefs: ColumnDef[],
): boolean {
  return Object.entries(filters).every(([key, value]) => {
    if (!value) return true;
    const empVal = getVal(emp, key);
    const col = columnDefs.find(c => c.key === key);
    if (col?.fieldType === 'multiselect') {
      return empVal.split('|').filter(Boolean).includes(value);
    }
    if (col?.fieldType === 'dropdown' || key === 'status') {
      return empVal === value;
    }
    return empVal.toLowerCase().includes(value.toLowerCase());
  });
}
