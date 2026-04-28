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
      ov_tax_table:               '{"brackets":[{"min":0,"max":40000,"rate":0},{"min":40001,"max":55000,"rate":0.10},{"min":55001,"max":70000,"rate":0.15},{"min":70001,"max":200000,"rate":0.20},{"min":200001,"max":400000,"rate":0.225},{"min":400001,"max":99999999,"rate":0.25}]}',
      ov_si_rates:                '{"employee_rate":0.11,"employer_rate":0.18,"martyrs_fund":0.0005,"min_insurance_salary":1800,"max_insurance_salary":11600}',
      ov_employer_si_variable:    '{"rate":0.02}',
      ov_default_working_days:    22,
      ov_public_holidays:         'Coptic Christmas\nRevolution Day\nSinai Liberation Day',
      allow_working_days_override: true,
      scope:                      'all',
    },
    portal_config: {
      portal_users:               _portalUsers,
      allow_working_days_override: true,
    },
  };
}

/**
 * portalListRuns
 * Returns all MPS records — period, status, progress counters, and
 * financial totals for completed runs (used by Step 4 wizard card).
 */
export function mock_portalListRuns() {
  return {
    status: 'success',
    runs: [
      {
        period:       '2026-04',
        status:       'Processing',
        employees:    10,
        working_days: 22,
        batches:      2,
        done:         3,
        error:        2,
        pending:      5,
        holidays:     'Sinai Liberation Day',
        gross:        null,
        net:          null,
        tax:          null,
        si:           null,
      },
      {
        period:       '2026-03',
        status:       'Completed',
        employees:    43,
        working_days: 21,
        batches:      5,
        done:         43,
        error:        0,
        pending:      0,
        holidays:     'Revolution Day',
        gross:        1820000,
        net:          1491000,
        tax:          126000,
        si:           200200,
      },
      {
        period:       '2026-02',
        status:       'Completed',
        employees:    43,
        working_days: 20,
        batches:      5,
        done:         43,
        error:        0,
        pending:      0,
        holidays:     null,
        gross:        1800000,
        net:          1476000,
        tax:          124200,
        si:           198000,
      },
      {
        period:       '2026-01',
        status:       'Completed',
        employees:    41,
        working_days: 22,
        batches:      5,
        done:         40,
        error:        1,
        pending:      0,
        holidays:     'Coptic Christmas',
        gross:        1750000,
        net:          1432500,
        tax:          121000,
        si:           192500,
      },
      {
        period:       '2025-12',
        status:       'Completed',
        employees:    41,
        working_days: 23,
        batches:      5,
        done:         41,
        error:        0,
        pending:      0,
        holidays:     null,
        gross:        2100000,
        net:          1722000,
        tax:          145000,
        si:           231000,
      },
    ],
  };
}

/**
 * portalGetQueueStatus
 * Returns MPS status and per-queue progress for a given period.
 * Used by QueueMonitor and RunPayroll polling.
 */
export function mock_portalGetQueueStatus({ payroll_period } = {}) {
  const isProcessing = payroll_period === '2026-04';
  return {
    status:           'success',
    mps_status:       isProcessing ? 'Processing' : 'Completed',
    mps_working_days: isProcessing ? 22 : 21,
    progress: {
      total:      isProcessing ? 10 : 43,
      done:       isProcessing ? 3  : 43,
      error:      isProcessing ? 2  : 0,
      pending:    isProcessing ? 3  : 0,
      processing: isProcessing ? 2  : 0,
    },
    regular_run: {
      summary: { total: isProcessing ? 10 : 43, done: isProcessing ? 3 : 43, error: isProcessing ? 2 : 0, pending: isProcessing ? 5 : 0 },
      records: isProcessing ? [
        { employee_id: 'EMP001', status: 'Done',       batch_number: 1, processed_at: '09:15', error: '' },
        { employee_id: 'EMP002', status: 'Done',       batch_number: 1, processed_at: '09:15', error: '' },
        { employee_id: 'EMP003', status: 'Done',       batch_number: 1, processed_at: '09:16', error: '' },
        { employee_id: 'EMP004', status: 'Error',      batch_number: 1, processed_at: '09:16', error: 'Missing emp_basic_salary field' },
        { employee_id: 'EMP005', status: 'Error',      batch_number: 1, processed_at: '09:17', error: 'Attendance API returned status 1' },
        { employee_id: 'EMP006', status: 'Processing', batch_number: 2, processed_at: '',      error: '' },
        { employee_id: 'EMP007', status: 'Processing', batch_number: 2, processed_at: '',      error: '' },
        { employee_id: 'EMP008', status: 'Pending',    batch_number: 2, processed_at: '',      error: '' },
        { employee_id: 'EMP009', status: 'Pending',    batch_number: 3, processed_at: '',      error: '' },
        { employee_id: 'EMP010', status: 'Pending',    batch_number: 3, processed_at: '',      error: '' },
      ] : [
        { employee_id: 'EMP001', status: 'Done', batch_number: 1, processed_at: '08:40', error: '' },
        { employee_id: 'EMP002', status: 'Done', batch_number: 1, processed_at: '08:40', error: '' },
        { employee_id: 'EMP003', status: 'Done', batch_number: 1, processed_at: '08:41', error: '' },
      ],
    },
    termination_run: {
      summary: { total: 0, done: 0, error: 0, pending: 0 },
      records: [],
    },
  };
}

/**
 * portalGetPayrollRecords
 * Returns per-employee pr_* financial results for a given period.
 * Cached client-side after first fetch — no duplicate calls per period.
 */
export function mock_portalGetPayrollRecords({ payroll_period } = {}) {
  const recordsByPeriod = {
    '2026-04': [
      { employee_id: 'EMP001', status: 'Done',       pr_basic_salary: 30000, pr_total_allowances: 11000, pr_gross_salary: 41000,  pr_employee_si_deduction: 3300,  pr_martyrs_fund: 20.5, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 0,   pr_total_deductions: 6120,  pr_net_salary: 34200, pr_monthly_tax_withheld: 2800, pr_ytd_tax_withheld: 8400,  error: '' },
      { employee_id: 'EMP002', status: 'Done',       pr_basic_salary: 25000, pr_total_allowances: 9000,  pr_gross_salary: 34000,  pr_employee_si_deduction: 2750,  pr_martyrs_fund: 17,   pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 150, pr_total_deductions: 5500,  pr_net_salary: 28500, pr_monthly_tax_withheld: 2100, pr_ytd_tax_withheld: 6300,  error: '' },
      { employee_id: 'EMP003', status: 'Done',       pr_basic_salary: 38000, pr_total_allowances: 12200, pr_gross_salary: 50200,  pr_employee_si_deduction: 4020,  pr_martyrs_fund: 25.1, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,    pr_late_deduction: 0,   pr_total_deductions: 8200,  pr_net_salary: 42000, pr_monthly_tax_withheld: 3800, pr_ytd_tax_withheld: 11400, error: '' },
      { employee_id: 'EMP004', status: 'Error',      pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,   pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: 'Missing emp_basic_salary field' },
      { employee_id: 'EMP005', status: 'Error',      pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,   pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: 'Attendance API returned status 1' },
      { employee_id: 'EMP006', status: 'Processing', pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,   pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: '' },
      { employee_id: 'EMP007', status: 'Processing', pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,   pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: '' },
      { employee_id: 'EMP008', status: 'Pending',    pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,   pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: '' },
      { employee_id: 'EMP009', status: 'Pending',    pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,   pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: '' },
      { employee_id: 'EMP010', status: 'Pending',    pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,   pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: '' },
    ],
    '2026-03': [
      { employee_id: 'EMP001', status: 'Done', pr_basic_salary: 30000, pr_total_allowances: 10500, pr_gross_salary: 40500, pr_employee_si_deduction: 3245, pr_martyrs_fund: 20.3, pr_absence_deduction: 0,   pr_unpaid_leave_deduction: 0, pr_late_deduction: 0,   pr_total_deductions: 6040, pr_net_salary: 33800, pr_monthly_tax_withheld: 2750, pr_ytd_tax_withheld: 5500, error: '' },
      { employee_id: 'EMP002', status: 'Done', pr_basic_salary: 25000, pr_total_allowances: 8500,  pr_gross_salary: 33500, pr_employee_si_deduction: 2685, pr_martyrs_fund: 16.8, pr_absence_deduction: 0,   pr_unpaid_leave_deduction: 0, pr_late_deduction: 0,   pr_total_deductions: 5350, pr_net_salary: 28100, pr_monthly_tax_withheld: 2050, pr_ytd_tax_withheld: 4100, error: '' },
      { employee_id: 'EMP003', status: 'Done', pr_basic_salary: 38000, pr_total_allowances: 11700, pr_gross_salary: 49700, pr_employee_si_deduction: 3980, pr_martyrs_fund: 24.9, pr_absence_deduction: 0,   pr_unpaid_leave_deduction: 0, pr_late_deduction: 0,   pr_total_deductions: 8000, pr_net_salary: 41500, pr_monthly_tax_withheld: 3700, pr_ytd_tax_withheld: 7400, error: '' },
      { employee_id: 'EMP004', status: 'Done', pr_basic_salary: 20000, pr_total_allowances: 6500,  pr_gross_salary: 26500, pr_employee_si_deduction: 2123, pr_martyrs_fund: 13.3, pr_absence_deduction: 750, pr_unpaid_leave_deduction: 0, pr_late_deduction: 200, pr_total_deductions: 4350, pr_net_salary: 22000, pr_monthly_tax_withheld: 1600, pr_ytd_tax_withheld: 3200, error: '' },
      { employee_id: 'EMP005', status: 'Done', pr_basic_salary: 28000, pr_total_allowances: 9000,  pr_gross_salary: 37000, pr_employee_si_deduction: 2965, pr_martyrs_fund: 18.5, pr_absence_deduction: 0,   pr_unpaid_leave_deduction: 0, pr_late_deduction: 0,   pr_total_deductions: 5600, pr_net_salary: 31000, pr_monthly_tax_withheld: 2400, pr_ytd_tax_withheld: 4800, error: '' },
    ],
    '2026-02': [
      { employee_id: 'EMP001', status: 'Done', pr_basic_salary: 30000, pr_total_allowances: 10000, pr_gross_salary: 40000, pr_employee_si_deduction: 3200, pr_martyrs_fund: 20,   pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 5900, pr_net_salary: 33500, pr_monthly_tax_withheld: 2700, pr_ytd_tax_withheld: 2700, error: '' },
      { employee_id: 'EMP002', status: 'Done', pr_basic_salary: 25000, pr_total_allowances: 8200,  pr_gross_salary: 33200, pr_employee_si_deduction: 2660, pr_martyrs_fund: 16.6, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 5300, pr_net_salary: 27900, pr_monthly_tax_withheld: 2000, pr_ytd_tax_withheld: 2000, error: '' },
      { employee_id: 'EMP003', status: 'Done', pr_basic_salary: 38000, pr_total_allowances: 11200, pr_gross_salary: 49200, pr_employee_si_deduction: 3940, pr_martyrs_fund: 24.6, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 7900, pr_net_salary: 41100, pr_monthly_tax_withheld: 3650, pr_ytd_tax_withheld: 3650, error: '' },
    ],
    '2026-01': [
      { employee_id: 'EMP001', status: 'Done',  pr_basic_salary: 30000, pr_total_allowances: 9500, pr_gross_salary: 39500, pr_employee_si_deduction: 3163, pr_martyrs_fund: 19.8, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 5800, pr_net_salary: 33000, pr_monthly_tax_withheld: 2650, pr_ytd_tax_withheld: 2650, error: '' },
      { employee_id: 'EMP004', status: 'Error', pr_basic_salary: null,  pr_total_allowances: null, pr_gross_salary: null,  pr_employee_si_deduction: null,  pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: 'Employee profile not found in Zoho People' },
    ],
    '2025-12': [
      { employee_id: 'EMP001', status: 'Done', pr_basic_salary: 30000, pr_total_allowances: 18000, pr_gross_salary: 48000, pr_employee_si_deduction: 3840, pr_martyrs_fund: 24,   pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 7500, pr_net_salary: 40000, pr_monthly_tax_withheld: 3500, pr_ytd_tax_withheld: 3500, error: '' },
      { employee_id: 'EMP002', status: 'Done', pr_basic_salary: 25000, pr_total_allowances: 15700, pr_gross_salary: 40700, pr_employee_si_deduction: 3256, pr_martyrs_fund: 20.4, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 6400, pr_net_salary: 34000, pr_monthly_tax_withheld: 2900, pr_ytd_tax_withheld: 2900, error: '' },
      { employee_id: 'EMP003', status: 'Done', pr_basic_salary: 38000, pr_total_allowances: 21800, pr_gross_salary: 59800, pr_employee_si_deduction: 4784, pr_martyrs_fund: 29.9, pr_absence_deduction: 0, pr_unpaid_leave_deduction: 0, pr_late_deduction: 0, pr_total_deductions: 9500, pr_net_salary: 50000, pr_monthly_tax_withheld: 4800, pr_ytd_tax_withheld: 4800, error: '' },
    ],
  };

  return {
    status:  'success',
    period:  payroll_period,
    records: recordsByPeriod[payroll_period] || [],
  };
}

/**
 * portalGetPeriodReport
 * Returns org-level financial summary for a given period.
 * Used exclusively by the Reports screen.
 */
export function mock_portalGetPeriodReport({ payroll_period } = {}) {
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
export function mock_portalCreateMPS({ payroll_period } = {}) {
  // ERROR SIMULATION — duplicate period guard
  if (_createdPeriods.has(payroll_period)) {
    return {
      status:  'error',
      message: `A payroll run for ${payroll_period} already exists. Delete it before creating a new one.`,
    };
  }
  _createdPeriods.add(payroll_period);
  return {
    status:       'success',
    period:       payroll_period,
    working_days: 22,
    holidays:     'No public holidays this period',
    message:      `MPS created for ${payroll_period}`,
  };
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
 * ERROR SIMULATION: First call for a new period returns a lock conflict error.
 * Second call succeeds. This simulates an orchestrator concurrency guard.
 */
export function mock_portalTriggerOrchestrator({ payroll_period } = {}) {
  const attempts = _triggerAttempts[payroll_period] || 0;
  _triggerAttempts[payroll_period] = attempts + 1;

  // ERROR SIMULATION — first attempt fails with lock conflict
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
