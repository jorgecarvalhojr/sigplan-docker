import { cache } from 'react'

const CBMERJ_LOCATION = process.env.CBMERJ_LOCATION || ''
const CBMERJ_URI = process.env.CBMERJ_URI || ''
const SECRET_ID = process.env.SECRET_ID || ''
const SECRET_KEY = process.env.SECRET_KEY || ''

async function soapRequest(method: string, paramsXml: string) {
  if (!CBMERJ_LOCATION) return null

  const soapXml = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
      <soap:Body>
        <${method} xmlns="${CBMERJ_URI}">
          ${paramsXml}
        </${method}>
      </soap:Body>
    </soap:Envelope>`

  const headers: Record<string, string> = {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': `${CBMERJ_URI}#${method}`,
    'User-Agent': 'NextJS-Client'
  }

  if (SECRET_ID && SECRET_KEY) {
    headers['secretid'] = SECRET_ID
    headers['secretkey'] = SECRET_KEY
  }

  try {
    const response = await fetch(CBMERJ_LOCATION, {
      method: 'POST',
      headers,
      body: soapXml,
      next: { revalidate: 0 }
    })

    if (!response.ok) return null
    return await response.text()
  } catch (error) {
    console.error('SOAP Request Error:', error)
    return null
  }
}

export async function autenticarCbmerj(rg: string, password: string) {
  // Garantir que o RG tenha 7 dígitos (zeros à esquerda)
  const rgFormatado = rg.trim().padStart(7, '0')

  console.log(`📡 1. Tentando Login para RG ${rgFormatado}...`)

  // --- PASSO 1: LOGIN (Verifica Senha) ---
  const loginParams = `<rg>${rgFormatado}</rg><password>${password}</password>`
  const loginResponse = await soapRequest('login', loginParams)

  if (!loginResponse || !loginResponse.toLowerCase().includes('true')) {
    console.warn("⛔ Login falhou (Senha inválida ou erro).")
    return null
  }

  console.log("✅ Senha correta! Buscando dados do militar...")

  // --- PASSO 2: BUSCAR DADOS (Método 'militar') ---
  const militarParams = `<rg>${rgFormatado}</rg>`
  const militarResponse = await soapRequest('militar', militarParams)

  const dadosUsuario = {
    rg: rgFormatado,
    nome: 'Militar CBMERJ',
    posto: '',
    unidade: ''
  }

  if (militarResponse) {
    try {
      // Tenta extrair JSON do retorno (o método 'militar' costuma retornar JSON)
      const startJson = militarResponse.indexOf('{')
      const endJson = militarResponse.lastIndexOf('}') + 1

      if (startJson !== -1 && endJson !== -1) {
        const jsonStr = militarResponse.substring(startJson, endJson)
        const data = JSON.parse(jsonStr)

        if (typeof data === 'object' && data !== null) {
          dadosUsuario.nome = data.nome || data.nm_pessoa || 'Militar'
          dadosUsuario.posto = data.graduacao || data.nm_graduacao || ''
          dadosUsuario.unidade = data.unidade || data.nm_unidade || ''
          console.log(`✅ Dados recuperados: ${dadosUsuario.nome}`)
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao processar dados do militar: ${error}`)
    }
  }

  return dadosUsuario
}
