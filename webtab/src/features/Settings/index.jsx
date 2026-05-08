import { useState } from 'react';
import { useAuth, useToast } from '../../context/AuthContext';
import { useGateway }        from '../../hooks/useGateway';

// ─── Constants ─────────────────────────────────────────────────────────────
const ACCENT       = '#6366F1';
const ACCENT_BG    = '#EEF2FF';
const ACCENT_TEXT  = '#3730A3';
const GRAPHITE     = '#111827';
const GRAPHITE_H   = '#1F2937';

// ─── Base components ────────────────────────────────────────────────────────

function SectionCard({ title, children, onSave, saving, badge }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 12,
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
            disabled={saving}
            style={{
              width: '100%', padding: '9px 16px',
              background: saving ? 'var(--surface-inset)' : GRAPHITE,
              color: saving ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 12.5, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit', transition: 'background 120ms',
            }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = GRAPHITE_H; }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.background = GRAPHITE; }}
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

function FormulaHint({ text }) {
  return (
    <div style={{
      margin: '0 16px 10px',
      padding: '7px 10px',
      background: 'var(--surface-raised)',
      border: '1px solid var(--border)',
      borderRadius: 6, fontSize: 10.5,
      color: 'var(--text-muted)',
      fontFamily: 'monospace', lineHeight: 1.6,
    }}>
      {text}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--surface-inset)', margin: '2px 0' }} />;
}

// ─── Section 1 — Payroll Run ────────────────────────────────────────────────
function PayrollRunSection() {
  const { auth, setAuth } = useAuth();
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const pr0 = auth.payrollSettings?.payroll_run || {};
  const [scope,     setScope]     = useState(pr0.scope     || 'all');
  const [dept,      setDept]      = useState(pr0.department || '');
  const [empIds,    setEmpIds]    = useState((pr0.selected_employees || []).join(', '));
  const [saving,    setSaving]    = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const selected_employees = scope === 'by_employee'
        ? empIds.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const result = await gateway.invoke('portalSaveSettings', {
        section: 'payroll_run',
        scope,
        department:         scope === 'by_department' ? dept : null,
        selected_employees,
      });
      if (result.status === 'success') {
        showToast('Payroll run settings saved', 'success');
        setAuth(prev => ({
          ...prev,
          payrollSettings: {
            ...prev.payrollSettings,
            payroll_run: { scope, department: dept || null, selected_employees },
          },
        }));
      } else {
        showToast(result.message || 'Save failed', 'error');
      }
    } finally { setSaving(false); }
  };

  return (
    <SectionCard title="Payroll Run" onSave={handleSave} saving={saving}>
      <SettingRow label="Run scope" sub="Determines which employees are included in each payroll run">
        <SelectField
          value={scope} onChange={setScope}
          options={[
            { value: 'all',           label: 'All active employees' },
            { value: 'by_department', label: 'By department' },
            { value: 'by_employee',   label: 'Selected employees' },
          ]}
        />
      </SettingRow>

      {scope === 'by_department' && (
        <div style={{ padding: '0 16px 12px' }}>
          <label style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
            Department name
          </label>
          <input
            type="text"
            value={dept}
            onChange={e => setDept(e.target.value)}
            placeholder="e.g. Engineering"
            style={{
              width: '100%', border: '1px solid var(--border)', borderRadius: 7,
              padding: '7px 10px', fontSize: 12.5,
              background: 'var(--surface)', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit',
            }}
            onFocus={e => e.target.style.borderColor = ACCENT}
            onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      )}

      {scope === 'by_employee' && (
        <div style={{ padding: '0 16px 12px' }}>
          <label style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
            Employee IDs — comma separated
          </label>
          <textarea
            value={empIds}
            onChange={e => setEmpIds(e.target.value)}
            placeholder="EMP001, EMP002, EMP003"
            rows={3}
            style={{
              width: '100%', border: '1px solid var(--border)', borderRadius: 7,
              padding: '7px 10px', fontSize: 12.5,
              background: 'var(--surface)', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'monospace', resize: 'vertical',
            }}
            onFocus={e => e.target.style.borderColor = ACCENT}
            onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          />
          <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 5 }}>
            Selection clears automatically after a successful run.
          </p>
        </div>
      )}

      <div style={{
        margin: '4px 16px 8px',
        padding: '8px 12px',
        background: 'var(--surface-inset)',
        borderRadius: 7, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5,
      }}>
        Termination runs are always processed through the payroll queue — no immediate mode.
      </div>
    </SectionCard>
  );
}

// ─── Section 2 — Attendance ─────────────────────────────────────────────────
function AttendanceSection() {
  const { auth, setAuth } = useAuth();
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const att0 = auth.payrollSettings?.attendance || {};

  const [wdDefault,    setWdDefault]    = useState(att0.working_days_default ?? 22);
  const [absEn,        setAbsEn]        = useState(att0.absence?.enabled        ?? true);
  const [absMul,       setAbsMul]       = useState(att0.absence?.multiplier     ?? 1.0);
  const [ulEn,         setUlEn]         = useState(att0.unpaid_leave?.enabled   ?? true);
  const [ulMul,        setUlMul]        = useState(att0.unpaid_leave?.multiplier ?? 1.0);
  const [lateEn,       setLateEn]       = useState(att0.late_deduction?.enabled      ?? true);
  const [lateGrace,    setLateGrace]    = useState(att0.late_deduction?.grace_minutes ?? 0);
  const [lateMul,      setLateMul]      = useState(att0.late_deduction?.multiplier    ?? 1.0);
  const [otEn,         setOtEn]         = useState(att0.overtime?.enabled       ?? true);
  const [otMul,        setOtMul]        = useState(att0.overtime?.multiplier    ?? 1.5);
  const [phEn,         setPhEn]         = useState(att0.public_holiday?.enabled  ?? true);
  const [phIfWorked,   setPhIfWorked]   = useState(att0.public_holiday?.if_worked ?? 'overtime_rate');
  const [saving,       setSaving]       = useState(false);

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
      const result = await gateway.invoke('portalSaveSettings', {
        section: 'attendance',
        ...newAtt,
      });
      if (result.status === 'success') {
        showToast('Attendance settings saved', 'success');
        setAuth(prev => ({
          ...prev,
          payrollSettings: { ...prev.payrollSettings, attendance: newAtt },
        }));
      } else {
        showToast(result.message || 'Save failed', 'error');
      }
    } finally { setSaving(false); }
  };

  return (
    <SectionCard title="Attendance" onSave={handleSave} saving={saving}>

      {/* Default working days */}
      <SettingRow
        label="Default working days"
        sub="Fallback value if working days are not set on the monthly payroll setup"
      >
        <NumberInput value={wdDefault} onChange={setWdDefault} min={1} max={30} step={1} width={60} />
      </SettingRow>

      <Divider />

      {/* Absence */}
      <SettingRow label="Absence deduction" sub="Deduct for unexcused absent days">
        <Toggle value={absEn} onChange={setAbsEn} />
      </SettingRow>
      {absEn && (
        <>
          <SettingRow label="Absence multiplier" sub="Applied to daily rate per absent day">
            <NumberInput value={absMul} onChange={setAbsMul} min={1.0} max={5.0} step={0.25} width={72} />
          </SettingRow>
          <FormulaHint text={`Deduction = (Gross ÷ Working days) × Absent days × ${absMul.toFixed(2)}`} />
        </>
      )}

      <Divider />

      {/* Unpaid leave */}
      <SettingRow label="Unpaid leave deduction" sub="Deduct for HR-approved unpaid leave days">
        <Toggle value={ulEn} onChange={setUlEn} />
      </SettingRow>
      {ulEn && (
        <>
          <SettingRow label="Unpaid leave multiplier" sub="Applied to daily rate per unpaid leave day">
            <NumberInput value={ulMul} onChange={setUlMul} min={1.0} max={5.0} step={0.25} width={72} />
          </SettingRow>
          <FormulaHint text={`Deduction = (Gross ÷ Working days) × Unpaid days × ${ulMul.toFixed(2)}`} />
        </>
      )}

      <Divider />

      {/* Late deduction */}
      <SettingRow label="Late deduction" sub="Deduct for accumulated late minutes">
        <Toggle value={lateEn} onChange={setLateEn} />
      </SettingRow>
      {lateEn && (
        <>
          <SettingRow
            label="Grace period"
            sub="Monthly late minutes before deduction starts (0 = every minute counted)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <NumberInput value={lateGrace} onChange={setLateGrace} min={0} max={480} step={5} width={60} />
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>mins</span>
            </div>
          </SettingRow>
          <SettingRow label="Late multiplier" sub="Applied to per-minute rate after grace period">
            <NumberInput value={lateMul} onChange={setLateMul} min={1.0} max={5.0} step={0.25} width={72} />
          </SettingRow>
          <FormulaHint text={
            `Minute rate = (Gross ÷ Working days ÷ 8) ÷ 60\n` +
            `Effective mins = max(Total late mins − ${lateGrace}, 0)\n` +
            `Deduction = Minute rate × Effective mins × ${lateMul.toFixed(2)}`
          } />
          <div style={{
            margin: '0 16px 10px',
            padding: '6px 10px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.20)',
            borderRadius: 6, fontSize: 10.5, color: '#B45309',
          }}>
            ⚠ Grace period and multiplier are saved to the org variable but not yet active in the engine. See PENDING_CONFIG.md items PC-03 and PC-04.
          </div>
        </>
      )}

      <Divider />

      {/* Overtime */}
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

      {/* Public holiday */}
      <SettingRow label="Public holiday pay" sub="Extra pay when employees work on public holidays">
        <Toggle value={phEn} onChange={setPhEn} />
      </SettingRow>
      {phEn && (
        <>
          <SettingRow label="If worked, pay at" sub="Rate applied to days worked on public holidays">
            <SelectField
              value={phIfWorked}
              onChange={setPhIfWorked}
              options={[
                { value: 'overtime_rate', label: 'Overtime rate (uses multiplier above)' },
                { value: 'double_rate',   label: 'Double rate (2×)' },
                { value: 'paid_day',      label: 'No extra pay (paid day off treated as normal)' },
              ]}
            />
          </SettingRow>
          {phIfWorked === 'overtime_rate' && (
            <div style={{
              margin: '0 16px 10px', padding: '6px 10px',
              background: ACCENT_BG, border: '1px solid var(--accent-border)',
              borderRadius: 6, fontSize: 10.5, color: ACCENT_TEXT,
            }}>
              Uses overtime multiplier ({otEn ? `${otMul}×` : 'overtime disabled — enable above'})
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ─── Section 3 — Social Insurance ──────────────────────────────────────────
function SocialInsuranceSection() {
  const { auth, setAuth } = useAuth();
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const si0 = auth.payrollSettings?.social_insurance || {};
  const [ceiling,  setCeiling]  = useState(si0.monthly_ceiling ?? 9400);
  const [saving,   setSaving]   = useState(false);

  // Warning: show if ceiling_updated is before the current calendar year
  const ceilingYear    = si0.ceiling_updated ? new Date(si0.ceiling_updated).getFullYear() : 0;
  const currentYear    = new Date().getFullYear();
  const showWarning    = ceilingYear < currentYear;
  const fmtDate        = si0.ceiling_updated
    ? new Date(si0.ceiling_updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await gateway.invoke('portalSaveSettings', {
        section:         'social_insurance',
        monthly_ceiling: ceiling,
      });
      if (result.status === 'success') {
        const today = new Date().toISOString().split('T')[0];
        showToast('Social insurance settings saved', 'success');
        setAuth(prev => ({
          ...prev,
          payrollSettings: {
            ...prev.payrollSettings,
            social_insurance: {
              ...prev.payrollSettings.social_insurance,
              monthly_ceiling: ceiling,
              ceiling_updated: today,
            },
          },
        }));
      } else {
        showToast(result.message || 'Save failed', 'error');
      }
    } finally { setSaving(false); }
  };

  const badge = showWarning ? (
    <span style={{
      background: 'rgba(245,158,11,0.12)',
      border: '1px solid rgba(245,158,11,0.30)',
      color: '#B45309',
      fontSize: 10, fontWeight: 600,
      padding: '2px 8px', borderRadius: 99,
    }}>
      ⚠ Verify against current GOSI ceiling
    </span>
  ) : null;

  return (
    <SectionCard title="Social Insurance" onSave={handleSave} saving={saving} badge={badge}>

      {showWarning && (
        <div style={{
          margin: '8px 16px 0',
          padding: '8px 12px',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.20)',
          borderRadius: 7, fontSize: 11.5, color: '#B45309', lineHeight: 1.5,
        }}>
          The monthly SI ceiling was last updated in {ceilingYear}. Update it every January per the GOSI announcement to ensure correct deductions.
        </div>
      )}

      <SettingRow label="Monthly SI ceiling" sub="Maximum insurable wage per month (EGP) — update every January">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>EGP</span>
          <NumberInput value={ceiling} onChange={setCeiling} min={1000} max={99999} step={100} width={90} />
        </div>
      </SettingRow>

      <SettingRow label="Ceiling last updated" sub="Auto-stamped when you save this section">
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{fmtDate}</span>
      </SettingRow>

      <Divider />

      <SettingRow label="Employee SI rate" sub="Fixed by Egyptian Law 148/2019 — not configurable">
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
          background: 'var(--surface-inset)', padding: '3px 10px', borderRadius: 6,
        }}>11%</span>
      </SettingRow>
      <SettingRow label="Employer SI rate" sub="Fixed by Egyptian Law 148/2019 — not configurable">
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
          background: 'var(--surface-inset)', padding: '3px 10px', borderRadius: 6,
        }}>18.75%</span>
      </SettingRow>
      <SettingRow label="Martyrs' Fund rate" sub="Legal Entities only — fixed by law" last>
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
          background: 'var(--surface-inset)', padding: '3px 10px', borderRadius: 6,
        }}>0.05%</span>
      </SettingRow>
    </SectionCard>
  );
}

// ─── Section 4 — Portal Configuration ──────────────────────────────────────
function PortalConfigSection() {
  const { auth, setAuth } = useAuth();
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const pc0 = auth.portalConfig || {};
  const [holidaySrc,    setHolidaySrc]    = useState(pc0.default_holiday_source      || 'zoho');
  const [allowOverride, setAllowOverride] = useState(pc0.allow_working_days_override ?? false);
  const [saving,        setSaving]        = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await gateway.invoke('portalSaveSettings', {
        section:                     'portal_config',
        default_holiday_source:      holidaySrc,
        allow_working_days_override: allowOverride,
      });
      if (result.status === 'success') {
        showToast('Portal configuration saved', 'success');
        setAuth(prev => ({
          ...prev,
          portalConfig: {
            ...prev.portalConfig,
            default_holiday_source:      holidaySrc,
            allow_working_days_override: allowOverride,
          },
        }));
      } else {
        showToast(result.message || 'Save failed', 'error');
      }
    } finally { setSaving(false); }
  };

  return (
    <SectionCard title="Portal Configuration" onSave={handleSave} saving={saving}>
      <SettingRow label="Holiday source" sub="How public holidays are fetched when creating a payroll setup">
        <SelectField
          value={holidaySrc}
          onChange={setHolidaySrc}
          options={[
            { value: 'zoho',   label: 'Zoho People — fetch from holiday calendar' },
            { value: 'manual', label: 'Manual — HR enters holidays directly' },
          ]}
        />
      </SettingRow>
      <SettingRow
        label="Allow working days override"
        sub="Shows an override field on the payroll setup review step"
        last
      >
        <Toggle value={allowOverride} onChange={setAllowOverride} />
      </SettingRow>
    </SectionCard>
  );
}

// ─── Section 5 — Portal Users ───────────────────────────────────────────────
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
      // Bug #1 fix — calls portalAddPortalUser, not portalSaveSettings
      const result = await gateway.invoke('portalAddPortalUser', {
        employee_id: empId,
        role:        newRole,
      });
      if (result.status === 'success') {
        setPortalUsers(result.portal_users);
        setNewEmpId('');
        showToast(`${empId} added as ${newRole}`, 'success');
      } else {
        showToast(result.message || 'Add failed', 'error');
      }
    } finally { setAdding(false); }
  };

  const handleRemove = async (userId) => {
    if (userId === auth.employeeId) {
      showToast('You cannot remove yourself', 'warning');
      return;
    }
    // Bug #1 fix — calls portalRemovePortalUser, not portalSaveSettings
    const result = await gateway.invoke('portalRemovePortalUser', { employee_id: userId });
    if (result.status === 'success') {
      setPortalUsers(result.portal_users);
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
      {/* User list */}
      {Object.keys(portalUsers).length === 0 ? (
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No users configured</p>
        </div>
      ) : (
        Object.entries(portalUsers).map(([uid, role]) => {
          const rc    = roleColors[role] || { bg: 'var(--surface-inset)', color: 'var(--text-secondary)' };
          const isSelf = uid === auth.employeeId;
          const initials = uid.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'U';
          return (
            <div key={uid} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: ACCENT_BG, border: `1px solid var(--accent-border)`,
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

      {/* Add user form */}
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
              outline: 'none', fontFamily: 'monospace',
              textTransform: 'uppercase',
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
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'orca-spin 0.7s linear infinite',
            }} />
          )}
          {adding ? 'Adding…' : 'Add user'}
        </button>
      </div>
    </SectionCard>
  );
}

// ─── Main Settings ───────────────────────────────────────────────────────────
export default function Settings() {
  const { auth } = useAuth();

  // Access guard — only admins see Settings
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
    <>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Settings
        </h1>
        <PayrollRunSection />
        <AttendanceSection />
        <SocialInsuranceSection />
        <PortalConfigSection />
        <PortalUsersSection />
      </div>
    </>
  );
}
