import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Collapse, Chip, Grid, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, Button, Alert } from '@mui/material';
import { useAppStore } from '../store/useAppStore';
import { ChevronDown, ChevronUp, Store, Calendar, FileText, Edit, Trash2 } from 'lucide-react';

export default function Historico() {
  const { purchases, fetchData, deletePurchase, deletePurchaseItem, updatePurchase, updatePurchaseItem, loading, error } = useAppStore();
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

  // Purchase Delete Dialog State
  const [deletePurchaseOpen, setDeletePurchaseOpen] = useState(false);
  const [purchaseIdToDelete, setPurchaseIdToDelete] = useState<string | null>(null);

  // Purchase Edit Dialog State
  const [editPurchaseOpen, setEditPurchaseOpen] = useState(false);
  const [purchaseToEdit, setPurchaseToEdit] = useState<any | null>(null);
  const [editMercado, setEditMercado] = useState('');
  const [editData, setEditData] = useState('');

  // Item Delete Dialog State
  const [deleteItemOpen, setDeleteItemOpen] = useState(false);
  const [itemIdToDelete, setItemIdToDelete] = useState<string | null>(null);
  const [itemDeletePurchaseId, setItemDeletePurchaseId] = useState<string | null>(null);

  // Item Edit Dialog State
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<any | null>(null);
  const [itemEditPurchaseId, setItemEditPurchaseId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [editUn, setEditUn] = useState('UN');
  const [editVal, setEditVal] = useState<number>(0);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleExpand = (id: string) => {
    setExpandedPurchaseId(expandedPurchaseId === id ? null : id);
  };

  // Purchase Dialog Actions
  const handleOpenDeletePurchase = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setPurchaseIdToDelete(id);
    setDeletePurchaseOpen(true);
  };

  const handleConfirmDeletePurchase = async () => {
    if (purchaseIdToDelete) {
      await deletePurchase(purchaseIdToDelete);
      setDeletePurchaseOpen(false);
      setPurchaseIdToDelete(null);
    }
  };

  const handleOpenEditPurchase = (purchase: any, event: React.MouseEvent) => {
    event.stopPropagation();
    setPurchaseToEdit(purchase);
    setEditMercado(purchase.mercado);
    // Convert to YYYY-MM-DD for date input
    try {
      const dateObj = new Date(purchase.data);
      const isoStr = dateObj.toISOString().split('T')[0];
      setEditData(isoStr);
    } catch {
      setEditData('');
    }
    setEditPurchaseOpen(true);
  };

  const handleConfirmEditPurchase = async () => {
    if (purchaseToEdit && editMercado && editData) {
      // Ensure safe ISO conversion
      const isoDate = new Date(editData + 'T12:00:00').toISOString();
      await updatePurchase(purchaseToEdit.id, editMercado, isoDate);
      setEditPurchaseOpen(false);
      setPurchaseToEdit(null);
    }
  };

  // Item Dialog Actions
  const handleOpenDeleteItem = (itemId: string, purchaseId: string) => {
    setItemIdToDelete(itemId);
    setItemDeletePurchaseId(purchaseId);
    setDeleteItemOpen(true);
  };

  const handleConfirmDeleteItem = async () => {
    if (itemIdToDelete && itemDeletePurchaseId) {
      await deletePurchaseItem(itemIdToDelete, itemDeletePurchaseId);
      setDeleteItemOpen(false);
      setItemIdToDelete(null);
      setItemDeletePurchaseId(null);
    }
  };

  const handleOpenEditItem = (item: any, purchaseId: string) => {
    setItemToEdit(item);
    setItemEditPurchaseId(purchaseId);
    setEditQty(item.quantidade);
    setEditUn(item.unidade);
    setEditVal(item.valor_unitario);
    setEditItemOpen(true);
  };

  const handleConfirmEditItem = async () => {
    if (itemToEdit && itemEditPurchaseId) {
      await updatePurchaseItem(itemToEdit.id, itemEditPurchaseId, editQty, editVal, editUn);
      setEditItemOpen(false);
      setItemToEdit(null);
      setItemEditPurchaseId(null);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Histórico de Compras</Typography>
        <Typography variant="body2" color="text.secondary">Confira todas as compras, edite valores ou exclua notas importadas.</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      )}

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

                    <Grid size={{ xs: 12, sm: 3 }} sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
                      <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                        <Typography variant="caption" color="text.secondary">Valor Total da Nota</Typography>
                        <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                          R$ {Number(purchase.valor_total).toFixed(2)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                        <IconButton size="small" color="primary" onClick={(e) => handleOpenEditPurchase(purchase, e)} disabled={loading}>
                          <Edit size={16} />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={(e) => handleOpenDeletePurchase(purchase.id, e)} disabled={loading}>
                          <Trash2 size={16} />
                        </IconButton>
                      </Box>
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
                              <TableCell align="center" sx={{ width: 100 }}>Ações</TableCell>
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
                                <TableCell align="center">
                                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                    <IconButton size="small" color="primary" onClick={() => handleOpenEditItem(item, purchase.id)} disabled={loading}>
                                      <Edit size={14} />
                                    </IconButton>
                                    <IconButton size="small" color="error" onClick={() => handleOpenDeleteItem(item.id, purchase.id)} disabled={loading}>
                                      <Trash2 size={14} />
                                    </IconButton>
                                  </Box>
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

      {/* dialog exclusion purchase */}
      <Dialog open={deletePurchaseOpen} onClose={() => setDeletePurchaseOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Excluir Compra?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza de que deseja excluir esta compra permanentemente? Isso removerá a nota e todos os seus itens do histórico.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeletePurchaseOpen(false)} variant="outlined">Cancelar</Button>
          <Button onClick={handleConfirmDeletePurchase} color="error" variant="contained">Excluir</Button>
        </DialogActions>
      </Dialog>

      {/* dialog edit purchase */}
      <Dialog open={editPurchaseOpen} onClose={() => setEditPurchaseOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 'bold' }}>Editar Compra</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <TextField
            label="Supermercado / Estabelecimento"
            fullWidth
            value={editMercado}
            onChange={(e) => setEditMercado(e.target.value)}
            size="small"
            sx={{ mt: 1 }}
          />
          <TextField
            label="Data da Compra"
            type="date"
            fullWidth
            value={editData}
            onChange={(e) => setEditData(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditPurchaseOpen(false)} variant="outlined">Cancelar</Button>
          <Button onClick={handleConfirmEditPurchase} color="success" variant="contained" disabled={!editMercado || !editData}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* dialog exclusion item */}
      <Dialog open={deleteItemOpen} onClose={() => setDeleteItemOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Remover Item?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza de que deseja remover este item desta compra? O valor total da nota será recalculado automaticamente.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteItemOpen(false)} variant="outlined">Cancelar</Button>
          <Button onClick={handleConfirmDeleteItem} color="error" variant="contained">Excluir</Button>
        </DialogActions>
      </Dialog>

      {/* dialog edit item */}
      <Dialog open={editItemOpen} onClose={() => setEditItemOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 'bold' }}>Editar Item</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 1 }}>
            {itemToEdit?.descricao_original}
          </Typography>
          <TextField
            label="Quantidade"
            type="number"
            fullWidth
            value={editQty}
            onChange={(e) => setEditQty(Math.max(0.001, parseFloat(e.target.value) || 0))}
            slotProps={{ htmlInput: { min: 0.001, step: 'any' } }}
            size="small"
          />
          <TextField
            label="Unidade (ex: UN, KG)"
            fullWidth
            value={editUn}
            onChange={(e) => setEditUn(e.target.value.toUpperCase())}
            size="small"
          />
          <TextField
            label="Preço Unitário (R$)"
            type="number"
            fullWidth
            value={editVal}
            onChange={(e) => setEditVal(Math.max(0, parseFloat(e.target.value) || 0))}
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditItemOpen(false)} variant="outlined">Cancelar</Button>
          <Button onClick={handleConfirmEditItem} color="success" variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
