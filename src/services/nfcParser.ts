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

  return {
    chaveAcesso: chave,
    numeroNf,
    serie,
    cnpjEmitente,
    dataEmissao,
    valorTotal: 0,
    itens: []
  };
}
