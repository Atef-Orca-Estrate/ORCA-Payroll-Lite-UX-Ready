import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '../../context/AuthContext';
import { useGateway } from '../../hooks/useGateway';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT      = '#6366F1';
const ACCENT_BG   = '#EEF2FF';
const ACCENT_TEXT = '#3730A3';
const GRAPHITE    = '#111827';
const GRAPHITE_H  = '#1F2937';

const DEPT_COLOR = {
  Engineering:       '#6366F1',
  Finance:           '#10B981',
  Operations:        '#F59E0B',
  Sales:             '#3B82F6',
  'Human Resources': '#EC4899',
  Marketing:         '#F97316',
};

function deptColor(dept) { return DEPT_COLOR[dept] || '#6B7280'; }
function initials(name)  { return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

const fmtEGP = (v) => v == null ? '—'
  : 'EGP ' + Number(v).toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 20, color = ACCENT }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid ${color}33`,
      borderTopColor: color,
      borderRadius: '50%',
      animation: 'orca-spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

// ─── Exclusion Checkbox Row ───────────────────────────────────────────────────
function ExclusionRow({ label, description, checked, onChange, isLast }) {
  return (
    <>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 0', cursor: 'pointer', userSelect: 'none',
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
          border: checked ? 'none' : '1.5px solid var(--border-strong)',
          background: checked ? ACCENT : 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 150ms',
          boxShadow: checked ? '0 0 0 2px rgba(99,102,241,0.18)' : 'none',
        }}>
          {checked && (
            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          )}
        </div>
        <input type="checkbox" checked={checked} onChange={onChange} style={{ display: 'none' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: checked ? ACCENT_TEXT : 'var(--text-primary)' }}>
            {label}
          </div>
          {description && (
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>
          )}
        </div>
      </label>
      {!isLast && <div style={{ height: 1, background: 'var(--border)' }} />}
    </>
  );
}

// ─── Employee Row ─────────────────────────────────────────────────────────────
function EmployeeRow({ emp, isExpanded, onToggle, onUpdated }) {
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const [saving, setSaving] = useState(false);

  const savedRef = useRef({
    exclude_si:           emp.exclude_si,
    exclude_martyrs_fund: emp.exclude_martyrs_fund,
    exclude_income_tax:   emp.exclude_income_tax,
  });
  const [draft, setDraft] = useState({ ...savedRef.current });

  const isDirty = draft.exclude_si           !== savedRef.current.exclude_si
    || draft.exclude_martyrs_fund !== savedRef.current.exclude_martyrs_fund
    || draft.exclude_income_tax   !== savedRef.current.exclude_income_tax;

  const savedExclusionCount = [
    savedRef.current.exclude_si,
    savedRef.current.exclude_martyrs_fund,
    savedRef.current.exclude_income_tax,
  ].filter(Boolean).length;

  const toggle = (key) => setDraft(prev => ({ ...prev, [key]: !prev[key] }));

  const handleCancel = () => setDraft({ ...savedRef.current });

  const handleUpdate = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      const result = await gateway.invoke('portalUpdateEmployee', { employee_id: emp.employee_id, ...draft });
      if (result.status === 'success') {
        savedRef.current = { ...draft };
        onUpdated(emp.employee_id, draft);
        showToast(`${emp.employee_name} updated`, 'success');
      } else {
        showToast(result.message || 'Update failed', 'error');
      }
    } catch {
      showToast('Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const aColor  = deptColor(emp.department);
  const initStr = initials(emp.employee_name);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>

      {/* ── Collapsed header ── */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 16px', cursor: 'pointer',
          background: isExpanded ? 'var(--surface-raised)' : 'transparent',
          transition: 'background 120ms',
        }}
        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--surface-raised)'; }}
        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Avatar */}
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: aColor + '18', border: `1.5px solid ${aColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: aColor }}>{initStr}</span>
        </div>

        {/* Name + id · dept */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            {emp.employee_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'monospace' }}>
            {emp.employee_id} · {emp.department}
          </div>
        </div>

        {/* Exclusion badge + basic salary + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {savedExclusionCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#B45309',
              background: 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 99, padding: '2px 7px',
            }}>
              {savedExclusionCount} exclusion{savedExclusionCount > 1 ? 's' : ''}
            </span>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {fmtEGP(emp.pr_basic_salary)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Basic</div>
          </div>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={2}
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms', flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      {/* ── Expanded detail panel ── */}
      {isExpanded && (
        <div style={{ padding: '4px 16px 14px 62px', background: 'var(--surface-raised)' }}>

          {/* Salary reference */}
          <div style={{ marginBottom: 14 }}>
            <p style={{
              fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
            }}>
              Salary Reference
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Basic', val: emp.pr_basic_salary,  accent: false },
                { label: 'Gross', val: emp.pr_gross_salary,  accent: false },
                { label: 'Net',   val: emp.pr_net_salary,    accent: true  },
              ].map(({ label, val, accent }) => (
                <div key={label} style={{
                  borderRadius: 8, padding: '9px 12px',
                  background: accent ? ACCENT_BG : 'var(--surface)',
                  border: `1px solid ${accent ? 'var(--accent-border)' : 'var(--border)'}`,
                }}>
                  <div style={{ fontSize: 10, color: accent ? ACCENT : 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3, color: accent ? ACCENT_TEXT : 'var(--text-primary)' }}>
                    {fmtEGP(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payroll exclusions */}
          <div style={{ marginBottom: 14 }}>
            <p style={{
              fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
            }}>
              Payroll Exclusions
            </p>
            <div style={{
              background: 'var(--surface)', borderRadius: 8,
              border: '1px solid var(--border)', padding: '0 12px',
            }}>
              <ExclusionRow
                label="Exclude from Social Insurance"
                description="SI deduction will not be applied for this employee"
                checked={draft.exclude_si}
                onChange={() => toggle('exclude_si')}
              />
              <ExclusionRow
                label="Exclude from Martyrs' Fund"
                description="Martyrs' fund contribution will not be deducted"
                checked={draft.exclude_martyrs_fund}
                onChange={() => toggle('exclude_martyrs_fund')}
              />
              <ExclusionRow
                label="Exclude from Income Tax"
                description="Monthly income tax withholding will be skipped"
                checked={draft.exclude_income_tax}
                onChange={() => toggle('exclude_income_tax')}
                isLast
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={handleUpdate}
              disabled={!isDirty || saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', fontSize: 12.5, fontWeight: 600,
                background: !isDirty ? 'var(--surface-inset)' : GRAPHITE,
                color: !isDirty ? 'var(--text-muted)' : '#fff',
                border: 'none', borderRadius: 7,
                cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'background 120ms',
                opacity: !isDirty ? 0.4 : 1,
              }}
              onMouseEnter={e => { if (isDirty && !saving) e.currentTarget.style.background = GRAPHITE_H; }}
              onMouseLeave={e => { if (isDirty && !saving) e.currentTarget.style.background = isDirty ? GRAPHITE : 'var(--surface-inset)'; }}
            >
              {saving && <Spinner size={13} color="#fff" />}
              {saving ? 'Saving…' : 'Update'}
            </button>
            <button
              onClick={handleCancel}
              disabled={!isDirty || saving}
              style={{
                padding: '7px 16px', fontSize: 12.5, fontWeight: 500,
                background: 'none', border: '1px solid var(--border)', borderRadius: 7,
                color: !isDirty ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'background 120ms',
                opacity: !isDirty ? 0.4 : 1,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Employees ───────────────────────────────────────────────────────────
export default function Employees() {
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const [employees,   setEmployees]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId,  setExpandedId]  = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await gateway.invoke('portalListEmployees');
        if (result.status === 'success') setEmployees(result.employees);
        else { showToast('Failed to load employees', 'error'); setEmployees([]); }
      } catch { showToast('Failed to load employees', 'error'); setEmployees([]); }
      finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdated = useCallback((id, patch) => {
    setEmployees(prev => prev?.map(e => e.employee_id === id ? { ...e, ...patch } : e) ?? prev);
  }, []);

  const filtered = (employees || []).filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.employee_name.toLowerCase().includes(q) ||
      e.employee_id.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Page header */}
      <div style={{ flexShrink: 0, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Employees</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Active employee roster — configure payroll exceptions per employee
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', width: 220 }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={2}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              placeholder="Name, ID or department…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                paddingLeft: 32, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
                fontSize: 12.5, background: 'var(--surface)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 8,
                outline: 'none', fontFamily: 'inherit', transition: 'border-color 120ms',
              }}
              onFocus={e => e.target.style.borderColor = ACCENT}
              onBlur={e  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>
      </div>

      {/* Employee list card */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Card header */}
        <div style={{
          flexShrink: 0, padding: '10px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Active employees
          </span>
          {employees && (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {filtered.length}{filtered.length !== employees.length ? ` of ${employees.length}` : ''} employee{employees.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <Spinner size={22} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 10, padding: '48px 0',
            }}>
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="var(--border-strong)" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {searchQuery ? 'No employees match your search' : 'No active employees'}
              </p>
            </div>
          ) : filtered.map(emp => (
            <EmployeeRow
              key={emp.employee_id}
              emp={emp}
              isExpanded={expandedId === emp.employee_id}
              onToggle={() => setExpandedId(id => id === emp.employee_id ? null : emp.employee_id)}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
