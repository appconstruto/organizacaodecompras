import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Collapse, Chip, Grid } from '@mui/material';
import { useAppStore } from '../store/useAppStore';
import { ChevronDown, ChevronUp, Store, Calendar, FileText } from 'lucide-react';

export default function Historico() {
  const { purchases, fetchData } = useAppStore();
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleExpand = (id: string) => {
    setExpandedPurchaseId(expandedPurchaseId === id ? null : id);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Histórico de Compras</Typography>
        <Typography variant="body2" color="text.secondary">Confira todas as notas e cupons importados por você.</Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {purchases.length > 0 ? (
          purchases.map((purchase) => {
            const isExpanded = expandedPurchaseId === purchase.id;
            const itemQty = purchase.itens?.length || 0;

            return (
              <Card 
                key={purchase.id} 
                sx={{ 
                  borderRadius: 4, 
                  boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                  border: '1px solid',
                  borderColor: isExpanded ? 'primary.main' : 'divider'
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                    <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <IconButton 
                        onClick={() => handleToggleExpand(purchase.id)}
                        color="primary"
                        sx={{ bgcolor: 'action.hover' }}
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </IconButton>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Store size={18} /> {purchase.mercado}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Calendar size={14} /> {new Date(purchase.data).toLocaleDateString('pt-BR')}
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="caption" color="text.secondary">Método Importação</Typography>
                      <Box>
                        <Chip 
                          label={purchase.origem_importacao.toUpperCase()} 
                          size="small" 
                          color="secondary" 
                          variant="outlined" 
                        />
                      </Box>
                    </Grid>

                    <Grid size={{ xs: 6, sm: 2 }} sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="caption" color="text.secondary">Quantidade Itens</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{itemQty} itens</Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 3 }} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                      <Typography variant="caption" color="text.secondary">Valor Total da Nota</Typography>
                      <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                        R$ {Number(purchase.valor_total).toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>Lista Completa de Itens</Typography>
                      
                      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                        <Table size="small">
                          <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                              <TableCell>Descrição na Nota</TableCell>
                              <TableCell>Produto Padronizado</TableCell>
                              <TableCell align="right">Quantidade</TableCell>
                              <TableCell align="right">Preço Unitário</TableCell>
                              <TableCell align="right">Valor Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {purchase.itens?.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell sx={{ fontFamily: 'monospace' }}>{item.descricao_original}</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>{item.produto?.nome_padronizado}</TableCell>
                                <TableCell align="right">{item.quantidade} {item.unidade}</TableCell>
                                <TableCell align="right">R$ {Number(item.valor_unitario).toFixed(2)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                  R$ {(Number(item.quantidade) * Number(item.valor_unitario)).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card sx={{ p: 6, textAlign: 'center', borderRadius: 4 }}>
            <FileText size={48} style={{ opacity: 0.15, marginBottom: 8 }} />
            <Typography variant="body2" color="text.secondary">
              Nenhuma compra importada até o momento.
            </Typography>
          </Card>
        )}
      </Box>
    </Box>
  );
}
