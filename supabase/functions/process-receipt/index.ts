import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageBase64, mimeType } = await req.json()

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma imagem fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Chave de API do Gemini não configurada no Supabase Secrets (GEMINI_API_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const prompt = `Analise esta imagem de um cupom fiscal brasileiro e extraia as informações estruturadas.
Você deve ler os dados reais presentes na imagem do cupom e preencher o JSON de retorno. 

ATENÇÃO CRÍTICA (NÃO INVENTE DADOS):
1. Se um campo não puder ser identificado com confiança superior a 80% ou não estiver presente na imagem, retorne null.
2. NUNCA gere CNPJ fictício (ex: "00.000.000/0000-00"), Número de nota fictício, Série fictícia, Chave de acesso fictícia ou Produtos inexistentes.
3. Se você NÃO encontrar ou não conseguir ler a data de emissão com certeza, retorne null. NUNCA retorne a data de hoje como fallback.
4. Identifique o CNPJ do estabelecimento contendo apenas dígitos numéricos (se achar, senão null).
5. Identifique a chave de acesso de 44 dígitos se ela estiver visível e legível (apenas números, senão null).

Retorne APENAS um objeto JSON válido no formato abaixo:
{
  "empresa": "Nome Real do Estabelecimento (ex: Supermercado Silva) ou null",
  "cnpj": "12345678000199 (apenas os numeros reais, ou null)",
  "chaveAcesso": "352606564400270001506510... (apenas os 44 numeros reais, ou null)",
  "numeroNota": "94882 (numero real da nota, ou null)",
  "serie": "103 (serie real da nota, ou null)",
  "dataEmissao": "2026-06-23 (data real no formato YYYY-MM-DD, ou null)",
  "valorTotal": 45.89,
  "itens": [
    {
      "descricao": "BANANA NANICA",
      "descricaoNormalizada": "Banana Nanica",
      "marca": "Genérica",
      "categoria": "Hortifruti",
      "quantidade": 1.255,
      "unidade": "KG",
      "valorUnitario": 4.99,
      "valorTotal": 6.26,
      "confidence": 95
    }
  ]
}`

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Erro na API do Gemini: ${errText}`)
    }

    const geminiData = await response.json()
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      throw new Error('Nenhuma resposta retornada do Gemini')
    }

    const result = JSON.parse(responseText.trim())

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || err }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
