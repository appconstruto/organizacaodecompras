export interface ParsedNFCe {
  chaveAcesso: string;
  numeroNf: string;
  serie: string;
  cnpjEmitente: string;
  dataEmissao: Date;
  valorTotal: number;
  itens: Array<{
    descricao: string;
    quantidade: number;
    unidade: string;
    valorUnitario: number;
  }>;
}

/**
 * Parses NFC-e QR Code URLs and extracts the 44-digit key and components.
 */
export function parseNfcUrl(url: string): ParsedNFCe | null {
  // Regex to search for the 44 digit access key (chNFe)
  const regex = /[?&]chNFe=(\d{44})|[?&]p=(\d{44})/i;
  const match = url.match(regex);
  const chaveAcesso = match ? (match[1] || match[2]) : null;

  if (!chaveAcesso || chaveAcesso.length !== 44) {
    // If not a URL, but a direct 44-digit key typed/scanned
    if (/^\d{44}$/.test(url.trim())) {
      return parseFromChave(url.trim());
    }
    return null;
  }

  return parseFromChave(chaveAcesso);
}

function parseFromChave(chave: string): ParsedNFCe {
  // NFC-e 44 digit structure:
  // State (2) | Year/Month (4) | CNPJ (14) | Model (2) | Series (3) | Number (9) | Type (1) | Code (8) | DV (1)
  const ano = '20' + chave.substring(2, 4);
  const mes = chave.substring(4, 6);
  const cnpjEmitente = chave.substring(6, 20).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  const serie = parseInt(chave.substring(22, 25), 10).toString();
  const numeroNf = parseInt(chave.substring(25, 34), 10).toString();

  // Create a realistic date using Year/Month from chave
  const dataEmissao = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, 15, 12, 0, 0);

  // Generate realistic items for the mock demonstration
  const randomItems = generateMockItems();
  const valorTotal = parseFloat(randomItems.reduce((acc, item) => acc + item.quantidade * item.valorUnitario, 0).toFixed(2));

  return {
    chaveAcesso: chave,
    numeroNf,
    serie,
    cnpjEmitente,
    dataEmissao,
    valorTotal,
    itens: randomItems
  };
}

// Helper to generate realistic items for test imports
function generateMockItems() {
  const possibleItems = [
    { descricao: 'ARROZ TIO JOAO TP1 5KG', unidade: 'UN', valorUnitario: 29.90, base: 'kg', convert: 5 },
    { descricao: 'FEIJAO CARIOCA CAMIL 1KG', unidade: 'UN', valorUnitario: 8.90, base: 'kg', convert: 1 },
    { descricao: 'OLEO DE SOJA LIZA 900ML', unidade: 'UN', valorUnitario: 6.50, base: 'L', convert: 0.9 },
    { descricao: 'ACUCAR REFINADO UNIAO 1KG', unidade: 'UN', valorUnitario: 4.80, base: 'kg', convert: 1 },
    { descricao: 'CAFE PILAO TRADICIONAL 500G', unidade: 'UN', valorUnitario: 15.20, base: 'kg', convert: 0.5 },
    { descricao: 'LEITE INTEGRAL UHT ITALAC 1L', unidade: 'UN', valorUnitario: 5.20, base: 'L', convert: 1 },
    { descricao: 'MACARRAO ADOC CHAPA 500G', unidade: 'UN', valorUnitario: 3.50, base: 'kg', convert: 0.5 },
    { descricao: 'SABONETE DOVE ORIGINAL 90G', unidade: 'UN', valorUnitario: 3.90, base: 'unidades', convert: 1 },
    { descricao: 'DETERGENTE YPE NEUTRO 500ML', unidade: 'UN', valorUnitario: 2.30, base: 'L', convert: 0.5 },
    { descricao: 'PAPEL HIGIENICO NEVE C/12 UN', unidade: 'UN', valorUnitario: 18.90, base: 'unidades', convert: 12 },
    { descricao: 'COCA COLA MENOS AZUCAR 2L', unidade: 'UN', valorUnitario: 9.90, base: 'L', convert: 2 },
    { descricao: 'CEBOLA KG', unidade: 'KG', valorUnitario: 5.90, base: 'kg', convert: 1 },
    { descricao: 'BATATA MONALISA KG', unidade: 'KG', valorUnitario: 6.80, base: 'kg', convert: 1 },
    { descricao: 'TOMATE ITALIANO KG', unidade: 'KG', valorUnitario: 8.90, base: 'kg', convert: 1 },
    { descricao: 'BANANA PRATA KG', unidade: 'KG', valorUnitario: 7.20, base: 'kg', convert: 1 },
    { descricao: 'PÃO DE FORMA WICKBOLD 500G', unidade: 'UN', valorUnitario: 8.50, base: 'kg', convert: 0.5 }
  ];

  // Pick 4 to 8 random items
  const count = Math.floor(Math.random() * 5) + 4;
  const shuffled = [...possibleItems].sort(() => 0.5 - Math.random());
  
  return shuffled.slice(0, count).map(item => {
    const qty = item.unidade === 'KG' 
      ? parseFloat((Math.random() * 1.5 + 0.3).toFixed(3))
      : Math.floor(Math.random() * 3) + 1;
    
    return {
      descricao: item.descricao,
      quantidade: qty,
      unidade: item.unidade,
      valorUnitario: item.valorUnitario
    };
  });
}
