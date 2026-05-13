import { Fragment, useState, useEffect, useCallback } from 'react';
import { useAuth, useToast } from '../../context/AuthContext';
import { useGateway }        from '../../hooks/useGateway';
import { MonthPicker }       from '../../components/MonthPicker';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT       = '#6366F1';
const ACCENT_BG    = '#EEF2FF';
const ACCENT_TEXT  = '#3730A3';
const ACCENT_MUTED = '#818CF8';
const GRAPHITE     = '#111827';
const GRAPHITE_H   = '#1F2937';

const fmtEGP = (val) =>
  val == null ? '—'
  : 'EGP ' + Number(val).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const STEP_FOR_STATUS = { Draft: 2, Processing: 3, Completed: 4 };

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ step }) {
  const steps = ['Setup', 'Review', 'Running', 'Complete'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', flexShrink: 0 }}>
      {steps.map((label, i) => {
        const idx    = i + 1;
        const done   = step > idx;
        const active = step === idx;
        const circleBg    = done ? '#16A34A' : active ? ACCENT : 'var(--surface-inset)';
        const circleColor = done || active ? '#fff' : 'var(--text-muted)';
        const size        = active ? 26 : done ? 18 : 22;
        return (
          <Fragment key={label}>
            {/* Step node — flex: 0 0 auto so it takes only its natural size */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
              <div style={{
                width: size, height: size, borderRadius: '50%',
                background: circleBg,
                border: !done && !active ? '1.5px solid var(--border-strong)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                fontSize: active ? 11 : 9, fontWeight: 600,
                color: circleColor,
                transition: 'width 300ms ease, height 300ms ease, background 300ms ease, font-size 300ms ease',
              }}>
                {done ? (
                  <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                ) : idx}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: ACCENT,
                whiteSpace: 'nowrap', overflow: 'hidden',
                maxWidth: active ? '72px' : '0px',
                opacity: active ? 1 : 0,
                marginLeft: active ? 6 : 0,
                transition: 'max-width 300ms ease, opacity 200ms ease, margin-left 300ms ease',
              }}>
                {label}
              </span>
            </div>

            {/* Connector — flex: 1 sibling, not nested inside the node */}
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, minWidth: 6, height: 2, borderRadius: 99,
                background: step > idx + 1 ? '#16A34A' : step === idx + 1 ? ACCENT : 'var(--border)',
                marginLeft:  done                     ? 4 : 8,
                marginRight: (done || step > idx + 1) ? 4 : 8,
                transition: 'background 300ms ease, margin-left 300ms ease, margin-right 300ms ease',
              }} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── Shared button styles ─────────────────────────────────────────────────────
function PrimaryBtn({ onClick, disabled, loading, children, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: '100%', padding: '10px 16px',
        background: disabled ? 'var(--surface-inset)' : GRAPHITE,
        color: disabled ? 'var(--text-muted)' : '#fff',
        border: 'none', borderRadius: 8,
        fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: 'inherit', transition: 'background 120ms',
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = GRAPHITE_H; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = GRAPHITE; }}
    >
      {loading && <Spinner size={14} color="#fff" />}
      {children}
    </button>
  );
}

function GreenBtn({ onClick, disabled, loading, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: '100%', padding: '10px 16px',
        background: disabled ? 'var(--surface-inset)' : '#16A34A',
        color: disabled ? 'var(--text-muted)' : '#fff',
        border: 'none', borderRadius: 8,
        fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: 'inherit', transition: 'background 120ms',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#15803D'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = '#16A34A'; }}
    >
      {loading && <Spinner size={14} color="#fff" />}
      {children}
    </button>
  );
}

function Spinner({ size = 14, color = ACCENT }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid rgba(255,255,255,0.25)`,
      borderTopColor: color,
      borderRadius: '50%',
      animation: 'orca-spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

// ─── Step 1 — Setup ───────────────────────────────────────────────────────────
// Two internal sub-screens — Stepper stays at Step 1 throughout:
//   'period_scope' — period picker + scope selector
//   'selection'    — fetched dept list (radio) or employee list (checkbox)
//
const SCOPE_OPTIONS = [
  { value: 'all',           label: 'All employees'    },
  { value: 'by_department', label: 'By department'    },
  { value: 'by_employee',   label: 'Select employees' },
];

function StepSetup({ onCreated, runs }) {
  const gateway = useGateway();
  const { auth } = useAuth();
  const { show: showToast } = useToast();

  // Sub-screen + period + scope
  const [subScreen, setSubScreen] = useState('period_scope');
  const [period,    setPeriod]    = useState(currentMonth());
  const [scope,     setScope]     = useState('all');
  const [loading,   setLoading]   = useState(false);

  // List picker state — selection sub-screen
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedEmps, setSelectedEmps] = useState(new Set());
  const [listData,     setListData]     = useState(null);   // null = not yet fetched
  const [listLoading,  setListLoading]  = useState(false);
  const [listSearch,   setListSearch]   = useState('');

  // Fetch dept or employee list when entering selection sub-screen
  useEffect(() => {
    if (subScreen !== 'selection') return;
    let cancelled = false;
    setListData(null);
    setListLoading(true);
    setListSearch('');
    const fn = scope === 'by_department' ? 'portalGetDepartments' : 'portalGetEmployees';
    gateway.invoke(fn)
      .then(res => {
        if (cancelled) return;
        if (res.status === 'success') {
          setListData(scope === 'by_department' ? res.departments : res.employees);
        } else {
          showToast(res.message || 'Failed to load list', 'error');
          setListData([]);
        }
      })
      .catch(() => { if (!cancelled) { showToast('Failed to load list', 'error'); setListData([]); } })
      .finally(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, [subScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side search filter — no re-fetch on keystroke
  const filteredList = (listData || []).filter(item => {
    const q = listSearch.toLowerCase();
    if (!q) return true;
    if (scope === 'by_department') return item.name.toLowerCase().includes(q);
    return item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
  });

  const handleNext = () => {
    if (!period) { showToast('Select a period first', 'warning'); return; }
    if (scope === 'all') {
      doCreate();
    } else {
      setSelectedDept('');
      setSelectedEmps(new Set());
      setSubScreen('selection');
    }
  };

  const toggleEmp = (id) => {
    setSelectedEmps(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const doCreate = async () => {
    const empArr = Array.from(selectedEmps);

    // Pre-flight: duplicate period check honoring allow_multiple_runs setting
    const existingRun    = runs?.find(r => r.period === period);
    const allowMultiRun  = auth.portalConfig?.allow_multiple_runs ?? false;
    if (existingRun) {
      if (!allowMultiRun) {
        showToast(`A run for ${period} already exists`, 'error');
        return;
      }
      if (existingRun.status === 'Processing') {
        showToast(`A run for ${period} is currently processing — wait for it to complete`, 'error');
        return;
      }
    }

    const force           = !!(existingRun && allowMultiRun);
    const selectedDeptVal = scope === 'by_department' ? selectedDept : '';
    const selectedEmpsVal = scope === 'by_employee'   ? empArr       : [];

    setLoading(true);
    try {
      const result = await gateway.invoke('portalCreateMPS', {
        payroll_period:      period,
        scope,
        selected_department: selectedDeptVal,
        selected_employees:  selectedEmpsVal,
        force,
      });
      if (result.status === 'success') {
        showToast('Payroll setup created', 'success');
        onCreated(result, {
          scope,
          selected_department: selectedDeptVal,
          selected_employees:  selectedEmpsVal,
        });
      } else {
        showToast(result.message || 'Failed to create setup', 'error');
      }
    } catch { showToast('Error creating setup', 'error'); }
    finally  { setLoading(false); }
  };

  // ── Sub-screen: period + scope ─────────────────────────────────────────────
  if (subScreen === 'period_scope') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, padding: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Period picker */}
          <div>
            <label style={{ display: 'block', fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Period
            </label>
            <MonthPicker value={period} onChange={setPeriod} />
          </div>

          {/* Scope selector */}
          <div>
            <label style={{ display: 'block', fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Scope
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SCOPE_OPTIONS.map(opt => {
                const sel = scope === opt.value;
                return (
                  <button key={opt.value} onClick={() => setScope(opt.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                      border: `1.5px solid ${sel ? ACCENT : 'var(--border)'}`,
                      background: sel ? ACCENT_BG : 'var(--surface)',
                      textAlign: 'left', fontFamily: 'inherit', transition: 'all 120ms',
                    }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${sel ? ACCENT : 'var(--border-strong)'}`,
                      background: sel ? ACCENT : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {sel && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: sel ? 600 : 400, color: sel ? ACCENT_TEXT : 'var(--text-primary)' }}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ position: 'sticky', bottom: 0, paddingTop: 8, background: 'var(--surface)' }}>
          <PrimaryBtn onClick={handleNext} disabled={loading} loading={loading}>
            {loading ? 'Creating…' : scope === 'all' ? 'Create setup' : 'Next →'}
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  // ── Sub-screen: selection — dept list (radio) or employee list (checkbox) ──
  const ctaDisabled = loading
    || (scope === 'by_department' && !selectedDept)
    || (scope === 'by_employee'   && selectedEmps.size === 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 0', overflow: 'hidden' }}>

        {/* Back */}
        <button onClick={() => setSubScreen('period_scope')}
          style={{
            flexShrink: 0, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', padding: 0, transition: 'color 120ms',
          }}
          onMouseEnter={e => e.currentTarget.style.color = ACCENT}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        {/* Period + scope badge */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 5 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '5px 10px', background: 'var(--surface-raised)',
            border: '1px solid var(--border)', borderRadius: 7,
          }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Period</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{period}</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', padding: '5px 10px',
            background: ACCENT_BG, border: '1px solid var(--accent-border)', borderRadius: 7,
          }}>
            <span style={{ fontSize: 10.5, color: ACCENT_TEXT, fontWeight: 500 }}>
              {scope === 'by_department' ? 'By dept' : 'By employee'}
            </span>
          </div>
        </div>

        {/* Search */}
        <div style={{ flexShrink: 0, position: 'relative' }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={2}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            placeholder={scope === 'by_department' ? 'Search departments…' : 'Search by name or ID…'}
            value={listSearch}
            onChange={e => setListSearch(e.target.value)}
            style={{
              width: '100%', border: '1px solid var(--border)', borderRadius: 8,
              padding: '7px 10px 7px 30px', fontSize: 12.5,
              background: 'var(--surface)', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit',
            }}
            onFocus={e => e.target.style.borderColor = ACCENT}
            onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* List — fills remaining height, scrolls internally */}
        <div style={{
          flex: 1, minHeight: 0, border: '1px solid var(--border)',
          borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {listLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Spinner size={20} color={ACCENT} />
            </div>
          ) : !listData || filteredList.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {listSearch ? 'No results match your search' : 'No items found'}
              </p>
            </div>
          ) : scope === 'by_department' ? (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredList.map(item => {
                const sel = selectedDept === item.name;
                return (
                  <div key={item.name} onClick={() => setSelectedDept(item.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 12px', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', transition: 'background 120ms',
                      background: sel ? ACCENT_BG : 'transparent',
                    }}
                    onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--surface-raised)'; }}
                    onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${sel ? ACCENT : 'var(--border-strong)'}`,
                      background: sel ? ACCENT : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 120ms',
                    }}>
                      {sel && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: sel ? 500 : 400, color: sel ? ACCENT_TEXT : 'var(--text-primary)' }}>
                      {item.name}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredList.map(emp => {
                const sel = selectedEmps.has(emp.id);
                return (
                  <div key={emp.id} onClick={() => toggleEmp(emp.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 12px', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', transition: 'background 120ms',
                      background: sel ? ACCENT_BG : 'transparent',
                    }}
                    onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--surface-raised)'; }}
                    onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${sel ? ACCENT : 'var(--border-strong)'}`,
                      background: sel ? ACCENT : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 120ms',
                    }}>
                      {sel && (
                        <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: sel ? 500 : 400, color: sel ? ACCENT_TEXT : 'var(--text-primary)', lineHeight: 1.3 }}>
                        {emp.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', opacity: 0.75, marginTop: 1, fontFamily: 'monospace' }}>
                        {emp.id}{emp.department ? ` · ${emp.department}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selection count — employee multi-select only */}
        {scope === 'by_employee' && selectedEmps.size > 0 && (
          <div style={{ flexShrink: 0, fontSize: 11.5, color: ACCENT, fontWeight: 500 }}>
            {selectedEmps.size} employee{selectedEmps.size !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 0, paddingTop: 8, paddingBottom: 4, background: 'var(--surface)' }}>
        <PrimaryBtn onClick={doCreate} disabled={ctaDisabled} loading={loading}>
          {loading ? 'Creating…' : 'Create setup'}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Step 2 — Review ──────────────────────────────────────────────────────────
function StepReview({ run, onRun }) {
  const gateway = useGateway();
  const { auth } = useAuth();
  const { show: showToast } = useToast();
  const allowOverride = auth.portalConfig?.allow_working_days_override;
  const isManualHolidays = auth.portalConfig?.default_holiday_source === 'manual';

  const [overriding,   setOverriding]   = useState(false);
  const [workingDays,  setWorkingDays]  = useState(run.working_days);
  const [saving,       setSaving]       = useState(false);
  const [running,      setRunning]      = useState(false);

  // ── Holiday editing state (manual source only) ───────────────────────────
  const [holidays,   setHolidays]   = useState(Array.isArray(run.holidays) ? run.holidays : []);
  const [editingIdx, setEditingIdx] = useState(null);
  const [showAdd,    setShowAdd]    = useState(false);
  const [formDate,   setFormDate]   = useState('');
  const [formName,   setFormName]   = useState('');
  const [hSaving,    setHSaving]    = useState(false);

  const periodMin = `${run.period}-01`;
  const periodMax = (() => {
    const [y, m] = run.period.split('-').map(Number);
    return `${run.period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  })();
  const fmtHDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const persistHolidays = async newList => {
    setHSaving(true);
    try {
      const r = await gateway.invoke('portalUpdateMPSHolidays', { payroll_period: run.period, holidays: newList });
      if (r.status === 'success') setHolidays(newList);
      else showToast(r.message || 'Failed to save holidays', 'error');
    } catch { showToast('Failed to save holidays', 'error'); }
    finally { setHSaving(false); }
  };

  const handleHAdd = async () => {
    if (!formDate || !formName.trim()) { showToast('Enter date and holiday name', 'warning'); return; }
    const sorted = [...holidays, { date: formDate, name: formName.trim() }]
      .sort((a, b) => a.date.localeCompare(b.date));
    await persistHolidays(sorted);
    setShowAdd(false); setFormDate(''); setFormName('');
  };

  const handleHEdit = async () => {
    if (!formDate || !formName.trim()) { showToast('Enter date and holiday name', 'warning'); return; }
    const sorted = holidays
      .map((h, i) => i === editingIdx ? { date: formDate, name: formName.trim() } : h)
      .sort((a, b) => a.date.localeCompare(b.date));
    await persistHolidays(sorted);
    setEditingIdx(null); setFormDate(''); setFormName('');
  };

  const handleHDelete = async idx => {
    await persistHolidays(holidays.filter((_, i) => i !== idx));
  };

  const startEdit = idx => {
    setEditingIdx(idx); setFormDate(holidays[idx].date); setFormName(holidays[idx].name);
    setShowAdd(false);
  };

  const cancelForm = () => {
    setEditingIdx(null); setShowAdd(false); setFormDate(''); setFormName('');
  };

  const handleSaveOverride = async () => {
    setSaving(true);
    try {
      const result = await gateway.invoke('portalUpdateMPS', { payroll_period: run.period, new_working_days: workingDays });
      if (result.status === 'success') { showToast('Working days updated', 'success'); setOverriding(false); }
      else showToast(result.message || 'Override failed', 'error');
    } finally { setSaving(false); }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await gateway.invoke('portalTriggerOrchestrator', { payroll_period: run.period });
      if (result.status === 'success') {
        showToast(`Run started — ${result.queued} employees queued`, 'success');
        onRun(result);
      } else { showToast(result.message || 'Run failed', 'error'); setRunning(false); }
    } catch { showToast('Failed to trigger run', 'error'); setRunning(false); }
  };

  // Scope label reads from the run object (set at creation time) — not from auth settings.
  // This fixes AUD-012 and gives accurate per-run scope detail in the review step.
  const scopeLabel = (() => {
    if (!run.scope || run.scope === 'all') return 'All active employees';
    if (run.scope === 'by_department') return run.selected_department ? `Dept: ${run.selected_department}` : 'By department';
    if (run.scope === 'by_employee') {
      const n = run.selected_employees?.length || 0;
      return `${n} selected employee${n !== 1 ? 's' : ''}`;
    }
    return 'All active employees';
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, paddingBottom: 12 }}>
        {/* Config rows */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          {[['Period', run.period], ['Scope', scopeLabel]].map(([label, value]) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: 'var(--surface-raised)',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
          {/* Working days row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', background: 'var(--surface-raised)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Working days</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {overriding ? (
                <input type="number" min={1} max={31} value={workingDays}
                  onChange={e => setWorkingDays(Number(e.target.value))}
                  style={{
                    width: 52, border: '1px solid var(--border)', borderRadius: 6,
                    padding: '2px 8px', fontSize: 12, textAlign: 'right',
                    background: 'var(--surface)', color: 'var(--text-primary)',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = ACCENT}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                />
              ) : (
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{workingDays}</span>
              )}
              {allowOverride && !overriding && (
                <button onClick={() => setOverriding(true)}
                  style={{ fontSize: 11, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                  Override
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Override save/cancel */}
        {overriding && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={handleSaveOverride} disabled={saving}
              style={{
                flex: 1, padding: '7px 12px', background: ACCENT, color: '#fff',
                border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit',
              }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setOverriding(false); setWorkingDays(run.working_days); }}
              style={{
                flex: 1, padding: '7px 12px', background: 'none',
                border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 500,
                color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Cancel
            </button>
          </div>
        )}

        {/* Holidays */}
        <div style={{ marginBottom: 8 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Public holidays
              {!isManualHolidays && (
                <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)', opacity: 0.7 }}>· Zoho</span>
              )}
            </p>
            {isManualHolidays && !showAdd && editingIdx === null && (
              <button
                onClick={() => { setShowAdd(true); setEditingIdx(null); setFormDate(''); setFormName(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600, color: ACCENT,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', padding: 0,
                }}
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                Add
              </button>
            )}
          </div>

          {/* Holiday list */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {holidays.length === 0 && !showAdd ? (
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '10px 12px', fontStyle: 'italic' }}>
                No public holidays this period
              </p>
            ) : (
              holidays.map((h, i) => (
                <div key={i}>
                  {editingIdx === i ? (
                    /* ── Inline edit form ── */
                    <div style={{ padding: '10px 12px', background: 'var(--surface-inset)', borderBottom: i < holidays.length - 1 || showAdd ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="date" value={formDate} min={periodMin} max={periodMax}
                          onChange={e => setFormDate(e.target.value)}
                          style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 11.5, background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
                          onFocus={e => e.target.style.borderColor = ACCENT}
                          onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                        />
                        <input
                          type="text" value={formName} placeholder="Holiday name"
                          onChange={e => setFormName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleHEdit()}
                          style={{ flex: 1, minWidth: 90, border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 11.5, background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
                          onFocus={e => e.target.style.borderColor = ACCENT}
                          onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                        />
                        <button onClick={handleHEdit} disabled={hSaving}
                          style={{ padding: '5px 10px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: hSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: hSaving ? 0.6 : 1 }}>
                          Save
                        </button>
                        <button onClick={cancelForm}
                          style={{ padding: '5px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11.5, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Holiday row ── */
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 12px', gap: 10,
                      borderBottom: i < holidays.length - 1 || showAdd ? '1px solid var(--border)' : 'none',
                      background: 'var(--surface-raised)',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{h.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'monospace' }}>{fmtHDate(h.date)}</div>
                      </div>
                      {isManualHolidays && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button onClick={() => startEdit(i)}
                            style={{ fontSize: 10.5, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '3px 7px', borderRadius: 5, transition: 'background 120ms' }}
                            onMouseEnter={e => e.currentTarget.style.background = ACCENT_BG}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            Edit
                          </button>
                          <button onClick={() => handleHDelete(i)} disabled={hSaving}
                            style={{ fontSize: 10.5, color: '#DC2626', background: 'none', border: 'none', cursor: hSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', padding: '3px 7px', borderRadius: 5, transition: 'background 120ms' }}
                            onMouseEnter={e => { if (!hSaving) e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* ── Add form ── */}
            {showAdd && (
              <div style={{ padding: '10px 12px', background: 'var(--surface-inset)' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="date" value={formDate} min={periodMin} max={periodMax}
                    onChange={e => setFormDate(e.target.value)}
                    style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 11.5, background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
                    onFocus={e => e.target.style.borderColor = ACCENT}
                    onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                  />
                  <input
                    type="text" value={formName} placeholder="Holiday name"
                    onChange={e => setFormName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleHAdd()}
                    style={{ flex: 1, minWidth: 90, border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 11.5, background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
                    onFocus={e => e.target.style.borderColor = ACCENT}
                    onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                  />
                  <button onClick={handleHAdd} disabled={hSaving}
                    style={{ padding: '5px 10px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: hSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: hSaving ? 0.6 : 1 }}>
                    {hSaving ? '…' : 'Add'}
                  </button>
                  <button onClick={cancelForm}
                    style={{ padding: '5px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11.5, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div style={{ position: 'sticky', bottom: 0, paddingTop: 8, background: 'var(--surface)' }}>
        <GreenBtn onClick={handleRun} disabled={running || overriding} loading={running}>
          {running ? 'Starting…' : 'Run payroll'}
        </GreenBtn>
      </div>
    </div>
  );
}

// ─── Step 3 — Running ─────────────────────────────────────────────────────────
function StepRunning({ run, countdown }) {
  const total = run.employees || 1;
  const done  = run.done  || 0;
  const err   = run.error || 0;
  const rem   = run.pending || 0;
  const pct   = Math.round((done / total) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
      <div style={{
        background: ACCENT_BG, border: `1px solid var(--accent-border)`,
        borderRadius: 8, padding: '10px 12px',
      }}>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: ACCENT_TEXT }}>
          {run.employees} employees · {run.batches} batch{run.batches !== 1 ? 'es' : ''}
        </p>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Processing — refresh in {countdown}s</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pct}%</span>
        </div>
        <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: ACCENT, borderRadius: 99, transition: 'width 500ms ease' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Done',      val: done, bg: 'rgba(22,163,74,0.08)',   color: '#16A34A' },
          { label: 'Remaining', val: rem,  bg: 'rgba(245,158,11,0.08)',  color: '#B45309' },
          { label: 'Errors',    val: err,  bg: 'rgba(239,68,68,0.08)',   color: '#DC2626' },
        ].map(({ label, val, bg, color }) => (
          <div key={label} style={{ background: bg, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4 — Complete ────────────────────────────────────────────────────────
function StepComplete({ run }) {
  const scopeLabel = (() => {
    if (!run.scope || run.scope === 'all') return 'All employees';
    if (run.scope === 'by_department') return run.selected_department ? `Dept · ${run.selected_department}` : 'By department';
    if (run.scope === 'by_employee') {
      const n = run.selected_employees?.length || 0;
      return `${n} selected employee${n !== 1 ? 's' : ''}`;
    }
    return 'All employees';
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
      {/* Success banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.20)',
        borderRadius: 8, padding: '10px 12px',
      }}>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#16A34A" strokeWidth={2.5} style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: '#15803D' }}>
          {run.employees} employees processed — {run.period}
        </p>
      </div>

      {/* Scope */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px',
        background: 'var(--surface-raised)', border: '1px solid var(--border)',
        borderRadius: 8,
      }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Scope</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{scopeLabel}</span>
      </div>

      {/* Error count */}
      {run.error > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)',
          borderRadius: 8, padding: '8px 12px',
        }}>
          <p style={{ fontSize: 12, color: '#DC2626' }}>
            {run.error} employee{run.error > 1 ? 's' : ''} errored — check records
          </p>
        </div>
      )}

      {/* Financial summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Gross salary', val: run.gross, accent: false },
          { label: 'Net paid',     val: run.net,   accent: true  },
          { label: 'Tax withheld', val: run.tax,   accent: false },
          { label: 'Employee SI',  val: run.si,    accent: false },
        ].map(({ label, val, accent }) => (
          <div key={label} style={{
            borderRadius: 8, padding: '10px 12px',
            background: accent ? ACCENT_BG : 'var(--surface-raised)',
            border: `1px solid ${accent ? 'var(--accent-border)' : 'var(--border)'}`,
          }}>
            <div style={{ fontSize: 10.5, color: accent ? ACCENT : 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3, color: accent ? ACCENT_TEXT : 'var(--text-primary)' }}>
              {fmtEGP(val)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Wizard Card ──────────────────────────────────────────────────────────────
function WizardCard({ run, isNew, countdown, onCreated, onRun, onViewReport, runs }) {
  const step = isNew ? 1 : (STEP_FOR_STATUS[run?.status] ?? 1);
  return (
    <div style={{
      flex: '1 1 0', minHeight: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Payroll wizard
        </span>
        {!isNew && run && (
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
            background: ACCENT_BG, color: ACCENT,
          }}>
            {run.period}
          </span>
        )}
      </div>

      <Stepper step={step} />

      {/* Scrollable step content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px 16px' }}>
        {step === 1 && <StepSetup onCreated={onCreated} runs={runs} />}
        {step === 2 && run && <StepReview run={run} onRun={onRun} />}
        {step === 3 && run && <StepRunning run={run} countdown={countdown} />}
        {step === 4 && run && <StepComplete run={run} />}
      </div>

      {/* View period report — locked to card bottom, never scrolls */}
      {step === 4 && run && (
        <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onViewReport}
            style={{
              width: '100%', padding: '9px 16px',
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 12.5, fontWeight: 500,
              color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 120ms, color 120ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-raised)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            View period report →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Runs List ────────────────────────────────────────────────────────────────
const STATUS_DOT = {
  Completed:  { bg: '#16A34A' },
  Processing: { bg: ACCENT, pulse: true },
  Draft:      { bg: 'var(--text-muted)' },
};

function RunsList({ runs, selectedRun: selectedRunObj, isNew, onSelectNew, onSelectRun }) {
  return (
    <div style={{
      flex: '1 1 0', minHeight: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    }}>
      <div style={{ flexShrink: 0, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Previous runs
        </span>
      </div>

      {/* New run row — fixed, never scrolls */}
      <div onClick={onSelectNew} style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px', cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        background: isNew ? ACCENT_BG : 'transparent',
        transition: 'background 120ms',
      }}
      onMouseEnter={e => { if (!isNew) e.currentTarget.style.background = 'var(--surface-raised)'; }}
      onMouseLeave={e => { if (!isNew) e.currentTarget.style.background = 'transparent'; }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          border: `2px dashed ${isNew ? ACCENT : 'var(--border-strong)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke={isNew ? ACCENT : 'var(--text-muted)'} strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: isNew ? ACCENT_TEXT : 'var(--text-secondary)' }}>
          New payroll run
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* Historical runs */}
        {runs === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <Spinner size={18} color={ACCENT} />
          </div>
        ) : runs.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No previous runs</p>
        ) : runs.map(run => {
          const dot        = STATUS_DOT[run.status] || STATUS_DOT.Draft;
          const isSelected = !isNew && (
            selectedRunObj?.run_id ? selectedRunObj.run_id === run.run_id : selectedRunObj?.period === run.period
          );
          const scopeLabel = (() => {
            if (!run.scope || run.scope === 'all') return null;
            if (run.scope === 'by_department') return run.selected_department ? `Dept · ${run.selected_department}` : 'By dept';
            if (run.scope === 'by_employee') {
              const n = run.selected_employees?.length || 0;
              return `${n} emp${n !== 1 ? 's' : ''}`;
            }
            return null;
          })();
          return (
            <div key={run.run_id || run.period} onClick={() => onSelectRun(run)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 16px', cursor: 'pointer',
              borderBottom: '1px solid var(--border)',
              background: isSelected ? ACCENT_BG : 'transparent',
              transition: 'background 120ms',
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-raised)'; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: dot.bg,
                boxShadow: dot.pulse ? `0 0 0 2px rgba(99,102,241,0.3)` : 'none',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? ACCENT_TEXT : 'var(--text-primary)' }}>
                  {run.period}
                  {scopeLabel && (
                    <span style={{ fontSize: 10.5, fontWeight: 400, color: isSelected ? ACCENT : 'var(--text-muted)', marginLeft: 6 }}>
                      {scopeLabel}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {run.employees} employees · {run.working_days} days
                </div>
              </div>
              <span style={{
                fontSize: 10.5, fontWeight: 500, padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                background: run.status === 'Completed' ? 'rgba(22,163,74,0.10)'
                  : run.status === 'Processing' ? ACCENT_BG : 'var(--surface-inset)',
                color: run.status === 'Completed' ? '#16A34A'
                  : run.status === 'Processing' ? ACCENT : 'var(--text-muted)',
              }}>
                {run.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Record Row ───────────────────────────────────────────────────────────────
function RecordRow({ rec, isExpanded, onToggle }) {
  const hasFinancials = rec.pr_gross_salary != null;
  const statusColor = rec.status === 'Done' ? '#16A34A'
    : rec.status === 'Error' ? '#DC2626'
    : rec.status === 'Processing' ? ACCENT : 'var(--text-muted)';
  const statusBg = rec.status === 'Done' ? 'rgba(22,163,74,0.10)'
    : rec.status === 'Error' ? 'rgba(239,68,68,0.10)'
    : rec.status === 'Processing' ? ACCENT_BG : 'var(--surface-inset)';

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div onClick={hasFinancials ? onToggle : undefined} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 16px',
        cursor: hasFinancials ? 'pointer' : 'default',
        background: isExpanded ? 'var(--surface-raised)' : 'transparent',
        transition: 'background 120ms',
      }}
      onMouseEnter={e => { if (hasFinancials && !isExpanded) e.currentTarget.style.background = 'var(--surface-raised)'; }}
      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}>
        <div style={{ minWidth: 0, marginRight: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            {rec.employee_name || rec.employee_id}
          </div>
          {/* ID · Department — always shown */}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
            {[rec.employee_id, rec.department].filter(Boolean).join(' · ')}
          </div>
          {/* Error message — always shown when present */}
          {rec.error && (
            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2, fontFamily: 'inherit' }}>{rec.error}</div>
          )}
          {/* Status text — only for non-Done, non-error states */}
          {!rec.error && rec.status !== 'Done' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'inherit' }}>
              {rec.status.toLowerCase() + (rec.processed_at ? ` · ${rec.processed_at}` : '')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: statusBg, color: statusColor }}>
            {rec.status}
          </span>
          {hasFinancials && (
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={2}
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms', flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          )}
        </div>
      </div>

      {isExpanded && hasFinancials && (
        <div style={{ padding: '4px 16px 16px', background: 'var(--surface-raised)' }}>
          {[
            { title: 'Earnings', rows: [
              ['Basic salary', rec.pr_basic_salary],
              ['Allowances', rec.pr_total_allowances],
              ['Gross salary', rec.pr_gross_salary],
            ]},
            { title: 'Deductions', rows: [
              ['Employee SI', rec.pr_employee_si_deduction],
              ["Martyrs' fund", rec.pr_martyrs_fund],
              ['Absence', rec.pr_absence_deduction],
              ['Unpaid leave', rec.pr_unpaid_leave_deduction],
              ['Late', rec.pr_late_deduction],
              ['Total deductions', rec.pr_total_deductions],
            ]},
            { title: 'Result', rows: [
              ['Net salary', rec.pr_net_salary, true],
              ['Monthly tax', rec.pr_monthly_tax_withheld],
              ['YTD tax', rec.pr_ytd_tax_withheld],
            ]},
          ].map(({ title, rows }) => (
            <div key={title} style={{ marginTop: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                {title}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {rows.map(([label, val, accent]) => (
                  <div key={label} style={{
                    background: accent ? ACCENT_BG : 'var(--surface)',
                    border: `1px solid ${accent ? 'var(--accent-border)' : 'var(--border)'}`,
                    borderRadius: 7, padding: '8px 10px',
                  }}>
                    <div style={{ fontSize: 10, color: accent ? ACCENT : 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2, color: accent ? ACCENT_TEXT : 'var(--text-primary)' }}>
                      {fmtEGP(val)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Records Panel ────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Done', 'Processing', 'Pending', 'Errors'];

function RecordsPanel({ records, loading, period, currentRunId, onNavigateQueue, siblingRuns = [], onSelectRun }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [expandedId,   setExpandedId]   = useState(null);

  useEffect(() => { setActiveFilter('All'); setExpandedId(null); }, [period]);

  const counts = {
    All:        records.length,
    Done:       records.filter(r => r.status === 'Done').length,
    Processing: records.filter(r => r.status === 'Processing').length,
    Pending:    records.filter(r => r.status === 'Pending').length,
    Errors:     records.filter(r => r.status === 'Error').length,
  };

  const filtered =
    activeFilter === 'All'    ? records :
    activeFilter === 'Errors' ? records.filter(r => r.status === 'Error') :
    records.filter(r => r.status === activeFilter);

  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    }}>
      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        {/* Top row: label + employee count + Queue button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Payroll records
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {period && (
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{counts.All} employees</span>
            )}
            {period && onNavigateQueue && (
              <button
                onClick={() => onNavigateQueue(period, currentRunId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 600, color: ACCENT,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', padding: 0, transition: 'opacity 120ms',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                View Queue
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Run navigation row — only shown when multiple runs share the same period */}
        {period && siblingRuns.length > 1 && (() => {
          const currentIdx = siblingRuns.findIndex(r =>
            currentRunId ? r.run_id === currentRunId : r.period === period
          );
          return (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 16px 8px', borderTop: '1px solid var(--border)',
              background: 'var(--surface-raised)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Run {currentIdx + 1} of {siblingRuns.length} for {period}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => currentIdx > 0 && onSelectRun(siblingRuns[currentIdx - 1])}
                  disabled={currentIdx <= 0}
                  style={{
                    width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    cursor: currentIdx <= 0 ? 'not-allowed' : 'pointer',
                    opacity: currentIdx <= 0 ? 0.35 : 1, color: 'var(--text-secondary)',
                  }}
                >
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <button
                  onClick={() => currentIdx < siblingRuns.length - 1 && onSelectRun(siblingRuns[currentIdx + 1])}
                  disabled={currentIdx >= siblingRuns.length - 1}
                  style={{
                    width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    cursor: currentIdx >= siblingRuns.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: currentIdx >= siblingRuns.length - 1 ? 0.35 : 1, color: 'var(--text-secondary)',
                  }}
                >
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Filter tabs */}
      <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {FILTERS.map(f => {
          const isActive = activeFilter === f;
          return (
            <button key={f} onClick={() => { setActiveFilter(f); setExpandedId(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 14px', fontSize: 12, fontWeight: isActive ? 600 : 400,
                borderBottom: `2px solid ${isActive ? ACCENT : 'transparent'}`,
                color: isActive ? ACCENT : 'var(--text-muted)',
                background: 'none', border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: isActive ? ACCENT : 'transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'inherit', transition: 'color 120ms',
              }}>
              {f}
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 99,
                background: isActive ? ACCENT_BG : 'var(--surface-inset)',
                color: isActive ? ACCENT_TEXT : 'var(--text-secondary)',
                fontWeight: 600,
              }}>
                {counts[f]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Records list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {!period ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: '48px 0' }}>
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="var(--border-strong)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select a run to view records</p>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner size={22} color={ACCENT} />
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0' }}>
            No records match this filter
          </p>
        ) : filtered.map(rec => (
          <RecordRow
            key={rec.employee_id} rec={rec}
            isExpanded={expandedId === rec.employee_id}
            onToggle={() => setExpandedId(id => id === rec.employee_id ? null : rec.employee_id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main RunPayroll ──────────────────────────────────────────────────────────
export default function RunPayroll({ onNavigate, navParams = {} }) {
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const [runs,           setRuns]           = useState(null);
  const [selectedRun,    setSelectedRun]    = useState(null);
  const [isNew,          setIsNew]          = useState(true);
  const [recordsCache,   setRecordsCache]   = useState({});
  const [activeRecords,  setActiveRecords]  = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [countdown,      setCountdown]      = useState(30);
  const [showDrawer,     setShowDrawer]     = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = showDrawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showDrawer]);

  useEffect(() => {
    (async () => {
      try {
        const result = await gateway.invoke('portalListRuns');
        if (result.status === 'success') setRuns(result.runs);
        else { showToast('Failed to load runs', 'error'); setRuns([]); }
      } catch { showToast('Failed to load runs', 'error'); setRuns([]); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecords = useCallback(async (run, forceRefresh = false) => {
    const cacheKey = run.run_id || run.period;
    if (!forceRefresh && recordsCache[cacheKey]) { setActiveRecords(recordsCache[cacheKey]); return; }
    setRecordsLoading(true);
    try {
      const result = await gateway.invoke('portalGetPayrollRecords', { payroll_period: run.period, run_id: run.run_id });
      if (result.status === 'success') {
        setRecordsCache(prev => ({ ...prev, [cacheKey]: result.records }));
        setActiveRecords(result.records);
      }
    } catch { showToast('Failed to load records', 'error'); }
    finally { setRecordsLoading(false); }
  }, [recordsCache]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedRun || selectedRun.status !== 'Processing') return;
    const poll = async () => {
      try {
        const result = await gateway.invoke('portalGetQueueStatus', { payroll_period: selectedRun.period, run_id: selectedRun.run_id });
        if (result.status !== 'success') return;
        const updated = {
          ...selectedRun,
          done:    result.progress?.done    ?? selectedRun.done,
          error:   result.progress?.error   ?? selectedRun.error,
          pending: (result.progress?.pending ?? 0) + (result.progress?.processing ?? 0),
          status:  result.mps_status,
        };
        setSelectedRun(updated);
        setRuns(prev => prev?.map(r =>
          (r.run_id ? r.run_id === updated.run_id : r.period === updated.period) ? updated : r
        ) ?? prev);
        setCountdown(30);
        if (result.mps_status === 'Completed') loadRecords(updated, true);
      } catch { /* silent */ }
    };
    const pollTimer  = setInterval(poll, 30000);
    const countTimer = setInterval(() => setCountdown(c => (c > 1 ? c - 1 : 30)), 1000);
    return () => { clearInterval(pollTimer); clearInterval(countTimer); };
  }, [selectedRun?.run_id, selectedRun?.period, selectedRun?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectNew = () => { setIsNew(true); setSelectedRun(null); setActiveRecords([]); setShowDrawer(false); };
  const handleSelectRun = useCallback((run) => { setIsNew(false); setSelectedRun(run); setCountdown(30); loadRecords(run); }, [loadRecords]);

  // Auto-select run when navigated from another screen
  useEffect(() => {
    if (!navParams?.period || !runs) return;
    const target = navParams.run_id
      ? runs.find(r => r.run_id === navParams.run_id) || runs.find(r => r.period === navParams.period)
      : runs.find(r => r.period === navParams.period);
    if (target) handleSelectRun(target);
  }, [navParams?.period, navParams?.run_id, runs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMpsCreated = (result, scopeInfo = {}) => {
    const newRun = {
      run_id:              result.run_id,
      period:              result.period,
      status:              'Draft',
      employees:           0,
      working_days:        result.working_days,
      batches:             0,
      done:                0,
      error:               0,
      pending:             0,
      holidays:            result.holidays,
      scope:               scopeInfo.scope               || 'all',
      selected_department: scopeInfo.selected_department || '',
      selected_employees:  scopeInfo.selected_employees  || [],
    };
    setRuns(prev => [newRun, ...(prev ?? [])]);
    setIsNew(false); setSelectedRun(newRun); setActiveRecords([]);
  };

  const handleRunStarted = (orchResult) => {
    const updated = { ...selectedRun, status: 'Processing', employees: orchResult.queued, batches: orchResult.batches, pending: orchResult.queued, done: 0, error: 0 };
    setSelectedRun(updated);
    setRuns(prev => prev?.map(r => r.run_id === updated.run_id ? updated : r) ?? prev);
    setCountdown(30);
  };

  const handleViewReport = () => {
    if (onNavigate && selectedRun?.period) {
      onNavigate('feature_reports', { period: selectedRun.period });
    }
  };

  const handleNavigateQueue = (period, run_id) => {
    if (onNavigate) onNavigate('feature_queue_monitor', { period, run_id });
  };

  const siblingRuns = (!isNew && selectedRun && runs)
    ? runs.filter(r => r.period === selectedRun.period)
    : [];

  return (
    <>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Page header */}
        <div style={{ flexShrink: 0, marginBottom: 12 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Run payroll</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Select a previous run or create a new one</p>
        </div>

        {/* Layout — mobile: stacked flex, desktop: two-column grid */}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gap: 12, overflow: 'hidden' }}
          className="grid-layout-run">
          {/* Left column: wizard + runs list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'hidden' }}>
            <WizardCard
              run={selectedRun} isNew={isNew} countdown={countdown}
              onCreated={handleMpsCreated} onRun={handleRunStarted}
              onViewReport={handleViewReport} runs={runs}
            />
            <RunsList
              runs={runs} selectedRun={selectedRun} isNew={isNew}
              onSelectNew={handleSelectNew} onSelectRun={handleSelectRun}
            />
          </div>

          {/* Right column: records panel — hidden on mobile (shown in drawer) */}
          <div className="records-desktop" style={{ display: 'none', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <RecordsPanel records={activeRecords} loading={recordsLoading} period={isNew ? null : selectedRun?.period} currentRunId={isNew ? null : selectedRun?.run_id} onNavigateQueue={handleNavigateQueue} siblingRuns={siblingRuns} onSelectRun={handleSelectRun} />
          </div>
        </div>
      </div>

      {/* ── Floating "View Records" button — mobile only ────────────────────── */}
      {!isNew && selectedRun && (
        <div className="records-fab" style={{ position: 'fixed', bottom: 76, right: 16, zIndex: 45 }}>
          <button onClick={() => setShowDrawer(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#0F172A', border: '1px solid rgba(99,102,241,0.45)',
            borderRadius: 99, padding: '10px 18px',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={ACCENT_MUTED} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Records
            {activeRecords.length > 0 && (
              <span style={{
                background: ACCENT, color: '#fff',
                fontSize: 10, fontWeight: 700,
                padding: '1px 7px', borderRadius: 99, minWidth: 20, textAlign: 'center',
              }}>
                {activeRecords.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── Records bottom drawer — mobile only ────────────────────────────── */}
      {/* Backdrop */}
      <div className="records-fab"
        onClick={() => setShowDrawer(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 48,
          background: 'rgba(0,0,0,0.55)',
          opacity: showDrawer ? 1 : 0,
          pointerEvents: showDrawer ? 'auto' : 'none',
          transition: 'opacity 280ms ease',
        }} />

      {/* Drawer */}
      <div className="records-fab" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 49,
        background: 'var(--surface)',
        borderRadius: '16px 16px 0 0',
        border: '1px solid var(--border)',
        maxHeight: '85dvh',
        display: 'flex', flexDirection: 'column',
        transform: showDrawer ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border-strong)', borderRadius: 99 }} />
        </div>

        {/* Drawer header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 16px 12px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Records</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {selectedRun?.period} · {activeRecords.length} employees
            </div>
          </div>
          <button onClick={() => setShowDrawer(false)} style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--surface-inset)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit',
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Records content */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <RecordsPanel records={activeRecords} loading={recordsLoading} period={isNew ? null : selectedRun?.period} />
        </div>
      </div>

      {/* Responsive layout styles */}
      <style>{`
        @media (min-width: 768px) {
          .grid-layout-run { grid-template-columns: 260px 1fr !important; }
          .records-desktop  { display: flex !important; }
          .records-fab      { display: none !important; }
        }
      `}</style>
    </>
  );
}
