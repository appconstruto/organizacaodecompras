import { supabase } from './supabaseClient';
import { normalizeProduct } from './productNormalizer';
import type { NormalizedProduct } from './productNormalizer';

/**
 * Normalizes a single product by wrapping the batch normalizer.
 */
export async function normalizeProductWithAI(
  descricaoOriginal: string,
  unidadeOriginal?: string
): Promise<NormalizedProduct> {
  try {
    const results = await normalizeProductsWithAI([{ descricao: descricaoOriginal, unidade: unidadeOriginal }]);
    if (results && results.length > 0) {
      return results[0];
    }
  } catch (error) {
    console.error('Error in single AI normalization, falling back to heuristics:', error);
  }
  return normalizeProduct(descricaoOriginal, unidadeOriginal);
}

/**
 * Normalizes an array of products in a single batch call to the backend Edge Function.
 */
export async function normalizeProductsWithAI(
  items: Array<{ descricao: string; unidade?: string }>
): Promise<NormalizedProduct[]> {
  if (!items || items.length === 0) return [];

  try {
    const { data, error } = await supabase.functions.invoke('normalize-products', {
      body: { items }
    });

    if (error) {
      throw error;
    }

    if (data && Array.isArray(data)) {
      return data.map((parsed: any) => ({
        nomePadronizado: parsed.nomePadronizado,
        marca: parsed.marca || 'Genérica',
        categoriaId: Number(parsed.categoriaId) || 10,
        unidadeBase: parsed.unidadeBase as 'kg' | 'L' | 'unidades',
        multiplicadorBase: Number(parsed.multiplicadorBase) || 1.0
      }));
    }
  } catch (error) {
    console.error('Error in batch AI normalization, falling back to heuristics:', error);
  }

  // Fallback to local heuristics for each item
  return items.map(item => normalizeProduct(item.descricao, item.unidade));
}
