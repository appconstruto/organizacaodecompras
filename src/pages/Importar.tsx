import { useRef, useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Button, Tabs, Tab, TextField, Alert, CircularProgress, Divider, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Grid, IconButton } from '@mui/material';
import { QrReader } from './QrReader'; // We will create a clean component for camera QR scanning
import { Html5Qrcode } from 'html5-qrcode';
import { parseNfcUrl } from '../services/nfcParser';
import type { ParsedNFCe } from '../services/nfcParser';
import { processReceiptImage } from '../services/ocrService';
import { useAppStore } from '../store/useAppStore';
import { Camera, FileText, ImageIcon, CheckCircle, ShieldAlert, Trash2, Plus } from 'lucide-react';

export default function Importar() {
  const { importNfc, loading: storeLoading, error: storeError } = useAppStore();
  const [activeTab, setActiveTab] = useState(0);
  
  // Manual URL State
  const [nfcUrl, setNfcUrl] = useState('');
  
  // OCR File State
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  
  // Parsed Result View State
  const [parsedData, setParsedData] = useState<ParsedNFCe | null>(null);
  const [editableItens, setEditableItens] = useState<ParsedNFCe['itens']>([]);
  const [importSuccess, setImportSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize editable items state with parsed data
  useEffect(() => {
    if (parsedData) {
      setEditableItens(parsedData.itens);
    } else {
      setEditableItens([]);
    }
  }, [parsedData]);

  // Dynamically calculate the total price based on editable items
  const totalCalculado = editableItens.reduce((sum, item) => sum + (item.quantidade * item.valorUnitario), 0);

  const handleTabChange = (_event: any, newValue: number) => {
    setActiveTab(newValue);
    setParsedData(null);
    setImportSuccess(false);
    setErrorMessage(null);
  };

  const handleProcessUrl = (urlStr: string) => {
    setErrorMessage(null);
    setImportSuccess(false);
    
    const parsed = parseNfcUrl(urlStr);
    if (parsed) {
      setParsedData(parsed);
    } else {
      setErrorMessage('URL ou Chave de Acesso NFC-e inválida. Verifique o formato.');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setOcrFile(file);
    setLocalLoading(true);
    setErrorMessage(null);
    setImportSuccess(false);

    try {
      if (file.type.includes('pdf')) {
        setErrorMessage('Importação direta de arquivos PDF não suportada no momento. Por favor, envie uma foto/imagem do cupom.');
        setLocalLoading(false);
        return;
      }

      // 1. Try to scan QR Code from the image file
      let qrParsed: ParsedNFCe | null = null;
      try {
        const html5QrCode = new Html5Qrcode("qr-file-scanner-temp");
        const decodedText = await html5QrCode.scanFile(file, false);
        qrParsed = parseNfcUrl(decodedText);
      } catch (e) {
        console.log("No QR Code detected in image file, falling back to pure OCR", e);
      }

      // 2. Process image via OCR to read the text and items
      const ocrRes = await processReceiptImage(file);

      // 3. Construct final parsed data, prioritizing QR Code metadata over OCR text
      const finalChave = qrParsed?.chaveAcesso || ocrRes.chaveAcesso || '';
      const finalCnpj = qrParsed?.cnpjEmitente || ocrRes.cnpjEmitente || '';
      const finalDate = qrParsed?.dataEmissao || ocrRes.dataEmissao || new Date();
      const finalNumero = qrParsed?.numeroNf || ocrRes.numeroNf || '';
      const finalSerie = qrParsed?.serie || ocrRes.serie || '';

      const finalParsed: ParsedNFCe = {
        chaveAcesso: finalChave,
        numeroNf: finalNumero,
        serie: finalSerie,
        cnpjEmitente: finalCnpj,
        dataEmissao: finalDate,
        valorTotal: ocrRes.valorTotal > 0 ? ocrRes.valorTotal : (qrParsed?.valorTotal || 0),
        itens: ocrRes.itens
      };

      if (ocrRes.itens.length === 0) {
        setErrorMessage('Aviso: Não conseguimos ler os produtos da imagem automaticamente. Você pode preencher as informações adicionando itens abaixo.');
      }

      setParsedData(finalParsed);
      setLocalLoading(false);
    } catch (err: any) {
      setErrorMessage(`Erro ao ler arquivo: ${err.message || err}`);
      setLocalLoading(false);
    }
  };

  const handleEditItem = (index: number, field: keyof ParsedNFCe['itens'][0], value: any) => {
    setEditableItens(prev => prev.map((item, idx) => {
      if (idx === index) {
        if (field === 'quantidade' || field === 'valorUnitario') {
          const numVal = value === '' ? 0 : parseFloat(value);
          return { ...item, [field]: isNaN(numVal) ? 0 : numVal };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleRemoveItem = (index: number) => {
    setEditableItens(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAddItem = () => {
    setEditableItens(prev => [
      ...prev,
      { descricao: '', quantidade: 1, unidade: 'UN', valorUnitario: 0 }
    ]);
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;
    if (editableItens.length === 0) {
      setErrorMessage('A nota fiscal precisa ter pelo menos um item.');
      return;
    }
    
    const sourceMethod = activeTab === 0 ? 'qrcode' : activeTab === 1 ? 'pdf' : 'ocr';
    const finalData: ParsedNFCe = {
      ...parsedData,
      itens: editableItens,
      valorTotal: totalCalculado
    };

    const success = await importNfc(finalData, sourceMethod);
    
    if (success) {
      setImportSuccess(true);
      setParsedData(null);
      setNfcUrl('');
      setOcrFile(null);
    } else {
      setErrorMessage(storeError || 'Erro ao importar para o banco de dados.');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Importar Cupom</Typography>
        <Typography variant="body2" color="text.secondary">Adicione novos itens ao seu estoque e histórico via QR Code, PDF ou Foto.</Typography>
      </Box>

      {importSuccess && (
        <Alert severity="success" icon={<CheckCircle size={20} />} sx={{ borderRadius: 3 }}>
          Cupom fiscal importado e sincronizado com sucesso no Supabase!
        </Alert>
      )}

      {errorMessage && (
        <Alert severity="error" icon={<ShieldAlert size={20} />} sx={{ borderRadius: 3 }}>
          {errorMessage}
        </Alert>
      )}

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ borderRadius: 4, overflow: 'hidden' }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange} 
              variant="fullWidth"
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab icon={<Camera size={18} />} label="QR Code" sx={{ minHeight: 72 }} />
              <Tab icon={<FileText size={18} />} label="PDF" sx={{ minHeight: 72 }} />
              <Tab icon={<ImageIcon size={18} />} label="Imagem/OCR" sx={{ minHeight: 72 }} />
            </Tabs>
            
            <CardContent sx={{ p: 3 }}>
              {/* TAB 0: QR Code Scanner */}
              {activeTab === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <QrReader onScanSuccess={handleProcessUrl} />
                  
                  <Divider>Ou insira a URL manualmente</Divider>
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      label="URL da NFC-e ou Chave de Acesso"
                      variant="outlined"
                      value={nfcUrl}
                      onChange={(e) => setNfcUrl(e.target.value)}
                      placeholder="https://www.sefaz.rs.gov.br/..."
                      size="small"
                    />
                    <Button variant="contained" onClick={() => handleProcessUrl(nfcUrl)} sx={{ borderRadius: 2 }}>
                      Validar
                    </Button>
                  </Box>
                </Box>
              )}

              {/* TAB 1 & 2: PDF or Image upload */}
              {(activeTab === 1 || activeTab === 2) && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept={activeTab === 1 ? '.pdf' : 'image/*'}
                    style={{ display: 'none' }}
                  />
                  <Paper
                    variant="outlined"
                    sx={{
                      width: '100%',
                      height: 180,
                      borderStyle: 'dashed',
                      borderColor: 'primary.main',
                      borderRadius: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      bgcolor: 'background.default',
                      gap: 1,
                      '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText', borderStyle: 'solid' }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {activeTab === 1 ? <FileText size={48} /> : <ImageIcon size={48} />}
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {ocrFile ? ocrFile.name : `Selecione um arquivo ${activeTab === 1 ? 'PDF' : 'de imagem'}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tamanho máximo: 10MB
                    </Typography>
                  </Paper>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          {localLoading || storeLoading ? (
            <Card sx={{ borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 8 }}>
              <CircularProgress size={50} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Processando dados da nota fiscal...
              </Typography>
            </Card>
          ) : parsedData ? (
            <Card sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Confirme a Importação</Typography>
                  <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                    R$ {totalCalculado.toFixed(2)}
                  </Typography>
                </Box>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid size={6}>
                    <Typography variant="caption" color="text.secondary">CNPJ Emitente</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{parsedData.cnpjEmitente}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="caption" color="text.secondary">Data Emissão</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {new Date(parsedData.dataEmissao).toLocaleDateString('pt-BR')}
                    </Typography>
                  </Grid>
                  <Grid size={12}>
                    <Typography variant="caption" color="text.secondary">Chave de Acesso</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                      {parsedData.chaveAcesso}
                    </Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                {editableItens.length === 0 && (
                  <Alert severity="info" sx={{ mb: 2, borderRadius: 2, fontSize: '0.85rem' }}>
                    Chave fiscal lida com sucesso! Como a SEFAZ bloqueia consultas automatizadas no navegador, por favor adicione os itens da sua compra manualmente utilizando o botão "+ Adicionar Item".
                  </Alert>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Itens Encontrados</Typography>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    startIcon={<Plus size={16} />} 
                    onClick={handleAddItem}
                    sx={{ borderRadius: 2 }}
                  >
                    Adicionar Item
                  </Button>
                </Box>

                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 300, mb: 3 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Descrição</TableCell>
                        <TableCell align="right" sx={{ width: 80 }}>Qtd</TableCell>
                        <TableCell align="center" sx={{ width: 60 }}>Un</TableCell>
                        <TableCell align="right" sx={{ width: 100 }}>Valor Unit</TableCell>
                        <TableCell align="right" sx={{ width: 100 }}>Total</TableCell>
                        <TableCell align="center" sx={{ width: 50 }}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {editableItens.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              variant="outlined"
                              value={item.descricao}
                              onChange={(e) => handleEditItem(idx, 'descricao', e.target.value)}
                              placeholder="Nome do produto"
                              slotProps={{ htmlInput: { style: { padding: '6px 8px', fontSize: '0.85rem' } } }}
                              sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              variant="outlined"
                              value={item.quantidade}
                              onChange={(e) => handleEditItem(idx, 'quantidade', e.target.value)}
                              slotProps={{ htmlInput: { min: 0, step: 'any', style: { textAlign: 'right', padding: '6px 6px', fontSize: '0.85rem' } } }}
                              sx={{ bgcolor: 'background.paper', borderRadius: 1, width: 70 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              variant="outlined"
                              value={item.unidade}
                              onChange={(e) => handleEditItem(idx, 'unidade', e.target.value)}
                              placeholder="UN"
                              slotProps={{ htmlInput: { style: { textAlign: 'center', padding: '6px 6px', fontSize: '0.85rem' } } }}
                              sx={{ bgcolor: 'background.paper', borderRadius: 1, width: 55 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              variant="outlined"
                              value={item.valorUnitario}
                              onChange={(e) => handleEditItem(idx, 'valorUnitario', e.target.value)}
                              slotProps={{ htmlInput: { min: 0, step: 'any', style: { textAlign: 'right', padding: '6px 6px', fontSize: '0.85rem' } } }}
                              sx={{ bgcolor: 'background.paper', borderRadius: 1, width: 85 }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.875rem', pr: 2 }}>
                            R$ {(item.quantidade * item.valorUnitario).toFixed(2)}
                          </TableCell>
                          <TableCell align="center">
                            <IconButton 
                              color="error" 
                              size="small" 
                              onClick={() => handleRemoveItem(idx)}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {editableItens.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                            Nenhum item na lista. Clique em "Adicionar Item".
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button variant="outlined" color="error" onClick={() => setParsedData(null)} sx={{ borderRadius: 2 }}>
                    Cancelar
                  </Button>
                  <Button variant="contained" color="success" onClick={handleConfirmImport} sx={{ borderRadius: 2 }}>
                    Salvar no Supabase
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Card sx={{ borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 8, borderStyle: 'dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
              <FileText size={48} color="rgba(0,0,0,0.15)" />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Nenhuma nota carregada. Escaneie um QR Code ou envie um arquivo para ver a prévia.
              </Typography>
            </Card>
          )}
        </Grid>
      </Grid>
      <div id="qr-file-scanner-temp" style={{ display: 'none' }} />
    </Box>
  );
}

