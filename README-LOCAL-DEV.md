# Running ORCA Payroll Portal Locally

## Prerequisites
- Node.js 18+
- npm

## Steps

```bash
# 1. Clone the repo
git clone https://github.com/Atef-Orca-Estrate/ORCA-Payroll---Lite-2.0.git
cd ORCA-Payroll---Lite-2.0

# 2. Switch to the UI sandbox branch
git checkout ui/mock-frontend-sandbox

# 3. Install dependencies
cd webtab
npm install

# 4. Start the dev server
npm run dev
```

Then open **http://localhost:5173** in your browser.

## What runs in local mode

- `DEV_MODE = true` is hardcoded in `useGateway.js`
- All Zoho API calls are intercepted — no real Zoho connection needed
- Mock user: **EMP001 / admin** (full access to all features)
- Mock data lives in `webtab/src/hooks/mockData.js` — edit freely

## Error simulations active

| Action | Simulated behaviour |
|---|---|
| Create a run for an existing period | Duplicate period error |
| Click "Run payroll" for the first time | Orchestrator lock error — retry succeeds |
| Add a user that already exists | Duplicate user error |

## Before deploying to Zoho

1. Set `DEV_MODE = false` in `webtab/src/hooks/useGateway.js`
2. Uncomment the Zoho SDK script in `webtab/index.html`
3. Run `npm run build` — output goes to `webtab/app/`
4. Package with Zoho Extension CLI
