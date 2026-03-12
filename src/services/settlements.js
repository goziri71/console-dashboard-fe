import api from './api'

export async function getSettlementSummary() {
  const { data } = await api.get('/settlements/summary')
  return data
}

export async function getSettlementBatches(params = {}) {
  const { data } = await api.get('/settlements/batches', { params })
  return data
}

export async function getSettlementBatch(batchId) {
  const { data } = await api.get(`/settlements/batches/${batchId}`)
  return data
}
