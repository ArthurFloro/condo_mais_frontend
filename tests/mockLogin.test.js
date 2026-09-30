import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { mockUsers, validateMockLogin } from '../src/mocks/mockUsers.js'

for (const [profile, path] of [['ADMINISTRADOR', '/admin'], ['PORTEIRO', '/portaria'], ['MORADOR', '/morador']]) {
  test(`login válido de ${profile} direciona para ${path}`, () => {
    const account = mockUsers.find((user) => user.profile === profile)
    assert.deepEqual(validateMockLogin(account.cpf, account.password), { path })
  })
}

test('senha incorreta não fornece destino nem permite entrada', () => {
  for (const account of mockUsers) {
    for (const password of ['incorreta', account.password.toLowerCase(), ` ${account.password}`]) {
      const result = validateMockLogin(account.cpf, password)
      assert.equal(result.path, undefined)
      assert.equal(result.error, 'CPF ou senha inválidos.')
      assert.deepEqual(result.invalidFields, ['cpf', 'password'])
    }
  }
})

test('CPF inexistente e identificação antiga por e-mail não fornecem destino', () => {
  for (const cpf of ['111.111.111-11', 'admin@condomais.local', 'admin', '000.000.000-0']) {
    const result = validateMockLogin(cpf, mockUsers[0].password)
    assert.equal(result.path, undefined)
    assert.equal(result.error, 'CPF ou senha inválidos.')
  }
})

test('campos vazios indicam os controles obrigatórios sem permitir entrada', () => {
  for (const [cpf, password, invalidFields] of [
    ['', '', ['cpf', 'password']],
    [' ', mockUsers[0].password, ['cpf']],
    [mockUsers[0].cpf, ' ', ['password']],
  ]) {
    const result = validateMockLogin(cpf, password)
    assert.equal(result.path, undefined)
    assert.equal(result.error, 'Preencha o CPF e a senha.')
    assert.deepEqual(result.invalidFields, invalidFields)
  }
})

test('CPF aceita com ou sem pontuação, sem alterar a senha', () => {
  const account = mockUsers[0]
  assert.equal(validateMockLogin(account.cpf.replace(/\D/g, ''), account.password).path, '/admin')
  assert.equal(validateMockLogin(` ${account.cpf} `, account.password).path, '/admin')
})

test('login renderizado pede CPF, oculta senha e não exibe contas de desenvolvimento', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { default: LoginPage } = await server.ssrLoadModule('/src/pages/auth/LoginPage.jsx')
    const { AppDataProvider } = await server.ssrLoadModule('/src/context/AppDataContext.jsx')
    const html = renderToStaticMarkup(React.createElement(AppDataProvider, null, React.createElement(MemoryRouter, null, React.createElement(LoginPage))))
    assert.match(html, />CPF</)
    assert.match(html, /inputMode="numeric"|inputmode="numeric"/)
    assert.match(html, /placeholder="000.000.000-00"/)
    assert.doesNotMatch(html, /type="email"/)
    assert.match(html, /type="password"/)
    assert.match(html, /aria-required="true"/)
    assert.match(html, /Digite sua senha/)
    for (const account of mockUsers) {
      assert.ok(!html.includes(account.cpf))
      assert.ok(!html.includes(account.password))
    }
    assert.doesNotMatch(html, /demo-access|Escolha um perfil|Acessos de demonstração/)
    assert.doesNotMatch(html, />(?:Admin|Portaria|Morador)<\/button>/)
  } finally { await server.close() }
})

test('primeiro acesso pede CPF com máscara e mantém o fluxo demonstrativo no modo mock', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { default: AuthFlowPage } = await server.ssrLoadModule('/src/pages/auth/AuthFlowPage.jsx')
    const { AppDataProvider } = await server.ssrLoadModule('/src/context/AppDataContext.jsx')
    const render = (step, path) => renderToStaticMarkup(React.createElement(AppDataProvider, null, React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(AuthFlowPage, { step }))))
    const first = render('first', '/primeiro-acesso')
    assert.match(first, /Primeiro acesso/)
    assert.match(first, /inputMode="numeric"|inputmode="numeric"/)
    assert.match(first, /placeholder="000.000.000-00"/)
    const create = render('create', '/criar-senha')
    assert.match(create, /Ative sua conta|Informe seu CPF antes de criar a senha/)
  } finally { await server.close() }
})
