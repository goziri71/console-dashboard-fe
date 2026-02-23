export const dashboardMetrics = [
  {
    id: 'total-customers',
    label: 'Total Customers',
    value: '1,247',
    comparison: { value: 12, direction: 'up', label: 'Compared to last month' },
    iconColor: 'success',
  },
  {
    id: 'total-wallets',
    label: 'Total Wallets',
    value: '3,456',
    comparison: { value: 8, direction: 'up', label: 'Compared to last month' },
    iconColor: 'info',
  },
  {
    id: 'transactions-today',
    label: 'Transactions Today',
    value: '892',
    comparison: { value: 5, direction: 'down', label: 'Compared to yesterday' },
    iconColor: 'accent',
  },
  {
    id: 'open-disputes',
    label: 'Open Disputes',
    value: '1,247',
    comparison: null,
    iconColor: 'error',
  },
  {
    id: 'system-uptime',
    label: 'System Uptime',
    value: '99.98%',
    comparison: null,
    iconColor: 'accent',
  },
]

export const quickActions = [
  {
    id: 'bulk-transfer',
    title: 'Bulk Transfer',
    description: 'Move funds to multiple wallets in a single operation.',
    iconColor: 'info',
  },
  {
    id: 'open-investigation',
    title: 'Open Investigation',
    description: 'Start a review for suspicious or disputed transactions.',
    iconColor: 'warning',
  },
  {
    id: 'generate-compliance',
    title: 'Generate Compliance Report',
    description: 'Create jurisdiction-specific regulatory compliance reports.',
    iconColor: 'success',
  },
  {
    id: 'export-ledger',
    title: 'Export Ledger',
    description: 'Export transaction and balance ledger records for auditing.',
    iconColor: 'accent',
  },
  {
    id: 'freeze-account',
    title: 'Freeze Customer Account',
    description: 'Temporarily restrict a customer account from transactions.',
    iconColor: 'info',
  },
]

export const settlementStatus = {
  completedToday: 32349490023.11,
  pendingSettlements: 41932322.87,
  escrowBalance: 41932322.87,
}

export const operationalMonitoring = [
  { id: 'kyc', label: 'KYC Pending Approval', count: 8, iconColor: 'success' },
  { id: 'tier-upgrade', label: 'Tier Upgrade Pending Approval', count: 32, iconColor: 'info' },
  { id: 'id-verification', label: 'ID Verification Pending Approval', count: 12, iconColor: 'warning' },
]

export const currencyUsageData = [
  { currency: 'NGN', amount: 15500000 },
  { currency: 'USD', amount: 3200000 },
  { currency: 'ZAR', amount: 12800000 },
  { currency: 'GBP', amount: 13400000 },
  { currency: 'GHS', amount: 9400000 },
]

export const recentActivities = [
  {
    id: 1,
    description: 'Wallet #3456 created',
    author: 'AdminUser',
    timestamp: '2 mins ago',
    type: 'wallet',
  },
  {
    id: 2,
    description: 'Dispute #789 resolved successfully',
    author: 'Support Team',
    timestamp: '15 mins ago',
    type: 'dispute',
  },
  {
    id: 3,
    description: 'Transfer of ₦50,000 processed',
    author: 'System',
    timestamp: '23 mins ago',
    type: 'transfer',
  },
  {
    id: 4,
    description: 'New customer onboarded',
    author: 'Sales Team',
    timestamp: '1 hour ago',
    type: 'customer',
  },
  {
    id: 5,
    description: 'New dispute filed for transaction #1234',
    author: 'Customer Support',
    timestamp: '2 hours ago',
    type: 'dispute',
  },
  {
    id: 6,
    description: 'API integration test passed',
    author: 'DevOps',
    timestamp: '4 hours ago',
    type: 'system',
  },
  {
    id: 7,
    description: 'Dispute #789 resolved successfully',
    author: 'Support Team',
    timestamp: '15 mins ago',
    type: 'dispute',
  },
  {
    id: 8,
    description: 'Wallet #3445 balance updated',
    author: 'System',
    timestamp: '5 hours ago',
    type: 'wallet',
  },
  {
    id: 9,
    description: 'Transfer of ₦50,000 processed',
    author: 'System',
    timestamp: '23 mins ago',
    type: 'transfer',
  },
]
