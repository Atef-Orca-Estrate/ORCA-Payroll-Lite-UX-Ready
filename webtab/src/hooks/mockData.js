/**
 * mockData.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central mock data store for all gateway functions.
 * Used exclusively when DEV_MODE = true in useGateway.js.
 *
 * RULES:
 *  - Real API call code in useGateway.js is NEVER removed — only bypassed.
 *  - This file is the single source of truth for all mock responses.
 *  - Each function key matches exactly the function name passed to gateway.invoke().
 *  - Error simulations are clearly marked with // ERROR SIMULATION comments.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Internal state (persists within a browser session) ──────────────────────
// Tracks created MPS periods so portalCreateMPS can simulate duplicate errors.
let _createdPeriods = new Set(['2026-04', '2026-03', '2026-02', '2026-01', '2025-12']);

// Tracks trigger attempts so portalTriggerOrchestrator can simulate one failure.
let _triggerAttempts = {};

// Tracks portal users so portalAddPortalUser can simulate duplicate errors.
let _portalUsers = { EMP001: 'admin', EMP002: 'manager' };

// Counter for generating unique run IDs within a session.
let _runSeqCounter = 0;

// Tracks portal roles so role saves persist within a browser session.
let _portalRoles = {
  admin:   ['feature_dashboard', 'feature_run_payroll', 'feature_queue_monitor', 'feature_reports', 'feature_settings', 'feature_employees'],
  manager: ['feature_dashboard', 'feature_run_payroll', 'feature_queue_monitor', 'feature_reports', 'feature_employees'],
};

// Tracks per-employee exclusion overrides within a session.
let _employeeOverrides = {};

// ── Session run state — enables full end-to-end cycle for new periods ─────────
// Populated by portalCreateMPS + portalTriggerOrchestrator.
// Read by portalListRuns + portalGetQueueStatus + portalGetPayrollRecords.
//
// Shape per entry:
//   { period, status, working_days, employees, batches,
//     done, error, pending, holidays, gross, net, tax, si,
//     pollCount }   ← pollCount drives simulated Processing→Completed transition
let _sessionRuns = {};

// Build mock employee records for a session run (2 batches of 5)
function _buildSessionRecords(period, pollCount) {
  const doneCount = Math.min(10, pollCount * 3 + 3);
  const records = [];
  for (let i = 1; i <= 10; i++) {
    const batchNum  = i <= 5 ? 1 : 2;
    const empId     = `SES${String(i).padStart(3, '0')}`;
    const isDone    = i <= doneCount;
    const isActive  = !isDone && i === doneCount + 1;
    records.push({
      employee_id:  empId,
      status:       isDone ? 'Done' : isActive ? 'Processing' : 'Pending',
      batch_number: batchNum,
      processed_at: isDone ? `09:${String(14 + i).padStart(2, '0')}` : '',
      error:        '',
    });
  }
  return records;
}

// Build mock payroll records for a completed session run
function _buildSessionPayrollRecords(period) {
  return Array.from({ length: 10 }, (_, i) => ({
    employee_id:               `SES${String(i + 1).padStart(3, '0')}`,
    status:                    'Done',
    pr_basic_salary:           25000 + i * 1000,
    pr_total_allowances:       8000,
    pr_gross_salary:           33000 + i * 1000,
    pr_employee_si_deduction:  2750,
    pr_martyrs_fund:           16.5,
    pr_absence_deduction:      0,
    pr_unpaid_leave_deduction: 0,
    pr_late_deduction:         0,
    pr_total_deductions:       5100,
    pr_net_salary:             27900 + i * 1000,
    pr_monthly_tax_withheld:   2200,
    pr_ytd_tax_withheld:       6600,
    error:                     '',
  }));
}


// ─────────────────────────────────────────────────────────────────────────────
// MOCK RESPONSES
// Each export is a function that receives the call params and returns a response
// object matching what the real Deluge gateway function would return.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * portalGetSettings
 * Returns org-level payroll configuration and portal user map.
 */
export function mock_portalGetSettings() {
  return {
    status: 'success',
    payroll_settings: {
      payroll_run: {
        scope:               'all',
        selected_department: '',
        selected_employees:  [],
      },
      attendance: {
        working_days_default: 22,
        absence:        { enabled: true,  multiplier: 1.0 },
        unpaid_leave:   { enabled: true,  multiplier: 1.0 },
        late_deduction: { enabled: true,  grace_minutes: 0, multiplier: 1.0 },
        overtime:       { enabled: true,  multiplier: 1.5 },
        public_holiday: { enabled: true,  if_worked: 'overtime_rate' },
      },
      social_insurance: {
        monthly_ceiling:   9400,
        employee_rate:     0.11,
        employer_rate:     0.1875,
        martyrs_fund_rate: 0.0005,
        ceiling_updated:   '2024-01-01',
      },
    },
    portal_config: {
      portal_users:                _portalUsers,
      portal_roles: _portalRoles,
      default_holiday_source:      'zoho',
      allow_working_days_override: true,
      allow_multiple_runs:         false,
    },
  };
}

/**
 * portalListRuns
 * Returns all MPS records — period, status, progress counters, and
 * financial totals for completed runs (used by Step 4 wizard card).
 * Includes any runs created during this browser session.
 */
export function mock_portalListRuns() {
  const sessionList = Object.values(_sessionRuns)
    .sort((a, b) => b.period.localeCompare(a.period))
    .map(r => ({ ...r }));
  return {
    status: 'success',
    runs: [...sessionList, ..._staticRuns],
  };
}

/**
 * portalGetQueueStatus
 * Returns MPS status and per-queue progress for a given period.
 * Used by QueueMonitor and RunPayroll polling.
 *
 * Session-created periods: polls drive Processing→Completed transition.
 *   pollCount 0–1 → Processing (partial progress)
 *   pollCount 2   → Processing (near complete)
 *   pollCount 3+  → Completed
 */
export function mock_portalGetQueueStatus({ payroll_period, run_id } = {}) {

  // ── Session run — only match when no run_id provided or run_id matches ────
  if (_sessionRuns[payroll_period]) {
    const run = _sessionRuns[payroll_period];
    if (!run_id || run_id === run.run_id) {

      if (run.status === 'Draft') {
        return {
          status: 'success', run_id: run.run_id, mps_status: 'Draft', mps_working_days: run.working_days,
          progress: { total: 0, done: 0, error: 0, pending: 0, processing: 0 },
          regular_run:     { summary: { total: 0, done: 0, error: 0, pending: 0 }, records: [] },
          termination_run: { summary: { total: 0, done: 0, error: 0, pending: 0 }, records: [] },
        };
      }

      if (run.status === 'Processing') {
        run.pollCount = (run.pollCount || 0) + 1;
        if (run.pollCount >= 3) {
          run.status  = 'Completed';
          run.done    = 10; run.pending = 0; run.error = 0;
          run.gross   = 330000; run.net = 270900; run.tax = 22000; run.si = 27500;
        } else {
          const doneCount = Math.min(9, run.pollCount * 3 + 3);
          run.done    = doneCount;
          run.pending = Math.max(0, 10 - doneCount - 1);
          run.error   = 0;
        }
      }

      if (run.status === 'Completed') {
        const completedRecords = _buildSessionRecords(payroll_period, 99);
        return {
          status: 'success', run_id: run.run_id, mps_status: 'Completed', mps_working_days: run.working_days,
          progress: { total: 10, done: 10, error: 0, pending: 0, processing: 0 },
          regular_run:     { summary: { total: 10, done: 10, error: 0, pending: 0 }, records: completedRecords },
          termination_run: { summary: { total: 0,  done: 0,  error: 0, pending: 0 }, records: [] },
        };
      }

      const liveRecords = _buildSessionRecords(payroll_period, run.pollCount);
      const processing  = liveRecords.filter(r => r.status === 'Processing').length;
      const pending     = liveRecords.filter(r => r.status === 'Pending').length;
      const done        = liveRecords.filter(r => r.status === 'Done').length;
      return {
        status: 'success', run_id: run.run_id, mps_status: 'Processing', mps_working_days: run.working_days,
        progress: { total: 10, done, error: 0, pending, processing },
        regular_run:     { summary: { total: 10, done, error: 0, pending: pending + processing }, records: liveRecords },
        termination_run: { summary: { total: 0,  done: 0, error: 0, pending: 0 }, records: [] },
      };
    }
  }

  // ── Static run lookup — by run_id if provided, else first run for period ──
  const resolvedRunId = run_id || _staticRuns.find(r => r.period === payroll_period)?.run_id;
  if (!resolvedRunId) {
    return { status: 'error', code: 'no_run', message: `No payroll run found for period ${payroll_period}` };
  }
  const queueData = _staticQueueByRunId[resolvedRunId];
  if (!queueData) {
    return { status: 'error', code: 'no_run', message: `No queue data found for run ${resolvedRunId}` };
  }
  return {
    status:           'success',
    run_id:           resolvedRunId,
    mps_status:       queueData.mps_status,
    mps_working_days: queueData.mps_working_days,
    progress:         queueData.progress,
    regular_run:      _enrichRun(queueData.regular_run),
    termination_run:  _enrichRun(queueData.termination_run),
  };
}

// Employee name + department lookup — enriches payroll records at return time
const _empInfo = {
  EMP001: { employee_name: 'Ahmed Hassan',   department: 'Engineering'     },
  EMP002: { employee_name: 'Sara Mohamed',   department: 'Finance'         },
  EMP003: { employee_name: 'Omar Khalil',    department: 'Operations'      },
  EMP004: { employee_name: 'Nour Ibrahim',   department: 'Engineering'     },
  EMP005: { employee_name: 'Karim Youssef',  department: 'Sales'           },
  EMP006: { employee_name: 'Layla Mahmoud',  department: 'Human Resources' },
  EMP007: { employee_name: 'Tarek Farouk',   department: 'Engineering'     },
  EMP008: { employee_name: 'Mona Sayed',     department: 'Finance'         },
  EMP009: { employee_name: 'Yasser Nour',    department: 'Operations'      },
  EMP010: { employee_name: 'Heba Ashraf',    department: 'Marketing'       },
  EMP011: { employee_name: 'Rania Fares',    department: 'Marketing'       },
  EMP012: { employee_name: 'Sherif Hamdy',   department: 'Operations'      },
  EMP043: { employee_name: 'Mahmoud Saad',   department: 'Sales'           },
};

const _sesNames = ['Ali Mostafa','Rania Khaled','Hassan Samir','Dina Fawzy','Khaled Reda',
                   'Mariam Essam','Youssef Nabil','Salma Tarek','Amr Wael','Nadia Gamal'];
const _sesDepts = ['Engineering','Finance','Operations','Engineering','Sales',
                   'Human Resources','Engineering','Finance','Operations','Marketing'];

function _enrich(records) {
  return records.map((r, _i) => {
    const info = _empInfo[r.employee_id];
    if (info) return { ...r, ...info };
    // Session employees SES001-SES010
    const idx = parseInt(r.employee_id.replace('SES', '')) - 1;
    return {
      ...r,
      employee_name: _sesNames[idx] || r.employee_id,
      department:    _sesDepts[idx] || '',
    };
  });
}

// ─── Static run catalogue ────────────────────────────────────────────────────
// Three April 2026 runs demonstrate every scope. One run for each older period.

const _staticRuns = [
  // ── April 2026 — three runs, one per scope ─────────────────────────────────
  {
    run_id: 'RUN-2026-04-001', period: '2026-04', status: 'Completed',
    scope: 'all', selected_department: '', selected_employees: [],
    employees: 10, working_days: 22, batches: 2, done: 8, error: 2, pending: 0,
    holidays: [{ date: '2026-04-25', name: 'Sinai Liberation Day' }],
    gross: 360000, net: 295000, tax: 25000, si: 29000,
  },
  {
    run_id: 'RUN-2026-04-002', period: '2026-04', status: 'Completed',
    scope: 'by_department', selected_department: 'Engineering', selected_employees: [],
    employees: 3, working_days: 22, batches: 1, done: 3, error: 0, pending: 0,
    holidays: [{ date: '2026-04-25', name: 'Sinai Liberation Day' }],
    gross: 109500, net: 91400, tax: 7400, si: 8800,
  },
  {
    run_id: 'RUN-2026-04-003', period: '2026-04', status: 'Processing',
    scope: 'by_employee', selected_department: '', selected_employees: ['EMP001', 'EMP004', 'EMP007'],
    employees: 3, working_days: 22, batches: 1, done: 1, error: 0, pending: 2,
    holidays: [{ date: '2026-04-25', name: 'Sinai Liberation Day' }],
    gross: null, net: null, tax: null, si: null,
  },
  // ── Other periods — single run each ────────────────────────────────────────
  {
    run_id: 'RUN-2026-03-001', period: '2026-03', status: 'Completed',
    scope: 'all', selected_department: '', selected_employees: [],
    employees: 43, working_days: 21, batches: 5, done: 43, error: 0, pending: 0,
    holidays: [{ date: '2026-03-20', name: 'Spring Equinox' }],
    gross: 1820000, net: 1491000, tax: 126000, si: 145600,
  },
  {
    run_id: 'RUN-2026-02-001', period: '2026-02', status: 'Completed',
    scope: 'all', selected_department: '', selected_employees: [],
    employees: 43, working_days: 20, batches: 5, done: 43, error: 0, pending: 0,
    holidays: [],
    gross: 1800000, net: 1476000, tax: 124200, si: 144000,
  },
  {
    run_id: 'RUN-2026-01-001', period: '2026-01', status: 'Completed',
    scope: 'all', selected_department: '', selected_employees: [],
    employees: 41, working_days: 22, batches: 5, done: 40, error: 1, pending: 0,
    holidays: [{ date: '2026-01-07', name: 'Coptic Christmas' }],
    gross: 1750000, net: 1432500, tax: 121000, si: 140000,
  },
  {
    run_id: 'RUN-2025-12-001', period: '2025-12', status: 'Completed',
    scope: 'all', selected_department: '', selected_employees: [],
    employees: 41, working_days: 23, batches: 5, done: 41, error: 0, pending: 0,
    holidays: [{ date: '2025-12-25', name: 'Christmas Day' }],
    gross: 2100000, net: 1722000, tax: 145000, si: 168000,
  },
];

// ── Queue status records per run (raw — enriched at return time) ──────────────
const _staticQueueByRunId = {
  'RUN-2026-04-001': {
    mps_status: 'Completed', mps_working_days: 22,
    progress: { total: 10, done: 8, error: 2, pending: 0, processing: 0 },
    regular_run: {
      summary: { total: 10, done: 8, error: 2, pending: 0 },
      records: [
        { employee_id: 'EMP001', status: 'Done',  batch_number: 1, processed_at: '09:15', error: '' },
        { employee_id: 'EMP002', status: 'Done',  batch_number: 1, processed_at: '09:15', error: '' },
        { employee_id: 'EMP003', status: 'Done',  batch_number: 1, processed_at: '09:16', error: '' },
        { employee_id: 'EMP004', status: 'Error', batch_number: 1, processed_at: '09:16', error: 'Missing emp_basic_salary field' },
        { employee_id: 'EMP005', status: 'Error', batch_number: 1, processed_at: '09:17', error: 'Attendance API returned status 1' },
        { employee_id: 'EMP006', status: 'Done',  batch_number: 2, processed_at: '09:25', error: '' },
        { employee_id: 'EMP007', status: 'Done',  batch_number: 2, processed_at: '09:25', error: '' },
        { employee_id: 'EMP008', status: 'Done',  batch_number: 2, processed_at: '09:26', error: '' },
        { employee_id: 'EMP009', status: 'Done',  batch_number: 2, processed_at: '09:26', error: '' },
        { employee_id: 'EMP010', status: 'Done',  batch_number: 2, processed_at: '09:27', error: '' },
      ],
    },
    termination_run: { summary: { total: 0, done: 0, error: 0, pending: 0 }, records: [] },
  },
  'RUN-2026-04-002': {
    mps_status: 'Completed', mps_working_days: 22,
    progress: { total: 3, done: 3, error: 0, pending: 0, processing: 0 },
    regular_run: {
      summary: { total: 3, done: 3, error: 0, pending: 0 },
      records: [
        { employee_id: 'EMP001', status: 'Done', batch_number: 1, processed_at: '10:05', error: '' },
        { employee_id: 'EMP004', status: 'Done', batch_number: 1, processed_at: '10:06', error: '' },
        { employee_id: 'EMP007', status: 'Done', batch_number: 1, processed_at: '10:07', error: '' },
      ],
    },
    termination_run: { summary: { total: 0, done: 0, error: 0, pending: 0 }, records: [] },
  },
  'RUN-2026-04-003': {
    mps_status: 'Processing', mps_working_days: 22,
    progress: { total: 3, done: 1, error: 0, pending: 1, processing: 1 },
    regular_run: {
      summary: { total: 3, done: 1, error: 0, pending: 2 },
      records: [
        { employee_id: 'EMP001', status: 'Done',       batch_number: 1, processed_at: '11:00', error: '' },
        { employee_id: 'EMP004', status: 'Processing', batch_number: 1, processed_at: '',      error: '' },
        { employee_id: 'EMP007', status: 'Pending',    batch_number: 1, processed_at: '',      error: '' },
      ],
    },
    termination_run: { summary: { total: 0, done: 0, error: 0, pending: 0 }, records: [] },
  },
  'RUN-2026-03-001': {
    mps_status: 'Completed', mps_working_days: 21,
    progress: { total: 12, done: 11, error: 1, pending: 0, processing: 0 },
    regular_run: {
      summary: { total: 12, done: 11, error: 1, pending: 0 },
      records: [
        { employee_id: 'EMP001', status: 'Done',  batch_number: 1, processed_at: '08:40', error: '' },
        { employee_id: 'EMP002', status: 'Done',  batch_number: 1, processed_at: '08:40', error: '' },
        { employee_id: 'EMP003', status: 'Done',  batch_number: 1, processed_at: '08:41', error: '' },
        { employee_id: 'EMP004', status: 'Done',  batch_number: 1, processed_at: '08:41', error: '' },
        { employee_id: 'EMP005', status: 'Done',  batch_number: 2, processed_at: '08:50', error: '' },
        { employee_id: 'EMP006', status: 'Done',  batch_number: 2, processed_at: '08:50', error: '' },
        { employee_id: 'EMP007', status: 'Done',  batch_number: 2, processed_at: '08:51', error: '' },
        { employee_id: 'EMP008', status: 'Done',  batch_number: 2, processed_at: '08:51', error: '' },
        { employee_id: 'EMP009', status: 'Done',  batch_number: 3, processed_at: '09:00', error: '' },
        { employee_id: 'EMP010', status: 'Done',  batch_number: 3, processed_at: '09:00', error: '' },
        { employee_id: 'EMP011', status: 'Done',  batch_number: 3, processed_at: '09:01', error: '' },
        { employee_id: 'EMP012', status: 'Error', batch_number: 3, processed_at: '09:01', error: 'SI bracket calculation failed' },
      ],
    },
    termination_run: {
      summary: { total: 1, done: 1, error: 0, pending: 0 },
      records: [{ employee_id: 'EMP043', status: 'Done', batch_number: 1, processed_at: '08:45', error: '' }],
    },
  },
};

// ── Payroll records per run (raw — enriched at return time) ───────────────────
const _staticRecordsByRunId = {
  'RUN-2026-04-001': [
    { employee_id: 'EMP001', status: 'Done',  pr_basic_salary: 30000, pr_total_allowances: 11000, pr_gross_salary: 41000,  pr_employee_si_deduction: 3300,  pr_martyrs_fund: 20.5, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 0,    pr_total_deductions: 6120,  pr_net_salary: 34200, pr_monthly_tax_withheld: 2800, pr_ytd_tax_withheld: 8400,  error: '' },
    { employee_id: 'EMP002', status: 'Done',  pr_basic_salary: 25000, pr_total_allowances: 9000,  pr_gross_salary: 34000,  pr_employee_si_deduction: 2750,  pr_martyrs_fund: 17,   pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 150,  pr_total_deductions: 5500,  pr_net_salary: 28500, pr_monthly_tax_withheld: 2100, pr_ytd_tax_withheld: 6300,  error: '' },
    { employee_id: 'EMP003', status: 'Done',  pr_basic_salary: 38000, pr_total_allowances: 12200, pr_gross_salary: 50200,  pr_employee_si_deduction: 4020,  pr_martyrs_fund: 25.1, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 0,    pr_total_deductions: 8200,  pr_net_salary: 42000, pr_monthly_tax_withheld: 3800, pr_ytd_tax_withheld: 11400, error: '' },
    { employee_id: 'EMP004', status: 'Error', pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,   pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null,  pr_net_salary: null,  pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null,  error: 'Missing emp_basic_salary field' },
    { employee_id: 'EMP005', status: 'Error', pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,   pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null,  pr_net_salary: null,  pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null,  error: 'Attendance API returned status 1' },
    { employee_id: 'EMP006', status: 'Done',  pr_basic_salary: 22000, pr_total_allowances: 7000,  pr_gross_salary: 29000,  pr_employee_si_deduction: 2323,  pr_martyrs_fund: 14.5, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 0,    pr_total_deductions: 4500,  pr_net_salary: 24200, pr_monthly_tax_withheld: 1800, pr_ytd_tax_withheld: 5400,  error: '' },
    { employee_id: 'EMP007', status: 'Done',  pr_basic_salary: 32000, pr_total_allowances: 9500,  pr_gross_salary: 41500,  pr_employee_si_deduction: 3320,  pr_martyrs_fund: 20.8, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 0,    pr_total_deductions: 6400,  pr_net_salary: 34700, pr_monthly_tax_withheld: 2900, pr_ytd_tax_withheld: 8700,  error: '' },
    { employee_id: 'EMP008', status: 'Done',  pr_basic_salary: 27000, pr_total_allowances: 8500,  pr_gross_salary: 35500,  pr_employee_si_deduction: 2840,  pr_martyrs_fund: 17.8, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 0,    pr_total_deductions: 5500,  pr_net_salary: 29700, pr_monthly_tax_withheld: 2250, pr_ytd_tax_withheld: 6750,  error: '' },
    { employee_id: 'EMP009', status: 'Done',  pr_basic_salary: 29000, pr_total_allowances: 8000,  pr_gross_salary: 37000,  pr_employee_si_deduction: 2960,  pr_martyrs_fund: 18.5, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 0,    pr_total_deductions: 5700,  pr_net_salary: 31000, pr_monthly_tax_withheld: 2350, pr_ytd_tax_withheld: 7050,  error: '' },
    { employee_id: 'EMP010', status: 'Done',  pr_basic_salary: 24000, pr_total_allowances: 7500,  pr_gross_salary: 31500,  pr_employee_si_deduction: 2520,  pr_martyrs_fund: 15.8, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 0,    pr_total_deductions: 4900,  pr_net_salary: 26300, pr_monthly_tax_withheld: 1950, pr_ytd_tax_withheld: 5850,  error: '' },
  ],
  'RUN-2026-04-002': [
    { employee_id: 'EMP001', status: 'Done', pr_basic_salary: 30000, pr_total_allowances: 11000, pr_gross_salary: 41000,  pr_employee_si_deduction: 3300,  pr_martyrs_fund: 20.5, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 6120, pr_net_salary: 34200, pr_monthly_tax_withheld: 2800, pr_ytd_tax_withheld: 11200, error: '' },
    { employee_id: 'EMP004', status: 'Done', pr_basic_salary: 20000, pr_total_allowances: 7000,  pr_gross_salary: 27000,  pr_employee_si_deduction: 2160,  pr_martyrs_fund: 13.5, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 4200, pr_net_salary: 22500, pr_monthly_tax_withheld: 1700, pr_ytd_tax_withheld: 6800,  error: '' },
    { employee_id: 'EMP007', status: 'Done', pr_basic_salary: 32000, pr_total_allowances: 9500,  pr_gross_salary: 41500,  pr_employee_si_deduction: 3320,  pr_martyrs_fund: 20.8, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 6400, pr_net_salary: 34700, pr_monthly_tax_withheld: 2900, pr_ytd_tax_withheld: 11600, error: '' },
  ],
  'RUN-2026-04-003': [
    { employee_id: 'EMP001', status: 'Done',       pr_basic_salary: 30000, pr_total_allowances: 11000, pr_gross_salary: 41000, pr_employee_si_deduction: 3300, pr_martyrs_fund: 20.5, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 0,    pr_total_deductions: 6120, pr_net_salary: 34200, pr_monthly_tax_withheld: 2800, pr_ytd_tax_withheld: 14000, error: '' },
    { employee_id: 'EMP004', status: 'Processing', pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,  pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null,  pr_net_salary: null,  pr_monthly_tax_withheld: null,  pr_ytd_tax_withheld: null,  error: '' },
    { employee_id: 'EMP007', status: 'Pending',    pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,  pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null,  pr_net_salary: null,  pr_monthly_tax_withheld: null,  pr_ytd_tax_withheld: null,  error: '' },
  ],
  'RUN-2026-03-001': [
    { employee_id: 'EMP001', status: 'Done', pr_basic_salary: 30000, pr_total_allowances: 10500, pr_gross_salary: 40500, pr_employee_si_deduction: 3245, pr_martyrs_fund: 20.3, pr_absence_deduction: 0,   pr_unpaid_leave_deduction: 0, pr_late_deduction: 0,   pr_total_deductions: 6040, pr_net_salary: 33800, pr_monthly_tax_withheld: 2750, pr_ytd_tax_withheld: 5500, error: '' },
    { employee_id: 'EMP002', status: 'Done', pr_basic_salary: 25000, pr_total_allowances: 8500,  pr_gross_salary: 33500, pr_employee_si_deduction: 2685, pr_martyrs_fund: 16.8, pr_absence_deduction: 0,   pr_unpaid_leave_deduction: 0, pr_late_deduction: 0,   pr_total_deductions: 5350, pr_net_salary: 28100, pr_monthly_tax_withheld: 2050, pr_ytd_tax_withheld: 4100, error: '' },
    { employee_id: 'EMP003', status: 'Done', pr_basic_salary: 38000, pr_total_allowances: 11700, pr_gross_salary: 49700, pr_employee_si_deduction: 3980, pr_martyrs_fund: 24.9, pr_absence_deduction: 0,   pr_unpaid_leave_deduction: 0, pr_late_deduction: 0,   pr_total_deductions: 8000, pr_net_salary: 41500, pr_monthly_tax_withheld: 3700, pr_ytd_tax_withheld: 7400, error: '' },
    { employee_id: 'EMP004', status: 'Done', pr_basic_salary: 20000, pr_total_allowances: 6500,  pr_gross_salary: 26500, pr_employee_si_deduction: 2123, pr_martyrs_fund: 13.3, pr_absence_deduction: 750, pr_unpaid_leave_deduction: 0, pr_late_deduction: 200, pr_total_deductions: 4350, pr_net_salary: 22000, pr_monthly_tax_withheld: 1600, pr_ytd_tax_withheld: 3200, error: '' },
    { employee_id: 'EMP005', status: 'Done', pr_basic_salary: 28000, pr_total_allowances: 9000,  pr_gross_salary: 37000, pr_employee_si_deduction: 2965, pr_martyrs_fund: 18.5, pr_absence_deduction: 0,   pr_unpaid_leave_deduction: 0, pr_late_deduction: 0,   pr_total_deductions: 5600, pr_net_salary: 31000, pr_monthly_tax_withheld: 2400, pr_ytd_tax_withheld: 4800, error: '' },
  ],
  'RUN-2026-02-001': [
    { employee_id: 'EMP001', status: 'Done', pr_basic_salary: 30000, pr_total_allowances: 10000, pr_gross_salary: 40000, pr_employee_si_deduction: 3200, pr_martyrs_fund: 20, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 5900, pr_net_salary: 33500, pr_monthly_tax_withheld: 2700, pr_ytd_tax_withheld: 2700, error: '' },
    { employee_id: 'EMP002', status: 'Done', pr_basic_salary: 25000, pr_total_allowances: 8200,  pr_gross_salary: 33200, pr_employee_si_deduction: 2660, pr_martyrs_fund: 16.6, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 5300, pr_net_salary: 27900, pr_monthly_tax_withheld: 2000, pr_ytd_tax_withheld: 2000, error: '' },
    { employee_id: 'EMP003', status: 'Done', pr_basic_salary: 38000, pr_total_allowances: 11200, pr_gross_salary: 49200, pr_employee_si_deduction: 3940, pr_martyrs_fund: 24.6, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 7900, pr_net_salary: 41100, pr_monthly_tax_withheld: 3650, pr_ytd_tax_withheld: 3650, error: '' },
  ],
  'RUN-2026-01-001': [
    { employee_id: 'EMP001', status: 'Done',  pr_basic_salary: 30000, pr_total_allowances: 9500, pr_gross_salary: 39500, pr_employee_si_deduction: 3163, pr_martyrs_fund: 19.8, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 5800, pr_net_salary: 33000, pr_monthly_tax_withheld: 2650, pr_ytd_tax_withheld: 2650, error: '' },
    { employee_id: 'EMP004', status: 'Error', pr_basic_salary: null,  pr_total_allowances: null, pr_gross_salary: null,  pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: 'Employee profile not found in Zoho People' },
  ],
  'RUN-2025-12-001': [
    { employee_id: 'EMP001', status: 'Done', pr_basic_salary: 30000, pr_total_allowances: 18000, pr_gross_salary: 48000, pr_employee_si_deduction: 3840, pr_martyrs_fund: 24,   pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 7500, pr_net_salary: 40000, pr_monthly_tax_withheld: 3500, pr_ytd_tax_withheld: 3500, error: '' },
    { employee_id: 'EMP002', status: 'Done', pr_basic_salary: 25000, pr_total_allowances: 15700, pr_gross_salary: 40700, pr_employee_si_deduction: 3256, pr_martyrs_fund: 20.4, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 6400, pr_net_salary: 34000, pr_monthly_tax_withheld: 2900, pr_ytd_tax_withheld: 2900, error: '' },
    { employee_id: 'EMP003', status: 'Done', pr_basic_salary: 38000, pr_total_allowances: 21800, pr_gross_salary: 59800, pr_employee_si_deduction: 4784, pr_martyrs_fund: 29.9, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 9500, pr_net_salary: 50000, pr_monthly_tax_withheld: 4800, pr_ytd_tax_withheld: 4800, error: '' },
  ],
};

// Helper: enrich a queue run block (regular_run / termination_run)
function _enrichRun(runBlock) {
  if (!runBlock) return runBlock;
  return { ...runBlock, records: _enrich(runBlock.records || []) };
}

/**
 * portalGetPayrollRecords
 * Returns per-employee pr_* financial results for a given period.
 * Cached client-side after first fetch — no duplicate calls per period.
 */
export function mock_portalGetPayrollRecords({ payroll_period, run_id } = {}) {
  // Session run
  if (_sessionRuns[payroll_period]) {
    const run = _sessionRuns[payroll_period];
    if (run.status === 'Completed') {
      return { status: 'success', period: payroll_period, run_id: run.run_id, records: _enrich(_buildSessionPayrollRecords(payroll_period)) };
    }
    return { status: 'success', period: payroll_period, run_id: run.run_id, records: [] };
  }

  // Static run — look up by run_id if provided, else first run for the period
  const resolvedRunId = run_id || _staticRuns.find(r => r.period === payroll_period)?.run_id;
  const raw = resolvedRunId ? (_staticRecordsByRunId[resolvedRunId] || []) : [];
  return { status: 'success', period: payroll_period, run_id: resolvedRunId, records: _enrich(raw) };
}

/**
 * portalGetPeriodReport
 * Returns org-level financial summary for a given period.
 * Used exclusively by the Reports screen.
 */
export function mock_portalGetPeriodReport({ payroll_period } = {}) {
  // Session run — return generated summary if completed
  if (_sessionRuns[payroll_period]) {
    const run = _sessionRuns[payroll_period];
    if (run.status !== 'Completed') {
      return { status: 'error', message: `No completed report available for period ${payroll_period}` };
    }
    return {
      status: 'success',
      period: payroll_period,
      generated_at: new Date().toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' }),
      summary: {
        headcount: 10, termination_count: 0,
        total_gross: 330000, total_basic_salary: 295000, total_allowances: 80000, total_net_salary: 270900,
        total_employee_si: 27500, total_employer_si: 61875, total_martyrs_fund: 165,
        total_tax_withheld: 22000, total_employer_cost: 392040,
      },
    };
  }

  const reports = {
    '2026-04': null, // still processing — no report yet
    '2026-03': {
      headcount: 43, termination_count: 0,
      total_gross: 1820000, total_basic_salary: 1290000, total_allowances: 530000, total_net_salary: 1491000,
      total_employee_si: 145600, total_employer_si: 232400, total_martyrs_fund: 910,
      total_tax_withheld: 126000, total_employer_cost: 2052400,
    },
    '2026-02': {
      headcount: 43, termination_count: 0,
      total_gross: 1800000, total_basic_salary: 1275000, total_allowances: 525000, total_net_salary: 1476000,
      total_employee_si: 144000, total_employer_si: 229500, total_martyrs_fund: 900,
      total_tax_withheld: 124200, total_employer_cost: 2029500,
    },
    '2026-01': {
      headcount: 41, termination_count: 1,
      total_gross: 1750000, total_basic_salary: 1240000, total_allowances: 510000, total_net_salary: 1432500,
      total_employee_si: 140000, total_employer_si: 224000, total_martyrs_fund: 875,
      total_tax_withheld: 121000, total_employer_cost: 1974000,
    },
    '2025-12': {
      headcount: 41, termination_count: 0,
      total_gross: 2100000, total_basic_salary: 1435000, total_allowances: 665000, total_net_salary: 1722000,
      total_employee_si: 168000, total_employer_si: 268800, total_martyrs_fund: 1050,
      total_tax_withheld: 145000, total_employer_cost: 2368800,
    },
  };

  const summary = reports[payroll_period];
  if (!summary) {
    return { status: 'error', message: `No completed report available for period ${payroll_period}` };
  }
  return {
    status:       'success',
    period:       payroll_period,
    generated_at: new Date().toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' }),
    summary,
  };
}

/**
 * portalCreateMPS
 * Creates a new Monthly Payroll Setup record for the given period.
 *
 * ERROR SIMULATION: Returns an error if the period already has a run.
 * This simulates the duplicate-guard in the real Deluge function.
 */
// Holidays fetched from Zoho per period — simulates the real gateway lookup
const _zohoHolidays = {
  '2026-05': [{ date: '2026-05-01', name: 'Labour Day' }],
  '2026-04': [{ date: '2026-04-25', name: 'Sinai Liberation Day' }],
  '2026-03': [{ date: '2026-03-20', name: 'Spring Equinox' }],
  '2026-02': [],
  '2026-01': [{ date: '2026-01-07', name: 'Coptic Christmas' }],
  '2025-12': [{ date: '2025-12-25', name: 'Christmas Day' }],
};

export function mock_portalCreateMPS({ payroll_period, force = false } = {}) {
  // ERROR SIMULATION — duplicate period guard (bypassed when force=true)
  if (_createdPeriods.has(payroll_period) && !force) {
    return {
      status:  'error',
      message: `A payroll run for ${payroll_period} already exists.`,
    };
  }
  _createdPeriods.add(payroll_period);

  const holidays = _zohoHolidays[payroll_period] || [];
  const run_id   = `SES-${payroll_period}-${String(++_runSeqCounter).padStart(3, '0')}`;

  _sessionRuns[payroll_period] = {
    run_id,
    period:       payroll_period,
    status:       'Draft',
    working_days: 22,
    employees:    0,
    batches:      0,
    done:         0,
    error:        0,
    pending:      0,
    holidays,
    pollCount:    0,
    gross:        null,
    net:          null,
    tax:          null,
    si:           null,
  };

  return {
    status:       'success',
    run_id,
    period:       payroll_period,
    working_days: 22,
    holidays,
    message:      `MPS created for ${payroll_period}`,
  };
}

/**
 * portalUpdateMPSHolidays
 * Saves the manually edited holiday list back to the MPS record.
 */
export function mock_portalUpdateMPSHolidays({ payroll_period, holidays = [] } = {}) {
  if (_sessionRuns[payroll_period]) {
    _sessionRuns[payroll_period].holidays = holidays;
  }
  return { status: 'success' };
}

/**
 * portalUpdateMPS
 * Overrides the working days on an existing MPS record.
 * Always succeeds in mock.
 */
export function mock_portalUpdateMPS({ payroll_period, new_working_days } = {}) {
  return {
    status:       'success',
    period:       payroll_period,
    working_days: new_working_days,
    message:      `Working days updated to ${new_working_days} for ${payroll_period}`,
  };
}

/**
 * portalTriggerOrchestrator
 * Enqueues all active employees for the given period and kicks off the run.
 *
 * ERROR SIMULATION: First call for a hardcoded period returns a lock conflict.
 * Second call succeeds. Session-created periods always succeed immediately —
 * no lock simulation needed for clean cycle testing.
 */
export function mock_portalTriggerOrchestrator({ payroll_period } = {}) {
  // For session-created periods — always succeed, no lock simulation
  if (_sessionRuns[payroll_period]) {
    const run_id = _sessionRuns[payroll_period].run_id;
    _sessionRuns[payroll_period] = {
      ..._sessionRuns[payroll_period],
      run_id,
      status:    'Processing',
      employees: 10,
      batches:   2,
      pending:   10,
      done:      0,
      error:     0,
      pollCount: 0,
    };
    _createdPeriods.add(payroll_period + '_triggered');
    return {
      status:  'success',
      run_id,
      period:  payroll_period,
      queued:  10,
      batches: 2,
      message: `Payroll run started — 10 employees queued in 2 batches`,
    };
  }

  // For hardcoded periods — simulate lock conflict on first attempt
  const attempts = _triggerAttempts[payroll_period] || 0;
  _triggerAttempts[payroll_period] = attempts + 1;

  if (attempts === 0 && !_createdPeriods.has(payroll_period + '_triggered')) {
    return {
      status:  'error',
      message: 'Orchestrator is locked by another process. Wait 30 seconds and try again.',
    };
  }

  _createdPeriods.add(payroll_period + '_triggered');
  return {
    status:  'success',
    period:  payroll_period,
    queued:  10,
    batches: 2,
    message: `Payroll run started — 10 employees queued in 2 batches`,
  };
}

/**
 * portalSaveSettings
 * Handles all settings sections. For portal_users section, updates the
 * shared _portalUsers state so subsequent portalGetSettings calls reflect
 * the change (simulates persistence within the session).
 */
export function mock_portalSaveSettings({ section, user_id, role, portal_roles } = {}) {
  if (section === 'payroll_settings') {
    return { status: 'error', message: "'payroll_settings' is not a valid section. Scope is owned by the MPS record — pass it to portalCreateMPS instead." };
  }
  if (section === 'portal_users' && user_id !== undefined && user_id !== '') {
    if (role === '' || role == null) {
      delete _portalUsers[user_id];
    } else {
      _portalUsers[user_id] = role;
    }
  }
  if (section === 'portal_roles' && portal_roles) {
    Object.assign(_portalRoles, {});
    Object.keys(_portalRoles).forEach(k => delete _portalRoles[k]);
    Object.assign(_portalRoles, portal_roles);
  }
  return { status: 'success', message: 'Settings saved successfully.' };
}

/**
 * portalAddPortalUser
 * Adds an employee to the portal users map with the given role.
 *
 * ERROR SIMULATION: Returns an error if the employee ID already exists.
 */
export function mock_portalAddPortalUser({ employee_id, role } = {}) {
  // ERROR SIMULATION — duplicate user guard
  if (_portalUsers[employee_id]) {
    return {
      status:  'error',
      message: `${employee_id} already has portal access as ${_portalUsers[employee_id]}.`,
    };
  }
  _portalUsers[employee_id] = role;
  return {
    status:      'success',
    employee_id,
    role,
    message:     `${employee_id} added as ${role}`,
    portal_users: { ..._portalUsers },
  };
}

/**
 * portalRemovePortalUser
 * Removes an employee from the portal users map.
 * Always succeeds in mock.
 */
export function mock_portalRemovePortalUser({ employee_id } = {}) {
  delete _portalUsers[employee_id];
  return {
    status:      'success',
    employee_id,
    message:     `${employee_id} removed from portal access`,
    portal_users: { ..._portalUsers },
  };
}

/**
 * portalGetDepartments
 * Returns a static list of departments for the selection picker.
 */
export function mock_portalGetDepartments() {
  return {
    status: 'success',
    departments: [
      { name: 'Engineering'      },
      { name: 'Finance'          },
      { name: 'Operations'       },
      { name: 'Human Resources'  },
      { name: 'Sales'            },
      { name: 'Marketing'        },
      { name: 'Legal'            },
      { name: 'Customer Support' },
    ],
  };
}

/**
 * portalGetEmployees
 * Slim picker list for the Run Payroll wizard employee selector.
 * Shape: { id, name, department }
 */
export function mock_portalGetEmployees() {
  return {
    status: 'success',
    employees: [
      { id: 'EMP001', name: 'Ahmed Hassan',   department: 'Engineering'     },
      { id: 'EMP002', name: 'Sara Mohamed',   department: 'Finance'         },
      { id: 'EMP003', name: 'Omar Khalil',    department: 'Operations'      },
      { id: 'EMP004', name: 'Nour Ibrahim',   department: 'Engineering'     },
      { id: 'EMP005', name: 'Karim Youssef',  department: 'Sales'           },
      { id: 'EMP006', name: 'Layla Mahmoud',  department: 'Human Resources' },
      { id: 'EMP007', name: 'Tarek Farouk',   department: 'Engineering'     },
      { id: 'EMP008', name: 'Mona Sayed',     department: 'Finance'         },
      { id: 'EMP009', name: 'Yasser Nour',    department: 'Operations'      },
      { id: 'EMP010', name: 'Heba Ashraf',    department: 'Marketing'       },
    ],
  };
}

// Static employee profiles — salary reference + exclusion defaults
const _staticEmployees = [
  { employee_id: 'EMP001', employee_name: 'Ahmed Hassan',   department: 'Engineering',     pr_basic_salary: 30000, pr_gross_salary: 41000, pr_net_salary: 34200, exclude_si: false, exclude_martyrs_fund: false, exclude_income_tax: false },
  { employee_id: 'EMP002', employee_name: 'Sara Mohamed',   department: 'Finance',         pr_basic_salary: 25000, pr_gross_salary: 34000, pr_net_salary: 28500, exclude_si: false, exclude_martyrs_fund: false, exclude_income_tax: false },
  { employee_id: 'EMP003', employee_name: 'Omar Khalil',    department: 'Operations',      pr_basic_salary: 38000, pr_gross_salary: 50200, pr_net_salary: 42000, exclude_si: false, exclude_martyrs_fund: false, exclude_income_tax: false },
  { employee_id: 'EMP004', employee_name: 'Nour Ibrahim',   department: 'Engineering',     pr_basic_salary: 20000, pr_gross_salary: 27000, pr_net_salary: 22500, exclude_si: false, exclude_martyrs_fund: true,  exclude_income_tax: false },
  { employee_id: 'EMP005', employee_name: 'Karim Youssef',  department: 'Sales',           pr_basic_salary: 28000, pr_gross_salary: 37000, pr_net_salary: 31000, exclude_si: false, exclude_martyrs_fund: false, exclude_income_tax: false },
  { employee_id: 'EMP006', employee_name: 'Layla Mahmoud',  department: 'Human Resources', pr_basic_salary: 22000, pr_gross_salary: 29000, pr_net_salary: 24200, exclude_si: false, exclude_martyrs_fund: false, exclude_income_tax: false },
  { employee_id: 'EMP007', employee_name: 'Tarek Farouk',   department: 'Engineering',     pr_basic_salary: 32000, pr_gross_salary: 41500, pr_net_salary: 34700, exclude_si: false, exclude_martyrs_fund: false, exclude_income_tax: false },
  { employee_id: 'EMP008', employee_name: 'Mona Sayed',     department: 'Finance',         pr_basic_salary: 27000, pr_gross_salary: 35500, pr_net_salary: 29700, exclude_si: false, exclude_martyrs_fund: false, exclude_income_tax: false },
  { employee_id: 'EMP009', employee_name: 'Yasser Nour',    department: 'Operations',      pr_basic_salary: 29000, pr_gross_salary: 37000, pr_net_salary: 31000, exclude_si: false, exclude_martyrs_fund: false, exclude_income_tax: false },
  { employee_id: 'EMP010', employee_name: 'Heba Ashraf',    department: 'Marketing',       pr_basic_salary: 24000, pr_gross_salary: 31500, pr_net_salary: 26300, exclude_si: false, exclude_martyrs_fund: false, exclude_income_tax: false },
  { employee_id: 'EMP011', employee_name: 'Rania Fares',    department: 'Marketing',       pr_basic_salary: 21000, pr_gross_salary: 28500, pr_net_salary: 23800, exclude_si: false, exclude_martyrs_fund: false, exclude_income_tax: false },
  { employee_id: 'EMP012', employee_name: 'Sherif Hamdy',   department: 'Operations',      pr_basic_salary: 26000, pr_gross_salary: 33500, pr_net_salary: 28000, exclude_si: true,  exclude_martyrs_fund: false, exclude_income_tax: false },
];

/**
 * portalListEmployees
 * Full employee profiles for the Employees screen.
 * Applies any session-level exclusion overrides on top of static defaults.
 */
export function mock_portalListEmployees() {
  return {
    status: 'success',
    employees: _staticEmployees.map(emp => ({
      ...emp,
      ...(_employeeOverrides[emp.employee_id] || {}),
    })),
  };
}

/**
 * portalUpdateEmployee
 * Persists exclusion flag changes for a single employee within the session.
 */
export function mock_portalUpdateEmployee({ employee_id, exclude_si, exclude_martyrs_fund, exclude_income_tax } = {}) {
  if (!employee_id) return { status: 'error', message: 'Missing employee_id' };
  _employeeOverrides[employee_id] = {
    exclude_si:           Boolean(exclude_si),
    exclude_martyrs_fund: Boolean(exclude_martyrs_fund),
    exclude_income_tax:   Boolean(exclude_income_tax),
  };
  return { status: 'success', employee_id };
}

/**
 * portalGetDashboard
 * Returns aggregated summary data for the dashboard landing page.
 */
export function mock_portalGetDashboard() {
  return {
    status: 'success',
    employee_summary: {
      total_active:    142,
      total_on_leave:  8,
      new_this_month:  3,
    },
    last_run: {
      period:         '2026-04',
      run_date:       '2026-04-30',
      status:         'Completed',
      employee_count: 139,
      total_gross:    4_820_000,
      total_net:      3_945_000,
      total_tax:        486_000,
      total_si:         389_000,
    },
    upcoming_run: {
      period:         '2026-05',
      cutoff_date:    '2026-05-25',
      scheduled_date: '2026-05-30',
    },
    queue_summary: {
      pending:         0,
      processing:      0,
      failed:          1,
      completed_today: 0,
    },
    run_history: [
      { period: '2026-04', run_date: '2026-04-30', status: 'Completed', employee_count: 139, total_net: 3_945_000 },
      { period: '2026-03', run_date: '2026-03-31', status: 'Completed', employee_count: 137, total_net: 3_890_000 },
      { period: '2026-02', run_date: '2026-02-28', status: 'Completed', employee_count: 135, total_net: 3_820_000 },
      { period: '2026-01', run_date: '2026-01-31', status: 'Completed', employee_count: 135, total_net: 3_800_000 },
      { period: '2025-12', run_date: '2025-12-31', status: 'Completed', employee_count: 132, total_net: 3_750_000 },
      { period: '2025-11', run_date: '2025-11-30', status: 'Completed', employee_count: 130, total_net: 3_690_000 },
    ],
    alerts: [
      { id: 1, severity: 'error',   message: '1 queue item failed — review in Queue monitor' },
      { id: 2, severity: 'warning', message: 'SI ceiling last updated in 2025 — verify against GOSI announcement' },
    ],
  };
}
