# Developer Instructions — ORCA Payroll Lite 2.0

> This document covers everything a developer needs to set up, configure, build, and deploy the ORCA Payroll Lite 2.0 system. It is intended for developers onboarding onto the project or picking up the codebase for the first time.

---

## 1. Prerequisites

<!-- List all required tools, accounts, and access needed before starting -->

---

## 2. Repository Structure

<!-- Brief orientation to the repo layout — point to README.md for the full breakdown -->

---

## 3. Local Development Setup

### 3.1 Cloning the Repository

<!-- git clone instructions, branch conventions -->

### 3.2 Web Tab (React SPA)

<!-- npm install, DEV_MODE flag, npm run dev, localhost URL -->

### 3.3 Environment & SDK Mocking

<!-- How DEV_MODE works, where mock data lives, how to add mock responses -->

---

## 4. Zoho People Configuration

### 4.1 Required Org Variables

<!-- The 7 org variables — names, group, initial JSON values to paste -->

### 4.2 Custom Forms

<!-- The 4 forms — how to create them, field types, required flags -->

### 4.3 Custom Fields on P_Employee

<!-- The 8 custom fields — names, types, nullable rules -->

### 4.4 Workflow Rules

<!-- The 3 workflow rules — conditions, timing, function targets -->

---

## 5. Deploying Deluge Functions

### 5.1 Gateway Functions

<!-- How to create each of the 7 gateway functions in Zoho People -->

### 5.2 Core Engine Functions

<!-- How to deploy runPayrollOrchestrator, processPayrollBatch, calculateEmployeePayroll -->

### 5.3 Termination Functions

<!-- onEmployeeTermination, processTerminationRun, standalone calc functions -->

### 5.4 Function Naming Conventions

<!-- Exact function names as they must appear in Zoho — case-sensitive -->

---

## 6. Building & Packaging the Web Tab

### 6.1 Pre-build Checklist

<!-- DEV_MODE = false, version bump, any env checks -->

### 6.2 Build Command

<!-- npm run build output location -->

### 6.3 Packaging with Zoho CLI

<!-- zet pack, zip output location, CLI version requirement -->

### 6.4 Uploading the Extension

<!-- Zoho People → Setup → Extensions — step by step -->

### 6.5 Tab Visibility Configuration

<!-- Which profiles get access to the web tab -->

---

## 7. First-Time Deployment Sequence

<!-- The exact order to deploy everything for a fresh Zoho org — org variables first, then forms, then functions, then extension -->

---

## 8. Configuration Reference

### 8.1 PAYROLL_PORTAL_CONFIG — Initial Values

<!-- The JSON to paste for first setup — roles map, users map, config defaults -->

### 8.2 SI_CONFIG_JSON — Annual Update Procedure

<!-- When and how to update the SI ceiling each fiscal year -->

### 8.3 Tax Brackets — Update Procedure

<!-- When and how to update TAX_BRACKETS_STD_JSON and TAX_BRACKETS_HI_JSON if the law changes -->

---

## 9. DEV_MODE vs Production Mode

<!-- Clear explanation of the flag, what it controls, and why it must be false in production -->

---

## 10. Common Errors & Troubleshooting

<!-- Table or list of known errors, their causes, and fixes -->

---

## 11. Making Changes

### 11.1 Adding a New Feature Module

<!-- Steps to add a new feature to the web tab — permissions, Nav, Shell, new component -->

### 11.2 Adding a New Gateway Function

<!-- Steps to add a new Deluge gateway function and wire it up in useGateway.js -->

### 11.3 Modifying Calculation Logic

<!-- Where the calc functions live, how to test changes safely -->

---

## 12. Known Limitations (Pilot Scope)

<!-- Reference the README Known Pilot Gaps — add any developer-specific gotchas here -->

---

## 13. Contacts & Ownership

<!-- Who to contact for Zoho org access, repo access, client-side questions -->

---

*Last updated: —*
