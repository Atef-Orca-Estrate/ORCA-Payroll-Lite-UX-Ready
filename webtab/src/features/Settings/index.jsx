import { useRef, useState } from 'react';
import { useAuth, useToast } from '../../context/AuthContext';
import { useGateway }        from '../../hooks/useGateway';

// ─── Constants ─────────────────────────────────────────────────────────────
const ACCENT      = '#6366F1';
const ACCENT_BG   = '#EEF2FF';
const ACCENT_TEXT = '#3730A3';
const GRAPHITE    = '#111827';
const GRAPHITE_H  = '#1F2937';

// ─── Base components ────────────────────────────────────────────────────────

function SectionCard({ title, children, onSave, saving, badge, dirty = true }) {
  const saveDisabled = saving || !dirty;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-raised)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {title}
        </span>
        {badge}
      </div>

      <div style={{ padding: '4px 0' }}>
        {children}
      </div>

      {onSave && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onSave}
            disabled={saveDisabled}
            style={{
              width: '100%', padding: '9px 16px',
              background: saveDisabled ? 'var(--surface-inset)' : GRAPHITE,
              color: saveDisabled ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 12.5, fontWeight: 600,
              cursor: saveDisabled ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit', transition: 'background 120ms',
            }}
            onMouseEnter={e => { if (!saveDisabled) e.currentTarget.style.background = GRAPHITE_H; }}
            onMouseLeave={e => { if (!saveDisabled) e.currentTarget.style.background = saveDisabled ? 'var(--surface-inset)' : GRAPHITE; }}
          >
            {saving && (
              <div style={{
                width: 13, height: 13,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'orca-spin 0.7s linear infinite',
              }} />
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

function SettingRow({ label, sub, children, last = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 16px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      gap: 12,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 99,
        background: value ? ACCENT : 'var(--border-strong)',
        border: 'none', cursor: 'pointer',
        position: 'relative', transition: 'background 150ms',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: 2,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transform: value ? 'translateX(20px)' : 'translateX(0)',
        transition: 'transform 150ms',
        display: 'block',
      }} />
    </button>
  );
}

function NumberInput({ value, onChange, min = 0, max = 100, step = 1, width = 80 }) {
  return (
    <input
      type="number"
      value={value}
      min={min} max={max} step={step}
      onChange={e => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
      style={{
        width, border: '1px solid var(--border)', borderRadius: 7,
        padding: '5px 8px', fontSize: 12.5, textAlign: 'right',
        background: 'var(--surface)', color: 'var(--text-primary)',
        outline: 'none', fontFamily: 'inherit',
      }}
      onFocus={e => e.target.style.borderColor = ACCENT}
      onBlur={e  => e.target.style.borderColor = 'var(--border)'}
    />
  );
}

function SelectField({ value, onChange, options, width = 'auto' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        border: '1px solid var(--border)', borderRadius: 7,
        padding: '6px 10px', fontSize: 12.5, width,
        background: 'var(--surface)', color: 'var(--text-primary)',
        outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
      }}
      onFocus={e => e.target.style.borderColor = ACCENT}
      onBlur={e  => e.target.style.borderColor = 'var(--border)'}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--surface-inset)', margin: '2px 0' }} />;
}

// ─── Section 1 — Attendance ─────────────────────────────────────────────────
function AttendanceSection() {
  const { auth, setAuth } = useAuth();
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const att0 = auth.payrollSettings?.attendance || {};

  const [wdDefault,  setWdDefault]  = useState(att0.working_days_default          ?? 22);
  const [absEn,      setAbsEn]      = useState(att0.absence?.enabled               ?? true);
  const [absMul,     setAbsMul]     = useState(att0.absence?.multiplier            ?? 1.0);
  const [ulEn,       setUlEn]       = useState(att0.unpaid_leave?.enabled          ?? true);
  const [ulMul,      setUlMul]      = useState(att0.unpaid_leave?.multiplier       ?? 1.0);
  const [lateEn,     setLateEn]     = useState(att0.late_deduction?.enabled        ?? true);
  const [lateGrace,  setLateGrace]  = useState(att0.late_deduction?.grace_minutes  ?? 0);
  const [lateMul,    setLateMul]    = useState(att0.late_deduction?.multiplier     ?? 1.0);
  const [otEn,       setOtEn]       = useState(att0.overtime?.enabled              ?? true);
  const [otMul,      setOtMul]      = useState(att0.overtime?.multiplier           ?? 1.5);
  const [phEn,       setPhEn]       = useState(att0.public_holiday?.enabled        ?? true);
  const [phIfWorked, setPhIfWorked] = useState(att0.public_holiday?.if_worked      ?? 'overtime_rate');
  const [saving,     setSaving]     = useState(false);

  const saved = useRef({ wdDefault, absEn, absMul, ulEn, ulMul, lateEn, lateGrace, lateMul, otEn, otMul, phEn, phIfWorked });

  const isDirty =
    wdDefault  !== saved.current.wdDefault  ||
    absEn      !== saved.current.absEn      ||
    absMul     !== saved.current.absMul     ||
    ulEn       !== saved.current.ulEn       ||
    ulMul      !== saved.current.ulMul      ||
    lateEn     !== saved.current.lateEn     ||
    lateGrace  !== saved.current.lateGrace  ||
    lateMul    !== saved.current.lateMul    ||
    otEn       !== saved.current.otEn       ||
    otMul      !== saved.current.otMul      ||
    phEn       !== saved.current.phEn       ||
    phIfWorked !== saved.current.phIfWorked;

  const handleSave = async () => {
    setSaving(true);
    const newAtt = {
      working_days_default: wdDefault,
      absence:        { enabled: absEn,  multiplier: absMul },
      unpaid_leave:   { enabled: ulEn,   multiplier: ulMul  },
      late_deduction: { enabled: lateEn, grace_minutes: lateGrace, multiplier: lateMul },
      overtime:       { enabled: otEn,   multiplier: otMul  },
      public_holiday: { enabled: phEn,   if_worked: phIfWorked },
    };
    try {
      const result = await gateway.invoke('portalSaveSettings', { section: 'attendance', ...newAtt });
      if (result.status === 'success') {
        showToast('Attendance settings saved', 'success');
        saved.current = { wdDefault, absEn, absMul, ulEn, ulMul, lateEn, lateGrace, lateMul, otEn, otMul, phEn, phIfWorked };
        setAuth(prev => ({ ...prev, payrollSettings: { ...prev.payrollSettings, attendance: newAtt } }));
      } else {
        showToast(result.message || 'Save failed', 'error');
      }
    } finally { setSaving(false); }
  };

  return (
    <SectionCard title="Attendance" onSave={handleSave} saving={saving} dirty={isDirty}>

      <SettingRow label="Default working days" sub="Fallback if not set on monthly payroll setup">
        <NumberInput value={wdDefault} onChange={setWdDefault} min={1} max={30} step={1} width={60} />
      </SettingRow>

      <Divider />

      <SettingRow label="Absence deduction" sub="Deduct for unexcused absent days">
        <Toggle value={absEn} onChange={setAbsEn} />
      </SettingRow>
      {absEn && (
        <SettingRow label="Absence multiplier" sub="Applied to daily rate per absent day">
          <NumberInput value={absMul} onChange={setAbsMul} min={1.0} max={5.0} step={0.25} width={72} />
        </SettingRow>
      )}

      <Divider />

      <SettingRow label="Unpaid leave deduction" sub="Deduct for HR-approved unpaid leave days">
        <Toggle value={ulEn} onChange={setUlEn} />
      </SettingRow>
      {ulEn && (
        <SettingRow label="Unpaid leave multiplier" sub="Applied to daily rate per unpaid leave day">
          <NumberInput value={ulMul} onChange={setUlMul} min={1.0} max={5.0} step={0.25} width={72} />
        </SettingRow>
      )}

      <Divider />

      <SettingRow label="Late deduction" sub="Deduct for accumulated late minutes">
        <Toggle value={lateEn} onChange={setLateEn} />
      </SettingRow>
      {lateEn && (
        <>
          <SettingRow label="Grace period" sub="Monthly late minutes before deduction starts">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <NumberInput value={lateGrace} onChange={setLateGrace} min={0} max={480} step={5} width={60} />
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>mins</span>
            </div>
          </SettingRow>
          <SettingRow label="Late multiplier" sub="Applied to per-minute rate after grace period">
            <NumberInput value={lateMul} onChange={setLateMul} min={1.0} max={5.0} step={0.25} width={72} />
          </SettingRow>
        </>
      )}

      <Divider />

      <SettingRow label="Overtime pay" sub="Add overtime pay for extra hours worked">
        <Toggle value={otEn} onChange={setOtEn} />
      </SettingRow>
      {otEn && (
        <SettingRow label="Overtime multiplier" sub="Applied to hourly rate per overtime hour">
          <SelectField
            value={String(otMul)}
            onChange={v => setOtMul(parseFloat(v))}
            options={[
              { value: '1.5', label: '1.5× — standard overtime' },
              { value: '2.0', label: '2.0× — double time' },
            ]}
          />
        </SettingRow>
      )}

      <Divider />

      <SettingRow label="Public holiday pay" sub="Extra pay when employees work on public holidays">
        <Toggle value={phEn} onChange={setPhEn} />
      </SettingRow>
      {phEn && (
        <SettingRow label="If worked, pay at" sub="Rate applied to days worked on public holidays" last>
          <SelectField
            value={phIfWorked}
            onChange={setPhIfWorked}
            options={[
              { value: 'overtime_rate', label: 'Overtime rate' },
              { value: 'double_rate',   label: 'Double rate (2×)' },
              { value: 'paid_day',      label: 'No extra pay' },
            ]}
          />
        </SettingRow>
      )}
    </SectionCard>
  );
}

// ─── Section 2 — Social Insurance ──────────────────────────────────────────
function SocialInsuranceSection() {
  const { auth, setAuth } = useAuth();
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const si0 = auth.payrollSettings?.social_insurance || {};
  const [ceiling, setCeiling] = useState(si0.monthly_ceiling ?? 9400);
  const [saving,  setSaving]  = useState(false);

  const saved = useRef({ ceiling: si0.monthly_ceiling ?? 9400 });
  const isDirty = ceiling !== saved.current.ceiling;

  const ceilingYear = si0.ceiling_updated ? new Date(si0.ceiling_updated).getFullYear() : 0;
  const currentYear = new Date().getFullYear();
  const showWarning = ceilingYear < currentYear;
  const fmtDate     = si0.ceiling_updated
    ? new Date(si0.ceiling_updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await gateway.invoke('portalSaveSettings', { section: 'social_insurance', monthly_ceiling: ceiling });
      if (result.status === 'success') {
        const today = new Date().toISOString().split('T')[0];
        showToast('Social insurance settings saved', 'success');
        saved.current = { ceiling };
        setAuth(prev => ({
          ...prev,
          payrollSettings: {
            ...prev.payrollSettings,
            social_insurance: { ...prev.payrollSettings.social_insurance, monthly_ceiling: ceiling, ceiling_updated: today },
          },
        }));
      } else {
        showToast(result.message || 'Save failed', 'error');
      }
    } finally { setSaving(false); }
  };

  const badge = showWarning ? (
    <span style={{
      background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)',
      color: '#B45309', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
    }}>
      ⚠ Verify ceiling
    </span>
  ) : null;

  return (
    <SectionCard title="Social Insurance" onSave={handleSave} saving={saving} badge={badge} dirty={isDirty}>

      {showWarning && (
        <div style={{
          margin: '8px 16px 0', padding: '8px 12px',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.20)',
          borderRadius: 7, fontSize: 11.5, color: '#B45309', lineHeight: 1.5,
        }}>
          SI ceiling last updated in {ceilingYear}. Update every January per GOSI announcement.
        </div>
      )}

      <SettingRow label="Monthly SI ceiling" sub="Maximum insurable wage per month (EGP)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>EGP</span>
          <NumberInput value={ceiling} onChange={setCeiling} min={1000} max={99999} step={100} width={90} />
        </div>
      </SettingRow>

      <SettingRow label="Ceiling last updated">
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{fmtDate}</span>
      </SettingRow>

      <Divider />

      <SettingRow label="Employee SI rate" sub="Fixed by Egyptian Law 148/2019">
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
          background: 'var(--surface-inset)', padding: '3px 10px', borderRadius: 6,
        }}>11%</span>
      </SettingRow>
      <SettingRow label="Employer SI rate" sub="Fixed by Egyptian Law 148/2019">
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
          background: 'var(--surface-inset)', padding: '3px 10px', borderRadius: 6,
        }}>18.75%</span>
      </SettingRow>
      <SettingRow label="Martyrs' Fund rate" sub="Legal Entities only" last>
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
          background: 'var(--surface-inset)', padding: '3px 10px', borderRadius: 6,
        }}>0.05%</span>
      </SettingRow>
    </SectionCard>
  );
}

// ─── Section 3 — Portal Configuration ──────────────────────────────────────
function PortalConfigSection() {
  const { auth, setAuth } = useAuth();
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const pc0 = auth.portalConfig || {};
  const [holidaySrc,    setHolidaySrc]    = useState(pc0.default_holiday_source      || 'zoho');
  const [allowOverride, setAllowOverride] = useState(pc0.allow_working_days_override ?? false);
  const [allowMultiRun, setAllowMultiRun] = useState(pc0.allow_multiple_runs         ?? false);
  const [saving,        setSaving]        = useState(false);

  const saved = useRef({
    holidaySrc:    pc0.default_holiday_source      || 'zoho',
    allowOverride: pc0.allow_working_days_override ?? false,
    allowMultiRun: pc0.allow_multiple_runs         ?? false,
  });
  const isDirty = holidaySrc    !== saved.current.holidaySrc
               || allowOverride !== saved.current.allowOverride
               || allowMultiRun !== saved.current.allowMultiRun;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await gateway.invoke('portalSaveSettings', {
        section:                     'portal_config',
        default_holiday_source:      holidaySrc,
        allow_working_days_override: allowOverride,
        allow_multiple_runs:         allowMultiRun,
      });
      if (result.status === 'success') {
        showToast('Portal configuration saved', 'success');
        saved.current = { holidaySrc, allowOverride, allowMultiRun };
        setAuth(prev => ({
          ...prev,
          portalConfig: {
            ...prev.portalConfig,
            default_holiday_source:      holidaySrc,
            allow_working_days_override: allowOverride,
            allow_multiple_runs:         allowMultiRun,
          },
        }));
      } else {
        showToast(result.message || 'Save failed', 'error');
      }
    } finally { setSaving(false); }
  };

  return (
    <SectionCard title="Portal Configuration" onSave={handleSave} saving={saving} dirty={isDirty}>
      <SettingRow label="Holiday source" sub="Source for public holidays in payroll setup">
        <SelectField
          value={holidaySrc}
          onChange={setHolidaySrc}
          options={[
            { value: 'zoho',   label: 'Zoho People' },
            { value: 'manual', label: 'Manual' },
          ]}
        />
      </SettingRow>
      <SettingRow label="Working days override" sub="Allow overriding working days on payroll setup">
        <Toggle value={allowOverride} onChange={setAllowOverride} />
      </SettingRow>
      <SettingRow
        label="Allow multiple runs per period"
        sub="Re-run a completed period only if no processing run exists"
        last
      >
        <Toggle value={allowMultiRun} onChange={setAllowMultiRun} />
      </SettingRow>
    </SectionCard>
  );
}

// ─── Section 4 — Portal Users ───────────────────────────────────────────────
function PortalUsersSection() {
  const { auth } = useAuth();
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const [portalUsers, setPortalUsers] = useState(auth.portalConfig?.portal_users || {});
  const [newEmpId,    setNewEmpId]    = useState('');
  const [newRole,     setNewRole]     = useState('manager');
  const [adding,      setAdding]      = useState(false);

  const handleAdd = async () => {
    const empId = newEmpId.trim().toUpperCase();
    if (!empId) { showToast('Enter an employee ID', 'warning'); return; }
    setAdding(true);
    try {
      const result = await gateway.invoke('portalSaveSettings', { section: 'portal_users', user_id: empId, role: newRole });
      if (result.status === 'success') {
        setPortalUsers(prev => ({ ...prev, [empId]: newRole }));
        setNewEmpId('');
        showToast(`${empId} added as ${newRole}`, 'success');
      } else {
        showToast(result.message || 'Add failed', 'error');
      }
    } finally { setAdding(false); }
  };

  const handleRemove = async (userId) => {
    if (userId === auth.employeeId) { showToast('You cannot remove yourself', 'warning'); return; }
    const result = await gateway.invoke('portalSaveSettings', { section: 'portal_users', user_id: userId, role: '' });
    if (result.status === 'success') {
      setPortalUsers(prev => { const next = { ...prev }; delete next[userId]; return next; });
      showToast(`${userId} removed`, 'success');
    } else {
      showToast(result.message || 'Remove failed', 'error');
    }
  };

  const roleColors = {
    admin:   { bg: ACCENT_BG, color: ACCENT_TEXT },
    manager: { bg: 'rgba(22,163,74,0.10)', color: '#15803D' },
  };

  return (
    <SectionCard title="Portal Users">
      {Object.keys(portalUsers).length === 0 ? (
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No users configured</p>
        </div>
      ) : (
        Object.entries(portalUsers).map(([uid, role]) => {
          const rc     = roleColors[role] || { bg: 'var(--surface-inset)', color: 'var(--text-secondary)' };
          const isSelf = uid === auth.employeeId;
          const initials = uid.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'U';
          return (
            <div key={uid} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: ACCENT_BG, border: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: ACCENT_TEXT }}>{initials}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {uid} {isSelf && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(you)</span>}
                </div>
                <span style={{
                  display: 'inline-block', fontSize: 10, fontWeight: 600, textTransform: 'capitalize',
                  padding: '1px 7px', borderRadius: 99, marginTop: 2,
                  background: rc.bg, color: rc.color,
                }}>
                  {role}
                </span>
              </div>
              {!isSelf && (
                <button
                  onClick={() => handleRemove(uid)}
                  style={{
                    fontSize: 11, color: '#DC2626',
                    background: 'none', border: 'none',
                    padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'background 120ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })
      )}

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
          Add user
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Employee ID"
            value={newEmpId}
            onChange={e => setNewEmpId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{
              flex: 1, border: '1px solid var(--border)', borderRadius: 7,
              padding: '7px 10px', fontSize: 12.5,
              background: 'var(--surface)', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'monospace', textTransform: 'uppercase',
            }}
            onFocus={e => e.target.style.borderColor = ACCENT}
            onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            style={{
              border: '1px solid var(--border)', borderRadius: 7,
              padding: '7px 10px', fontSize: 12.5,
              background: 'var(--surface)', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        <button
          onClick={handleAdd}
          disabled={adding}
          style={{
            width: '100%', padding: '8px 16px',
            background: adding ? 'var(--surface-inset)' : GRAPHITE,
            color: adding ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 7,
            fontSize: 12.5, fontWeight: 600,
            cursor: adding ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            fontFamily: 'inherit', transition: 'background 120ms',
          }}
          onMouseEnter={e => { if (!adding) e.currentTarget.style.background = GRAPHITE_H; }}
          onMouseLeave={e => { if (!adding) e.currentTarget.style.background = GRAPHITE; }}
        >
          {adding && (
            <div style={{
              width: 13, height: 13,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff', borderRadius: '50%',
              animation: 'orca-spin 0.7s linear infinite',
            }} />
          )}
          {adding ? 'Adding…' : 'Add user'}
        </button>
      </div>
    </SectionCard>
  );
}

// ─── Feature label map — avoids circular import with featureRegistry ─────────
const FEATURE_LABELS = {
  feature_dashboard:     'Dashboard',
  feature_run_payroll:   'Payroll Runs',
  feature_queue_monitor: 'Queue Monitor',
  feature_reports:       'Reports',
  feature_employees:     'Employees',
  feature_settings:      'Settings',
};
const ALL_FEATURES = Object.keys(FEATURE_LABELS);

// ─── Section 5 — Roles & Permissions ────────────────────────────────────────
function RolesSection() {
  const { auth, setAuth } = useAuth();
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const [roles,        setRoles]        = useState(() => JSON.parse(JSON.stringify(auth.portalConfig?.portal_roles || {})));
  const [saving,       setSaving]       = useState(false);
  const [addingRole,   setAddingRole]   = useState(false);
  const [newRoleName,  setNewRoleName]  = useState('');

  const saved    = useRef(JSON.stringify(auth.portalConfig?.portal_roles || {}));
  const isDirty  = JSON.stringify(roles) !== saved.current;
  // Admin always first; remaining roles in insertion order (first added → first displayed)
  const roleKeys = ['admin', ...Object.keys(roles).filter(k => k !== 'admin')];

  const handleToggle = (role, feature) => {
    if (role === 'admin' && feature === 'feature_settings') return;
    setRoles(prev => {
      const perms = prev[role] || [];
      const next  = perms.includes(feature) ? perms.filter(f => f !== feature) : [...perms, feature];
      return { ...prev, [role]: next };
    });
  };

  const handleAddRole = () => {
    const key = newRoleName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key)       { showToast('Enter a role name', 'warning'); return; }
    if (roles[key]) { showToast('Role already exists', 'warning'); return; }
    setRoles(prev => ({ ...prev, [key]: [] }));
    setAddingRole(false);
    setNewRoleName('');
  };

  const handleDeleteRole = role => {
    if (role === 'admin') { showToast('Cannot delete the admin role', 'warning'); return; }
    if (roleKeys.length <= 1) { showToast('At least one role is required', 'warning'); return; }
    setRoles(prev => { const n = { ...prev }; delete n[role]; return n; });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await gateway.invoke('portalSaveSettings', { section: 'portal_roles', portal_roles: roles });
      if (result.status === 'success') {
        showToast('Roles & permissions saved', 'success');
        saved.current = JSON.stringify(roles);
        setAuth(prev => ({ ...prev, portalConfig: { ...prev.portalConfig, portal_roles: { ...roles } } }));
      } else {
        showToast(result.message || 'Save failed', 'error');
      }
    } finally { setSaving(false); }
  };

  const saveDisabled = saving || !isDirty;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 12,
    }}>
      {/* Card header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-raised)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Roles &amp; Permissions
        </span>
      </div>

      {/* Matrix table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
              {/* Feature column — sticky left */}
              <th style={{ padding: '10px 16px', textAlign: 'left', width: '30%', position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface-raised)' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Feature
                </span>
              </th>

              {/* Role columns */}
              {roleKeys.map(role => (
                <th key={role} style={{ padding: '10px 16px', textAlign: 'center', minWidth: 110 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
                      textTransform: 'capitalize',
                    }}>
                      {role.replace(/_/g, ' ')}
                    </span>
                    {role !== 'admin' && (
                      <button
                        onClick={() => handleDeleteRole(role)}
                        style={{
                          fontSize: 10, color: '#DC2626', background: 'none', border: 'none',
                          cursor: 'pointer', fontFamily: 'inherit',
                          padding: '2px 7px', borderRadius: 5, transition: 'background 120ms',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        Remove
                      </button>
                    )}
                    {role === 'admin' && (
                      <span style={{ fontSize: 9.5, color: 'var(--text-muted)', padding: '2px 7px' }}>Protected</span>
                    )}
                  </div>
                </th>
              ))}

              {/* Add role column */}
              <th style={{ padding: '10px 16px', textAlign: 'center', minWidth: 120 }}>
                {addingRole ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
                    <input
                      autoFocus
                      type="text"
                      value={newRoleName}
                      onChange={e => setNewRoleName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  handleAddRole();
                        if (e.key === 'Escape') { setAddingRole(false); setNewRoleName(''); }
                      }}
                      placeholder="Role name"
                      style={{
                        width: 90, border: '1px solid var(--border)', borderRadius: 6,
                        padding: '5px 8px', fontSize: 11.5, textAlign: 'center',
                        background: 'var(--surface)', color: 'var(--text-primary)',
                        outline: 'none', fontFamily: 'inherit',
                      }}
                      onFocus={e => e.target.style.borderColor = ACCENT}
                      onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                    />
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button
                        onClick={handleAddRole}
                        style={{
                          padding: '4px 10px', background: ACCENT, color: '#fff',
                          border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Create
                      </button>
                      <button
                        onClick={() => { setAddingRole(false); setNewRoleName(''); }}
                        style={{
                          padding: '4px 8px', background: 'none',
                          border: '1px solid var(--border)', borderRadius: 5,
                          fontSize: 11, color: 'var(--text-secondary)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingRole(true)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11.5, fontWeight: 600, color: ACCENT,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', padding: '4px 10px', borderRadius: 6,
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = ACCENT_BG}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Add role
                  </button>
                )}
              </th>
            </tr>
          </thead>

          <tbody>
            {ALL_FEATURES.map((featureKey, fi) => (
              <tr key={featureKey} style={{ borderBottom: fi < ALL_FEATURES.length - 1 ? '1px solid var(--border)' : 'none' }}>
                {/* Feature label — sticky left */}
                <td style={{ padding: '12px 16px', position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {FEATURE_LABELS[featureKey]}
                  </span>
                </td>

                {/* Checkboxes */}
                {roleKeys.map(role => {
                  const locked  = role === 'admin' && featureKey === 'feature_settings';
                  const checked = (roles[role] || []).includes(featureKey);
                  return (
                    <td key={role} style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleToggle(role, featureKey)}
                          title={locked ? 'Admin always has Settings access' : undefined}
                          style={{
                            width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                            border: `2px solid ${checked ? ACCENT : 'var(--border-strong)'}`,
                            background: checked ? ACCENT : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: locked ? 'not-allowed' : 'pointer',
                            opacity: locked ? 0.45 : 1,
                            transition: 'background 150ms, border-color 150ms',
                          }}
                          onMouseEnter={e => { if (!locked && !checked) e.currentTarget.style.borderColor = ACCENT; }}
                          onMouseLeave={e => { if (!locked && !checked) e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                        >
                          {checked && (
                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  );
                })}

                {/* Empty cell under add-role column */}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={handleSave}
          disabled={saveDisabled}
          style={{
            width: '100%', padding: '9px 16px',
            background: saveDisabled ? 'var(--surface-inset)' : GRAPHITE,
            color: saveDisabled ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 8,
            fontSize: 12.5, fontWeight: 600,
            cursor: saveDisabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'inherit', transition: 'background 120ms',
          }}
          onMouseEnter={e => { if (!saveDisabled) e.currentTarget.style.background = GRAPHITE_H; }}
          onMouseLeave={e => { if (!saveDisabled) e.currentTarget.style.background = GRAPHITE; }}
        >
          {saving && (
            <div style={{
              width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff', borderRadius: '50%',
              animation: 'orca-spin 0.7s linear infinite',
            }} />
          )}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Settings ───────────────────────────────────────────────────────────
export default function Settings() {
  const { auth } = useAuth();

  if (auth.role !== 'admin') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '64px 24px', textAlign: 'center', gap: 10,
      }}>
        <svg width="36" height="36" fill="none" viewBox="0 0 24 24"
          stroke="var(--border-strong)" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Admin access required</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
        Settings
      </h1>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SocialInsuranceSection />
          <PortalUsersSection />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PortalConfigSection />
          <AttendanceSection />
        </div>
      </div>
      <RolesSection />
    </div>
  );
}
