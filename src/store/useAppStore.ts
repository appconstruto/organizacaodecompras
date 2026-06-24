import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
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
  status?: string;
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
  deletePurchase: (purchaseId: string) => Promise<boolean>;
  deletePurchaseItem: (itemId: string, purchaseId: string) => Promise<boolean>;
  updatePurchase: (purchaseId: string, mercado: string, data: string) => Promise<boolean>;
  updatePurchaseItem: (itemId: string, purchaseId: string, quantidade: number, valorUnitario: number, unidade: string) => Promise<boolean>;
  deleteProduct: (productId: string) => Promise<boolean>;
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

      // 2. Save invoice details (supporting nullable values)
      if (parsed.chaveAcesso || parsed.cnpjEmitente || parsed.numeroNf) {
        const { data: newNf, error: nfInsertErr } = await supabase
          .from('notas_fiscais')
          .insert({
            chave_acesso: parsed.chaveAcesso || null,
            numero_nf: parsed.numeroNf || null,
            serie: parsed.serie || null,
            cnpj_emitente: parsed.cnpjEmitente || null,
            data_emissao: parsed.dataEmissao ? parsed.dataEmissao.toISOString() : null,
            valor_total: parsed.valorTotal
          })
          .select('id')
          .single();

        if (nfInsertErr) throw nfInsertErr;
        notaFiscalId = newNf.id;
      }

      // 3. Save main purchase row
      // Use company name from Gemini (parsed.empresa) as the market name, with elegant fallback
      let marketName = parsed.empresa || null;
      if (!marketName) {
        marketName = parsed.cnpjEmitente 
          ? `Supermercado Cód. ${parsed.cnpjEmitente.replace(/\D/g, '').substring(0, 5)}`
          : 'Supermercado Desconhecido';
      }

      const totalCalculado = parsed.itens.reduce((sum, item) => sum + (item.quantidade * item.valorUnitario), 0);
      const isDiscrepant = parsed.valorTotal > 0 && Math.abs(totalCalculado - parsed.valorTotal) > 0.10;
      const status = isDiscrepant ? 'revisao' : 'processado';

      const { data: newPurchase, error: purchaseErr } = await supabase
        .from('compras')
        .insert({
          data: parsed.dataEmissao ? parsed.dataEmissao.toISOString() : new Date().toISOString(),
          mercado: marketName,
          valor_total: parsed.valorTotal > 0 ? parsed.valorTotal : totalCalculado,
          origem_importacao: method,
          nota_fiscal_id: notaFiscalId,
          status: status
        })
        .select('id')
        .single();

      if (purchaseErr) throw purchaseErr;

      // 4. Resolve products using caching and batch AI normalization
      const originalDescs = parsed.itens.map(it => it.descricao.toUpperCase().trim());
      
      const { data: cachedAliases, error: cacheErr } = await supabase
        .from('produto_alias')
        .select('descricao_original, produto_id')
        .in('descricao_original', originalDescs);

      if (cacheErr) throw cacheErr;

      const cacheMap = new Map<string, string>();
      if (cachedAliases) {
        cachedAliases.forEach(alias => {
          cacheMap.set(alias.descricao_original.toUpperCase().trim(), alias.produto_id);
        });
      }

      const itemsToNormalize = parsed.itens.filter(item => !cacheMap.has(item.descricao.toUpperCase().trim()));

      let normalizedResults: NormalizedProduct[] = [];
      if (itemsToNormalize.length > 0) {
        const { normalizeProductsWithAI } = await import('../services/geminiNormalizer');
        normalizedResults = await normalizeProductsWithAI(
          itemsToNormalize.map(it => ({ descricao: it.descricao, unidade: it.unidade }))
        );
      }

      let normalResultIdx = 0;

      // 5. Save items
      for (const item of parsed.itens) {
        const descClean = item.descricao.toUpperCase().trim();
        let productId = cacheMap.get(descClean) || '';

        if (!productId) {
          const normalized = normalizedResults[normalResultIdx++];
          
          // Find or create product in DB
          const { data: existingProduct, error: prodFindErr } = await supabase
            .from('produtos')
            .select('id, unidade_base, categoria_id')
            .eq('nome_padronizado', normalized.nomePadronizado)
            .maybeSingle();

          if (prodFindErr) throw prodFindErr;

          if (existingProduct) {
            productId = existingProduct.id;
            
            const needsUnitUpgrade = existingProduct.unidade_base === 'unidades' && normalized.unidadeBase !== 'unidades';
            const needsCategoryUpgrade = existingProduct.categoria_id === 10 && normalized.categoriaId !== 10;
            
            if (needsUnitUpgrade || needsCategoryUpgrade) {
              await supabase
                .from('produtos')
                .update({
                  unidade_base: needsUnitUpgrade ? normalized.unidadeBase : existingProduct.unidade_base,
                  categoria_id: needsCategoryUpgrade ? normalized.categoriaId : existingProduct.categoria_id
                })
                .eq('id', productId);
            }
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

          // Insert into cache alias table
          await supabase
            .from('produto_alias')
            .insert({
              descricao_original: descClean,
              produto_id: productId
            });
        }

        // Convert sub-units to base units (g -> kg, ml -> L)
        let finalQuantidade = item.quantidade;
        let finalUnidade = item.unidade;
        let finalValorUnitario = item.valorUnitario;

        const cleanUnit = item.unidade.toUpperCase().trim();
        if (cleanUnit === 'G' || cleanUnit === 'GR' || cleanUnit === 'GRAMAS') {
          finalQuantidade = item.quantidade / 1000;
          finalUnidade = 'KG';
          finalValorUnitario = item.valorUnitario * 1000;
        } else if (cleanUnit === 'ML' || cleanUnit === 'ML.') {
          finalQuantidade = item.quantidade / 1000;
          finalUnidade = 'L';
          finalValorUnitario = item.valorUnitario * 1000;
        }

        // Insert item details
        const { error: itemInsertErr } = await supabase
          .from('itens_compra')
          .insert({
            compra_id: newPurchase.id,
            descricao_original: item.descricao,
            produto_id: productId,
            quantidade: finalQuantidade,
            unidade: finalUnidade,
            valor_unitario: finalValorUnitario
          });

        if (itemInsertErr) throw itemInsertErr;

        // Insert historical price entry
        const dateStr = parsed.dataEmissao ? parsed.dataEmissao.toISOString() : new Date().toISOString();
        await supabase
          .from('historico_precos')
          .insert({
            produto_id: productId,
            data: dateStr,
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
  },

  deletePurchase: async (purchaseId: string) => {
    set({ loading: true, error: null });
    try {
      const purchase = get().purchases.find(p => p.id === purchaseId);
      
      // 1. Delete purchase items first
      const { error: itemsErr } = await supabase
        .from('itens_compra')
        .delete()
        .eq('compra_id', purchaseId);

      if (itemsErr) throw itemsErr;

      // 2. Delete purchase itself
      const { error: purchaseErr } = await supabase
        .from('compras')
        .delete()
        .eq('id', purchaseId);

      if (purchaseErr) throw purchaseErr;

      // 3. Delete linked invoice if exists
      if (purchase?.nota_fiscal_id) {
        const { error: nfErr } = await supabase
          .from('notas_fiscais')
          .delete()
          .eq('id', purchase.nota_fiscal_id);
        if (nfErr) throw nfErr;
      }

      await get().fetchData();
      await get().generateInsights();
      return true;
    } catch (err: any) {
      console.error('Error deleting purchase:', err);
      set({ error: err.message, loading: false });
      return false;
    }
  },

  deletePurchaseItem: async (itemId: string, purchaseId: string) => {
    set({ loading: true, error: null });
    try {
      const purchase = get().purchases.find(p => p.id === purchaseId);

      // 1. Delete item
      const { error: itemErr } = await supabase
        .from('itens_compra')
        .delete()
        .eq('id', itemId);

      if (itemErr) throw itemErr;

      // 2. Query remaining items to compute new total
      const { data: remainingItems, error: itemsQueryErr } = await supabase
        .from('itens_compra')
        .select('quantidade, valor_unitario')
        .eq('compra_id', purchaseId);

      if (itemsQueryErr) throw itemsQueryErr;

      const newTotal = (remainingItems || []).reduce(
        (sum, item) => sum + (Number(item.quantidade) * Number(item.valor_unitario)), 
        0
      );

      // 3. Update purchase total
      const { error: purchaseUpdateErr } = await supabase
        .from('compras')
        .update({ valor_total: newTotal })
        .eq('id', purchaseId);

      if (purchaseUpdateErr) throw purchaseUpdateErr;

      // 4. Update linked invoice total
      if (purchase?.nota_fiscal_id) {
        const { error: nfErr } = await supabase
          .from('notas_fiscais')
          .update({ valor_total: newTotal })
          .eq('id', purchase.nota_fiscal_id);
        if (nfErr) throw nfErr;
      }

      await get().fetchData();
      await get().generateInsights();
      return true;
    } catch (err: any) {
      console.error('Error deleting purchase item:', err);
      set({ error: err.message, loading: false });
      return false;
    }
  },

  updatePurchase: async (purchaseId: string, mercado: string, data: string) => {
    set({ loading: true, error: null });
    try {
      const purchase = get().purchases.find(p => p.id === purchaseId);

      // 1. Update purchase
      const { error: purchaseErr } = await supabase
        .from('compras')
        .update({ mercado, data })
        .eq('id', purchaseId);

      if (purchaseErr) throw purchaseErr;

      // 2. Update linked invoice date
      if (purchase?.nota_fiscal_id) {
        const { error: nfErr } = await supabase
          .from('notas_fiscais')
          .update({ data_emissao: data })
          .eq('id', purchase.nota_fiscal_id);
        if (nfErr) throw nfErr;
      }

      await get().fetchData();
      await get().generateInsights();
      return true;
    } catch (err: any) {
      console.error('Error updating purchase:', err);
      set({ error: err.message, loading: false });
      return false;
    }
  },

  updatePurchaseItem: async (itemId: string, purchaseId: string, quantidade: number, valorUnitario: number, unidade: string) => {
    set({ loading: true, error: null });
    try {
      const purchase = get().purchases.find(p => p.id === purchaseId);

      // 1. Update item values
      const { error: itemErr } = await supabase
        .from('itens_compra')
        .update({ quantidade, valor_unitario: valorUnitario, unidade })
        .eq('id', itemId);

      if (itemErr) throw itemErr;

      // 2. Query all items to compute new total
      const { data: remainingItems, error: itemsQueryErr } = await supabase
        .from('itens_compra')
        .select('quantidade, valor_unitario')
        .eq('compra_id', purchaseId);

      if (itemsQueryErr) throw itemsQueryErr;

      const newTotal = (remainingItems || []).reduce(
        (sum, item) => sum + (Number(item.quantidade) * Number(item.valor_unitario)), 
        0
      );

      // 3. Update purchase total
      const { error: purchaseUpdateErr } = await supabase
        .from('compras')
        .update({ valor_total: newTotal })
        .eq('id', purchaseId);

      if (purchaseUpdateErr) throw purchaseUpdateErr;

      // 4. Update linked invoice total
      if (purchase?.nota_fiscal_id) {
        const { error: nfErr } = await supabase
          .from('notas_fiscais')
          .update({ valor_total: newTotal })
          .eq('id', purchase.nota_fiscal_id);
        if (nfErr) throw nfErr;
      }

      await get().fetchData();
      await get().generateInsights();
      return true;
    } catch (err: any) {
      console.error('Error updating purchase item:', err);
      set({ error: err.message, loading: false });
      return false;
    }
  },

  deleteProduct: async (productId: string) => {
    set({ loading: true, error: null });
    try {
      // 1. Find all purchase items associated with this product to know which purchases will be affected
      const { data: itemsToChange, error: findItemsErr } = await supabase
        .from('itens_compra')
        .select('compra_id')
        .eq('produto_id', productId);

      if (findItemsErr) throw findItemsErr;

      // 2. Delete price history
      const { error: histErr } = await supabase
        .from('historico_precos')
        .delete()
        .eq('produto_id', productId);

      if (histErr) throw histErr;

      // 3. Delete purchase items
      const { error: itemsErr } = await supabase
        .from('itens_compra')
        .delete()
        .eq('produto_id', productId);

      if (itemsErr) throw itemsErr;

      // 4. Delete the product itself
      const { error: prodErr } = await supabase
        .from('produtos')
        .delete()
        .eq('id', productId);

      if (prodErr) throw prodErr;

      // 5. Recalculate and update the totals for all affected purchases
      if (itemsToChange && itemsToChange.length > 0) {
        const uniquePurchaseIds = Array.from(new Set(itemsToChange.map(item => item.compra_id)));

        for (const purchaseId of uniquePurchaseIds) {
          // Query remaining items
          const { data: remainingItems, error: itemsQueryErr } = await supabase
            .from('itens_compra')
            .select('quantidade, valor_unitario')
            .eq('compra_id', purchaseId);

          if (itemsQueryErr) throw itemsQueryErr;

          const newTotal = (remainingItems || []).reduce(
            (sum, item) => sum + (Number(item.quantidade) * Number(item.valor_unitario)), 
            0
          );

          // Update purchase
          const { error: purchaseUpdateErr } = await supabase
            .from('compras')
            .update({ valor_total: newTotal })
            .eq('id', purchaseId);

          if (purchaseUpdateErr) throw purchaseUpdateErr;

          // Find if there's a linked invoice to update
          const purchase = get().purchases.find(p => p.id === purchaseId);
          if (purchase?.nota_fiscal_id) {
            const { error: nfErr } = await supabase
              .from('notas_fiscais')
              .update({ valor_total: newTotal })
              .eq('id', purchase.nota_fiscal_id);
            if (nfErr) throw nfErr;
          }
        }
      }

      await get().fetchData();
      await get().generateInsights();
      return true;
    } catch (err: any) {
      console.error('Error deleting product:', err);
      set({ error: err.message, loading: false });
      return false;
    }
  }
}));
