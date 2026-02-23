import api from './api'

export async function getSummary() {
  const { data } = await api.get('/dashboard/summary')
  return data
}

export async function getActivities(page = 1, limit = 20) {
  const { data } = await api.get('/dashboard/activities', {
    params: { page, limit },
  })
  return data
}
