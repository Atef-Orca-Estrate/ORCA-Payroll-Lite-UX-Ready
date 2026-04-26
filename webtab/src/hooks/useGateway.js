// ─── DEV MODE ───────────────────────────────────────────────────────────────
// Set to false before packaging with Zoho Extension CLI
export const DEV_MODE = true;

// ─── BASE CONFIG ─────────────────────────────────────────────────────────────
const BASE_URL = 'https://people.zoho.com';

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCKS = {
  portalListRuns: {
    status: 'success',
    runs: [
      { period: '2026-04', status: 'Processing', employees: 10, working_days: 22, batches: 2, done: 3, error: 2, pending: 5 },
      { period: '2026-03', status: 'Completed',  employees: 43, working_days: 21, batches: 5, done: 43, error: 0, pending: 0 },
      { period: '2026-02', status: 'Completed',  employees: 43, working_days: 20, batches: 5, done: 43, error: 0, pending: 0 },
      { period: '2026-01', status: 'Completed',  employees: 41, working_days: 22, batches: 5, done: 40, error: 1, pending: 0 },
      { period: '2025-12', status: 'Completed',  employees: 41, working_days: 23, batches: 5, done: 41, error: 0, pending: 0 }
    ]
  },

  portalGetPayrollRecords: {
    status: 'success',
    period: '2026-04',
    records: [
      { employee_id: 'EMP001', status: 'Done',       pr_basic_salary: 30000, pr_total_allowances: 11000, pr_gross_salary: 41000, pr_employee_si_deduction: 3300, pr_martyrs_fund: 20.5, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,   pr_late_deduction: 0,   pr_total_deductions: 6120, pr_net_salary: 34200, pr_monthly_tax_withheld: 2800, pr_ytd_tax_withheld: 8400,  error: '' },
      { employee_id: 'EMP002', status: 'Done',       pr_basic_salary: 25000, pr_total_allowances: 9000,  pr_gross_salary: 34000, pr_employee_si_deduction: 2750, pr_martyrs_fund: 17,   pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,   pr_late_deduction: 150, pr_total_deductions: 5500, pr_net_salary: 28500, pr_monthly_tax_withheld: 2100, pr_ytd_tax_withheld: 6300,  error: '' },
      { employee_id: 'EMP003', status: 'Done',       pr_basic_salary: 38000, pr_total_allowances: 12200, pr_gross_salary: 50200, pr_employee_si_deduction: 4020, pr_martyrs_fund: 25.1, pr_absence_deduction: 0,    pr_unpaid_leave_deduction: 0,   pr_late_deduction: 0,   pr_total_deductions: 8200, pr_net_salary: 42000, pr_monthly_tax_withheld: 3800, pr_ytd_tax_withheld: 11400, error: '' },
      { employee_id: 'EMP004', status: 'Error',      pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,  pr_employee_si_deduction: null, pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: 'Missing emp_basic_salary field' },
      { employee_id: 'EMP005', status: 'Error',      pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,  pr_employee_si_deduction: null, pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: 'Attendance API returned status 1' },
      { employee_id: 'EMP006', status: 'Processing', pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,  pr_employee_si_deduction: null, pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: '' },
      { employee_id: 'EMP007', status: 'Processing', pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,  pr_employee_si_deduction: null, pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: '' },
      { employee_id: 'EMP008', status: 'Pending',    pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,  pr_employee_si_deduction: null, pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: '' },
      { employee_id: 'EMP009', status: 'Pending',    pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,  pr_employee_si_deduction: null, pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: '' },
      { employee_id: 'EMP010', status: 'Pending',    pr_basic_salary: null,  pr_total_allowances: null,  pr_gross_salary: null,  pr_employee_si_deduction: null, pr_martyrs_fund: null, pr_absence_deduction: null, pr_unpaid_leave_deduction: null, pr_late_deduction: null, pr_total_deductions: null, pr_net_salary: null, pr_monthly_tax_withheld: null, pr_ytd_tax_withheld: null, error: '' }
    ]
  },


    status: 'success',
    payroll_settings: {
      apply_insurance: true,
      entity_type: 'Legal Entity',
      apply_tax: true,
      scope: 'all',
      selected_department: '',
      lock: false
    },
    portal_config: {
      default_holiday_source: 'zoho',
      allow_working_days_override: true
    },
    portal_users: {
      EMP001: 'admin',
      EMP002: 'manager'
    },
    portal_roles: {
      admin:   ['feature_settings','feature_run_payroll','feature_queue_monitor','feature_reports'],
      manager: ['feature_run_payroll','feature_queue_monitor','feature_reports']
    }
  },

  portalSaveSettings: {
    status: 'success',
    message: 'Settings saved successfully.'
  },

  portalCreateMPS: {
    status: 'success',
    message: 'Monthly payroll setup created for period 2025-04.',
    period: '2025-04',
    working_days: 22,
    holidays: '2025-04-25 Sinai Liberation Day\n2025-04-07 Spring Holiday',
    mps_id: 'MPS_001'
  },

  portalUpdateMPS: {
    status: 'success',
    message: 'Working days updated to 20 for period 2025-04.',
    period: '2025-04',
    working_days: 20
  },

  portalTriggerOrchestrator: {
    status: 'success',
    message: 'Payroll run started for period 2025-04. 45 employees queued across 5 batches.',
    period: '2025-04',
    queued: 45,
    batches: 5
  },

  portalGetQueueStatus: {
    status: 'success',
    period: '2025-04',
    mps_status: 'Processing',
    mps_working_days: 22,
    progress: { total: 45, done: 38, error: 2, pending: 3, processing: 2 },
    regular_run: {
      summary: { total: 43, done: 36, error: 2, pending: 3, processing: 2 },
      records: [
        { employee_id: 'EMP001', status: 'Done',       batch_number: 1, processed_at: '2025-04-30 09:15:00', error: '' },
        { employee_id: 'EMP002', status: 'Done',       batch_number: 1, processed_at: '2025-04-30 09:15:02', error: '' },
        { employee_id: 'EMP003', status: 'Done',       batch_number: 1, processed_at: '2025-04-30 09:15:04', error: '' },
        { employee_id: 'EMP004', status: 'Error',      batch_number: 1, processed_at: '2025-04-30 09:15:06', error: 'Employee profile missing emp_basic_salary field' },
        { employee_id: 'EMP005', status: 'Error',      batch_number: 1, processed_at: '2025-04-30 09:15:08', error: 'Attendance API returned status 1' },
        { employee_id: 'EMP006', status: 'Processing', batch_number: 2, processed_at: '', error: '' },
        { employee_id: 'EMP007', status: 'Processing', batch_number: 2, processed_at: '', error: '' },
        { employee_id: 'EMP008', status: 'Pending',    batch_number: 2, processed_at: '', error: '' },
        { employee_id: 'EMP009', status: 'Pending',    batch_number: 3, processed_at: '', error: '' },
        { employee_id: 'EMP010', status: 'Pending',    batch_number: 3, processed_at: '', error: '' }
      ]
    },
    termination_run: {
      summary: { total: 2, done: 2, error: 0, pending: 0 },
      records: [
        { employee_id: 'EMP020', exit_date: '2025-04-15', status: 'Done', processed_at: '2025-04-15 14:30:00', error: '' },
        { employee_id: 'EMP021', exit_date: '2025-04-22', status: 'Done', processed_at: '2025-04-22 16:45:00', error: '' }
      ]
    }
  },

  portalGetPeriodReport: {
    status: 'success',
    period: '2025-04',
    generated_at: '2025-04-30 10:00:00',
    summary: {
      headcount:          43,
      termination_count:  2,
      total_gross:        1850000.00,
      total_basic_salary: 1400000.00,
      total_allowances:   450000.00,
      total_employee_si:  203500.00,
      total_employer_si:  346875.00,
      total_martyrs_fund: 925.00,
      total_tax_withheld: 129500.00,
      total_net_salary:   1516075.00,
      total_employer_cost:2197800.00
    },
    records: []
  }
};

// Simulate network delay in mock mode
const mockDelay = (ms = 600) => new Promise(r => setTimeout(r, ms));

// ─── HOOK ─────────────────────────────────────────────────────────────────────
export function useGateway() {
  const invoke = async (fnName, params = {}) => {
    if (DEV_MODE) {
      await mockDelay();
      const mock = MOCKS[fnName];
      if (!mock) throw new Error(`No mock defined for: ${fnName}`);
      return mock;
    }

    // Production — Pattern X: ZOHO People JS SDK direct function invoke
    try {
      const result = await window.ZOHO.PEOPLE.invoke(fnName, { params });
      return result;
    } catch (err) {
      console.error(`[useGateway] ${fnName} failed:`, err);
      throw err;
    }
  };

  return { invoke };
}
