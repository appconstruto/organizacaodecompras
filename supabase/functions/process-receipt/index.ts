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

    const prompt = `Analise esta imagem de um cupom fiscal brasileiro e extraia as informações estruturadas de forma extremamente precisa.
Você deve identificar:
- CNPJ do estabelecimento (apenas dígitos)
- Nome do estabelecimento (razao social ou fantasia)
- Data da compra (no formato ISO AAAA-MM-DD)
- Número da nota (NFC-e)
- Série
- Valor total
- Lista de produtos

Para cada produto, extraia a descrição exatamente como aparece no cupom (descricaoOriginal), gere uma versão normalizada (descricaoNormalizada), a marca e a categoria apropriada (ex: Alimentos, Bebidas, Limpeza, Higiene, Açougue, Hortifruti, Padaria, Congelados, Pet, Outros).
Adicione também um score de confiança (confidence) de 0 a 100 para cada produto indicando a certeza da leitura.

Retorne APENAS um objeto JSON válido no formato abaixo:
{
  "empresa": "Nome do mercado",
  "cnpj": "CNPJ apenas numeros",
  "numeroNota": "94882",
  "serie": "103",
  "dataEmissao": "AAAA-MM-DD",
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
