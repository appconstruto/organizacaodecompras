import { useEffect, useRef, useState } from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { CameraOff, ScanLine, Play } from 'lucide-react';

interface QrReaderProps {
  onScanSuccess: (decodedText: string) => void;
}

export function QrReader({ onScanSuccess }: QrReaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const startScanner = () => {
    setError(null);
    setScannerActive(true);

    setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          'qr-code-reader-element',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            onScanSuccess(decodedText);
            scanner.clear();
            setScannerActive(false);
          },
          () => {
            // Keep scanning silently
          }
        );

        scannerRef.current = scanner;
      } catch (err: any) {
        setError('Erro ao iniciar a câmera. Verifique se concedeu permissão.');
        setScannerActive(false);
      }
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  // Simulator helper (to make scanning testable instantly without actual hardware camera in desktop)
  const handleSimulateScan = () => {
    const mockNfcUrls = [
      'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?chNFe=43260612345678901234550010001234561001234567&nVersao=100&tpAmb=1',
      'https://www.sefaz.sp.gov.br/NFCE/consulta?chNFe=35260698765432109876550020006543211009876543&tpAmb=1'
    ];
    const randomUrl = mockNfcUrls[Math.floor(Math.random() * mockNfcUrls.length)];
    onScanSuccess(randomUrl);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {error && (
        <Alert severity="warning" sx={{ width: '100%' }}>
          {error}
        </Alert>
      )}

      {scannerActive ? (
        <Box sx={{ width: '100%', maxWidth: 350, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box id="qr-code-reader-element" sx={{ overflow: 'hidden', borderRadius: 3, border: '1px solid', borderColor: 'divider' }} />
          <Button variant="outlined" color="error" onClick={stopScanner}>
            Desligar Câmera
          </Button>
        </Box>
      ) : (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              height: 200,
              bgcolor: 'action.hover',
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'text.secondary',
              border: '1px dashed',
              borderColor: 'divider',
              gap: 1
            }}
          >
            <CameraOff size={40} />
            <Typography variant="body2">Câmera desativada</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<ScanLine size={18} />}
              onClick={startScanner}
              sx={{ py: 1.2, borderRadius: 2 }}
            >
              Iniciar Câmera
            </Button>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              startIcon={<Play size={18} />}
              onClick={handleSimulateScan}
              sx={{ py: 1.2, borderRadius: 2 }}
            >
              Simular Leitura
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
