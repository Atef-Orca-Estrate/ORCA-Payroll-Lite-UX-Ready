// ─── DEV MODE ────────────────────────────────────────────────────────────────
// Set to false before packaging with Zoho Extension CLI.
// When true, ALL gateway calls are intercepted and served from mockData.js.
// Real API call code below is NEVER removed — only bypassed.
export const DEV_MODE = true;

// ─── MOCK LAYER ───────────────────────────────────────────────────────────────
// All mock responses live in mockData.js — single source of truth.
// Imported here only; never inlined in this file.
import {
  mock_portalGetSettings,
  mock_portalListRuns,
  mock_portalGetQueueStatus,
  mock_portalGetPayrollRecords,
  mock_portalGetPeriodReport,
  mock_portalCreateMPS,
  mock_portalUpdateMPS,
  mock_portalTriggerOrchestrator,
  mock_portalSaveSettings,
  mock_portalAddPortalUser,
  mock_portalRemovePortalUser,
  mock_portalGetDepartments,
  mock_portalGetEmployees,
} from './mockData.js';

// Maps function name → mock handler function
const MOCK_HANDLERS = {
  portalGetSettings:         mock_portalGetSettings,
  portalListRuns:            mock_portalListRuns,
  portalGetQueueStatus:      mock_portalGetQueueStatus,
  portalGetPayrollRecords:   mock_portalGetPayrollRecords,
  portalGetPeriodReport:     mock_portalGetPeriodReport,
  portalCreateMPS:           mock_portalCreateMPS,
  portalUpdateMPS:           mock_portalUpdateMPS,
  portalTriggerOrchestrator: mock_portalTriggerOrchestrator,
  portalSaveSettings:        mock_portalSaveSettings,
  portalAddPortalUser:       mock_portalAddPortalUser,
  portalRemovePortalUser:    mock_portalRemovePortalUser,
  portalGetDepartments:      mock_portalGetDepartments,
  portalGetEmployees:        mock_portalGetEmployees,
};

// Simulates realistic network latency in mock mode
const mockDelay = (ms = 600) => new Promise(r => setTimeout(r, ms));

// ─── BASE CONFIG ──────────────────────────────────────────────────────────────
// Used by production path only — not referenced in DEV_MODE
const BASE_URL = 'https://people.zoho.com'; // eslint-disable-line no-unused-vars

// ─── HOOK ─────────────────────────────────────────────────────────────────────
export function useGateway() {
  const invoke = async (fnName, params = {}) => {

    // ── MOCK PATH (DEV_MODE = true) ──────────────────────────────────────────
    // Each call is routed to its mock handler in mockData.js.
    // Handlers receive params so they can simulate param-dependent responses
    // (e.g. period-specific records, duplicate-guard errors).
    if (DEV_MODE) {
      await mockDelay();
      const handler = MOCK_HANDLERS[fnName];
      if (!handler) throw new Error(`[DEV_MODE] No mock handler defined for: ${fnName}`);
      return handler(params);
    }

    // ── PRODUCTION PATH ──────────────────────────────────────────────────────
    // Real Zoho People JS SDK invocation.
    // DO NOT REMOVE — this is the live API call that runs in production.
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
