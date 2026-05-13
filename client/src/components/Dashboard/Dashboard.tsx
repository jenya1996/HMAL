import { useMemo, useState, useRef, useEffect } from 'react';
import { Employee, TaskTemplate, TaskAssignments, TaskGroup, DashboardConfig, ColumnDef } from '../../types';
import { ScheduleData } from '../Schedule/ScheduleCalendar';
import { getVal } from '../../lib/employeeFilters';

interface DashboardProps {
  employees: Employee[];
  schedule: ScheduleData;
  taskTemplates: TaskTemplate[];
  taskAssignments: TaskAssignments;
  taskGroups: TaskGroup[];
  dashboardConfig?: DashboardConfig;
  columnDefs?: ColumnDef[];
  onUpdateDashboardConfig?: (c: DashboardConfig) => void;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${ampm}`;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  sub: string;
  accentColor: string;
  icon: string;
}

function StatCard({ label, value, sub, accentColor, icon }: StatCardProps) {
  return (
    <div style={{
      background: 'white', borderRadius: '12px', padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: `4px solid ${accentColor}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minWidth: 0,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: '500', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        <div style={{ fontSize: '32px', fontWeight: '700', color: accentColor, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', lineHeight: '1.4' }}>
          {sub}
        </div>
      </div>
      <div style={{
        fontSize: '22px', width: '40px', height: '40px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: `${accentColor}14`,
        borderRadius: '10px', flexShrink: 0, marginLeft: '12px',
      }} aria-hidden="true">
        {icon}
      </div>
    </div>
  );
}

// ─── Task Status Row ─────────────────────────────────────────────────────────

function TaskRow({ template, assignedCount }: { template: TaskTemplate; assignedCount: number }) {
  const required = template.requiredSoldiers;
  const pct = required > 0 ? Math.min(assignedCount / required, 1) : 0;
  const statusColor = assignedCount === 0 ? '#ef4444' : assignedCount < required ? '#f59e0b' : '#22c55e';
  const statusLabel = assignedCount === 0 ? 'Empty' : assignedCount < required ? 'Partial' : 'Full';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto auto', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div title={statusLabel} style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor }} aria-label={statusLabel} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{template.name}</div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{formatTime(template.startTime)} – {formatTime(template.endTime)}</div>
      </div>
      <div style={{ width: '64px' }}>
        <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
          <div style={{ width: `${pct * 100}%`, height: '100%', background: statusColor, borderRadius: '4px', transition: 'width 0.3s ease' }} />
        </div>
      </div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: statusColor, background: `${statusColor}14`, padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
        {assignedCount}/{required}
      </div>
    </div>
  );
}

// ─── Soldier Avatar Row ──────────────────────────────────────────────────────

function SoldierRow({ emp, sub }: { emp: Employee; sub: string }) {
  const initials = emp.name
    ? emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div aria-hidden="true" style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', color: '#2563eb', fontSize: '13px', flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>{sub}</div>
      </div>
    </div>
  );
}

// ─── Department Bar ──────────────────────────────────────────────────────────

function DeptRow({ dept, count, total }: { dept: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>{dept}</span>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{count}</span>
      </div>
      <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#2563eb', borderRadius: '4px', transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>{message}</div>;
}

// ─── Drag-and-drop panel IDs ─────────────────────────────────────────────────

type PanelId = 'tasks' | 'on-leave' | 'at-base' | 'free-soldiers' | 'returning' | 'departed' | 'absent' | 'departments';

const ALL_PANEL_IDS: PanelId[] = ['tasks', 'on-leave', 'at-base', 'free-soldiers', 'returning', 'departed', 'absent', 'departments'];

const COLLAPSED_H = 290; // ~5 rows
const EXPANDED_H  = 580; // ~10 rows

// ─── Main Dashboard ──────────────────────────────────────────────────────────

type DateMode = 'yesterday' | 'today' | 'tomorrow' | 'custom';

export default function Dashboard({
  employees,
  schedule,
  taskTemplates,
  taskAssignments,
  taskGroups: _taskGroups,
  dashboardConfig,
  columnDefs,
  onUpdateDashboardConfig,
}: DashboardProps) {
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [customDate, setCustomDate] = useState<string>(todayKey);

  const selectedDateKey = useMemo(() => {
    if (dateMode === 'yesterday') {
      const d = new Date(); d.setDate(d.getDate() - 1); return toDateKey(d);
    }
    if (dateMode === 'tomorrow') {
      const d = new Date(); d.setDate(d.getDate() + 1); return toDateKey(d);
    }
    if (dateMode === 'custom') return customDate;
    return todayKey;
  }, [dateMode, customDate, todayKey]);

  const dateLabel = useMemo(() => {
    if (dateMode === 'yesterday') return 'Yesterday';
    if (dateMode === 'tomorrow') return 'Tomorrow';
    if (dateMode === 'custom') {
      const [y, m, d] = selectedDateKey.split('-');
      return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return 'Today';
  }, [dateMode, selectedDateKey]);

  // Apply soldier column filters from dashboardConfig
  const filteredSoldiers = useMemo(() => {
    const filters = dashboardConfig?.soldierColumnFilters ?? {};
    const colDefs = columnDefs ?? [];
    const entries = Object.entries(filters).filter(([, vals]) => vals.length > 0);
    if (!entries.length) return employees;
    return employees.filter(emp =>
      entries.every(([key, allowedValues]) => {
        const empVal = getVal(emp, key);
        const col = colDefs.find(c => c.key === key);
        if (col?.fieldType === 'multiselect') {
          const empValues = empVal.split('|').filter(Boolean);
          return empValues.some(v => allowedValues.includes(v));
        }
        return allowedValues.includes(empVal);
      })
    );
  }, [employees, dashboardConfig, columnDefs]);

  const activeEmployees     = filteredSoldiers.filter(e => e.status === 'Active').length;
  const annexationEmployees = filteredSoldiers.filter(e => e.status === 'Annexation').length;
  const inactiveEmployees   = filteredSoldiers.filter(e => e.status === 'Inactive').length;

  const onLeaveToday = useMemo(() =>
    filteredSoldiers.filter(e => schedule[e.id]?.[selectedDateKey] === 'home-leave'),
  [filteredSoldiers, schedule, selectedDateKey]);

  const onBaseSoldiers = useMemo(() =>
    filteredSoldiers.filter(e => {
      if (e.status !== 'Active') return false;
      const cell = schedule[e.id]?.[selectedDateKey];
      return !cell || cell === 'on-base' || cell === 'returning';
    }),
  [filteredSoldiers, schedule, selectedDateKey]);

  const onBaseCount = onBaseSoldiers.length;

  const taskStatsToday = useMemo(() =>
    taskTemplates.map(t => ({
      template: t,
      assignedCount: (taskAssignments[t.id]?.[selectedDateKey] ?? []).length,
    })),
  [taskTemplates, taskAssignments, selectedDateKey]);

  const tasksFullCount    = taskStatsToday.filter(s => s.assignedCount >= s.template.requiredSoldiers).length;
  const tasksPartialCount = taskStatsToday.filter(s => s.assignedCount > 0 && s.assignedCount < s.template.requiredSoldiers).length;
  const tasksEmptyCount   = taskStatsToday.filter(s => s.assignedCount === 0 && s.template.requiredSoldiers > 0).length;

  const freeSoldiersToday = useMemo(() => {
    const assignedIds = new Set<string>();
    taskTemplates.forEach(t => {
      (taskAssignments[t.id]?.[selectedDateKey] ?? []).forEach(id => assignedIds.add(id));
    });
    return filteredSoldiers.filter(e => {
      if (e.status !== 'Active') return false;
      const cell = schedule[e.id]?.[selectedDateKey];
      return (!cell || cell === 'on-base' || cell === 'returning') && !assignedIds.has(e.id);
    });
  }, [filteredSoldiers, schedule, taskTemplates, taskAssignments, selectedDateKey]);

  const returningToday = useMemo(() =>
    filteredSoldiers.filter(e => schedule[e.id]?.[selectedDateKey] === 'returning'),
  [filteredSoldiers, schedule, selectedDateKey]);

  const departedToday = useMemo(() =>
    filteredSoldiers.filter(e => schedule[e.id]?.[selectedDateKey] === 'departed'),
  [filteredSoldiers, schedule, selectedDateKey]);

  const absentToday = useMemo(() =>
    filteredSoldiers.filter(e => schedule[e.id]?.[selectedDateKey] === 'absent'),
  [filteredSoldiers, schedule, selectedDateKey]);

  const deptBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSoldiers.filter(e => e.status === 'Active').forEach(e => {
      const dept = e.department || 'Unassigned';
      map[dept] = (map[dept] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredSoldiers]);

  const sortedTasks = useMemo(() =>
    [...taskStatsToday].sort((a, b) => {
      const p = (s: typeof a) => s.assignedCount === 0 ? 0 : s.assignedCount < s.template.requiredSoldiers ? 1 : 2;
      return p(a) - p(b);
    }),
  [taskStatsToday]);

  // ── Panel order + collapse state ──────────────────────────────────────────
  const panelOrderRef = useRef<PanelId[]>([]);
  const [panelOrder, setPanelOrder] = useState<PanelId[]>(ALL_PANEL_IDS);
  const [collapsedPanels, setCollapsedPanels] = useState<Set<PanelId>>(new Set(ALL_PANEL_IDS));

  // Apply the server-loaded panel order once after initial fetch (localStorage is
  // cleared on logout, so the useState initializer above can't see the saved order).
  const initialOrderApplied = useRef(false);
  useEffect(() => {
    if (initialOrderApplied.current) return;
    const saved = dashboardConfig?.panelOrder as PanelId[] | undefined;
    if (!saved?.length) return;
    const valid = saved.filter(id => (ALL_PANEL_IDS as readonly string[]).includes(id));
    const validSet = new Set(valid);
    ALL_PANEL_IDS.forEach(id => { if (!validSet.has(id as PanelId)) valid.push(id as PanelId); });
    setPanelOrder(valid);
    panelOrderRef.current = valid;
    initialOrderApplied.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardConfig?.panelOrder]);

  panelOrderRef.current = panelOrder;

  const hiddenPanels = dashboardConfig?.hiddenPanels ?? [];
  const visiblePanelOrder = panelOrder.filter(id => !hiddenPanels.includes(id));

  function toggleCollapse(id: PanelId) {
    setCollapsedPanels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Drag-and-drop (long press + move) ────────────────────────────────────
  const [draggingIdState, setDraggingIdState] = useState<PanelId | null>(null);
  const [dragOverIdState,  setDragOverIdState]  = useState<PanelId | null>(null);
  const draggingIdRef  = useRef<PanelId | null>(null);
  const dragOverIdRef  = useRef<PanelId | null>(null);
  const isDraggingRef  = useRef(false);
  const longPressRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelElsRef    = useRef<Partial<Record<PanelId, HTMLDivElement>>>({});
  const panelRectsRef  = useRef<Partial<Record<PanelId, DOMRect>>>({});

  function makeDragHandlers(id: PanelId) {
    return {
      onPointerDown(e: React.PointerEvent) {
        e.preventDefault();
        const el = e.currentTarget as HTMLElement;
        const pointerId = e.pointerId;
        longPressRef.current = setTimeout(() => {
          isDraggingRef.current = true;
          draggingIdRef.current = id;
          setDraggingIdState(id);
          el.setPointerCapture(pointerId);
          for (const [pid, panelEl] of Object.entries(panelElsRef.current)) {
            if (panelEl) panelRectsRef.current[pid as PanelId] = panelEl.getBoundingClientRect();
          }
        }, 500);
      },
      onPointerMove(e: React.PointerEvent) {
        if (!isDraggingRef.current) return;
        let found: PanelId | null = null;
        for (const [pid, rect] of Object.entries(panelRectsRef.current)) {
          if (rect &&
              e.clientX >= rect.left && e.clientX <= rect.right &&
              e.clientY >= rect.top  && e.clientY <= rect.bottom) {
            found = pid as PanelId;
            break;
          }
        }
        if (found !== dragOverIdRef.current) {
          dragOverIdRef.current = found;
          setDragOverIdState(found);
        }
      },
      onPointerUp() {
        if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
        if (isDraggingRef.current) {
          const from = draggingIdRef.current;
          const to   = dragOverIdRef.current;
          if (from && to && from !== to) {
            const next = [...panelOrderRef.current];
            const fi = next.indexOf(from);
            const ti = next.indexOf(to);
            next.splice(fi, 1);
            next.splice(ti, 0, from);
            setPanelOrder(next);
            initialOrderApplied.current = true;
            if (dashboardConfig && onUpdateDashboardConfig) {
              onUpdateDashboardConfig({ ...dashboardConfig, panelOrder: next });
            }
          }
        }
        isDraggingRef.current = false;
        draggingIdRef.current = null;
        dragOverIdRef.current = null;
        setDraggingIdState(null);
        setDragOverIdState(null);
      },
      onPointerCancel() {
        if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
        isDraggingRef.current = false;
        draggingIdRef.current = null;
        dragOverIdRef.current = null;
        setDraggingIdState(null);
        setDragOverIdState(null);
      },
    };
  }

  // ── Render a panel ────────────────────────────────────────────────────────
  function renderPanel(id: PanelId) {
    const isCollapsed = collapsedPanels.has(id);
    const isDragging  = draggingIdState === id;
    const isOver      = dragOverIdState === id && draggingIdState !== id;
    const dragHandlers = makeDragHandlers(id);
    const listH = isCollapsed ? COLLAPSED_H : EXPANDED_H;

    const panelTitles: Record<PanelId, string> = {
      'tasks':          `${dateLabel}'s Tasks`,
      'on-leave':       'Soldiers at Home',
      'at-base':        `Soldiers at Base — ${dateLabel}`,
      'free-soldiers':  `Free Soldiers — ${dateLabel}`,
      'returning':      `Returning ${dateLabel} (RTN)`,
      'departed':       `Departed ${dateLabel} (OUT)`,
      'absent':         `Absent ${dateLabel} (ABS)`,
      'departments':    'Active Soldiers by Department',
    };
    const panelCounts: Record<PanelId, number | undefined> = {
      'tasks':          taskTemplates.length > 0 ? taskTemplates.length : undefined,
      'on-leave':       onLeaveToday.length || undefined,
      'at-base':        onBaseSoldiers.length || undefined,
      'free-soldiers':  freeSoldiersToday.length || undefined,
      'returning':      returningToday.length || undefined,
      'departed':       departedToday.length || undefined,
      'absent':         absentToday.length || undefined,
      'departments':    undefined,
    };

    const header = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
            {panelTitles[id]}
          </h2>
          {panelCounts[id] !== undefined && (
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{panelCounts[id]}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => toggleCollapse(id)}
            style={{
              background: '#f1f5f9', border: 'none', borderRadius: '6px',
              padding: '3px 8px', fontSize: '11px', color: '#64748b',
              cursor: 'pointer', fontWeight: '600',
            }}
          >
            {isCollapsed ? '▼ Expand' : '▲ Collapse'}
          </button>
          <div
            {...dragHandlers}
            title="Hold to reorder"
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'none',
              padding: '4px 6px',
              color: isDragging ? '#2563eb' : '#94a3b8',
              fontSize: '18px',
              userSelect: 'none',
              lineHeight: 1,
              borderRadius: '4px',
              background: isDragging ? '#eff6ff' : 'transparent',
            }}
          >
            ⠿
          </div>
        </div>
      </div>
    );

    let listContent: React.ReactNode;

    if (id === 'tasks') {
      listContent = sortedTasks.length === 0
        ? <EmptyState message="No task templates configured yet." />
        : sortedTasks.map(({ template, assignedCount }) => (
            <TaskRow key={template.id} template={template} assignedCount={assignedCount} />
          ));
    } else if (id === 'on-leave') {
      listContent = onLeaveToday.length === 0
        ? <EmptyState message="No soldiers at home today." />
        : onLeaveToday.map(emp => (
            <SoldierRow key={emp.id} emp={emp} sub={[emp.position, emp.department].filter(Boolean).join(' · ')} />
          ));
    } else if (id === 'at-base') {
      listContent = onBaseSoldiers.length === 0
        ? <EmptyState message="No soldiers at base today." />
        : onBaseSoldiers.map(emp => (
            <SoldierRow key={emp.id} emp={emp} sub={[emp.position, emp.department].filter(Boolean).join(' · ')} />
          ));
    } else if (id === 'free-soldiers') {
      listContent = freeSoldiersToday.length === 0
        ? <EmptyState message="All on-base soldiers are assigned." />
        : freeSoldiersToday.map(emp => (
            <SoldierRow key={emp.id} emp={emp} sub={[emp.position, emp.department].filter(Boolean).join(' · ')} />
          ));
    } else if (id === 'returning') {
      listContent = returningToday.length === 0
        ? <EmptyState message="No soldiers returning today." />
        : returningToday.map(emp => (
            <SoldierRow key={emp.id} emp={emp} sub={[emp.position, emp.department].filter(Boolean).join(' · ')} />
          ));
    } else if (id === 'departed') {
      listContent = departedToday.length === 0
        ? <EmptyState message="No soldiers departed today." />
        : departedToday.map(emp => (
            <SoldierRow key={emp.id} emp={emp} sub={[emp.position, emp.department].filter(Boolean).join(' · ')} />
          ));
    } else if (id === 'absent') {
      listContent = absentToday.length === 0
        ? <EmptyState message="No soldiers absent today." />
        : absentToday.map(emp => (
            <SoldierRow key={emp.id} emp={emp} sub={[emp.position, emp.department].filter(Boolean).join(' · ')} />
          ));
    } else {
      listContent = deptBreakdown.length === 0
        ? <EmptyState message="No active soldiers." />
        : deptBreakdown.map(([dept, count]) => (
            <DeptRow key={dept} dept={dept} count={count} total={activeEmployees} />
          ));
    }

    return (
      <div
        key={id}
        ref={el => {
          if (el) panelElsRef.current[id] = el;
          else delete panelElsRef.current[id];
        }}
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: isOver
            ? '0 0 0 2px #2563eb, 0 4px 12px rgba(37,99,235,0.12)'
            : '0 1px 3px rgba(0,0,0,0.08)',
          opacity: isDragging ? 0.5 : 1,
          transition: 'box-shadow 0.15s, opacity 0.15s',
        }}
      >
        {header}
        <div style={{ maxHeight: listH, overflowY: 'auto' }}>
          {listContent}
        </div>
      </div>
    );
  }

  // ── Stat cards ────────────────────────────────────────────────────────────
  const hiddenCards = dashboardConfig?.hiddenStatCards ?? [];
  const isFiltered = Object.values(dashboardConfig?.soldierColumnFilters ?? {}).some(v => v.length > 0);

  const allStatCards: Array<{ id: string } & StatCardProps> = [
    {
      id: 'total',
      label: 'Total Soldiers',
      value: filteredSoldiers.length,
      sub: `${activeEmployees} active · ${annexationEmployees} annexation · ${inactiveEmployees} inactive`,
      accentColor: '#2563eb',
      icon: '👥',
    },
    {
      id: 'on-base',
      label: `On Base`,
      value: onBaseCount,
      sub: `of ${activeEmployees} active soldiers`,
      accentColor: '#0891b2',
      icon: '🏕️',
    },
    {
      id: 'at-home',
      label: 'At Home',
      value: onLeaveToday.length,
      sub: onLeaveToday.length === 0 ? `None at home ${dateLabel.toLowerCase()}` : `${onLeaveToday.length} soldier${onLeaveToday.length !== 1 ? 's' : ''} at home`,
      accentColor: '#7c3aed',
      icon: '🏠',
    },
    {
      id: 'tasks-today',
      label: 'Tasks',
      value: taskTemplates.length,
      sub: taskTemplates.length === 0 ? 'No tasks configured' : `${tasksFullCount} full · ${tasksPartialCount} partial · ${tasksEmptyCount} empty`,
      accentColor: tasksEmptyCount > 0 ? '#ef4444' : tasksPartialCount > 0 ? '#f59e0b' : '#22c55e',
      icon: '📋',
    },
    {
      id: 'free',
      label: 'Free',
      value: freeSoldiersToday.length,
      sub: freeSoldiersToday.length === 0 ? 'All on-base soldiers assigned' : 'on-base, no task assigned',
      accentColor: '#16a34a',
      icon: '✅',
    },
    {
      id: 'rtn',
      label: 'RTN',
      value: returningToday.length,
      sub: returningToday.length === 0 ? `No soldiers returning ${dateLabel.toLowerCase()}` : 'returning from leave',
      accentColor: '#0891b2',
      icon: '↩',
    },
    {
      id: 'out',
      label: 'OUT',
      value: departedToday.length,
      sub: departedToday.length === 0 ? `No soldiers departed ${dateLabel.toLowerCase()}` : 'departed on leave',
      accentColor: '#f59e0b',
      icon: '↪',
    },
    {
      id: 'abs',
      label: 'ABS',
      value: absentToday.length,
      sub: absentToday.length === 0 ? `No soldiers absent ${dateLabel.toLowerCase()}` : 'marked absent',
      accentColor: '#dc2626',
      icon: '✕',
    },
  ];

  const visibleStatCards = allStatCards.filter(c => !hiddenCards.includes(c.id));

  const DATE_MODES: { key: DateMode; label: string }[] = [
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'today',     label: 'Today' },
    { key: 'tomorrow',  label: 'Tomorrow' },
    { key: 'custom',    label: 'Custom' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>

      {/* ── Date Toggle ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px', gap: '2px' }}>
          {DATE_MODES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateMode(key)}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: dateMode === key ? '600' : '500',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                background: dateMode === key ? 'white' : 'transparent',
                color: dateMode === key ? '#1e293b' : '#64748b',
                boxShadow: dateMode === key ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {dateMode === 'custom' && (
          <input
            type="date"
            value={customDate}
            onChange={e => setCustomDate(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '13px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              color: '#1e293b',
              background: 'white',
              cursor: 'pointer',
              outline: 'none',
            }}
          />
        )}
      </div>

      {isFiltered && (
        <div style={{ fontSize: '12px', color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '8px 14px', fontWeight: '500' }}>
          Dashboard is filtered — showing a subset of soldiers. Adjust filters in Settings → Dashboard.
        </div>
      )}

      {/* ── Stat Cards ── */}
      {visibleStatCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
          {visibleStatCards.map(({ id, ...cardProps }) => (
            <StatCard key={id} {...cardProps} />
          ))}
        </div>
      )}

      {/* ── Reorderable panels (hold ⠿ to drag) ── */}
      {visiblePanelOrder.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
          {visiblePanelOrder.map(id => renderPanel(id))}
        </div>
      )}

    </div>
  );
}
