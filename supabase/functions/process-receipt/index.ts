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

ATENÇÃO:
1. NÃO retorne os textos explicativos ou placeholders de exemplo (como "CNPJ apenas numeros" ou "AAAA-MM-DD").
2. Se você NÃO encontrar um campo (como CNPJ, série ou número da nota), retorne null para aquele campo.
3. Se você não conseguir ler a data de emissão, retorne a data de hoje no formato YYYY-MM-DD.
4. Identifique o CNPJ do estabelecimento contendo apenas dígitos numéricos.
5. Identifique a chave de acesso de 44 dígitos se ela estiver visível na imagem (geralmente perto do QR Code ou no topo/fim do cupom). Se não achar, retorne null.

Retorne APENAS um objeto JSON válido no formato abaixo:
{
  "empresa": "Nome Real do Estabelecimento (ex: Supermercado Silva)",
  "cnpj": "12345678000199 (apenas os numeros reais)",
  "chaveAcesso": "352606564400270001506510... (apenas os 44 numeros se achar, senao null)",
  "numeroNota": "94882 (numero real da nota)",
  "serie": "103 (serie real da nota)",
  "dataEmissao": "2026-06-23 (data real extraida)",
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
