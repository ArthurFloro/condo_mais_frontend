// Cliente HTTP da API Condo+. Sem VITE_API_URL, o app continua usando apenas os mocks locais.
const env = import.meta.env || {}
const TOKEN_KEY = 'condoplus.token'

export const API_URL = (env.VITE_API_URL || '').replace(/\/+$/, '')

export function apiEnabled() { return Boolean(API_URL) }

export class ApiError extends Error {
  constructor(status, message) { super(message); this.name = 'ApiError'; this.status = status }
}

// Enquanto o login real não estiver integrado, VITE_API_TOKEN permite testar em desenvolvimento.
export function getToken() {
  try { const stored = sessionStorage.getItem(TOKEN_KEY); if (stored) return stored } catch { /* sem sessionStorage */ }
  return env.VITE_API_TOKEN || ''
}

export function setToken(token) {
  try { if (token) sessionStorage.setItem(TOKEN_KEY, token); else sessionStorage.removeItem(TOKEN_KEY) } catch { /* sem sessionStorage */ }
}

// Lê as claims do JWT sem validar a assinatura: serve só para escopo de requisição; quem valida é o servidor.
export function tokenClaims(token = getToken()) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(Array.from(atob(payload), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')))
  } catch { return null }
}

export function condominioIdFromToken(token = getToken()) { return tokenClaims(token)?.condominio_id || '' }

function errorMessage(status) {
  if (status === 401 || status === 403) return 'Sessão inválida ou expirada. Entre novamente.'
  if (status === 404) return 'Registro não encontrado.'
  if (status >= 500) return 'O servidor não conseguiu concluir a operação. Tente novamente.'
  return 'Não foi possível concluir a operação.'
}

export async function apiGet(path, params = {}, { fetchImpl = fetch } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
  const token = getToken()
  let response
  try {
    response = await fetchImpl(`${API_URL}${path}${query ? `?${query}` : ''}`, { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique sua conexão.')
  }
  if (!response.ok) throw new ApiError(response.status, errorMessage(response.status))
  return response.status === 204 ? null : response.json()
}
