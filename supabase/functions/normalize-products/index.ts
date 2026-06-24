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
    const { items } = await req.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum item fornecido para normalização' }),
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

    const prompt = `Você é um motor de normalização de produtos de supermercado para um app de controle de compras.
Dada uma lista de itens com descrição original e unidade original, você deve normalizar cada um dos itens retornando um array JSON contendo os dados estruturados na mesma ordem.

Categorias disponíveis:
1: Alimentos
2: Bebidas
3: Limpeza
4: Higiene
5: Açougue
6: Hortifruti
7: Padaria
8: Congelados
9: Pet
10: Outros

Unidades base permitidas: 'kg', 'L', 'unidades'.
- Se o produto for vendido por peso (legumes, carnes a granel, etc.), a unidadeBase deve ser 'kg'.
- Se for bebida/líquido (refrigerante, leite, amaciante líquido), a unidadeBase deve ser 'L'.
- Caso contrário (biscoitos, enlatados, sabonete em barra), deve ser 'unidades'.

O multiplicadorBase representa o peso/volume unitário em relação à unidade base (ex: amaciante de 900ml -> 0.9, café de 500g -> 0.5, arroz de 5kg -> 5.0). Para itens vendidos a granel ou por unidade padrão, use 1.0.

ATENÇÃO:
1. Retorne APENAS um array JSON válido (sem blocos de código \`\`\`json) contendo os objetos normalizados no formato:
[
  {
    "nomePadronizado": "Nome Padronizado com Primeira Letra Maiúscula (ex: Mandioquinha)",
    "marca": "Nome da marca ou 'Genérica'",
    "categoriaId": 6,
    "unidadeBase": "kg",
    "multiplicadorBase": 1.0
  }
]
2. Preserve estritamente a ordem de entrada dos itens no array de retorno.
3. Não invente ou alucine marcas ou dados se não estiverem explícitos na descrição (use 'Genérica' se não for óbvio).

Entrada:
${JSON.stringify(items, null, 2)}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
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
