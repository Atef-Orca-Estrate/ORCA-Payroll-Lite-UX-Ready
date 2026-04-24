import { useState } from 'react';
import { useAuth, useToast } from '../../context/AuthContext';
import { useGateway }        from '../../hooks/useGateway';

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label, sub }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

// ─── Select field ─────────────────────────────────────────────────────────────
function SelectField({ label, value, onChange, options }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, children, onSave, saving }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="px-4 py-1">{children}</div>
      <div className="px-4 py-3 border-t border-gray-100">
        <button
          onClick={onSave}
          disabled={saving}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── User row ────────────────────────────────────────────────────────────────
function UserRow({ userId, role, onRemove }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
          {userId.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800 font-mono">{userId}</p>
          <p className="text-xs text-gray-400 capitalize">{role}</p>
        </div>
      </div>
      <button
        onClick={() => onRemove(userId)}
        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
      >
        Remove
      </button>
    </div>
  );
}

// ─── Main Settings component ─────────────────────────────────────────────────
export default function Settings() {
  const { auth, setAuth } = useAuth();
  const gateway = useGateway();
  const { show: showToast } = useToast();

  // ── Payroll settings state ────────────────────────────────────────────────
  const ps0 = auth.payrollSettings || {};
  const [applyInsurance,  setApplyInsurance]  = useState(ps0.apply_insurance ?? true);
  const [entityType,      setEntityType]      = useState(ps0.entity_type || 'Legal Entity');
  const [applyTax,        setApplyTax]        = useState(ps0.apply_tax ?? true);
  const [scope,           setScope]           = useState(ps0.scope || 'all');
  const [savingPS,        setSavingPS]        = useState(false);

  // ── Portal config state ───────────────────────────────────────────────────
  const pc0 = auth.portalConfig || {};
  const [holidaySource,   setHolidaySource]  = useState(pc0.default_holiday_source || 'zoho');
  const [allowOverride,   setAllowOverride]  = useState(pc0.allow_working_days_override ?? false);
  const [savingPC,        setSavingPC]       = useState(false);

  // ── User management state ─────────────────────────────────────────────────
  const [users,     setUsers]     = useState(auth.payrollSettings ? {} : {}); // loaded from gateway mock
  const [newEmpId,  setNewEmpId]  = useState('');
  const [newRole,   setNewRole]   = useState('manager');
  const [savingUser,setSavingUser]= useState(false);

  // Initialize users from settings data (stored in useGateway mock)
  // In production this comes from portalGetSettings → portal_users
  const [portalUsers, setPortalUsers] = useState(
    { EMP001: 'admin', EMP002: 'manager' } // seeded from mock
  );

  // ── Save payroll settings ─────────────────────────────────────────────────
  const savePayrollSettings = async () => {
    setSavingPS(true);
    try {
      const result = await gateway.invoke('portalSaveSettings', {
        section:            'payroll_settings',
        apply_insurance:    applyInsurance,
        entity_type:        entityType,
        apply_tax:          applyTax,
        scope,
        selected_department: ''
      });
      if (result.status === 'success') {
        showToast('Payroll settings saved');
        setAuth(prev => ({ ...prev, payrollSettings: { ...prev.payrollSettings, apply_insurance: applyInsurance, entity_type: entityType, apply_tax: applyTax, scope } }));
      } else showToast(result.message || 'Save failed', 'error');
    } finally { setSavingPS(false); }
  };

  // ── Save portal config ────────────────────────────────────────────────────
  const savePortalConfig = async () => {
    setSavingPC(true);
    try {
      const result = await gateway.invoke('portalSaveSettings', {
        section:                    'portal_config',
        default_holiday_source:     holidaySource,
        allow_working_days_override: allowOverride
      });
      if (result.status === 'success') {
        showToast('Portal config saved');
        setAuth(prev => ({ ...prev, portalConfig: { ...prev.portalConfig, default_holiday_source: holidaySource, allow_working_days_override: allowOverride } }));
      } else showToast(result.message || 'Save failed', 'error');
    } finally { setSavingPC(false); }
  };

  // ── Add user ─────────────────────────────────────────────────────────────
  const addUser = async () => {
    if (!newEmpId.trim()) { showToast('Enter an employee ID', 'warning'); return; }
    setSavingUser(true);
    try {
      const result = await gateway.invoke('portalSaveSettings', {
        section: 'portal_users',
        user_id: newEmpId.trim(),
        role:    newRole
      });
      if (result.status === 'success') {
        setPortalUsers(prev => ({ ...prev, [newEmpId.trim()]: newRole }));
        setNewEmpId('');
        showToast(`User ${newEmpId.trim()} added as ${newRole}`);
      } else showToast(result.message || 'Add failed', 'error');
    } finally { setSavingUser(false); }
  };

  // ── Remove user ──────────────────────────────────────────────────────────
  const removeUser = async (userId) => {
    if (userId === auth.employeeId) { showToast('Cannot remove yourself', 'warning'); return; }
    try {
      const result = await gateway.invoke('portalSaveSettings', {
        section: 'portal_users',
        user_id: userId,
        role:    ''
      });
      if (result.status === 'success') {
        setPortalUsers(prev => { const n = { ...prev }; delete n[userId]; return n; });
        showToast(`User ${userId} removed`);
      } else showToast(result.message || 'Remove failed', 'error');
    } catch { showToast('Remove failed', 'error'); }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-5">Settings</h1>

      {/* Payroll Settings */}
      <Section title="Payroll Settings" onSave={savePayrollSettings} saving={savingPS}>
        <Toggle
          value={applyInsurance}
          onChange={setApplyInsurance}
          label="Apply Social Insurance"
          sub="Applies SI deductions to all employees"
        />
        <Toggle
          value={applyTax}
          onChange={setApplyTax}
          label="Apply Income Tax"
          sub="Applies income tax withholding to all employees"
        />
        <SelectField
          label="Entity type"
          value={entityType}
          onChange={setEntityType}
          options={[
            { value: 'Legal Entity',       label: 'Legal Entity — Martyrs Fund applies' },
            { value: 'Sole Proprietorship', label: 'Sole Proprietorship — no Martyrs Fund' }
          ]}
        />
        <SelectField
          label="Run scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all',           label: 'All active employees' },
            { value: 'by_department', label: 'By department' },
            { value: 'by_employee',   label: 'Selected employees' }
          ]}
        />
      </Section>

      {/* Portal Config */}
      <Section title="Portal Configuration" onSave={savePortalConfig} saving={savingPC}>
        <SelectField
          label="Holiday source"
          value={holidaySource}
          onChange={setHolidaySource}
          options={[
            { value: 'zoho',   label: 'Zoho People — fetch from holiday calendar' },
            { value: 'manual', label: 'Manual — HR enters holidays in web tab' }
          ]}
        />
        <Toggle
          value={allowOverride}
          onChange={setAllowOverride}
          label="Allow working days override"
          sub="Shows override button on MPS review screen"
        />
      </Section>

      {/* User Management */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Portal Users</h2>
        </div>
        <div className="px-4 py-1">
          {Object.entries(portalUsers).map(([uid, role]) => (
            <UserRow key={uid} userId={uid} role={role} onRemove={removeUser} />
          ))}
        </div>
        {/* Add user form */}
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          <p className="text-xs font-medium text-gray-600">Add user</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Employee ID"
              value={newEmpId}
              onChange={e => setNewEmpId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <button
            onClick={addUser}
            disabled={savingUser}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {savingUser && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {savingUser ? 'Adding…' : 'Add User'}
          </button>
        </div>
      </div>
    </div>
  );
}
