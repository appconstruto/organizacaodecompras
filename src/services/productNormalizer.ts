export interface NormalizedProduct {
  nomePadronizado: string;
  marca: string;
  categoriaId: number; // reference to DB categories
  unidadeBase: 'kg' | 'L' | 'unidades';
  multiplicadorBase: number; // e.g. 500g -> 0.5kg, 900ml -> 0.9L
}

// Predefined categories mapping
export const CATEGORIES_MAP: Record<string, number> = {
  'Alimentos': 1,
  'Bebidas': 2,
  'Limpeza': 3,
  'Higiene': 4,
  'Açougue': 5,
  'Hortifruti': 6,
  'Padaria': 7,
  'Congelados': 8,
  'Pet': 9,
  'Outros': 10
};

/**
 * Heuristics-based product normalizer.
 * In V2/V3, this can call OpenAI or Gemini APIs to automatically normalize.
 */
export function normalizeProduct(descricaoOriginal: string, unidadeOriginal?: string): NormalizedProduct {
  const cleanDesc = descricaoOriginal.toUpperCase().trim();

  // 1. Café Pilão rules
  if (cleanDesc.includes('CAF') && cleanDesc.includes('PILAO')) {
    let mult = 0.5; // default 500g
    if (cleanDesc.includes('250')) mult = 0.25;
    if (cleanDesc.includes('1KG') || cleanDesc.includes('1000')) mult = 1.0;
    
    return {
      nomePadronizado: 'Café Pilão',
      marca: 'Pilão',
      categoriaId: CATEGORIES_MAP['Alimentos'],
      unidadeBase: 'kg',
      multiplicadorBase: mult
    };
  }

  // 2. Leite Integral rules
  if (cleanDesc.includes('LEITE') && (cleanDesc.includes('INTEGRAL') || cleanDesc.includes('UHT') || cleanDesc.includes('ITALAC') || cleanDesc.includes('LECO') || cleanDesc.includes('PARMALAT'))) {
    let mult = 1.0; // default 1L
    let marca = 'Genérica';
    
    if (cleanDesc.includes('ITALAC')) marca = 'Italac';
    else if (cleanDesc.includes('LECO')) marca = 'Leco';
    else if (cleanDesc.includes('PARMALAT')) marca = 'Parmalat';

    if (cleanDesc.includes('500ML') || cleanDesc.includes('500 G')) mult = 0.5;
    if (cleanDesc.includes('200ML')) mult = 0.2;

    return {
      nomePadronizado: 'Leite Integral',
      marca,
      categoriaId: CATEGORIES_MAP['Bebidas'],
      unidadeBase: 'L',
      multiplicadorBase: mult
    };
  }

  // 3. Arroz rules
  if (cleanDesc.includes('ARROZ')) {
    let mult = 5.0; // default 5kg
    let marca = 'Genérica';
    if (cleanDesc.includes('TIO JOAO') || cleanDesc.includes('TIO JOÃO')) marca = 'Tio João';
    else if (cleanDesc.includes('CAMIL')) marca = 'Camil';
    else if (cleanDesc.includes('TIO URBAN')) marca = 'Tio Urbano';

    if (cleanDesc.includes('1KG') || cleanDesc.includes('1 KG')) mult = 1.0;

    return {
      nomePadronizado: 'Arroz Tipo 1',
      marca,
      categoriaId: CATEGORIES_MAP['Alimentos'],
      unidadeBase: 'kg',
      multiplicadorBase: mult
    };
  }

  // 4. Feijão rules
  if (cleanDesc.includes('FEIJAO') || cleanDesc.includes('FEIJÃO')) {
    let marca = 'Genérica';
    if (cleanDesc.includes('CAMIL')) marca = 'Camil';
    else if (cleanDesc.includes('KIKALDO')) marca = 'Kikaldo';

    return {
      nomePadronizado: 'Feijão Carioca',
      marca,
      categoriaId: CATEGORIES_MAP['Alimentos'],
      unidadeBase: 'kg',
      multiplicadorBase: 1.0
    };
  }

  // 5. Óleo de Soja
  if (cleanDesc.includes('OLEO') || cleanDesc.includes('ÓLEO') || cleanDesc.includes('SOJA')) {
    let marca = 'Liza';
    if (cleanDesc.includes('SOYA')) marca = 'Soya';
    else if (cleanDesc.includes('CONCORDIA')) marca = 'Concórdia';

    return {
      nomePadronizado: 'Óleo de Soja',
      marca,
      categoriaId: CATEGORIES_MAP['Alimentos'],
      unidadeBase: 'L',
      multiplicadorBase: 0.9 // standard bottle is 900ml
    };
  }

  // Fallback defaults
  let unit: 'kg' | 'L' | 'unidades' = 'unidades';
  let categoriaId = CATEGORIES_MAP['Outros'];
  let mult = 1.0;

  // Process original unit if available
  if (unidadeOriginal) {
    const cleanUnit = unidadeOriginal.toUpperCase().trim();
    if (cleanUnit === 'KG' || cleanUnit === 'K' || cleanUnit === 'KILO' || cleanUnit === 'KILOS' || cleanUnit === 'KG.') {
      unit = 'kg';
    } else if (cleanUnit === 'L' || cleanUnit === 'LITRO' || cleanUnit === 'LITROS' || cleanUnit === 'ML') {
      unit = 'L';
    } else if (cleanUnit === 'UN' || cleanUnit === 'UNID' || cleanUnit === 'UNIDADE' || cleanUnit === 'UNIDADES' || cleanUnit === 'U') {
      unit = 'unidades';
    }
  }

  // If unit is still 'unidades', inspect description text
  if (unit === 'unidades') {
    if (cleanDesc.includes('KG') || cleanDesc.includes('KILO') || cleanDesc.includes(' KG')) {
      unit = 'kg';
    } else if (cleanDesc.includes('ML') || cleanDesc.includes(' L ') || cleanDesc.endsWith(' L') || cleanDesc.includes('LITRO')) {
      unit = 'L';
      if (cleanDesc.includes('500ML')) mult = 0.5;
      else if (cleanDesc.includes('350ML')) mult = 0.35;
      else if (cleanDesc.includes('900ML')) mult = 0.9;
    }
  }

  // Guess category & refine unit defaults
  if (cleanDesc.includes('SABONETE') || cleanDesc.includes('SHAMPOO') || cleanDesc.includes('CREME DENTAL') || cleanDesc.includes('ESCOVA') || cleanDesc.includes('PAPEL HIGIENICO')) {
    categoriaId = CATEGORIES_MAP['Higiene'];
  } else if (cleanDesc.includes('DETERGENTE') || cleanDesc.includes('DESINFETANTE') || cleanDesc.includes('OMO') || cleanDesc.includes('SABÃO') || cleanDesc.includes('AMACIANTE')) {
    categoriaId = CATEGORIES_MAP['Limpeza'];
  } else if (
    cleanDesc.includes('CARNE') || 
    cleanDesc.includes('PEITO') || 
    cleanDesc.includes('FRANGO') || 
    cleanDesc.includes('LINGUICA') || 
    cleanDesc.includes('LINGUIÇA') ||
    cleanDesc.includes('ALCATRA') ||
    cleanDesc.includes('BOVINO') ||
    cleanDesc.includes('SUINO') ||
    cleanDesc.includes('SUÍNO') ||
    cleanDesc.includes('SÚINO') ||
    cleanDesc.includes('MAMINHA') ||
    cleanDesc.includes('PICANHA') ||
    cleanDesc.includes('COSTELA') ||
    cleanDesc.includes('FILÉ') ||
    cleanDesc.includes('FILE') ||
    cleanDesc.includes('PATINHO') ||
    cleanDesc.includes('ACEM') ||
    cleanDesc.includes('ACÉM')
  ) {
    categoriaId = CATEGORIES_MAP['Açougue'];
    // Default to kg for meat unless another volume/unit was explicitly parsed
    if (!unidadeOriginal || unidadeOriginal.toUpperCase().trim() === 'UN') {
      unit = 'kg';
    }
  } else if (
    cleanDesc.includes('TOMATE') || 
    cleanDesc.includes('CEBOLA') || 
    cleanDesc.includes('BATATA') || 
    cleanDesc.includes('MACA') || 
    cleanDesc.includes('MAÇÃ') ||
    cleanDesc.includes('BANANA') ||
    cleanDesc.includes('MANDIOQUINHA') ||
    cleanDesc.includes('CENOURA') ||
    cleanDesc.includes('LARANJA') ||
    cleanDesc.includes('ALHO') ||
    cleanDesc.includes('LIMÃO') ||
    cleanDesc.includes('LIMAO') ||
    cleanDesc.includes('ABOBORA') ||
    cleanDesc.includes('ABÓBORA') ||
    cleanDesc.includes('BROCOLIS') ||
    cleanDesc.includes('BRÓCOLIS') ||
    cleanDesc.includes('ALFACE') ||
    cleanDesc.includes('REPOLHO')
  ) {
    categoriaId = CATEGORIES_MAP['Hortifruti'];
    // Default to kg for Hortifruti items unless another volume/unit was explicitly parsed
    if (!unidadeOriginal || unidadeOriginal.toUpperCase().trim() === 'UN') {
      unit = 'kg';
    }
  }

  // Clean brand search
  const words = cleanDesc.split(' ');
  const brand = words.length > 1 ? words[words.length - 1] : 'Genérica';

  // Capitalize standardized name
  const formattedName = cleanDesc.charAt(0) + cleanDesc.slice(1).toLowerCase();

  return {
    nomePadronizado: formattedName,
    marca: brand,
    categoriaId,
    unidadeBase: unit,
    multiplicadorBase: mult
  };
}
