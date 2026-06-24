import { createWorker } from 'tesseract.js';

export interface OcrResult {
  text: string;
  itens: Array<{
    descricao: string;
    quantidade: number;
    unidade: string;
    valorUnitario: number;
  }>;
  valorTotal: number;
  chaveAcesso?: string;
  numeroNf?: string;
  serie?: string;
  cnpjEmitente?: string;
  dataEmissao?: Date;
}

/**
 * Service to process receipt images using Tesseract.js
 */
export async function processReceiptImage(imageFile: File): Promise<OcrResult> {
  const processedFile = await preprocessImage(imageFile);
  const worker = await createWorker('por'); // Portuguese language worker
  
  try {
    const ret = await worker.recognize(processedFile);
    const text = ret.data.text;
    
    // Parse items from OCR text using patterns
    const parsed = parseTextReceipt(text);
    const meta = extractMetadataFromText(text);
    
    return {
      text,
      itens: parsed.itens,
      valorTotal: parsed.valorTotal,
      chaveAcesso: meta.chave,
      numeroNf: meta.numero,
      serie: meta.serie,
      cnpjEmitente: meta.cnpj,
      dataEmissao: meta.date
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Preprocesses the image using canvas to improve Tesseract OCR accuracy.
 * Converts to grayscale and applies high-contrast thresholding.
 */
function preprocessImage(imageFile: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    img.src = objectUrl;
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageFile);
        return;
      }
      
      // Scale up image slightly if it is small to improve OCR character recognition
      const scale = img.width < 1200 ? 1.5 : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      // Draw image with scaling
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Pre-calculate threshold or use a dynamic threshold
      // For receipt OCR, a simple global threshold around 125 is very effective
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Convert to grayscale using luminance
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // High contrast binarization
        const threshold = 125;
        const binary = gray > threshold ? 255 : 0;
        
        data[i] = binary;
        data[i + 1] = binary;
        data[i + 2] = binary;
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], imageFile.name, { type: 'image/jpeg' });
          resolve(file);
        } else {
          resolve(imageFile);
        }
      }, 'image/jpeg', 0.9);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(imageFile);
    };
  });
}

/**
 * Extracts structured receipt metadata from raw text
 */
function extractMetadataFromText(text: string): {
  cnpj: string;
  chave: string;
  date: Date;
  numero: string;
  serie: string;
} {
  const cleanSpaced = text.replace(/\s+/g, '');
  const chaveMatch = cleanSpaced.match(/\d{44}/);
  const chave = chaveMatch ? chaveMatch[0] : '';

  let cnpj = '';
  let date = new Date();
  let numero = '';
  let serie = '';

  if (chave && chave.length === 44) {
    const ano = '20' + chave.substring(2, 4);
    const mes = chave.substring(4, 6);
    cnpj = chave.substring(6, 20).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    serie = parseInt(chave.substring(22, 25), 10).toString();
    numero = parseInt(chave.substring(25, 34), 10).toString();
    date = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, 15, 12, 0, 0);
  } else {
    const cnpjMatch = text.match(/(\d{2})\.?(\d{3})\.?(\d{3})\/?(\d{4})-?(\d{2})/);
    if (cnpjMatch) {
      cnpj = `${cnpjMatch[1]}.${cnpjMatch[2]}.${cnpjMatch[3]}/${cnpjMatch[4]}-${cnpjMatch[5]}`;
    }

    const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateMatch) {
      date = new Date(parseInt(dateMatch[3], 10), parseInt(dateMatch[2], 10) - 1, parseInt(dateMatch[1], 10), 12, 0, 0);
    }

    const nfMatch = text.match(/nfc-e\s+(?:no|n°|num)?\s*(\d+)/i) || text.match(/nota:\s*(\d+)/i) || text.match(/nº\s*(\d+)/i);
    if (nfMatch) {
      numero = nfMatch[1];
    }
    const serieMatch = text.match(/serie\s+(\d+)/i) || text.match(/série\s+(\d+)/i);
    if (serieMatch) {
      serie = serieMatch[1];
    }
  }

  return { cnpj, chave, date, numero, serie };
}

/**
 * Local parsing heuristics for OCR text.
 * Looks for common patterns like:
 * "Product Name  1 UN X 5.90  5.90"
 * "Product Name  2 x 3.50"
 */
function parseTextReceipt(text: string): { itens: OcrResult['itens']; valorTotal: number } {
  const lines = text.split('\n');
  const itens: OcrResult['itens'] = [];
  let extractedTotal: number | null = null;

  const validUnits = [
    'UN', 'KG', 'LT', 'ML', 'G', 'PC', 'FD', 'CX', 'UNID', 'UND', 'U',
    'KA', 'K6', 'KS', 'KO', 'UM', 'UNI', 'UN1'
  ];

  const parseLocalFloat = (valStr: string): number => {
    if (!valStr) return 0;
    let clean = valStr.replace(/[R$\s]/g, '').trim();
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  // First pass: scan for the overall total value and check for products area
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Detect real total value on lines like "Valor Total R$ 45,89" or "Valor a Pagar R$ 45,89"
    if (/total|pagar|soma|pgto/i.test(trimmedLine) && !/itens|qtde/i.test(trimmedLine)) {
      const match = trimmedLine.match(/(?:R\$)?\s*(\d+[,.]\d{2})/i);
      if (match) {
        const val = parseLocalFloat(match[1]);
        if (val > 0 && (!extractedTotal || val > extractedTotal)) {
          extractedTotal = val;
        }
      }
    }
  }

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 1. Skip lines containing the 44-digit NFC-e access key (even if spaced out)
    const normalizedDigits = trimmedLine.replace(/\s+/g, '');
    if (/\d{44}/.test(normalizedDigits)) {
      continue;
    }

    // 2. Skip headers, metadata, payment, and totals lines to avoid parsing them as items
    if (/cnpj|focal|sefaz|cupom|nfc|data|inscricao|vias|cliente|cpf|consumidor|protocolo|tributos|troco|pagamento|cartao|dinheiro|valor|total|pagar/i.test(trimmedLine)) {
      continue;
    }

    const tokens = trimmedLine.split(/\s+/);
    if (tokens.length < 4) continue;

    // Right-to-left heuristic parsing
    let totalIdx = -1;
    let priceIdx = -1;
    let unitIdx = -1;
    let qtyIdx = -1;

    // Try to find the unit token near the end of the line
    for (let i = tokens.length - 2; i >= 1; i--) {
      const tokenUpper = tokens[i].toUpperCase();
      if (validUnits.includes(tokenUpper) || /^(UN|KG|LT|ML|G|PC|FD|CX)$/i.test(tokenUpper)) {
        unitIdx = i;
        break;
      }
    }

    if (unitIdx !== -1) {
      qtyIdx = unitIdx - 1;
      priceIdx = unitIdx + 1;
      totalIdx = unitIdx + 2;
    } else {
      totalIdx = tokens.length - 1;
      priceIdx = tokens.length - 2;
      qtyIdx = tokens.length - 3;
    }

    // Validate indices are within bounds
    if (qtyIdx < 0 || priceIdx >= tokens.length || totalIdx >= tokens.length) continue;

    const totalVal = parseLocalFloat(tokens[totalIdx]);
    const priceVal = parseLocalFloat(tokens[priceIdx]);
    let qtyVal = parseLocalFloat(tokens[qtyIdx]);
    
    let rawUnit = unitIdx !== -1 ? tokens[unitIdx].toUpperCase() : 'UN';
    // Normalize OCR misreadings of units
    let unit = 'UN';
    if (/^(KG|KA|K6|KS|KO)$/i.test(rawUnit)) {
      unit = 'KG';
    } else if (/^(UN|UM|UNI|UN1|UND|UNID|U)$/i.test(rawUnit)) {
      unit = 'UN';
    } else {
      unit = rawUnit;
    }

    // Skip if price parsing failed or values are zero
    if (priceVal <= 0 || totalVal <= 0) continue;

    // Heuristic: quantity correction by dividing total price by unit price
    if (priceVal > 0 && totalVal > 0) {
      const calculatedQty = totalVal / priceVal;
      // If parsed quantity is way off, correct it
      if (Math.abs(qtyVal - calculatedQty) > 0.01) {
        qtyVal = calculatedQty;
      }
    }

    const descTokens = tokens.slice(0, qtyIdx);
    let desc = descTokens.join(' ').trim();

    // Clean up code prefix (e.g. "014120 KIMARC" -> "KIMARC")
    desc = desc.replace(/^\d{3,12}\s+/, '');

    if (desc && qtyVal > 0 && priceVal > 0) {
      itens.push({
        descricao: desc,
        quantidade: qtyVal,
        unidade: unit,
        valorUnitario: priceVal
      });
    }
  }

  // Calculate final total (prefer overall total extracted from receipt rodapé, fallback to sum of items)
  const itemsSum = parseFloat(itens.reduce((acc, it) => acc + (it.quantidade * it.valorUnitario), 0).toFixed(2));
  const finalTotal = extractedTotal !== null && extractedTotal > 0 ? extractedTotal : itemsSum;

  return { itens, valorTotal: finalTotal };
}
