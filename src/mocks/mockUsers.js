// Contas públicas e fictícias para desenvolvimento sem API (VITE_API_URL vazio).
// Não constituem autenticação segura. Com a API ligada, o login usa POST /auth/login.
// CPFs propositalmente inválidos (dígitos verificadores errados): não pertencem a ninguém.
export const mockUsers = [
  { cpf: '000.000.000-01', password: 'CondoDev123!', profile: 'ADMINISTRADOR' },
  { cpf: '000.000.000-02', password: 'CondoDev123!', profile: 'PORTEIRO' },
  { cpf: '000.000.000-03', password: 'CondoDev123!', profile: 'MORADOR' },
]

const profilePaths = { ADMINISTRADOR: '/admin', PORTEIRO: '/portaria', MORADOR: '/morador' }
const digits = (value) => String(value).replace(/\D/g, '')

export function validateMockLogin(cpf = '', password = '') {
  const invalidFields = []
  if (!cpf.trim()) invalidFields.push('cpf')
  if (!password.trim()) invalidFields.push('password')
  if (invalidFields.length) return { error: 'Preencha o CPF e a senha.', invalidFields }
  const account = mockUsers.find((user) => digits(user.cpf) === digits(cpf) && user.password === password)
  if (!account) return { error: 'CPF ou senha inválidos.', invalidFields: ['cpf', 'password'] }
  return { path: profilePaths[account.profile] }
}
