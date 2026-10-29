function getApiBase(): string {
  const envUrl = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
  if (!envUrl || envUrl === '/api') return '/api';
  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
}

const API_BASE = getApiBase();

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('athiveera_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (res.status === 401) {
    localStorage.removeItem('athiveera_token');
    localStorage.removeItem('athiveera_user');
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (text.startsWith('<!DOCTYPE') || text.includes('<html')) {
      throw new Error(`Cannot reach Backend API at ${API_BASE}. Please ensure your backend is deployed and VITE_API_URL is configured in Netlify.`);
    }
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data;
}

function cleanQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, rawVal] of Object.entries(params)) {
    let val = rawVal;
    if (val && typeof val === 'object' && ('_id' in val || 'id' in val)) {
      val = (val as any)._id || (val as any).id;
    }
    const strVal = String(val ?? '').trim();
    if (
      strVal !== '' &&
      strVal !== 'undefined' &&
      strVal !== 'null' &&
      strVal !== '[object Object]'
    ) {
      searchParams.append(key, strVal);
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export const api = {
  // Auth
  getSetupStatus: () => apiRequest('/auth/setup-status'),
  setupInitialAdmin: (data: any) => apiRequest('/auth/setup-initial', { method: 'POST', body: JSON.stringify(data) }),
  login: (credentials: any) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => apiRequest('/auth/me'),

  // Branches
  getBranches: () => apiRequest('/branches'),
  createBranch: (data: any) => apiRequest('/branches', { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (id: string, data: any) => apiRequest(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBranch: (id: string) => apiRequest(`/branches/${id}`, { method: 'DELETE' }),

  // Users
  getUsers: (params?: any) => apiRequest(`/users${cleanQuery(params)}`),
  createUser: (data: any) => apiRequest('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => apiRequest(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => apiRequest(`/users/${id}`, { method: 'DELETE' }),

  // Customers
  getCustomers: (params?: any) => apiRequest(`/customers${cleanQuery(params)}`),
  getCustomer: (id: string) => apiRequest(`/customers/${id}`),
  createCustomer: (data: any) => apiRequest('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: any) => apiRequest(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: string) => apiRequest(`/customers/${id}`, { method: 'DELETE' }),

  // Groups
  getGroups: (params?: any) => apiRequest(`/groups${cleanQuery(params)}`),
  getGroup: (id: string) => apiRequest(`/groups/${id}`),
  createGroup: (data: any) => apiRequest('/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateGroup: (id: string, data: any) => apiRequest(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGroup: (id: string) => apiRequest(`/groups/${id}`, { method: 'DELETE' }),

  // Loans
  getLoans: (params?: any) => apiRequest(`/loans${cleanQuery(params)}`),
  getLoan: (id: string) => apiRequest(`/loans/${id}`),
  updateLoan: (id: string, data: any) => apiRequest(`/loans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLoan: (id: string) => apiRequest(`/loans/${id}`, { method: 'DELETE' }),
  getLoanPresets: () => apiRequest('/loans/presets'),
  getLoanTiers: () => apiRequest('/loan-tiers'),
  createLoanTier: (data: any) => apiRequest('/loan-tiers', { method: 'POST', body: JSON.stringify(data) }),
  updateLoanTier: (id: string, data: any) => apiRequest(`/loan-tiers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLoanTier: (id: string) => apiRequest(`/loan-tiers/${id}`, { method: 'DELETE' }),
  resetLoanTiers: () => apiRequest('/loan-tiers/reset-canonical', { method: 'POST' }),
  calculateLoan: (data: any) => apiRequest('/loans/calculate', { method: 'POST', body: JSON.stringify(data) }),
  applyLoan: (data: any) => apiRequest('/loans/apply', { method: 'POST', body: JSON.stringify(data) }),
  createManagerLoan: (data: any) => apiRequest('/loans/create-manager-loan', { method: 'POST', body: JSON.stringify(data) }),
  assignLoanStaff: (id: string, staffId: string, transferType: 'PERMANENT' | 'TEMPORARY' = 'PERMANENT', remarks?: string) => 
    apiRequest(`/loans/${id}/assign-staff`, { method: 'PUT', body: JSON.stringify({ staffId, transferType, remarks }) }),
  transferLoanBulk: (data: { loanIds: string[]; staffId: string; transferType: 'PERMANENT' | 'TEMPORARY'; remarks?: string }) =>
    apiRequest('/loans/transfer-bulk', { method: 'POST', body: JSON.stringify(data) }),
  verifyLoan: (id: string, data: any) => apiRequest(`/loans/${id}/verify`, { method: 'POST', body: JSON.stringify(data) }),
  approveLoan: (id: string, remarks?: string) => apiRequest(`/loans/${id}/approve`, { method: 'POST', body: JSON.stringify({ remarks }) }),
  rejectLoan: (id: string, remarks?: string) => apiRequest(`/loans/${id}/reject`, { method: 'POST', body: JSON.stringify({ remarks }) }),
  disburseLoan: (id: string, disbursementDate?: string) => apiRequest(`/loans/${id}/disburse`, { method: 'POST', body: JSON.stringify({ disbursementDate }) }),
  getSettlementQuote: (id: string) => apiRequest(`/loans/${id}/settlement-quote`),
  settleLoan: (id: string, data: any) => apiRequest(`/loans/${id}/settle`, { method: 'POST', body: JSON.stringify(data) }),

  // Field Enquiries (Collection Staff & Manager)
  getEnquiries: (params?: any) => apiRequest(`/enquiries${cleanQuery(params)}`),
  createEnquiry: (data: any) => apiRequest('/enquiries', { method: 'POST', body: JSON.stringify(data) }),
  reviewEnquiry: (id: string, data: { status: 'APPROVED' | 'REJECTED'; managerRemarks: string }) => 
    apiRequest(`/enquiries/${id}/review`, { method: 'PUT', body: JSON.stringify(data) }),
  submitEnquiryKyc: (id: string, data: any) => 
    apiRequest(`/enquiries/${id}/kyc`, { method: 'POST', body: JSON.stringify(data) }),
  submitEnquiryMemberKyc: (id: string, data: any) =>
    apiRequest(`/enquiries/${id}/member-kyc`, { method: 'POST', body: JSON.stringify(data) }),
  deleteEnquiryMember: (id: string, memberIndex: number) =>
    apiRequest(`/enquiries/${id}/member/${memberIndex}`, { method: 'DELETE' }),
  deleteEnquiry: (id: string) => apiRequest(`/enquiries/${id}`, { method: 'DELETE' }),

  // Collections
  getDailySheet: (params?: any) => apiRequest(`/collections/daily-sheet${cleanQuery(params)}`),
  getWeeklySheet: (params?: any) => apiRequest(`/collections/weekly-sheet${cleanQuery(params)}`),
  getStaffCollections: (params?: any) => apiRequest(`/collections/staff-summary${cleanQuery(params)}`),
  recordCollection: (data: any) => apiRequest('/collections/record', { method: 'POST', body: JSON.stringify(data) }),
  recordGroupCollection: (data: any) => apiRequest('/collections/record-group', { method: 'POST', body: JSON.stringify(data) }),
  getReceipt: (receiptNumber: string) => apiRequest(`/collections/receipt/${receiptNumber}`),
  reversePayment: (id: string, reason: string) => apiRequest(`/collections/reverse/${id}`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Pending
  getPending: (params?: any) => apiRequest(`/pending${cleanQuery(params)}`),
  recordFollowUp: (data: any) => apiRequest('/pending/follow-up', { method: 'POST', body: JSON.stringify(data) }),

  // Cashbook & Daily Ledger & Denominations
  getCashbook: (params?: any) => apiRequest(`/cashbook${cleanQuery(params)}`),
  getDailyLedger: (params?: any) => apiRequest(`/cashbook/daily-ledger${cleanQuery(params)}`),
  getDenominations: (params?: any) => apiRequest(`/cashbook/denominations${cleanQuery(params)}`),
  saveDenominations: (data: any) => apiRequest('/cashbook/denominations', { method: 'POST', body: JSON.stringify(data) }),
  createCashbookEntry: (data: any) => apiRequest('/cashbook/entry', { method: 'POST', body: JSON.stringify(data) }),

  // Expenses
  getExpenses: (params?: any) => apiRequest(`/expenses${cleanQuery(params)}`),
  createExpense: (data: any) => apiRequest('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id: string, data: any) => apiRequest(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => apiRequest(`/expenses/${id}`, { method: 'DELETE' }),
  approveExpense: (id: string) => apiRequest(`/expenses/${id}/approve`, { method: 'PUT' }),

  // Transfers
  getTransfers: (params?: any) => apiRequest(`/transfers${cleanQuery(params)}`),
  createTransfer: (data: any) => apiRequest('/transfers', { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getDailyReport: (params?: any) => apiRequest(`/reports/daily${cleanQuery(params)}`),
  getWeeklyReport: (params?: any) => apiRequest(`/reports/weekly${cleanQuery(params)}`),
  getMonthlyReport: (params?: any) => apiRequest(`/reports/monthly${cleanQuery(params)}`),
  getPendingEmiReport: (params?: any) => apiRequest(`/reports/pending-emi${cleanQuery(params)}`),
  getProfitLossReport: (params?: any) => apiRequest(`/reports/profit-loss${cleanQuery(params)}`),
  getBranchWiseReport: () => apiRequest('/reports/branch-wise'),

  // Dashboard
  getDashboardMetrics: (params?: any) => apiRequest(`/dashboard/metrics${cleanQuery(params)}`),
  getDashboardCharts: (params?: any) => apiRequest(`/dashboard/charts${cleanQuery(params)}`),

  // Import
  getImportPreview: () => apiRequest('/import/preview'),
  executeImport: () => apiRequest('/import/execute', { method: 'POST' }),

  // Audit
  getAuditLogs: (params?: any) => apiRequest(`/audit${cleanQuery(params)}`),

  // Settings
  getSettings: () => apiRequest('/settings'),
  updateSettings: (data: any) => apiRequest('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Master Database & Ledger Management
  getMasterDataStats: () => apiRequest('/master-data/stats'),
  getMasterCustomers: (params?: any) => apiRequest(`/master-data/customers${cleanQuery(params)}`),
  updateMasterCustomer: (id: string, data: any) => apiRequest(`/master-data/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  mergeCustomers: (data: { sourceCustomerId: string; targetCustomerId: string }) => apiRequest('/master-data/customers/merge', { method: 'POST', body: JSON.stringify(data) }),
  autoDeduplicateCustomers: () => apiRequest('/master-data/customers/auto-deduplicate', { method: 'POST' }),
  getMasterLoans: (params?: any) => apiRequest(`/master-data/loans${cleanQuery(params)}`),
  updateMasterLoan: (id: string, data: any) => apiRequest(`/master-data/loans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getMasterLoanInstallments: (loanId: string) => apiRequest(`/master-data/loans/${loanId}/installments`),
  updateMasterInstallment: (id: string, data: any) => apiRequest(`/master-data/installments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  realignLoanScheduleDates: (loanId: string) => apiRequest(`/master-data/loans/${loanId}/realign-schedule-dates`, { method: 'POST' }),
  getMasterGroups: (params?: any) => apiRequest(`/master-data/groups${cleanQuery(params)}`),
  updateMasterGroup: (id: string, data: any) => apiRequest(`/master-data/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) })
};
