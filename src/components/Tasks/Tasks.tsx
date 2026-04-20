import { useState, useRef, useEffect } from 'react';
import { Employee, TaskTemplate, TaskAssignments, TaskRoles, TaskGroup } from '../../types';
import { ScheduleData, CellStatus } from '../Schedule/ScheduleCalendar';
import { useFirestore } from '../../hooks/useFirestore';

type ViewMode = 'day' | 'week' | 'month' | 'custom';

interface TasksProps {
  employees:           Employee[];
  schedule:            ScheduleData;
  taskTemplates:       TaskTemplate[];
  taskAssignments:     TaskAssignments;
  taskRoles:           TaskRoles;
  taskGroups:          TaskGroup[];
  onUpdateAssignments: (a: TaskAssignments) => void;
  onUpdateRoles:       (r: TaskRoles) => void;
}

// ── constants ────────────────────────────────────────────────────────────────
const HOUR_HEIGHT  = 64;
const SHORT_DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const FULL_DAYS    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const STATUS_STYLE: Partial<Record<CellStatus, { bg: string; border: string; color: string; label: string }>> = {
  'departed':  { bg: '#ffedd5', border: '#fed7aa', color: '#c2410c', label: 'OUT' },
  'returning': { bg: '#fef9c3', border: '#fde68a', color: '#a16207', label: 'RTN' },
};

// ── helpers ──────────────────────────────────────────────────────────────────
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function taskDurationH(tpl: TaskTemplate): number {
  let mins = timeToMins(tpl.endTime) - timeToMins(tpl.startTime);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

function fmtH(h: number): string {
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

function dayNumber(dk: string): number {
  const [y, mo, d] = dk.split('-').map(Number);
  return Math.floor(new Date(y, mo - 1, d).getTime() / 86400000);
}

// Returns [startAbsMins, endAbsMins] where abs = dayNumber * 1440 + timeOfDay
function taskAbsRange(dk: string, tpl: TaskTemplate): [number, number] {
  const base  = dayNumber(dk) * 1440;
  const start = base + timeToMins(tpl.startTime);
  const end   = timeToMins(tpl.endTime) < timeToMins(tpl.startTime)
    ? base + 1440 + timeToMins(tpl.endTime)   // overnight: ends next day
    : base + timeToMins(tpl.endTime);
  return [start, end];
}


function buildViewDates(mode: ViewMode, anchor: Date, applied: { from: string; to: string } | null): Date[] {
  if (mode === 'day') return [new Date(anchor)];
  if (mode === 'week') {
    const start = new Date(anchor);
    const dow = start.getDay();
    start.setDate(start.getDate() - dow); // Sunday
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }
  if (mode === 'month') {
    const y = anchor.getFullYear(), m = anchor.getMonth();
    const count = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(y, m, i + 1));
  }
  if (!applied) return [];
  const from = new Date(applied.from + 'T00:00:00');
  const to   = new Date(applied.to   + 'T00:00:00');
  const dates: Date[] = [];
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
  return dates;
}

function formatColHeader(d: Date, mode: ViewMode): { top: string; bottom: string } {
  const dn = d.getDate(), dow = d.getDay();
  if (mode === 'week')  return { top: SHORT_DAYS[dow],          bottom: String(dn) };
  if (mode === 'month') return { top: String(dn),               bottom: SHORT_DAYS[dow] };
  return                       { top: String(dn),               bottom: SHORT_MONTHS[d.getMonth()] };
}

// ── column layout for day view ───────────────────────────────────────────────

// An overnight task (end < start) occupies two segments per day:
//   [startTime, 24:00]  and  [00:00, endTime]
function segmentsOf(tpl: TaskTemplate): Array<[number, number]> {
  const s = timeToMins(tpl.startTime), e = timeToMins(tpl.endTime);
  return e > s ? [[s, e]] : [[s, 24 * 60], [0, e]];
}

function overlaps(a: TaskTemplate, b: TaskTemplate): boolean {
  for (const [sA, eA] of segmentsOf(a))
    for (const [sB, eB] of segmentsOf(b))
      if (sA < eB && eA > sB) return true;
  return false;
}

function assignColumns(templates: TaskTemplate[]): Array<{ tpl: TaskTemplate; col: number; totalCols: number }> {
  if (templates.length === 0) return [];
  const sorted = [...templates].sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime));
  const n = sorted.length;
  const cols = new Array<number>(n).fill(0);

  for (let i = 0; i < n; i++) {
    const taken = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (overlaps(sorted[i], sorted[j])) taken.add(cols[j]);
    }
    let c = 0;
    while (taken.has(c)) c++;
    cols[i] = c;
  }

  const totalCols = sorted.map((_, i) => {
    let max = cols[i];
    for (let j = 0; j < n; j++) if (j !== i && overlaps(sorted[i], sorted[j])) max = Math.max(max, cols[j]);
    return max + 1;
  });

  return sorted.map((tpl, i) => ({ tpl, col: cols[i], totalCols: totalCols[i] }));
}

// ── assignment panel ─────────────────────────────────────────────────────────
function soldierCerts(emp: Employee, certSourceKey: string): string[] {
  const raw = emp.customFields?.[certSourceKey];
  if (!raw) return [];
  return raw.split('|').map(s => s.trim()).filter(Boolean);
}

function AssignmentPanel({ tpl, dk, sidebarSoldiers, assigned, slotRoles, onToggle, onClose, certSourceKey, taskGroups, allTaskTemplates, allTaskAssignments }: {
  tpl:               TaskTemplate;
  dk:                string;
  sidebarSoldiers:   Array<{ emp: Employee; status: CellStatus }>;
  assigned:          string[];
  slotRoles:         Record<string, string>;
  onToggle:          (empId: string, cert?: string) => void;
  onClose:           () => void;
  certSourceKey:     string;
  taskGroups:        TaskGroup[];
  allTaskTemplates:  TaskTemplate[];
  allTaskAssignments: TaskAssignments;
}) {
  const group        = taskGroups.find(g => g.id === tpl.groupId);
  const intervalMins = (group?.intervalHours ?? 0) * 60;
  const [tStart, tEnd] = taskAbsRange(dk, tpl);

  // Returns null if not blocked, or "HH:MM" when they become available
  function getBlockedUntil(empId: string): string | null {
    if (!group) return null;
    const groupTpls = allTaskTemplates.filter(t => t.groupId === group.id);
    let maxBlockEnd = -Infinity;
    for (const gt of groupTpls) {
      const assignments = allTaskAssignments[gt.id] ?? {};
      for (const [aDk, ids] of Object.entries(assignments)) {
        if (gt.id === tpl.id && aDk === dk) continue; // same slot being edited
        if (!ids.includes(empId)) continue;
        const [oStart, oEnd] = taskAbsRange(aDk, gt);
        if (oStart < tEnd + intervalMins && oEnd > tStart - intervalMins) {
          maxBlockEnd = Math.max(maxBlockEnd, oEnd);
        }
      }
    }
    if (maxBlockEnd === -Infinity) return null;
    const availMins = (maxBlockEnd + intervalMins) % 1440;
    return `${String(Math.floor(availMins / 60)).padStart(2, '0')}:${String(availMins % 60).padStart(2, '0')}`;
  }
  const requiredCerts = tpl.certifications ?? [];
  const full          = assigned.length >= tpl.requiredSoldiers;

  // Returns overwork label (e.g. "8h+8h") if assigning this soldier would exceed the group alert threshold.
  function getOverworkWarning(empId: string): string {
    if (!group || !tpl.groupId) return '';
    const otherGroupTpls = allTaskTemplates.filter(t => t.groupId === tpl.groupId && t.id !== tpl.id);
    const alreadyIn = otherGroupTpls.filter(t => (allTaskAssignments[t.id]?.[dk] ?? []).includes(empId));
    if (alreadyIn.length === 0) return '';
    const hours = [...alreadyIn, tpl].map(t => taskDurationH(t));
    const total  = hours.reduce((s, h) => s + h, 0);
    if (total < (group.alertHours ?? 16)) return '';
    return hours.map(fmtH).join('+');
  }

  const assignedSoldiers = sidebarSoldiers.filter(({ emp }) => assigned.includes(emp.id));
  const unassigned       = sidebarSoldiers.filter(({ emp }) => !assigned.includes(emp.id));

  function sortPriority({ emp }: { emp: Employee; status: CellStatus }): number {
    if (getBlockedUntil(emp.id) !== null) return 2;      // rest → bottom
    if (getOverworkWarning(emp.id) !== '') return 1;     // 8-8 → middle
    return 0;                                            // free → top
  }

  function sortedSoldiers(list: Array<{ emp: Employee; status: CellStatus }>) {
    return [...list].sort((a, b) => sortPriority(a) - sortPriority(b));
  }

  const certSections = requiredCerts.map(cert => ({
    label:    cert,
    soldiers: sortedSoldiers(unassigned.filter(({ emp }) => soldierCerts(emp, certSourceKey).includes(cert))),
  }));

  const otherSoldiers = sortedSoldiers(unassigned.filter(({ emp }) => {
    const certs = soldierCerts(emp, certSourceKey);
    return !requiredCerts.some(rc => certs.includes(rc));
  }));

  function renderSoldierRow({ emp, status }: { emp: Employee; status: CellStatus }, isAssignedRow: boolean, cert?: string) {
    const st           = STATUS_STYLE[status as CellStatus];
    const blockedUntil = isAssignedRow ? null : getBlockedUntil(emp.id);
    const isBlocked    = blockedUntil !== null;
    const owLabel      = isAssignedRow || isBlocked ? '' : getOverworkWarning(emp.id);
    const isOverwork   = owLabel !== '';
    const bgColor      = isBlocked ? '#f8fafc' : isOverwork ? '#fef2f2' : isAssignedRow ? tpl.color + '18' : '#f8fafc';
    const borderColor  = isBlocked ? '#f1f5f9' : isOverwork ? '#fca5a5' : isAssignedRow ? tpl.color + '88' : '#e2e8f0';
    const nameColor    = isBlocked ? '#94a3b8' : isOverwork ? '#dc2626' : st?.color ?? '#1e293b';
    return (
      <div key={emp.id}
        onClick={() => !isBlocked && onToggle(emp.id, cert)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', cursor: isBlocked ? 'default' : 'pointer', background: bgColor, border: `1px solid ${borderColor}`, opacity: isBlocked ? 0.55 : 1, transition: 'all 0.1s' }}>
        <div style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, border: `2px solid ${isBlocked ? '#e2e8f0' : isOverwork ? '#fca5a5' : isAssignedRow ? tpl.color : '#cbd5e1'}`, background: isAssignedRow ? tpl.color : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'white', fontWeight: '700' }}>
          {isAssignedRow ? '✓' : ''}
        </div>
        <span style={{ fontSize: '12px', fontWeight: isOverwork ? '700' : '500', color: nameColor, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {emp.name.split(' ').slice(0, 2).join(' ')}
        </span>
        {isBlocked && <span style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', flexShrink: 0, whiteSpace: 'nowrap' }}>rest {blockedUntil}</span>}
        {isOverwork && <span style={{ fontSize: '10px', fontWeight: '700', color: '#dc2626', flexShrink: 0, whiteSpace: 'nowrap' }}>⚠ {owLabel}</span>}
        {isAssignedRow && slotRoles[emp.id] && (
          <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '9999px', background: tpl.color + '22', color: tpl.color, border: `1px solid ${tpl.color}44`, flexShrink: 0 }}>
            {slotRoles[emp.id]}
          </span>
        )}
        {!isBlocked && !isOverwork && st && <span style={{ fontSize: '10px', fontWeight: '700', color: st.color, flexShrink: 0 }}>{st.label}</span>}
      </div>
    );
  }

  function renderSection(label: string, cert: string | undefined, soldiers: Array<{ emp: Employee; status: CellStatus }>, isAssignedSection: boolean, alwaysShow = false) {
    if (soldiers.length === 0 && !isAssignedSection && !alwaysShow) return null;
    const headerColor = isAssignedSection ? '#15803d' : '#94a3b8';
    return (
      <div key={label} style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: headerColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', paddingLeft: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {label}
          {isAssignedSection && <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: '9999px', padding: '0px 6px', fontSize: '10px', fontWeight: '700' }}>{soldiers.length}</span>}
        </div>
        {soldiers.length === 0 ? (
          <div style={{ fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic', paddingLeft: '2px' }}>None</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {soldiers.map(s => renderSoldierRow(s, isAssignedSection, cert))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: '220px', flexShrink: 0, borderLeft: '1px solid #e2e8f0', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: 'white', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: tpl.color, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{dk} · {tpl.startTime}–{tpl.endTime}</span>
          {group && <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '9999px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>{group.name}</span>}
        </div>
        {requiredCerts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {requiredCerts.map(c => (
              <span key={c} style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '9999px', background: tpl.color + '18', color: tpl.color, border: `1px solid ${tpl.color}44` }}>{c}</span>
            ))}
          </div>
        )}
        <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '700', color: full ? '#15803d' : '#dc2626' }}>
          {assigned.length}/{tpl.requiredSoldiers} assigned
        </div>
      </div>
      {/* Sections */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
        {renderSection('Assigned', undefined, assignedSoldiers, true)}
        {certSections.map(({ label, soldiers }) => renderSection(label, label, soldiers, false, true))}
        {renderSection('Other Soldiers', '', otherSoldiers, false)}
      </div>
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────
export default function Tasks({ employees, schedule, taskTemplates, taskAssignments, taskRoles, taskGroups, onUpdateAssignments, onUpdateRoles }: TasksProps) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [certSourceKey]                   = useFirestore<string>('hmal-cert-source-col', '');
  const [viewMode, setViewMode]           = useFirestore<ViewMode>('tasks-view-mode', 'day');
  const [anchor, setAnchor]               = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [customFrom, setCustomFrom]       = useFirestore('tasks-custom-from', '');
  const [customTo, setCustomTo]           = useFirestore('tasks-custom-to', '');
  const [customApplied, setCustomApplied] = useFirestore<{ from: string; to: string } | null>('tasks-custom-applied', null);
  const [selectedCell, setSelectedCell]   = useState<{ templateId: string; dk: string } | null>(null);
  const [extraDays, setExtraDays]         = useState(2);
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorDk  = dateKey(anchor);

  // Reset infinite scroll when anchor or viewMode changes
  useEffect(() => {
    setExtraDays(2);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [anchorDk, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < HOUR_HEIGHT * 4) {
      setExtraDays(prev => prev + 1);
    }
  }

  // Days rendered in the infinite-scroll day view
  const daysList = Array.from({ length: extraDays + 1 }, (_, i) => {
    const d = new Date(anchor); d.setDate(d.getDate() + i); return d;
  });

  const viewDates  = buildViewDates(viewMode, anchor, customApplied);

  // The date used to determine sidebar soldier availability
  const activeDk = selectedCell?.dk ?? (viewDates.length > 0 ? dateKey(viewDates[0]) : anchorDk);

  const activeEmployees = employees.filter(e => e.status === 'Active' || e.status === 'Annexation');

  function getSoldierStatus(empId: string, dk: string): CellStatus {
    return (schedule[empId]?.[dk] ?? '') as CellStatus;
  }

  const sidebarSoldiers = activeEmployees
    .map(emp => ({ emp, status: getSoldierStatus(emp.id, activeDk) }))
    .filter(({ status }) => status !== 'home-leave' && status !== 'absent');

  function getAssigned(templateId: string, dk: string): string[] {
    return taskAssignments[templateId]?.[dk] ?? [];
  }

  // Returns overwork info for a soldier on a day, per group.
  // If the soldier's total hours in a group on that day >= group.alertHours, returns the breakdown.
  function overworkInfo(empId: string, dk: string, groupId: string | undefined): { exceeded: boolean; label: string } {
    if (!groupId) return { exceeded: false, label: '' };
    const group = taskGroups.find(g => g.id === groupId);
    if (!group) return { exceeded: false, label: '' };
    const groupTpls = taskTemplates.filter(t => t.groupId === groupId);
    const assignedTpls = groupTpls.filter(t => getAssigned(t.id, dk).includes(empId));
    if (assignedTpls.length < 2) return { exceeded: false, label: '' };
    const hours = assignedTpls.map(t => taskDurationH(t));
    const total = hours.reduce((s, h) => s + h, 0);
    const threshold = group.alertHours ?? 16;
    if (total < threshold) return { exceeded: false, label: '' };
    return { exceeded: true, label: hours.map(fmtH).join('+') };
  }

  function toggleAssignment(templateId: string, dk: string, empId: string, cert?: string) {
    const current    = getAssigned(templateId, dk);
    const isRemoving = current.includes(empId);
    const nextIds    = isRemoving ? current.filter(id => id !== empId) : [...current, empId];
    onUpdateAssignments({ ...taskAssignments, [templateId]: { ...(taskAssignments[templateId] ?? {}), [dk]: nextIds } });

    const currentSlotRoles = { ...(taskRoles[templateId]?.[dk] ?? {}) };
    if (isRemoving) {
      delete currentSlotRoles[empId];
    } else {
      currentSlotRoles[empId] = cert ?? '';
    }
    onUpdateRoles({ ...taskRoles, [templateId]: { ...(taskRoles[templateId] ?? {}), [dk]: currentSlotRoles } });
  }

  function navigate(delta: -1 | 1) {
    setAnchor(prev => {
      const d = new Date(prev);
      if (viewMode === 'day')   d.setDate(d.getDate() + delta);
      if (viewMode === 'week')  d.setDate(d.getDate() + delta * 7);
      if (viewMode === 'month') d.setMonth(d.getMonth() + delta);
      return d;
    });
  }

  function goToToday() {
    const d = new Date(); d.setHours(0,0,0,0);
    setAnchor(d);
  }

  function titleText(): string {
    if (viewMode === 'day') return `${FULL_DAYS[anchor.getDay()]}, ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
    if (viewMode === 'week' && viewDates.length === 7) {
      const f = viewDates[0], l = viewDates[6];
      if (f.getMonth() === l.getMonth()) return `${MONTH_NAMES[f.getMonth()]} ${f.getDate()}–${l.getDate()}, ${f.getFullYear()}`;
      return `${SHORT_MONTHS[f.getMonth()]} ${f.getDate()} – ${SHORT_MONTHS[l.getMonth()]} ${l.getDate()}, ${l.getFullYear()}`;
    }
    if (viewMode === 'month') return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (customApplied) return `${customApplied.from}  →  ${customApplied.to}`;
    return 'Custom Range';
  }

  const isToday    = (d: Date) => dateKey(d) === dateKey(today);
  const isWeekend  = (d: Date) => d.getDay() === 5 || d.getDay() === 6;
  const isFriday   = (d: Date) => d.getDay() === 5;
  const isSaturday = (d: Date) => d.getDay() === 6;
  const colMinWidth = viewMode === 'week' ? 110 : 80;

  const sortedTemplates = [...taskTemplates].sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime));

  // Custom row order for grid view (persisted)
  const [taskOrder, setTaskOrder] = useFirestore<string[]>('hmal-task-order', []);
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);
  const dragRowIdx = useRef<number | null>(null);

  // Apply custom order; new templates fall to the bottom
  const orderedTemplates = (() => {
    const inOrder = taskOrder.map(id => taskTemplates.find(t => t.id === id)).filter(Boolean) as TaskTemplate[];
    const rest    = taskTemplates.filter(t => !taskOrder.includes(t.id));
    return [...inOrder, ...rest];
  })();

  function handleRowDragStart(i: number) { dragRowIdx.current = i; }
  function handleRowDrop(i: number) {
    if (dragRowIdx.current === null || dragRowIdx.current === i) { setDragOverRow(null); return; }
    const next = [...orderedTemplates];
    const [moved] = next.splice(dragRowIdx.current, 1);
    next.splice(i, 0, moved);
    setTaskOrder(next.map(t => t.id));
    dragRowIdx.current = null;
    setDragOverRow(null);
  }

  const selectedTpl     = selectedCell ? (taskTemplates.find(t => t.id === selectedCell.templateId) ?? null) : null;

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

  const tabStyle = (m: ViewMode): React.CSSProperties => ({
    padding: '5px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
    border: '1px solid #e2e8f0',
    borderLeft: m !== 'day' ? 'none' : undefined,
    borderRadius: m === 'day' ? '6px 0 0 6px' : m === 'custom' ? '0 6px 6px 0' : '0',
    background: viewMode === m ? '#2563eb' : 'white',
    color: viewMode === m ? 'white' : '#475569',
  });

  const stickyTop:    React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2 };
  const stickyLeft:   React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1 };
  const stickyCorner: React.CSSProperties = { position: 'sticky', left: 0, top: 0, zIndex: 4 };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>

      {/* Row 1: nav + title + view tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flexShrink: 0 }}>
        {viewMode !== 'custom' && (
          <>
            <button onClick={() => navigate(-1)} style={navBtn}>‹</button>
            <span style={{ fontSize: '16px', fontWeight: '700', minWidth: '240px', textAlign: 'center', color: '#1e293b' }}>
              {titleText()}
            </span>
            <button onClick={() => navigate(1)} style={navBtn}>›</button>
            <button onClick={goToToday} style={{ padding: '5px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#2563eb', fontWeight: '500' }}>
              Today
            </button>
          </>
        )}
        {viewMode === 'custom' && (
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>{titleText()}</span>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex' }}>
          {(['day','week','month','custom'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => { setViewMode(m); setSelectedCell(null); }} style={tabStyle(m)}>
              {m === 'day' ? 'Day' : m === 'week' ? 'Week' : m === 'month' ? 'Month' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: custom range inputs */}
      {viewMode === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flexShrink: 0, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
          <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>From</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '5px 8px', fontSize: '13px', cursor: 'pointer' }} />
          <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>To</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '5px 8px', fontSize: '13px', cursor: 'pointer' }} />
          <button
            onClick={() => { if (customFrom && customTo && customFrom <= customTo) setCustomApplied({ from: customFrom, to: customTo }); }}
            style={{ padding: '5px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
            Apply
          </button>
          {customApplied && <span style={{ fontSize: '12px', color: '#64748b' }}>{viewDates.length} day{viewDates.length !== 1 ? 's' : ''}</span>}
        </div>
      )}

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, gap: '16px', minHeight: 0 }}>

        {/* Sidebar: soldier availability */}
        <div style={{ width: '192px', flexShrink: 0, background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            <div>Available · {sidebarSoldiers.length}</div>
            {viewMode !== 'day' && (
              <div style={{ fontSize: '10px', fontWeight: '400', color: '#cbd5e1', marginTop: '2px' }}>
                {selectedCell ? selectedCell.dk : (viewDates.length > 0 ? dateKey(viewDates[0]) : activeDk)}
              </div>
            )}
          </div>

          {sidebarSoldiers.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', paddingTop: '12px' }}>No soldiers on base</div>
          ) : sidebarSoldiers.map(({ emp, status }) => {
            const st = STATUS_STYLE[status as CellStatus];
            const bg      = st?.bg     ?? '#f8fafc';
            const border  = st?.border ?? '#f1f5f9';
            const color   = st?.color  ?? '#1e293b';
            const initBg  = st ? st.border : '#dbeafe';
            const initClr = st?.color ?? '#2563eb';
            return (
              <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 9px', borderRadius: '8px', background: bg, border: `1px solid ${border}` }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, background: initBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: initClr, fontSize: '10px' }}>
                  {emp.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.name.split(' ').slice(0, 2).join(' ')}
                  </div>
                  {st && <div style={{ fontSize: '10px', fontWeight: '700', color }}>{st.label}</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main area */}
        <div style={{ flex: 1, background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {taskTemplates.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontWeight: '600', fontSize: '15px' }}>No task templates yet</div>
              <div style={{ fontSize: '13px', marginTop: '6px' }}>Go to Settings to create task templates</div>
            </div>

          ) : viewMode === 'custom' && !customApplied ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📆</div>
              <div style={{ fontWeight: '500' }}>Select a date range above and click Apply</div>
            </div>

          ) : viewMode === 'day' ? (
            // ── DAY VIEW: infinite-scroll 24h timeline ──────────────────────
            <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
              <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflow: 'auto' }}>
                {daysList.map((day, dayIdx) => {
                  const dayDk    = dateKey(day);
                  const colLayout  = assignColumns(sortedTemplates);
                  const isTodayDay = isToday(day);
                  const isWknd     = isWeekend(day);
                  const prevDay    = new Date(day); prevDay.setDate(prevDay.getDate() - 1);
                  const prevDayDk  = dateKey(prevDay);
                  return (
                    <div key={dayDk}>
                      {/* Day separator header */}
                      <div style={{
                        position: 'sticky', top: 0, zIndex: 3,
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '7px 16px',
                        background: isTodayDay ? '#eff6ff' : isWknd ? '#fdf4ff' : '#f8fafc',
                        borderTop: dayIdx > 0 ? '3px solid #e2e8f0' : undefined,
                        borderBottom: `2px solid ${isTodayDay ? '#2563eb' : isWknd ? '#e9d5ff' : '#e2e8f0'}`,
                      }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: isTodayDay ? '#2563eb' : isWknd ? '#7c3aed' : '#1e293b' }}>
                          {FULL_DAYS[day.getDay()]}, {MONTH_NAMES[day.getMonth()]} {day.getDate()}, {day.getFullYear()}
                        </span>
                        {isTodayDay && <span style={{ fontSize: '11px', background: '#2563eb', color: 'white', borderRadius: '4px', padding: '1px 7px', fontWeight: '700' }}>Today</span>}
                        {isWknd && !isTodayDay && <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: '600' }}>Weekend</span>}
                      </div>

                      {/* 24h section */}
                      <div style={{ display: 'flex' }}>
                        {/* Hour labels */}
                        <div style={{ width: '52px', flexShrink: 0 }}>
                          {Array.from({ length: 24 }, (_, h) => (
                            <div key={h} style={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '8px', paddingTop: '4px' }}>
                              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>{String(h).padStart(2,'0')}:00</span>
                            </div>
                          ))}
                        </div>

                        {/* Grid */}
                        <div style={{ flex: 1, position: 'relative', borderLeft: '1px solid #f1f5f9' }}>
                          <div style={{ height: 24 * HOUR_HEIGHT }} />
                          {Array.from({ length: 25 }, (_, h) => (
                            <div key={h} style={{ position: 'absolute', top: h * HOUR_HEIGHT, left: 0, right: 0, borderTop: `1px solid ${h % 6 === 0 ? '#e2e8f0' : '#f8fafc'}`, zIndex: 0 }} />
                          ))}

                          {/* Now indicator — only on today */}
                          {isTodayDay && (
                            <div style={{ position: 'absolute', top: (nowMins / 60) * HOUR_HEIGHT, left: 0, right: 0, zIndex: 5, pointerEvents: 'none' }}>
                              <div style={{ height: '2px', background: '#ef4444' }}>
                                <div style={{ position: 'absolute', left: -5, top: -4, width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                              </div>
                            </div>
                          )}

                          {/* ── Continuation blocks: overnight tasks from previous day ── */}
                          {colLayout
                            .filter(({ tpl }) => {
                              const e = timeToMins(tpl.endTime);
                              return e < timeToMins(tpl.startTime) && e > 0; // overnight, ends after 00:00
                            })
                            .map(({ tpl, col, totalCols }) => {
                              const endMins  = timeToMins(tpl.endTime);
                              const height   = Math.max((endMins / 60) * HOUR_HEIGHT, 32);
                              const assigned = getAssigned(tpl.id, prevDayDk);
                              const isSel    = selectedCell?.templateId === tpl.id && selectedCell?.dk === prevDayDk;
                              const full     = assigned.length >= tpl.requiredSoldiers;
                              const leftVal  = `calc(${col / totalCols * 100}% + ${col === 0 ? 8 : 2}px)`;
                              const rightVal = `calc(${(totalCols - col - 1) / totalCols * 100}% + ${col === totalCols - 1 ? 8 : 2}px)`;
                              const borderColor = isSel ? tpl.color : tpl.color + '66';
                              return (
                                <div key={`cont-${tpl.id}`}
                                  onClick={() => setSelectedCell(isSel ? null : { templateId: tpl.id, dk: prevDayDk })}
                                  style={{ position: 'absolute', top: 0, left: leftVal, right: rightVal, height, borderRadius: '0 0 8px 8px', background: tpl.color + '1a', borderRight: `2px solid ${borderColor}`, borderBottom: `2px solid ${borderColor}`, borderLeft: `2px solid ${borderColor}`, borderTop: `2px dashed ${borderColor}`, padding: '4px 10px', cursor: 'pointer', overflow: 'hidden', zIndex: 1, boxShadow: isSel ? `0 0 0 3px ${tpl.color}33` : undefined, transition: 'box-shadow 0.15s' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '10px', color: tpl.color, fontWeight: '700' }}>↑</span>
                                    <span style={{ fontWeight: '700', fontSize: '12px', color: tpl.color }}>{tpl.name}</span>
                                    <span style={{ fontSize: '10px', color: '#64748b' }}>until {tpl.endTime}</span>
                                    <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '700', color: full ? '#15803d' : '#dc2626' }}>{assigned.length}/{tpl.requiredSoldiers}</span>
                                  </div>
                                  {height >= 48 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                      {assigned.map(id => { const e = employees.find(x => x.id === id); return e ? <span key={id} style={{ fontSize: '10px', background: tpl.color + '33', color: tpl.color, borderRadius: '4px', padding: '1px 5px', fontWeight: '600' }}>{e.name.split(' ')[0]}</span> : null; })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                          {/* ── Main task blocks ── */}
                          {colLayout.map(({ tpl, col, totalCols }) => {
                            const isOvernight = timeToMins(tpl.endTime) < timeToMins(tpl.startTime);
                            const startMins   = timeToMins(tpl.startTime);
                            const headEndMins = isOvernight ? 24 * 60 : timeToMins(tpl.endTime);
                            const top         = (startMins / 60) * HOUR_HEIGHT;
                            const height      = Math.max((headEndMins - startMins) / 60 * HOUR_HEIGHT, 32);
                            const assigned    = getAssigned(tpl.id, dayDk);
                            const isSel       = selectedCell?.templateId === tpl.id && selectedCell?.dk === dayDk;
                            const full        = assigned.length >= tpl.requiredSoldiers;
                            const leftVal     = `calc(${col / totalCols * 100}% + ${col === 0 ? 8 : 2}px)`;
                            const rightVal    = `calc(${(totalCols - col - 1) / totalCols * 100}% + ${col === totalCols - 1 ? 8 : 2}px)`;
                            const borderColor = isSel ? tpl.color : tpl.color + '66';
                            return (
                              <div key={tpl.id}
                                onClick={() => setSelectedCell(isSel ? null : { templateId: tpl.id, dk: dayDk })}
                                style={{ position: 'absolute', left: leftVal, right: rightVal, top, height, borderRadius: isOvernight ? '8px 8px 0 0' : '8px', background: tpl.color + '1a', borderRight: `2px solid ${borderColor}`, borderTop: `2px solid ${borderColor}`, borderLeft: `2px solid ${borderColor}`, borderBottom: isOvernight ? `2px dashed ${borderColor}` : `2px solid ${borderColor}`, padding: '6px 10px', cursor: 'pointer', overflow: 'hidden', zIndex: 1, boxShadow: isSel ? `0 0 0 3px ${tpl.color}33` : undefined, transition: 'box-shadow 0.15s' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                  <span style={{ fontWeight: '700', fontSize: '13px', color: tpl.color }}>{tpl.name}</span>
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>{tpl.startTime}–{tpl.endTime}{isOvernight ? ' ↓' : ''}</span>
                                  <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: '700', color: full ? '#15803d' : '#dc2626' }}>{assigned.length}/{tpl.requiredSoldiers}</span>
                                </div>
                                {height >= 48 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    {(tpl.certifications ?? []).length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                        {tpl.certifications.map(c => (
                                          <span key={c} style={{ fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '9999px', background: tpl.color + '33', color: tpl.color, border: `1px solid ${tpl.color}55` }}>{c}</span>
                                        ))}
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                      {assigned.map(id => {
                                        const e = employees.find(x => x.id === id);
                                        if (!e) return null;
                                        const ow = overworkInfo(id, dayDk, tpl.groupId);
                                        return (
                                          <span key={id} style={{ fontSize: '11px', background: ow.exceeded ? '#fef2f2' : tpl.color + '33', color: ow.exceeded ? '#dc2626' : tpl.color, borderRadius: '4px', padding: '1px 6px', fontWeight: '600', border: ow.exceeded ? '1px solid #fca5a5' : undefined }}>
                                            {e.name.split(' ')[0]}{ow.exceeded ? ` ⚠${ow.label}` : ''}
                                          </span>
                                        );
                                      })}
                                      {assigned.length < tpl.requiredSoldiers && <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>click to assign</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedTpl && selectedCell && (
                <AssignmentPanel tpl={selectedTpl} dk={selectedCell.dk} sidebarSoldiers={sidebarSoldiers}
                  assigned={getAssigned(selectedTpl.id, selectedCell.dk)}
                  slotRoles={taskRoles[selectedTpl.id]?.[selectedCell.dk] ?? {}}
                  onToggle={(empId, cert) => toggleAssignment(selectedTpl.id, selectedCell.dk, empId, cert)}
                  onClose={() => setSelectedCell(null)} certSourceKey={certSourceKey}
                  taskGroups={taskGroups} allTaskTemplates={taskTemplates} allTaskAssignments={taskAssignments} />
              )}
            </div>

          ) : (
            // ── WEEK / MONTH / CUSTOM: grid ────────────────────────────────
            <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ ...stickyCorner, minWidth: '180px', padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', background: '#f8fafc', borderRight: '2px solid #e2e8f0' }}>
                        Task
                      </th>
                      {viewDates.map(d => {
                        const { top, bottom } = formatColHeader(d, viewMode);
                        const weekend  = isWeekend(d);
                        const todayCol = isToday(d);
                        return (
                          <th key={dateKey(d)} style={{
                            ...stickyTop, padding: 0, fontSize: '11px', fontWeight: '600', textAlign: 'center',
                            borderRight: isSaturday(d) ? '2px solid #a78bfa' : '1px solid #e2e8f0',
                            borderLeft:  isFriday(d)   ? '2px solid #a78bfa' : undefined,
                            minWidth: colMinWidth,
                            background: todayCol ? '#eff6ff' : weekend ? '#fdf4ff' : '#f8fafc',
                            borderTop: todayCol ? '2px solid #2563eb' : weekend ? '2px solid #e9d5ff' : undefined,
                          }}>
                            <div style={{ padding: '6px 4px' }}>
                              <div style={{ color: weekend ? '#7c3aed' : todayCol ? '#2563eb' : '#374151', fontWeight: todayCol || weekend ? '700' : '600' }}>{top}</div>
                              <div style={{ color: weekend ? '#a78bfa' : '#94a3b8', fontSize: '10px' }}>{bottom}</div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {orderedTemplates.map((tpl, rowIdx) => {
                      const rowBg = rowIdx % 2 === 0 ? 'white' : '#fafafa';
                      const isDragOver = dragOverRow === rowIdx;
                      return (
                        <tr key={tpl.id}
                          draggable
                          onDragStart={() => handleRowDragStart(rowIdx)}
                          onDragEnter={() => setDragOverRow(rowIdx)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => handleRowDrop(rowIdx)}
                          onDragEnd={() => setDragOverRow(null)}
                          style={{ background: isDragOver ? '#eff6ff' : rowBg, outline: isDragOver ? '2px solid #2563eb' : undefined, outlineOffset: '-2px' }}>
                          {/* Task label */}
                          <td style={{ ...stickyLeft, padding: '8px 16px', background: isDragOver ? '#eff6ff' : rowBg, borderRight: '2px solid #e2e8f0', cursor: 'grab' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#cbd5e1', fontSize: '14px', flexShrink: 0 }}>⠿</span>
                              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: tpl.color, flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap' }}>{tpl.name}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{tpl.startTime}–{tpl.endTime}</div>
                              </div>
                            </div>
                          </td>
                          {/* Day cells */}
                          {viewDates.map(d => {
                            const cellDk   = dateKey(d);
                            const assigned = getAssigned(tpl.id, cellDk);
                            const isSel    = selectedCell?.templateId === tpl.id && selectedCell?.dk === cellDk;
                            const todayCol = isToday(d);
                            const weekend  = isWeekend(d);
                            const full     = assigned.length >= tpl.requiredSoldiers;
                            return (
                              <td key={cellDk}
                                onClick={() => setSelectedCell(isSel ? null : { templateId: tpl.id, dk: cellDk })}
                                style={{
                                  padding: '6px 8px', textAlign: 'left', cursor: 'pointer', minWidth: colMinWidth,
                                  verticalAlign: 'top',
                                  borderRight: isSaturday(d) ? '2px solid #a78bfa' : '1px solid #f1f5f9',
                                  borderLeft:  isFriday(d)   ? '2px solid #a78bfa' : undefined,
                                  background: isSel ? '#dbeafe' : todayCol ? '#f0f7ff' : weekend ? '#faf5ff' : rowBg,
                                  outline: isSel ? '2px solid #2563eb' : undefined,
                                  outlineOffset: '-2px',
                                }}>
                                {assigned.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '700', color: full ? '#15803d' : '#dc2626', marginBottom: '2px' }}>
                                      {assigned.length}/{tpl.requiredSoldiers}
                                    </div>
                                    {assigned.map(id => {
                                      const emp  = employees.find(x => x.id === id);
                                      if (!emp) return null;
                                      const role = taskRoles[tpl.id]?.[cellDk]?.[id] ?? '';
                                      const st   = STATUS_STYLE[getSoldierStatus(emp.id, cellDk)];
                                      const ow   = overworkInfo(id, cellDk, tpl.groupId);
                                      return (
                                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 7px', borderRadius: '7px', background: ow.exceeded ? '#fef2f2' : tpl.color + '18', border: `1px solid ${ow.exceeded ? '#fca5a5' : tpl.color + '44'}`, whiteSpace: 'nowrap' }}>
                                          <span style={{ fontSize: '11px', fontWeight: '600', color: ow.exceeded ? '#dc2626' : (st?.color ?? '#1e293b'), flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {emp.name.split(' ')[0]}
                                          </span>
                                          {ow.exceeded && (
                                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#dc2626', flexShrink: 0 }}>⚠{ow.label}</span>
                                          )}
                                          {role && !ow.exceeded && (
                                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 5px', borderRadius: '9999px', background: tpl.color + '33', color: tpl.color, border: `1px solid ${tpl.color}55`, flexShrink: 0 }}>
                                              {role}
                                            </span>
                                          )}
                                          {st && <span style={{ fontSize: '10px', fontWeight: '700', color: st.color, flexShrink: 0 }}>{st.label}</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ height: '22px' }} />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {selectedTpl && selectedCell && (
                <AssignmentPanel tpl={selectedTpl} dk={selectedCell.dk} sidebarSoldiers={sidebarSoldiers}
                  assigned={getAssigned(selectedTpl.id, selectedCell.dk)}
                  slotRoles={taskRoles[selectedTpl.id]?.[selectedCell.dk] ?? {}}
                  onToggle={(empId, cert) => toggleAssignment(selectedTpl.id, selectedCell.dk, empId, cert)}
                  onClose={() => setSelectedCell(null)} certSourceKey={certSourceKey}
                  taskGroups={taskGroups} allTaskTemplates={taskTemplates} allTaskAssignments={taskAssignments} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: '32px', height: '32px', border: '1px solid #e2e8f0',
  borderRadius: '6px', background: 'white', fontSize: '18px',
  cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: '#475569', lineHeight: 1,
};
