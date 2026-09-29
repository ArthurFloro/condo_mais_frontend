import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, apiGet, condominioIdFromToken, setToken, tokenClaims } from '../src/services/api.js'
import { listarUnidades, toUnit } from '../src/services/unidadesApi.js'

// sessionStorage mínimo para o Node; cada teste define o próprio token.
const storage = new Map()
globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) }

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const fakeJwt = (claims) => `${base64url({ alg: 'HS256' })}.${base64url(claims)}.assinatura`

function fakeFetch(routes) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    const route = routes.find(([prefix]) => url.includes(prefix))
    if (!route) return { ok: false, status: 404, json: async () => ({}) }
    const [, status, body] = route
    return { ok: status < 400, status, json: async () => body }
  }
  return { fetchImpl, calls }
}

test('lê claims do token, inclusive com acentos, e rejeita token malformado', () => {
  const token = fakeJwt({ sub: '12345678900', perfil: 'Administração', condominio_id: 'c-1' })
  assert.equal(tokenClaims(token).perfil, 'Administração')
  assert.equal(condominioIdFromToken(token), 'c-1')
  assert.equal(tokenClaims('nao-eh-jwt'), null)
  assert.equal(condominioIdFromToken(''), '')
})

test('apiGet envia bearer token e ignora parâmetros vazios', async () => {
  setToken('token-teste')
  const { fetchImpl, calls } = fakeFetch([['/condominios/torres', 200, []]])
  await apiGet('/condominios/torres', { condominioId: 'c-1', torreId: '', outro: null }, { fetchImpl })
  assert.match(calls[0].url, /\/condominios\/torres\?condominioId=c-1$/)
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token-teste')
})

test('apiGet converte falhas HTTP e de rede em ApiError com mensagem amigável', async () => {
  setToken('token-teste')
  const unauthorized = fakeFetch([['/x', 403, {}]])
  await assert.rejects(apiGet('/x', {}, unauthorized), (error) => error instanceof ApiError && error.status === 403 && /Sessão inválida/.test(error.message))
  const offline = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(apiGet('/x', {}, { fetchImpl: offline }), (error) => error.status === 0 && /conectar ao servidor/.test(error.message))
})

test('apartamento vira unidade com nome da torre; sem torre fica em branco', () => {
  const towers = { 't-a': 'Torre A' }
  assert.deepEqual(toUnit({ id: 'ap-1', numero: '203', status: 'ocupado', torreId: 't-a', condominioId: 'c-1' }, towers), { id: 'ap-1', number: '203', tower: 'Torre A', status: 'OCUPADO', owners: [], residents: [] })
  assert.equal(toUnit({ id: 'ap-2', numero: '10', status: null, torreId: null }, towers).tower, '')
  assert.equal(toUnit({ id: 'ap-2', numero: '10', status: null, torreId: null }, towers).status, '')
})

test('listarUnidades filtra pelo condomínio do token e junta torres', async () => {
  setToken(fakeJwt({ condominio_id: 'c-1' }))
  const { fetchImpl, calls } = fakeFetch([
    ['/condominios/torres', 200, [{ id: 't-a', nome: 'Torre A', condominioId: 'c-1' }]],
    ['/condominios/apartamentos', 200, [{ id: 'ap-1', numero: '203', status: 'LIVRE', torreId: 't-a', condominioId: 'c-1' }]],
  ])
  const units = await listarUnidades({ fetchImpl })
  assert.deepEqual(units.map((unit) => [unit.number, unit.tower, unit.status]), [['203', 'Torre A', 'LIVRE']])
  assert.ok(calls.every((call) => call.url.includes('condominioId=c-1')))
})

test('listarUnidades sem condomínio no token não consulta a API', async () => {
  setToken('')
  const { fetchImpl, calls } = fakeFetch([])
  await assert.rejects(listarUnidades({ fetchImpl }), (error) => error.status === 401)
  assert.equal(calls.length, 0)
})
