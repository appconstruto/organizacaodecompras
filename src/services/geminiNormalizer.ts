import { normalizeProduct } from './productNormalizer';
import type { NormalizedProduct } from './productNormalizer';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export async function normalizeProductWithAI(
  descricaoOriginal: string,
  unidadeOriginal?: string
): Promise<NormalizedProduct> {
  // If API key is not configured, fall back to local heuristics
  if (!GEMINI_API_KEY) {
    return normalizeProduct(descricaoOriginal, unidadeOriginal);
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const prompt = `Você é um motor de normalização de produtos de supermercado para um app de controle de compras.
Dada a descrição original do produto em um cupom fiscal e a unidade de medida original, você deve normalizar os dados retornando um JSON estruturado.

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

Retorne APENAS um objeto JSON válido (sem markdown, sem blocos de código \`\`\`json) no formato:
{
  "nomePadronizado": "Nome Padronizado com Primeira Letra Maiúscula (ex: Mandioquinha)",
  "marca": "Nome da marca ou 'Genérica'",
  "categoriaId": 6,
  "unidadeBase": "kg",
  "multiplicadorBase": 1.0
}

Entrada:
Descrição Original: "${descricaoOriginal}"
Unidade Original: "${unidadeOriginal || 'Não informada'}"`;

    const response = await fetch(url, {
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
    });

    if (!response.ok) {
      throw new Error(`Failed to call Gemini API: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
      const parsed = JSON.parse(text.trim());
      return {
        nomePadronizado: parsed.nomePadronizado,
        marca: parsed.marca || 'Genérica',
        categoriaId: Number(parsed.categoriaId) || 10,
        unidadeBase: parsed.unidadeBase as 'kg' | 'L' | 'unidades',
        multiplicadorBase: Number(parsed.multiplicadorBase) || 1.0
      };
    }
  } catch (error) {
    console.error('Error in Gemini normalization, falling back to heuristics:', error);
  }

  // Fallback if AI fails or returns invalid response
  return normalizeProduct(descricaoOriginal, unidadeOriginal);
}
