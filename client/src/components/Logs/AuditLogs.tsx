import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, apiStream } from '../../lib/api';
import type { AuditLogEntry, AuditCategory } from '../../types';

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s    = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m    = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h    = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

const CATEGORY_STYLE: Record<AuditCategory, { bg: string; color: string }> = {
  auth:      { bg: '#ede9fe', color: '#6d28d9' },
  employees: { bg: '#dbeafe', color: '#1d4ed8' },
  schedule:  { bg: '#d1fae5', color: '#065f46' },
  tasks:     { bg: '#fef3c7', color: '#b45309' },
  settings:  { bg: '#f1f5f9', color: '#475569' },
};

function actionStyle(action: string): { bg: string; color: string } {
  if (action.includes('DELETED'))    return { bg: '#fee2e2', color: '#dc2626' };
  if (action.includes('CREATED'))    return { bg: '#d1fae5', color: '#065f46' };
  if (action.includes('IMPORTED'))   return { bg: '#cffafe', color: '#0e7490' };
  if (action.includes('UPDATED'))    return { bg: '#dbeafe', color: '#1d4ed8' };
  if (action.includes('BULK'))       return { bg: '#fef3c7', color: '#b45309' };
  if (action.includes('ASSIGNED'))   return { bg: '#fef3c7', color: '#b45309' };
  if (action.includes('UNASSIGNED')) return { bg: '#fee2e2', color: '#b45309' };
  if (action === 'LOGIN')            return { bg: '#ede9fe', color: '#6d28d9' };
  if (action === 'LOGIN_FAILED')     return { bg: '#fee2e2', color: '#dc2626' };
  if (action === 'LOGOUT')           return { bg: '#f1f5f9', color: '#64748b' };
  if (action === 'USER_CREATED')     return { bg: '#d1fae5', color: '#065f46' };
  if (action.includes('REORDERED'))  return { bg: '#f1f5f9', color: '#64748b' };
  return { bg: '#f1f5f9', color: '#64748b' };
}

function Badge({ label, style }: { label: string; style: { bg: string; color: string } }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '9999px',
      fontSize: '11px', fontWeight: '600', letterSpacing: '0.02em',
      background: style.bg, color: style.color, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function safeCsvValue(v: unknown): string {
  const s = String(v ?? '');
  const sanitized = /^[=+\-@\t\r]/.test(s) ? `\t${s}` : s;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

function exportCSV(logs: AuditLogEntry[]) {
  const headers = ['Timestamp', 'User', 'Category', 'Action', 'Description', 'IP', 'User Agent'];
  const rows    = logs.map(l => [
    l.timestamp, l.userEmail, l.category, l.action, l.description,
    l.meta.ip, l.meta.userAgent,
  ]);
  const csv  = [headers, ...rows]
    .map(r => r.map(safeCsvValue).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── component ─────────────────────────────────────────────────────────────────

export default function AuditLogs() {
  const [logs,       setLogs]       = useState<AuditLogEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'off'>('connecting');

  const esRef           = useRef<EventSource | null>(null);
  const assumeLiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [filtersOpen,    setFiltersOpen]    = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterUser,     setFilterUser]     = useState('');
  const [filterSearch,   setFilterSearch]   = useState('');
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate)   params.set('to',   new Date(toDate + 'T23:59:59').toISOString());
      const { logs: data } = await apiFetch<{ logs: AuditLogEntry[] }>(`/api/logs?${params}`);
      setLogs(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Real-time SSE
  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function clearAssumeTimer() {
      if (assumeLiveTimer.current) { clearTimeout(assumeLiveTimer.current); assumeLiveTimer.current = null; }
    }

    function connect() {
      setLiveStatus('connecting');
      clearAssumeTimer();
      const es = apiStream('/api/logs/stream');
      esRef.current = es;
      es.onopen = () => {
        if (!cancelled) { clearAssumeTimer(); setLiveStatus('live'); }
      };
      es.onmessage = (e: MessageEvent) => {
        if (cancelled) return;
        // Firebase CDN may not forward onopen — treat first message as confirmation of live status
        clearAssumeTimer();
        setLiveStatus('live');
        const { log } = JSON.parse(e.data) as { log: AuditLogEntry };
        setLogs(prev => {
          if (prev.some(l => l.id === log.id)) return prev;
          return [log, ...prev];
        });
      };
      es.onerror = () => {
        clearAssumeTimer();
        es.close();
        if (!cancelled) {
          setLiveStatus('off');
          reconnectTimer = setTimeout(connect, 5000);
        }
      };
      // Fallback: if 5 s pass with no onopen/onerror, assume CDN absorbed the open event
      assumeLiveTimer.current = setTimeout(() => {
        assumeLiveTimer.current = null;
        if (!cancelled) setLiveStatus('live');
      }, 5000);
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      clearAssumeTimer();
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  const filtered = logs.filter(log => {
    if (filterCategory && log.category !== filterCategory) return false;
    if (filterUser) {
      const q = filterUser.toLowerCase();
      if (!log.userEmail.toLowerCase().includes(q)) return false;
    }
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!log.description.toLowerCase().includes(q) &&
          !log.action.toLowerCase().includes(q) &&
          !log.userEmail.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const uniqueUsers = [...new Set(logs.map(l => l.userEmail))].sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>Audit Logs</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            {filtered.length} of {logs.length} entries
            {' · '}
            <span style={{ color: liveStatus === 'live' ? '#059669' : liveStatus === 'connecting' ? '#d97706' : '#dc2626' }}>
              {liveStatus === 'live' ? '● Live' : liveStatus === 'connecting' ? '◌ Connecting…' : '○ Offline'}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchLogs} style={btnStyle('#f1f5f9', '#1e293b')}>
            ↻ Refresh
          </button>
          <button onClick={() => exportCSV(filtered)} style={btnStyle('#2563eb', 'white')}>
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Filters — collapsible */}
      <div style={{ flexShrink: 0, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Toggle row */}
        <button
          onClick={() => setFiltersOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', background: '#f8fafc', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', color: '#475569',
          }}
        >
          <span>
            Filters
            {(filterCategory || filterUser || filterSearch || fromDate || toDate) && (
              <span style={{ marginLeft: '6px', background: '#2563eb', color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '11px' }}>
                active
              </span>
            )}
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{filtersOpen ? '▲' : '▼'}</span>
        </button>

        {filtersOpen && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '12px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <input
              type="search"
              placeholder="Search description, action, user…"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              style={{ ...inputStyle, minWidth: '220px', flex: 1 }}
            />
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={inputStyle}>
              <option value="">All categories</option>
              {(['auth', 'employees', 'schedule', 'tasks', 'settings'] as AuditCategory[]).map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={inputStyle}>
              <option value="">All users</option>
              {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inputStyle} />
            </div>
            {(filterCategory || filterUser || filterSearch || fromDate || toDate) && (
              <button
                onClick={() => { setFilterCategory(''); setFilterUser(''); setFilterSearch(''); setFromDate(''); setToDate(''); }}
                style={{ ...btnStyle('#fee2e2', '#dc2626'), fontSize: '12px', padding: '5px 10px' }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table — fixed height showing ~13 rows, then scrolls */}
      <div style={{ overflowY: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', maxHeight: '720px' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Loading logs…</div>
        ) : error ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#dc2626' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>No log entries found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0 }}>
                {['Time', 'User', 'Category', 'Action', 'Description', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600',
                    color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em',
                    whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, idx) => (
                <>
                  <tr
                    key={log.id}
                    style={{
                      background: idx % 2 === 0 ? 'white' : '#fafafa',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: log.details ? 'pointer' : 'default',
                    }}
                    onClick={() => log.details && setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#475569' }} title={formatDate(log.timestamp)}>
                      {relativeTime(log.timestamp)}
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                        {new Date(log.timestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#1e293b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.userEmail}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge label={log.category} style={CATEGORY_STYLE[log.category] ?? CATEGORY_STYLE.settings} />
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <Badge label={log.action.replace(/_/g, ' ')} style={actionStyle(log.action)} />
                    </td>
                    <td style={{ padding: '10px 12px', color: '#334155' }}>
                      {log.description}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {log.details && (
                        <span style={{ color: '#94a3b8', fontSize: '12px', userSelect: 'none' }}>
                          {expandedId === log.id ? '▲' : '▼'}
                        </span>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && log.details && (
                    <tr key={`${log.id}-details`} style={{ background: '#f8fafc' }}>
                      <td colSpan={6} style={{ padding: '0 12px 12px 48px' }}>
                        <div style={{
                          background: '#0f172a', color: '#94a3b8', borderRadius: '6px',
                          padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '300px', overflow: 'auto',
                        }}>
                          {JSON.stringify(log.details, null, 2)}
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                          IP: {log.meta.ip} · {log.meta.userAgent.slice(0, 80)}{log.meta.userAgent.length > 80 ? '…' : ''}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

// ── style helpers ─────────────────────────────────────────────────────────────

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: '7px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer',
    fontSize: '13px', fontWeight: '500', background: bg, color,
    transition: 'opacity 0.15s',
  };
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px',
  fontSize: '13px', color: '#1e293b', background: 'white', outline: 'none',
};
