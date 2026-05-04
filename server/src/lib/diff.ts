export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface EntityDiff {
  added:   Array<{ id: string; name?: string; data: unknown }>;
  deleted: Array<{ id: string; name?: string }>;
  updated: Array<{ id: string; name?: string; changes: FieldChange[] }>;
}

function objectFieldDiff(
  before: Record<string, unknown>,
  after:  Record<string, unknown>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes.push({ field: key, before: b, after: a });
    }
  }
  return changes;
}

export function diffArrayById(
  before:    any[],
  after:     any[],
  idField   = 'id',
  nameField = 'name',
): EntityDiff {
  const beforeMap = new Map(before.map(e => [e[idField], e]));
  const afterMap  = new Map(after.map(e => [e[idField], e]));

  return {
    added: after
      .filter(e => !beforeMap.has(e[idField]))
      .map(e => ({ id: e[idField] as string, name: e[nameField] as string | undefined, data: e })),
    deleted: before
      .filter(e => !afterMap.has(e[idField]))
      .map(e => ({ id: e[idField] as string, name: e[nameField] as string | undefined })),
    updated: after
      .filter(e => {
        const old = beforeMap.get(e[idField]);
        return old && JSON.stringify(old) !== JSON.stringify(e);
      })
      .map(e => ({
        id:      e[idField] as string,
        name:    e[nameField] as string | undefined,
        changes: objectFieldDiff(beforeMap.get(e[idField])!, e as Record<string, unknown>),
      })),
  };
}

export function isReordered(before: any[], after: any[], idField = 'id'): boolean {
  if (before.length !== after.length) return false;
  return before.map(e => e[idField]).join(',') !== after.map(e => e[idField]).join(',');
}

export interface ScheduleChange {
  empId: string;
  date:  string;
  from:  string | undefined;
  to:    string | undefined;
}

export function diffSchedule(
  before: Record<string, Record<string, string>>,
  after:  Record<string, Record<string, string>>,
): ScheduleChange[] {
  const changes: ScheduleChange[] = [];
  const allEmpIds = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const empId of allEmpIds) {
    const allDates = new Set([
      ...Object.keys(before[empId] ?? {}),
      ...Object.keys(after[empId]  ?? {}),
    ]);
    for (const date of allDates) {
      const from = before[empId]?.[date];
      const to   = after[empId]?.[date];
      if (from !== to) changes.push({ empId, date, from, to });
    }
  }
  return changes;
}

export interface AssignmentChange {
  templateId: string;
  date:       string;
  assigned:   string[];
  unassigned: string[];
}

export function diffAssignments(
  before: Record<string, Record<string, string[]>>,
  after:  Record<string, Record<string, string[]>>,
): AssignmentChange[] {
  const changes: AssignmentChange[] = [];
  const allTemplateIds = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const templateId of allTemplateIds) {
    const allDates = new Set([
      ...Object.keys(before[templateId] ?? {}),
      ...Object.keys(after[templateId]  ?? {}),
    ]);
    for (const date of allDates) {
      const beforeSet = new Set(before[templateId]?.[date] ?? []);
      const afterSet  = new Set(after[templateId]?.[date]  ?? []);
      const assigned   = [...afterSet].filter(id => !beforeSet.has(id));
      const unassigned = [...beforeSet].filter(id => !afterSet.has(id));
      if (assigned.length > 0 || unassigned.length > 0) {
        changes.push({ templateId, date, assigned, unassigned });
      }
    }
  }
  return changes;
}
