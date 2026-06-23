import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import { normalizeProduct } from '../services/productNormalizer';
import type { NormalizedProduct } from '../services/productNormalizer';
import type { ParsedNFCe } from '../services/nfcParser';

interface Product {
  id: string;
  nome_padronizado: string;
  marca: string;
  categoria_id: number;
  unidade_base: string;
}

interface Purchase {
  id: string;
  data: string;
  mercado: string;
  valor_total: number;
  origem_importacao: string;
  nota_fiscal_id?: string;
  itens?: PurchaseItem[];
}

interface PurchaseItem {
  id: string;
  compra_id: string;
  descricao_original: string;
  produto_id: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  produto?: Product;
}

interface Insight {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  data_geracao: string;
}

interface AppState {
  products: Product[];
  purchases: Purchase[];
  insights: Insight[];
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  importNfc: (parsed: ParsedNFCe, method: string) => Promise<boolean>;
  generateInsights: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  products: [],
  purchases: [],
  insights: [],
  loading: false,
  error: null,

  fetchData: async () => {
    set({ loading: true, error: null });
    try {
      // 1. Fetch products
      const { data: productsData, error: prodErr } = await supabase
        .from('produtos')
        .select('*')
        .order('nome_padronizado');

      if (prodErr) throw prodErr;

      // 2. Fetch purchases with items and their products
      const { data: purchasesData, error: purErr } = await supabase
        .from('compras')
        .select(`
          *,
          itens:itens_compra (
            *,
            produto:produtos (*)
          )
        `)
        .order('data', { ascending: false });

      if (purErr) throw purErr;

      // 3. Fetch insights
      const { data: insightsData, error: insErr } = await supabase
        .from('insights')
        .select('*')
        .order('data_geracao', { ascending: false });

      if (insErr) throw insErr;

      set({
        products: productsData || [],
        purchases: purchasesData || [],
        insights: insightsData || [],
        loading: false
      });
    } catch (err: any) {
      console.error('Error fetching data from Supabase:', err);
      set({ error: err.message, loading: false });
    }
  },

  importNfc: async (parsed: ParsedNFCe, method: string) => {
    set({ loading: true, error: null });
    try {
      // 1. Check for duplicate invoices if access key exists
      if (parsed.chaveAcesso) {
        const { data: existingNf, error: nfCheckErr } = await supabase
          .from('notas_fiscais')
          .select('id')
          .eq('chave_acesso', parsed.chaveAcesso)
          .maybeSingle();

        if (nfCheckErr) throw nfCheckErr;

        if (existingNf) {
          set({ loading: false, error: 'Nota Fiscal já importada anteriormente.' });
          return false;
        }
      }

      let notaFiscalId = null;

      // 2. Save invoice details
      if (parsed.chaveAcesso) {
        const { data: newNf, error: nfInsertErr } = await supabase
          .from('notas_fiscais')
          .insert({
            chave_acesso: parsed.chaveAcesso,
            numero_nf: parsed.numeroNf,
            serie: parsed.serie,
            cnpj_emitente: parsed.cnpjEmitente,
            data_emissao: parsed.dataEmissao.toISOString(),
            valor_total: parsed.valorTotal
          })
          .select('id')
          .single();

        if (nfInsertErr) throw nfInsertErr;
        notaFiscalId = newNf.id;
      }

      // 3. Save main purchase row
      // We extract market name from emitter CNPJ (or mock it elegantly for V1)
      const marketName = parsed.cnpjEmitente === '00.000.000/0000-00' 
        ? 'Supermercado Exemplo' 
        : `Supermercado Cód. ${parsed.cnpjEmitente.substring(0, 5)}`;

      const { data: newPurchase, error: purchaseErr } = await supabase
        .from('compras')
        .insert({
          data: parsed.dataEmissao.toISOString(),
          mercado: marketName,
          valor_total: parsed.valorTotal,
          origem_importacao: method,
          nota_fiscal_id: notaFiscalId
        })
        .select('id')
        .single();

      if (purchaseErr) throw purchaseErr;

      // 4. Save items (resolving products and historical prices)
      for (const item of parsed.itens) {
        // Normalize description
        const normalized: NormalizedProduct = normalizeProduct(item.descricao);

        // Find or create product in DB
        let productId = '';
        const { data: existingProduct, error: prodFindErr } = await supabase
          .from('produtos')
          .select('id')
          .eq('nome_padronizado', normalized.nomePadronizado)
          .maybeSingle();

        if (prodFindErr) throw prodFindErr;

        if (existingProduct) {
          productId = existingProduct.id;
        } else {
          const { data: newProduct, error: prodCreateErr } = await supabase
            .from('produtos')
            .insert({
              nome_padronizado: normalized.nomePadronizado,
              marca: normalized.marca,
              categoria_id: normalized.categoriaId,
              unidade_base: normalized.unidadeBase
            })
            .select('id')
            .single();

          if (prodCreateErr) throw prodCreateErr;
          productId = newProduct.id;
        }

        // Insert item details
        const { error: itemInsertErr } = await supabase
          .from('itens_compra')
          .insert({
            compra_id: newPurchase.id,
            descricao_original: item.descricao,
            produto_id: productId,
            quantidade: item.quantidade,
            unidade: item.unidade,
            valor_unitario: item.valorUnitario
          });

        if (itemInsertErr) throw itemInsertErr;

        // Insert historical price entry
        await supabase
          .from('historico_precos')
          .insert({
            produto_id: productId,
            data: parsed.dataEmissao.toISOString(),
            preco: item.valorUnitario
          });
      }

      // 5. Refresh local store data
      await get().fetchData();
      await get().generateInsights();
      return true;
    } catch (err: any) {
      console.error('Error importing receipt:', err);
      set({ error: err.message, loading: false });
      return false;
    }
  },

  generateInsights: async () => {
    try {
      const state = get();
      if (state.purchases.length === 0) return;

      // Local logic to analyze data and push automatic insights
      // We will identify products with price fluctuations or high consumption patterns
      const newInsights: Array<{ tipo: string; titulo: string; descricao: string }> = [];

      // Only generate real dynamic insights from actual purchase history if there is any data
      // For V1, dynamic insights will be generated after more than 2 real purchases are registered.

      // Save generated insights to Supabase
      for (const ins of newInsights) {
        // Only insert if it doesn't exist to prevent spamming
        const { data: existing } = await supabase
          .from('insights')
          .select('id')
          .eq('titulo', ins.titulo)
          .maybeSingle();

        if (!existing) {
          await supabase.from('insights').insert(ins);
        }
      }

      // Refresh insights list
      const { data: updatedInsights } = await supabase
        .from('insights')
        .select('*')
        .order('data_geracao', { ascending: false });

      set({ insights: updatedInsights || [] });
    } catch (err) {
      console.error('Error generating automatic insights:', err);
    }
  }
}));
