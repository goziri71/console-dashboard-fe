import api from './api'

export async function getComplianceOverview() {
  const { data } = await api.get('/compliance/overview')
  return data
}

export async function getComplianceVerificationStatus() {
  const { data } = await api.get('/compliance/verification-status')
  return data
}

export async function getComplianceRiskTrends() {
  const { data } = await api.get('/compliance/risk-trends')
  return data
}

export async function getComplianceAlerts() {
  const { data } = await api.get('/compliance/alerts')
  return data
}

export async function getComplianceActivity() {
  const { data } = await api.get('/compliance/activity')
  return data
}

export async function getComplianceReports() {
  const { data } = await api.get('/compliance/reports')
  return data
}
