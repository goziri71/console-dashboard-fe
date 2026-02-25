import api from './api'

function getApiOrigin() {
  try {
    return new URL(api.defaults.baseURL).origin
  } catch {
    return window.location.origin
  }
}

export async function getWalletsPage(params = {}, signal) {
  const url = `${getApiOrigin()}/1.202602.0/wallets/page`
  const { data } = await api.get(url, { params, signal })
  return data
}
