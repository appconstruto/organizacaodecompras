import { useRef, useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Tabs, Tab, TextField, Alert, CircularProgress, Divider, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Grid } from '@mui/material';
import { QrReader } from './QrReader'; // We will create a clean component for camera QR scanning
import { parseNfcUrl } from '../services/nfcParser';
import type { ParsedNFCe } from '../services/nfcParser';
import { processReceiptImage } from '../services/ocrService';
import { useAppStore } from '../store/useAppStore';
import { Camera, FileText, ImageIcon, CheckCircle, ShieldAlert } from 'lucide-react';

export default function Importar() {
  const { importNfc, loading: storeLoading, error: storeError } = useAppStore();
  const [activeTab, setActiveTab] = useState(0);
  
  // Manual URL State
  const [nfcUrl, setNfcUrl] = useState('');
  
  // OCR File State
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  
  // Parsed Result View State
  const [parsedData, setParsedData] = useState<ParsedNFCe | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // PDF parser mock helper
        setTimeout(() => {
          const parsedMock: ParsedNFCe = {
            chaveAcesso: 'PDF' + Math.floor(Math.random() * 10000000000000000),
            numeroNf: Math.floor(Math.random() * 1000).toString(),
            serie: '1',
            cnpjEmitente: '12.345.678/0001-90',
            dataEmissao: new Date(),
            valorTotal: 58.50,
            itens: [
              { descricao: 'OLEO SOJA SOYA 900ML', quantidade: 1, unidade: 'UN', valorUnitario: 6.99 },
              { descricao: 'SABÃO LIQUIDO OMO 3L', quantidade: 1, unidade: 'UN', valorUnitario: 39.90 },
              { descricao: 'BISCOITO CLUB SOCIAL 144G', quantidade: 3, unidade: 'UN', valorUnitario: 3.87 }
            ]
          };
          setParsedData(parsedMock);
          setLocalLoading(false);
        }, 1500);
      } else {
        // OCR Image parser using Tesseract.js
        const res = await processReceiptImage(file);
        
        const parsedMock: ParsedNFCe = {
          chaveAcesso: 'IMG' + Math.floor(Math.random() * 10000000000000000),
          numeroNf: Math.floor(Math.random() * 1000).toString(),
          serie: '1',
          cnpjEmitente: '98.765.432/0001-10',
          dataEmissao: new Date(),
          valorTotal: res.valorTotal,
          itens: res.itens
        };
        setParsedData(parsedMock);
        setLocalLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(`Erro ao ler arquivo: ${err.message || err}`);
      setLocalLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;
    
    const sourceMethod = activeTab === 0 ? 'qrcode' : activeTab === 1 ? 'pdf' : 'ocr';
    const success = await importNfc(parsedData, sourceMethod);
    
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
                    R$ {parsedData.valorTotal.toFixed(2)}
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

                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Itens Encontrados</Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 250, mb: 3 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Descrição</TableCell>
                        <TableCell align="right">Qtd</TableCell>
                        <TableCell align="right">Valor Unit</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {parsedData.itens.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell sx={{ fontWeight: 'medium' }}>{item.descricao}</TableCell>
                          <TableCell align="right">{item.quantidade} {item.unidade}</TableCell>
                          <TableCell align="right">R$ {item.valorUnitario.toFixed(2)}</TableCell>
                          <TableCell align="right">R$ {(item.quantidade * item.valorUnitario).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
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
    </Box>
  );
}
