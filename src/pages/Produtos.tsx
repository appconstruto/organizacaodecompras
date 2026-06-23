import { useState } from 'react';
import { Box, Typography, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, InputAdornment, Chip } from '@mui/material';
import { useAppStore } from '../store/useAppStore';
import { Search, Tag } from 'lucide-react';

export default function Produtos() {
  const { products, purchases } = useAppStore();
  const [search, setSearch] = useState('');

  // Local helper to calculate stats per product
  const getProductStats = (productId: string) => {
    const prices: number[] = [];
    let totalQty = 0;

    purchases.forEach(p => {
      p.itens?.forEach(item => {
        if (item.produto_id === productId) {
          prices.push(Number(item.valor_unitario));
          totalQty += Number(item.quantidade);
        }
      });
    });

    if (prices.length === 0) return { min: 0, max: 0, avg: 0, total: 0 };

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    return { min, max, avg, total: totalQty };
  };

  const filteredProducts = products.filter(p => 
    p.nome_padronizado.toLowerCase().includes(search.toLowerCase()) ||
    p.marca.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Biblioteca de Produtos</Typography>
        <Typography variant="body2" color="text.secondary">Lista de produtos importados e normalizados pelo motor de IA.</Typography>
      </Box>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <TextField
            fullWidth
            placeholder="Pesquise por nome do produto ou marca..."
            variant="outlined"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ mb: 3 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={20} />
                  </InputAdornment>
                )
              }
            }}
          />

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell>Produto</TableCell>
                  <TableCell>Marca</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell align="right">Consumo Acumulado</TableCell>
                  <TableCell align="right">Preço Mínimo</TableCell>
                  <TableCell align="right">Preço Médio</TableCell>
                  <TableCell align="right">Preço Máximo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => {
                    const stats = getProductStats(product.id);
                    
                    return (
                      <TableRow key={product.id} hover>
                        <TableCell sx={{ fontWeight: 'bold' }}>{product.nome_padronizado}</TableCell>
                        <TableCell>{product.marca}</TableCell>
                        <TableCell>
                          <Chip 
                            label={product.categoria_id === 1 ? 'Alimentos' :
                                   product.categoria_id === 2 ? 'Bebidas' :
                                   product.categoria_id === 3 ? 'Limpeza' :
                                   product.categoria_id === 4 ? 'Higiene' :
                                   product.categoria_id === 5 ? 'Açougue' :
                                   product.categoria_id === 6 ? 'Hortifruti' :
                                   product.categoria_id === 7 ? 'Padaria' : 'Outros'} 
                            size="small" 
                            variant="outlined" 
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                          {stats.total.toFixed(2)} {product.unidade_base}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'medium' }}>
                          R$ {stats.min.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">R$ {stats.avg.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'medium' }}>
                          R$ {stats.max.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <Tag size={36} style={{ opacity: 0.2, marginBottom: 8 }} />
                      <Typography variant="body2" color="text.secondary">
                        Nenhum produto cadastrado na biblioteca ainda.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
