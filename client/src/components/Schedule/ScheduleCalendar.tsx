import { useState, useEffect, useRef } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Employee, ColumnDef, ScheduleTableState } from '../../types';
import { getFilterOptions, matchesFilters } from '../../lib/employeeFilters';
import { useUserPref } from '../../hooks/useUserPref';

interface ScheduleCalendarProps {
  employees: Employee[];
  schedule: ScheduleData;
  onUpdate: (schedule: ScheduleData) => void;
  columnDefs: ColumnDef[];
}

export type ScheduleData = Record<string, Record<string, CellStatus>>;
export type CellStatus = 'on-base' | 'home-leave' | 'departed' | 'returning' | 'absent' | '';
type ViewMode = 'day' | 'week' | 'month' | 'custom';

const STATUS_CONFIG: Record<CellStatus, { label: string; fullLabel: string; bg: string; color: string }> = {
  'on-base':    { label: 'B',   fullLabel: 'On Base',    bg: '#4ade80', color: '#14532d' },
  'home-leave': { label: 'H',   fullLabel: 'At Home',    bg: '#60a5fa', color: '#1e3a8a' },
  'departed':   { label: 'OUT', fullLabel: 'Departed',   bg: '#ffedd5', color: '#c2410c' },
  'returning':  { label: 'RTN', fullLabel: 'Returning',  bg: '#fef9c3', color: '#a16207' },
  'absent':     { label: 'ABS', fullLabel: 'Absent',     bg: '#4b5563', color: '#f9fafb' },
  '':           { label: '',    fullLabel: '',            bg: 'transparent', color: '' },
};

const STATUSES = Object.keys(STATUS_CONFIG).filter(k => k !== '') as CellStatus[];

const SUM_COL_W   = 42;
const SUM_ROW_H   = 30;
const NUM_STATUSES = STATUSES.length;

const SHORT_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const FULL_DAYS    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function shiftDay(dk: string, n: number): string {
  const d = new Date(dk + 'T12:00:00'); // noon to avoid DST issues
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function withTransitions(sched: ScheduleData): ScheduleData {
  const result: ScheduleData = {};

  for (const empId of Object.keys(sched)) {
    const empData = sched[empId];

    // Strip departed/returning and empty — they are always derived, never stored as intent.
    // This ensures stale OUT/RTN are removed when the surrounding H/ABS changes.
    const base: Record<string, CellStatus> = {};
    for (const [dk, status] of Object.entries(empData)) {
      if (status && status !== 'departed' && status !== 'returning') {
        base[dk] = status as CellStatus;
      }
    }

    const leaveDays = Object.keys(base)
      .filter(dk => base[dk] === 'home-leave' || base[dk] === 'absent')
      .sort();

    const updated: Record<string, CellStatus> = { ...base };

    if (leaveDays.length > 0) {
      const blocks: string[][] = [[leaveDays[0]]];
      for (let i = 1; i < leaveDays.length; i++) {
        if (shiftDay(leaveDays[i - 1], 1) === leaveDays[i]) {
          blocks[blocks.length - 1].push(leaveDays[i]);
        } else {
          blocks.push([leaveDays[i]]);
        }
      }

      for (const block of blocks) {
        // si tracks how many days were consumed from the front by an absorbed OUT marker.
        let si = 0;
        const ei = block.length - 1;

        // ── OUT: day before the first H/ABS ───────────────────────────────
        const outKey = shiftDay(block[0], -1);
        const outFree = !base[outKey] || base[outKey] === 'home-leave' || base[outKey] === 'absent';
        if (outFree) {
          updated[outKey] = 'departed';
        } else if (ei > 0) {
          // OUT position blocked by explicit value (e.g. B). First H day absorbs the marker,
          // shrinking the block — matching the pattern: b-b-OUT-h-h → b-b-b-OUT-h
          updated[block[0]] = 'departed';
          si = 1;
        }

        if (si > ei) continue; // whole block consumed

        // ── RTN: day after the last remaining H/ABS ───────────────────────
        const rtnKey = shiftDay(block[ei], 1);
        const rtnFree = !base[rtnKey] || base[rtnKey] === 'home-leave' || base[rtnKey] === 'absent';
        if (rtnFree) {
          updated[rtnKey] = 'returning';
        } else if (ei - si > 0) {
          // RTN position blocked. Last H day absorbs the marker, symmetric to OUT rule.
          updated[block[ei]] = 'returning';
        }
      }
    }

    if (Object.keys(updated).length > 0) result[empId] = updated;
  }

  return result;
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
  if (mode === 'day')   return { top: FULL_DAYS[dow],    bottom: `${SHORT_MONTHS[d.getMonth()]} ${dn}` };
  if (mode === 'week')  return { top: SHORT_DAYS[dow],   bottom: String(dn) };
  if (mode === 'month') return { top: String(dn),        bottom: SHORT_DAYS[dow] };
  return { top: String(dn), bottom: SHORT_MONTHS[d.getMonth()] };
}

function rightOf(i: number)  { return (NUM_STATUSES - 1 - i) * SUM_COL_W; }
function bottomOf(i: number) { return (NUM_STATUSES - 1 - i) * SUM_ROW_H; }

export default function ScheduleCalendar({ employees, schedule, onUpdate, columnDefs }: ScheduleCalendarProps) {
  const today = new Date(); today.setHours(0,0,0,0);

  const [tableState, setTableState] = useUserPref<ScheduleTableState>(
    'schedule-table-state',
    { search: '', filters: {} }
  );
  const search  = tableState.search;
  const filters = tableState.filters;
  function onSearchChange(v: string) { setTableState({ ...tableState, search: v }); }
  function onFiltersChange(f: Record<string, string>) { setTableState({ ...tableState, filters: f }); }

  const filteredEmployees = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.name.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q);
    return matchSearch && matchesFilters(e, filters, columnDefs);
  });

  const [viewMode, setViewMode]         = useLocalStorage<ViewMode>('schedule-view-mode', 'week');
  const [anchor, setAnchor]             = useState<Date>(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [customFrom, setCustomFrom]     = useLocalStorage('schedule-custom-from', '');
  const [customTo, setCustomTo]         = useLocalStorage('schedule-custom-to', '');
  const [customApplied, setCustomApplied] = useLocalStorage<{ from: string; to: string } | null>('schedule-custom-applied', null);
  const [legend, setLegend]             = useState(true);
  const [autoTransitions, setAutoTransitions] = useFirestore<boolean>('schedule-auto-transitions', true);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const isDragging    = useRef(false);
  const dragMode      = useRef<'add' | 'remove'>('add');
  const hoverStyleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    const el = document.createElement('style');
    document.head.appendChild(el);
    hoverStyleRef.current = el;
    return () => { el.remove(); };
  }, []);

  function handleHoverEnter(empId: string, dk: string) {
    if (!hoverStyleRef.current) return;
    hoverStyleRef.current.textContent = `
      tr[data-emp="${empId}"] td { background-color: #eef5ff !important; }
      [data-dk="${dk}"] { background-color: #eef5ff !important; }
      tr[data-emp="${empId}"] [data-dk="${dk}"] { background-color: #e0eeff !important; }
    `;
  }

  function handleHoverLeave() {
    if (hoverStyleRef.current) hoverStyleRef.current.textContent = '';
  }
  const [addingFilter, setAddingFilter] = useState(false);
  const [pendingCol, setPendingCol]     = useState('');
  const [pendingVal, setPendingVal]     = useState('');

  useEffect(() => {
    const stop = () => { isDragging.current = false; };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  // Backfill transitions on any existing schedule data (e.g. loaded from localStorage)
  useEffect(() => {
    if (!autoTransitions) return;
    if (Object.keys(schedule).length === 0) return;
    const next = withTransitions(schedule);
    if (JSON.stringify(next) !== JSON.stringify(schedule)) onUpdate(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const viewDates      = buildViewDates(viewMode, anchor, customApplied);
  const activeEmployees = filteredEmployees.filter(e => e.status === 'Active' || e.status === 'Annexation');

  function cellId(empId: string, d: Date) { return `${empId}|${dateKey(d)}`; }

  function handleCellMouseDown(empId: string, d: Date) {
    const id = cellId(empId, d);
    const alreadySelected = selectedCells.has(id);
    dragMode.current = alreadySelected ? 'remove' : 'add';
    isDragging.current = true;
    setSelectedCells(prev => {
      const next = new Set(prev);
      alreadySelected ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleCellMouseEnter(empId: string, d: Date) {
    if (!isDragging.current) return;
    const id = cellId(empId, d);
    setSelectedCells(prev => {
      const next = new Set(prev);
      dragMode.current === 'add' ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function applyStatus(status: CellStatus) {
    if (selectedCells.size === 0) return;
    let updated = { ...schedule };
    selectedCells.forEach(id => {
      const [empId, key] = id.split('|');
      updated = { ...updated, [empId]: { ...(updated[empId] ?? {}), [key]: status } };
    });
    onUpdate(autoTransitions ? withTransitions(updated) : updated);
    setSelectedCells(new Set());
  }

  function clearSelected() { applyStatus(''); }

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

  function getStatus(empId: string, d: Date): CellStatus {
    const val = schedule[empId]?.[dateKey(d)] ?? '';
    return (val in STATUS_CONFIG) ? val as CellStatus : '';
  }


  const isToday    = (d: Date) => dateKey(d) === dateKey(today);
  const isWeekend  = (d: Date) => { const w = d.getDay(); return w === 5 || w === 6; };
  const isFriday   = (d: Date) => d.getDay() === 5;
  const isSaturday = (d: Date) => d.getDay() === 6;

  function titleText(): string {
    if (viewMode === 'day') return `${FULL_DAYS[anchor.getDay()]}, ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
    if (viewMode === 'week') {
      const d = buildViewDates('week', anchor, null);
      const f = d[0], l = d[6];
      if (f.getMonth() === l.getMonth()) return `${MONTH_NAMES[f.getMonth()]} ${f.getDate()}–${l.getDate()}, ${f.getFullYear()}`;
      return `${SHORT_MONTHS[f.getMonth()]} ${f.getDate()} – ${SHORT_MONTHS[l.getMonth()]} ${l.getDate()}, ${l.getFullYear()}`;
    }
    if (viewMode === 'month') return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (customApplied) return `${customApplied.from}  →  ${customApplied.to}`;
    return 'Custom Range';
  }

  const colMinWidth = viewMode === 'day' ? 200 : viewMode === 'week' ? 72 : 36;

  const stickyTop:    React.CSSProperties = { position: 'sticky', top: 0,  zIndex: 2 };
  const stickyLeft:   React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1 };
  const stickyCorner: React.CSSProperties = { position: 'sticky', left: 0, top: 0, zIndex: 4 };

  const tabStyle = (m: ViewMode): React.CSSProperties => ({
    padding: '5px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
    border: '1px solid #e2e8f0',
    borderLeft: m !== 'day' ? 'none' : undefined,
    borderRadius: m === 'day' ? '6px 0 0 6px' : m === 'custom' ? '0 6px 6px 0' : '0',
    background: viewMode === m ? '#2563eb' : 'white',
    color: viewMode === m ? 'white' : '#475569',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>

      {/* Row 1: Navigation + title + view mode tabs + legend toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flexShrink: 0 }}>

        {/* Navigation arrows + title + Today */}
        {viewMode !== 'custom' && (
          <>
            <button onClick={() => navigate(-1)} style={navBtnStyle}>‹</button>
            <span style={{ fontSize: '16px', fontWeight: '700', minWidth: '200px', textAlign: 'center', color: '#1e293b' }}>
              {titleText()}
            </span>
            <button onClick={() => navigate(1)} style={navBtnStyle}>›</button>
            <button onClick={goToToday} style={{ padding: '5px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#2563eb', fontWeight: '500' }}>
              Today
            </button>
          </>
        )}
        {viewMode === 'custom' && (
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>{titleText()}</span>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* View mode tabs */}
        <div style={{ display: 'flex' }}>
          {(['day','week','month','custom'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={tabStyle(m)}>
              {m === 'day' ? 'Day' : m === 'week' ? 'Week' : m === 'month' ? 'Month' : 'Custom'}
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: '#475569', userSelect: 'none' }}>
          <input type="checkbox" checked={autoTransitions} onChange={e => setAutoTransitions(e.target.checked)} style={{ cursor: 'pointer', width: '15px', height: '15px' }} />
          Auto OUT/RTN
        </label>

        <button onClick={() => setLegend(l => !l)} style={{ padding: '5px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#475569' }}>
          {legend ? 'Hide' : 'Show'} Legend
        </button>
      </div>

      {/* Row 2: Soldier filter */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <input
          placeholder="🔍 Search soldiers..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', minWidth: '180px', flex: 1 }}
        />

        {/* Active filter chips */}
        {Object.entries(filters).map(([key, val]) => {
          const col = columnDefs.find(c => c.key === key);
          return (
            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '9999px', fontSize: '13px', color: '#1d4ed8', whiteSpace: 'nowrap' }}>
              {col?.label ?? key}: <strong>{val}</strong>
              <button onClick={() => { const n = { ...filters }; delete n[key]; onFiltersChange(n); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: '15px', lineHeight: 1, padding: '0 0 0 2px' }} aria-label={`Remove ${col?.label} filter`}>×</button>
            </span>
          );
        })}

        {/* Add filter */}
        {addingFilter ? (
          <>
            <select value={pendingCol} onChange={e => { setPendingCol(e.target.value); setPendingVal(''); }}
              style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', background: 'white' }}>
              <option value="">Column…</option>
              {columnDefs.filter(c => c.visible && !filters[c.key]).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            {pendingCol && (() => {
              const col = columnDefs.find(c => c.key === pendingCol);
              const opts = col ? getFilterOptions(col) : [];
              return opts.length > 0
                ? (
                  <select value={pendingVal} onChange={e => setPendingVal(e.target.value)}
                    style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', background: 'white' }}>
                    <option value="">Value…</option>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input value={pendingVal} onChange={e => setPendingVal(e.target.value)}
                    placeholder="Value…" autoFocus
                    style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', width: '130px' }} />
                );
            })()}
            <button
              disabled={!pendingCol || !pendingVal}
              onClick={() => { onFiltersChange({ ...filters, [pendingCol]: pendingVal }); setPendingCol(''); setPendingVal(''); setAddingFilter(false); }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: (!pendingCol || !pendingVal) ? '#e2e8f0' : '#2563eb', color: (!pendingCol || !pendingVal) ? '#94a3b8' : 'white', fontSize: '13px', fontWeight: '600', cursor: (!pendingCol || !pendingVal) ? 'default' : 'pointer' }}>
              Add
            </button>
            <button onClick={() => { setAddingFilter(false); setPendingCol(''); setPendingVal(''); }}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#64748b' }}>
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setAddingFilter(true)}
            style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#64748b', whiteSpace: 'nowrap' }}>
            + Filter
          </button>
        )}

        {(search || Object.keys(filters).length > 0) && (
          <button onClick={() => { onSearchChange(''); onFiltersChange({}); }}
            style={{ padding: '6px 12px', border: '1px solid #fca5a5', borderRadius: '6px', background: '#fee2e2', color: '#dc2626', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Clear
          </button>
        )}

        <span style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>
          {activeEmployees.length} soldier{activeEmployees.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Row 3: Custom date range inputs */}
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
          {customApplied && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {viewDates.length} day{viewDates.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Legend */}
      {legend && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
          {selectedCells.size > 0 && (
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#2563eb', marginRight: '4px' }}>
              {selectedCells.size} selected — set to:
            </span>
          )}
          {STATUSES.map(key => {
            const cfg = STATUS_CONFIG[key];
            const active = selectedCells.size > 0;
            return (
              <button key={key} onClick={() => active ? applyStatus(key) : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
                  padding: '4px 10px', borderRadius: '6px', cursor: active ? 'pointer' : 'default',
                  border: `1px solid ${active ? cfg.color : '#e2e8f0'}`,
                  background: active ? cfg.bg : 'white',
                  color: active ? cfg.color : '#94a3b8',
                  fontWeight: active ? '600' : '400',
                  transition: 'all 0.15s',
                  opacity: active ? 1 : 0.6,
                }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: cfg.bg, border: `1px solid ${cfg.color}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: cfg.color, fontSize: '10px', flexShrink: 0 }}>
                  {cfg.label}
                </div>
                {cfg.fullLabel}
              </button>
            );
          })}
          {selectedCells.size > 0 && (
            <>
              <button onClick={clearSelected} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                Clear
              </button>
              <button onClick={() => setSelectedCells(new Set())} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>
                Deselect
              </button>
            </>
          )}
          {selectedCells.size === 0 && (
            <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '4px' }}>Click cells to select, then pick a status</span>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeEmployees.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
            <div style={{ fontWeight: '500' }}>No active soldiers</div>
          </div>
        ) : viewMode === 'custom' && !customApplied ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📆</div>
            <div style={{ fontWeight: '500' }}>Select a date range above and click Apply</div>
          </div>
        ) : (
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {/* Top-left corner */}
                <th style={{ ...stickyCorner, minWidth: '160px', padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151', background: '#f8fafc', borderTop: '2px solid #475569', borderLeft: '2px solid #475569', borderRight: '2px solid #475569', borderBottom: '2px solid #475569' }}>
                  Soldier
                </th>

                {/* Day headers */}
                {viewDates.map(d => {
                  const { top, bottom } = formatColHeader(d, viewMode);
                  const weekend  = isWeekend(d);
                  const todayCol = isToday(d);
                  const thDk = dateKey(d);
                  return (
                    <th key={thDk} data-dk={thDk} style={{
                      ...stickyTop,
                      padding: 0, fontSize: '11px', fontWeight: '600', textAlign: 'center',
                      borderRight: isSaturday(d) ? '2px solid #a78bfa' : '1px solid #e2e8f0', minWidth: colMinWidth,
                      borderLeft: isFriday(d) ? '2px solid #a78bfa' : undefined,
                      background: todayCol ? '#eff6ff' : weekend ? '#fdf4ff' : '#f8fafc',
                      borderTop: todayCol ? '2px solid #2563eb' : weekend ? '2px solid #e9d5ff' : '2px solid #475569',
                      borderBottom: '2px solid #475569',
                    }}>
                      <div style={{ padding: '6px 4px' }}>
                        <div style={{ color: weekend ? '#7c3aed' : todayCol ? '#2563eb' : '#374151', fontWeight: todayCol || weekend ? '700' : '600' }}>{top}</div>
                        <div style={{ color: weekend ? '#a78bfa' : '#94a3b8', fontSize: '10px', fontWeight: '400' }}>{bottom}</div>
                      </div>
                    </th>
                  );
                })}

                {/* Top-right: summary column headers */}
                {STATUSES.map((statusKey, i) => {
                  const cfg = STATUS_CONFIG[statusKey];
                  return (
                    <th key={`sh-${statusKey}`} style={{
                      position: 'sticky', top: 0, right: rightOf(i), zIndex: 3,
                      width: SUM_COL_W, minWidth: SUM_COL_W, padding: '4px 2px',
                      background: '#f1f5f9',
                      borderTop: '2px solid #475569',
                      borderLeft: i === 0 ? '2px solid #475569' : undefined,
                      borderRight: i === NUM_STATUSES - 1 ? '2px solid #475569' : '1px solid #e2e8f0',
                      borderBottom: '2px solid #475569',
                      textAlign: 'center',
                    }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '4px', margin: '0 auto', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '10px' }}>
                        {cfg.label}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {activeEmployees.map((emp, rowIdx) => {
                const rowBg = rowIdx % 2 === 0 ? 'white' : '#fafafa';
                return (
                  <tr key={emp.id} data-emp={emp.id} style={{ background: rowBg }}>
                    {/* Sticky left: name */}
                    <td style={{ ...stickyLeft, padding: '8px 16px', fontSize: '13px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap', background: rowBg, borderLeft: '2px solid #475569', borderRight: '2px solid #475569' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#2563eb', fontSize: '11px' }}>
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        {emp.name}
                      </div>
                    </td>

                    {/* Day cells */}
                    {viewDates.map(d => {
                      const status   = getStatus(emp.id, d);
                      const cfg      = STATUS_CONFIG[status];
                      const todayCol = isToday(d);
                      const weekend  = isWeekend(d);
                      const isSelected = selectedCells.has(cellId(emp.id, d));
                      const dk = dateKey(d);
                      return (
                        <td key={dk} data-dk={dk}
                          onMouseDown={e => { e.preventDefault(); handleCellMouseDown(emp.id, d); }}
                          onMouseEnter={() => { handleCellMouseEnter(emp.id, d); handleHoverEnter(emp.id, dk); }}
                          onMouseLeave={handleHoverLeave}
                          title={status ? cfg.fullLabel : 'Click or drag to select'}
                          style={{
                            padding: '4px', textAlign: 'center',
                            borderRight: isSaturday(d) ? '2px solid #a78bfa' : '1px solid #f1f5f9',
                            borderLeft: isFriday(d) ? '2px solid #a78bfa' : undefined,
                            minWidth: colMinWidth,
                            background: isSelected ? '#dbeafe' : todayCol ? '#f0f7ff' : weekend ? '#faf5ff' : undefined,
                            cursor: 'pointer',
                            outline: isSelected ? '2px solid #2563eb' : undefined,
                            outlineOffset: '-2px',
                            userSelect: 'none',
                          }}>
                          {status ? (
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', margin: '0 auto', background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '11px', border: `1px solid ${cfg.color}33` }}>
                              {cfg.label}
                            </div>
                          ) : (
                            <div style={{ width: '28px', height: '28px' }} />
                          )}
                        </td>
                      );
                    })}

                    {/* Sticky right: per-soldier summary */}
                    {STATUSES.map((statusKey, i) => {
                      const cfg   = STATUS_CONFIG[statusKey];
                      const count = viewDates.filter(d => getStatus(emp.id, d) === statusKey).length;
                      const sumBg = rowIdx % 2 === 0 ? '#f8fafc' : '#f1f5f9';
                      return (
                        <td key={`sr-${statusKey}`} style={{ position: 'sticky', right: rightOf(i), width: SUM_COL_W, minWidth: SUM_COL_W, padding: '6px 2px', textAlign: 'center', fontSize: '12px', fontWeight: '700', background: sumBg, borderLeft: i === 0 ? '2px solid #475569' : undefined, borderRight: i === NUM_STATUSES - 1 ? '2px solid #475569' : '1px solid #e2e8f0' }}>
                          {count > 0
                            ? <span style={{ display: 'inline-block', background: cfg.bg, color: cfg.color, borderRadius: '4px', padding: '1px 5px', fontWeight: '700', fontSize: '11px' }}>{count}</span>
                            : <span style={{ color: '#d1d5db' }}>·</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              {STATUSES.map((statusKey, i) => {
                const cfg    = STATUS_CONFIG[statusKey];
                const bottom = bottomOf(i);
                const tdBase: React.CSSProperties = { position: 'sticky', bottom, height: SUM_ROW_H, background: '#f8fafc', fontSize: '12px', fontWeight: '600' };
                return (
                  <tr key={statusKey}>
                    {/* Bottom-left: label */}
                    <td style={{ ...tdBase, left: 0, zIndex: 3, padding: '0 16px', whiteSpace: 'nowrap', borderLeft: '2px solid #475569', borderRight: '2px solid #475569', borderTop: i === 0 ? '2px solid #475569' : undefined, borderBottom: i === NUM_STATUSES - 1 ? '2px solid #475569' : undefined }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '10px' }}>
                          {cfg.label}
                        </div>
                        <span style={{ color: '#64748b' }}>{cfg.fullLabel}</span>
                      </div>
                    </td>

                    {/* Per-day counts */}
                    {viewDates.map(d => {
                      const count    = activeEmployees.filter(emp => getStatus(emp.id, d) === statusKey).length;
                      const todayCol = isToday(d);
                      const footDk   = dateKey(d);
                      return (
                        <td key={footDk} data-dk={footDk} style={{ ...tdBase, zIndex: 1, padding: '0 2px', textAlign: 'center', background: todayCol ? '#f0f7ff' : isWeekend(d) ? '#faf5ff' : '#f8fafc', borderRight: isSaturday(d) ? '2px solid #a78bfa' : '1px solid #f1f5f9', borderLeft: isFriday(d) ? '2px solid #a78bfa' : undefined, borderTop: i === 0 ? '2px solid #475569' : undefined, borderBottom: i === NUM_STATUSES - 1 ? '2px solid #475569' : undefined }}>
                          {count > 0
                            ? <span style={{ display: 'inline-block', background: cfg.bg, color: cfg.color, borderRadius: '4px', padding: '1px 5px', fontWeight: '700', fontSize: '11px' }}>{count}</span>
                            : <span style={{ color: '#d1d5db' }}>·</span>}
                        </td>
                      );
                    })}

                    {/* Bottom-right corners */}
                    {STATUSES.map((k, j) => (
                      <td key={`bc-${k}`} style={{ ...tdBase, position: 'sticky', bottom, right: rightOf(j), zIndex: 2, borderLeft: j === 0 ? '2px solid #475569' : undefined, borderRight: j === NUM_STATUSES - 1 ? '2px solid #475569' : undefined, borderTop: i === 0 ? '2px solid #475569' : undefined, borderBottom: i === NUM_STATUSES - 1 ? '2px solid #475569' : undefined, background: '#eef2f7' }} />
                    ))}
                  </tr>
                );
              })}
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: '32px', height: '32px', border: '1px solid #e2e8f0',
  borderRadius: '6px', background: 'white', fontSize: '18px',
  cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: '#475569', lineHeight: 1,
};
