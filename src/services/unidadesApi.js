import { ApiError, apiGet, condominioIdFromToken } from './api.js'

// Converte ApartamentoResponseDTO para o formato de unidade usado pelas telas.
// Proprietários/moradores ainda não vêm da API; ficam vazios até o vínculo existir no backend.
export function toUnit(apartamento, towerNames = {}) {
  return {
    id: apartamento.id,
    number: apartamento.numero || '',
    tower: apartamento.torreId ? towerNames[apartamento.torreId] || '' : '',
    status: (apartamento.status || '').toUpperCase(),
    owners: [],
    residents: [],
  }
}

// O filtro por condomínio vem do token: sem ele, o backend listaria unidades de todos os condomínios.
export async function listarUnidades(options) {
  const condominioId = condominioIdFromToken()
  if (!condominioId) throw new ApiError(401, 'Sessão inválida ou expirada. Entre novamente.')
  const [torres, apartamentos] = await Promise.all([
    apiGet('/condominios/torres', { condominioId }, options),
    apiGet('/condominios/apartamentos', { condominioId }, options),
  ])
  const towerNames = Object.fromEntries(torres.map((torre) => [torre.id, torre.nome]))
  return apartamentos.map((apartamento) => toUnit(apartamento, towerNames))
}
