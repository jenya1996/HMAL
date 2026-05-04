import type { Request } from 'express';
import { adminDb } from './firebase-admin';
import { logger } from './logger';
import {
  diffArrayById, isReordered,
  diffSchedule, diffAssignments,
} from './diff';

export type AuditCategory = 'auth' | 'employees' | 'schedule' | 'tasks' | 'settings';

export interface AuditLogEntry {
  timestamp:   string;
  userId:      string;
  userEmail:   string;
  action:      string;
  category:    AuditCategory;
  description: string;
  details?:    Record<string, unknown>;
  meta: {
    ip:        string;
    userAgent: string;
  };
}

const AUDIT_COLLECTION = 'audit-logs';

export function getClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await adminDb.collection(AUDIT_COLLECTION).add(entry);
  } catch (err) {
    logger.error('[AuditLog] write failed:', err);
  }
}

export async function auditDataChange(
  key:    string,
  before: unknown,
  after:  unknown,
  req:    Request,
): Promise<void> {
  const user      = (req as any).user;
  const userId    = user?.uid   ?? 'system';
  const userEmail = user?.email ?? 'unknown';
  const ip        = getClientIp(req);
  const userAgent = req.headers['user-agent'] ?? '';
  const meta      = { ip, userAgent };
  const ts        = new Date().toISOString();

  try {
    if (key === 'hmal-soldiers-v2') {
      const oldArr = (before as any[] | null) ?? [];
      const newArr = (after  as any[])        ?? [];
      const diff   = diffArrayById(oldArr, newArr);

      if (!diff.added.length && !diff.deleted.length && !diff.updated.length) {
        if (isReordered(oldArr, newArr)) {
          await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'EMPLOYEES_REORDERED',
            category: 'employees', description: 'Reordered soldier list', meta });
        }
        return;
      }

      if (diff.added.length > 1) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'EMPLOYEES_IMPORTED',
          category: 'employees',
          description: `Imported ${diff.added.length} soldiers`,
          details: { count: diff.added.length, soldiers: diff.added.map(e => ({ id: e.id, name: e.name })) },
          meta });
      } else if (diff.added.length === 1) {
        const e = diff.added[0];
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'EMPLOYEE_CREATED',
          category: 'employees', description: `Created soldier "${e.name}"`,
          details: { entityId: e.id, entityName: e.name, data: e.data }, meta });
      }

      if (diff.deleted.length > 1) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'EMPLOYEES_DELETED',
          category: 'employees',
          description: `Deleted ${diff.deleted.length} soldiers`,
          details: { count: diff.deleted.length, soldiers: diff.deleted }, meta });
      } else if (diff.deleted.length === 1) {
        const e = diff.deleted[0];
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'EMPLOYEE_DELETED',
          category: 'employees', description: `Deleted soldier "${e.name}"`,
          details: { entityId: e.id, entityName: e.name }, meta });
      }

      if (diff.updated.length > 1) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'EMPLOYEES_BULK_UPDATED',
          category: 'employees',
          description: `Bulk updated ${diff.updated.length} soldiers`,
          details: { count: diff.updated.length, updates: diff.updated.map(e => ({ id: e.id, name: e.name, fields: e.changes.map(c => c.field) })) },
          meta });
      } else if (diff.updated.length === 1) {
        const e      = diff.updated[0];
        const fields = e.changes.map(c => c.field).join(', ');
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'EMPLOYEE_UPDATED',
          category: 'employees', description: `Updated soldier "${e.name}" (${fields})`,
          details: { entityId: e.id, entityName: e.name, changes: e.changes }, meta });
      }

    } else if (key === 'hmal-schedule') {
      const changes = diffSchedule(
        (before as Record<string, Record<string, string>> | null) ?? {},
        (after  as Record<string, Record<string, string>>)        ?? {},
      );
      if (!changes.length) return;
      const soldierCount = new Set(changes.map(c => c.empId)).size;
      const description  = soldierCount === 1
        ? `Updated schedule for 1 soldier (${changes.length} change${changes.length > 1 ? 's' : ''})`
        : `Updated schedule for ${soldierCount} soldiers (${changes.length} change${changes.length > 1 ? 's' : ''})`;
      await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'SCHEDULE_UPDATED',
        category: 'schedule', description,
        details: { count: changes.length, soldierCount, changes: changes.slice(0, 100) }, meta });

    } else if (key === 'hmal-task-templates') {
      const diff = diffArrayById((before as any[] | null) ?? [], (after as any[]) ?? []);
      if (!diff.added.length && !diff.deleted.length && !diff.updated.length) return;
      for (const t of diff.added) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'TASK_TEMPLATE_CREATED',
          category: 'tasks', description: `Created task template "${t.name}"`,
          details: { entityId: t.id, entityName: t.name }, meta });
      }
      for (const t of diff.deleted) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'TASK_TEMPLATE_DELETED',
          category: 'tasks', description: `Deleted task template "${t.name}"`,
          details: { entityId: t.id, entityName: t.name }, meta });
      }
      for (const t of diff.updated) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'TASK_TEMPLATE_UPDATED',
          category: 'tasks', description: `Updated task template "${t.name}" (${t.changes.map(c => c.field).join(', ')})`,
          details: { entityId: t.id, entityName: t.name, changes: t.changes }, meta });
      }

    } else if (key === 'hmal-task-assignments') {
      const changes = diffAssignments(
        (before as Record<string, Record<string, string[]>> | null) ?? {},
        (after  as Record<string, Record<string, string[]>>)        ?? {},
      );
      for (const c of changes) {
        if (c.assigned.length > 0) {
          await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'TASK_SOLDIERS_ASSIGNED',
            category: 'tasks', description: `Assigned ${c.assigned.length} soldier(s) to task on ${c.date}`,
            details: { templateId: c.templateId, date: c.date, assigned: c.assigned }, meta });
        }
        if (c.unassigned.length > 0) {
          await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'TASK_SOLDIERS_UNASSIGNED',
            category: 'tasks', description: `Unassigned ${c.unassigned.length} soldier(s) from task on ${c.date}`,
            details: { templateId: c.templateId, date: c.date, unassigned: c.unassigned }, meta });
        }
      }

    } else if (key === 'hmal-task-groups') {
      const diff = diffArrayById((before as any[] | null) ?? [], (after as any[]) ?? []);
      if (!diff.added.length && !diff.deleted.length && !diff.updated.length) return;
      for (const g of diff.added) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'TASK_GROUP_CREATED',
          category: 'tasks', description: `Created task group "${g.name}"`,
          details: { entityId: g.id, entityName: g.name }, meta });
      }
      for (const g of diff.deleted) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'TASK_GROUP_DELETED',
          category: 'tasks', description: `Deleted task group "${g.name}"`,
          details: { entityId: g.id, entityName: g.name }, meta });
      }
      for (const g of diff.updated) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'TASK_GROUP_UPDATED',
          category: 'tasks', description: `Updated task group "${g.name}" (${g.changes.map(c => c.field).join(', ')})`,
          details: { entityId: g.id, entityName: g.name, changes: g.changes }, meta });
      }

    } else if (key === 'hmal-columns-v1') {
      const diff = diffArrayById(
        (before as any[] | null) ?? [],
        (after  as any[])        ?? [],
        'key', 'label',
      );
      if (!diff.added.length && !diff.deleted.length && !diff.updated.length) return;
      for (const c of diff.added) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'COLUMN_ADDED',
          category: 'settings', description: `Added column "${c.name}"`,
          details: { columnKey: c.id, label: c.name }, meta });
      }
      for (const c of diff.deleted) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'COLUMN_DELETED',
          category: 'settings', description: `Deleted column "${c.name}"`,
          details: { columnKey: c.id, label: c.name }, meta });
      }
      for (const c of diff.updated) {
        await writeAuditLog({ timestamp: ts, userId, userEmail, action: 'COLUMN_UPDATED',
          category: 'settings', description: `Updated column "${c.name}" (${c.changes.map(ch => ch.field).join(', ')})`,
          details: { columnKey: c.id, label: c.name, changes: c.changes }, meta });
      }
    }
  } catch (err) {
    logger.error('[AuditLog] auditDataChange error for key', key, ':', err);
  }
}
