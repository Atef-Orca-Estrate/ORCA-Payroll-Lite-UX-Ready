import { DEV_MODE } from './useGateway';

// Mock user for DEV_MODE — matches EMP001 = admin in mock portalGetSettings
const MOCK_USER = { employeeId: 'EMP001', email: 'admin@example.com', name: 'Admin User' };

// Wait for ZOHO SDK to become available on window (max 5s)
const waitForSDK = () => new Promise((resolve, reject) => {
  if (window.ZOHO) { resolve(window.ZOHO); return; }
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (window.ZOHO) { clearInterval(interval); resolve(window.ZOHO); }
    else if (attempts > 50) { clearInterval(interval); reject(new Error('Zoho SDK failed to load')); }
  }, 100);
});

export function useSDK() {
  // Initialize the SDK and resolve user identity
  // Returns: { employeeId, email, name }
  const init = () => new Promise(async (resolve, reject) => {
    if (DEV_MODE) {
      setTimeout(() => resolve(MOCK_USER), 400);
      return;
    }
    try {
      const ZOHO = await waitForSDK();
      ZOHO.embeddedApp.on('PageLoad', (data) => {
        resolve({
          employeeId: data.employeeId || data.EmployeeID || '',
          email:      data.Email || data.email || '',
          name:       data.Name  || data.name  || ''
        });
      });
      ZOHO.embeddedApp.init();
    } catch (err) {
      reject(err);
    }
  });

  return { init };
}
