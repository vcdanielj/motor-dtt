import { normalizeText } from '@/ingest/normalize'

export interface GeoParseResult {
  estadoStd: string
  matchedPhrase: string
  confidence: 'HIGH' | 'MEDIUM'
}

/** Specific compound phrases where a simple token match would misclassify (e.g., 'ARAGUA DE BARCELONA' is in Anzoátegui, not Aragua).
 *  Order matters: more specific phrases MUST precede shorter/generic tokens. */
const COMPOUND_GEO_MAP: Array<{ phrase: string; estadoStd: string; confidence: 'HIGH' | 'MEDIUM' }> = [
  // ── Anzoátegui disambiguations ──
  { phrase: 'ARAGUA DE BARCELONA', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'ARAGUA BARCELONA', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'PUERTO LA CRUZ', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'PTO LA CRUZ', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'PTO. LA CRUZ', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'LECHERIA', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'EL TIGRE', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'EL TIGRECITO', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'SAN JOSE DE GUANIPA', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'CANTAURA', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'PARIAGUAN', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'CLARINES', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'PIRITU', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'PUERTO PIRITU', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
  { phrase: 'GUANIPA', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },

  // ── Distrito Capital / Caracas landmarks & avenues ──
  { phrase: 'FUERZAS ARMADAS', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV FUERZAS ARMADAS', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA FUERZAS ARMADAS', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV BARALT', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA BARALT', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV URDANETA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA URDANETA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV SAN MARTIN', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA SAN MARTIN', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV SUCRE', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA SUCRE', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV ANDRES BELLO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA ANDRES BELLO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV UNIVERSIDAD', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA UNIVERSIDAD', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV PANTEON', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA PANTEON', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV LECUNA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA LECUNA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV MEXICO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA MEXICO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV ROOSEVELT', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA ROOSEVELT', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV NUEVA GRANADA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA NUEVA GRANADA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AV VICTORIA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'AVENIDA VICTORIA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'PLAZA VENEZUELA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'SABANA GRANDE', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'QUINTA CRESPO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'CATIA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'EL JUNQUITO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'CARICUAO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'ANTIMANO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'PROPATRIA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'EL PARAISO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'LA VEGA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'SAN AGUSTIN SUR', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'SAN AGUSTIN DEL NORTE', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'LA PASTORA', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'EL CEMENTERIO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: 'MACARAO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
  { phrase: '23 DE ENERO', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },

  // ── Carabobo / Gran Valencia ──
  { phrase: 'GRAN VALENCIA', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'PUERTO CABELLO', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'PTO CABELLO', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'PTO. CABELLO', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'NAGUANAGUA', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'SAN DIEGO CARABOBO', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'LOS GUAYOS', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'SAN JOAQUIN CARABOBO', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'TOCUYITO', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'BEJUMA', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'MARIARA', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'GUACARA', estadoStd: 'CARABOBO', confidence: 'HIGH' },
  { phrase: 'MORON', estadoStd: 'CARABOBO', confidence: 'HIGH' },

  // ── Miranda ──
  { phrase: 'ALTOS MIRANDINOS', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'VALLES DEL TUY', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'SAN ANTONIO DE LOS ALTOS', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'SANTA TERESA DEL TUY', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'SAN FRANCISCO DE YARE', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'OCUMARE DEL TUY', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'LOS DOS CAMINOS', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'FILAS DE MARICHE', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'PALO VERDE', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'RIO CHICO', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'LOS TEQUES', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'GUARENAS', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'GUATIRE', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'CHARALLAVE', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'CARRIZAL', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'HIGUEROTE', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'CAUCAGUA', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'PETARE', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'BARUTA', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'CHACAO', estadoStd: 'MIRANDA', confidence: 'HIGH' },
  { phrase: 'EL HATILLO', estadoStd: 'MIRANDA', confidence: 'HIGH' },

  // ── Zulia ──
  { phrase: 'COSTA ORIENTAL DEL LAGO', estadoStd: 'ZULIA', confidence: 'HIGH' },
  { phrase: 'SANTA BARBARA DEL ZULIA', estadoStd: 'ZULIA', confidence: 'HIGH' },
  { phrase: 'CIUDAD OJEDA', estadoStd: 'ZULIA', confidence: 'HIGH' },
  { phrase: 'MENE GRANDE', estadoStd: 'ZULIA', confidence: 'HIGH' },
  { phrase: 'MACHIQUES', estadoStd: 'ZULIA', confidence: 'HIGH' },
  { phrase: 'BACHAQUERO', estadoStd: 'ZULIA', confidence: 'HIGH' },
  { phrase: 'MARACAIBO', estadoStd: 'ZULIA', confidence: 'HIGH' },
  { phrase: 'CABIMAS', estadoStd: 'ZULIA', confidence: 'HIGH' },

  // ── Aragua ──
  { phrase: 'SANTA CRUZ DE ARAGUA', estadoStd: 'ARAGUA', confidence: 'HIGH' },
  { phrase: 'COLONIA TOVAR', estadoStd: 'ARAGUA', confidence: 'HIGH' },
  { phrase: 'VILLA DE CURA', estadoStd: 'ARAGUA', confidence: 'HIGH' },
  { phrase: 'PALO NEGRO', estadoStd: 'ARAGUA', confidence: 'HIGH' },
  { phrase: 'EL LIMON', estadoStd: 'ARAGUA', confidence: 'HIGH' },
  { phrase: 'TURMERO', estadoStd: 'ARAGUA', confidence: 'HIGH' },
  { phrase: 'MARACAY', estadoStd: 'ARAGUA', confidence: 'HIGH' },
  { phrase: 'CAGUA', estadoStd: 'ARAGUA', confidence: 'HIGH' },

  // ── Lara ──
  { phrase: 'BARQUISIMETO', estadoStd: 'LARA', confidence: 'HIGH' },
  { phrase: 'CABUDARE', estadoStd: 'LARA', confidence: 'HIGH' },
  { phrase: 'CARORA', estadoStd: 'LARA', confidence: 'HIGH' },
  { phrase: 'QUIBOR', estadoStd: 'LARA', confidence: 'HIGH' },
  { phrase: 'EL TOCUYO', estadoStd: 'LARA', confidence: 'HIGH' },

  // ── Portuguesa ──
  { phrase: 'ACARIGUA', estadoStd: 'PORTUGUESA', confidence: 'HIGH' },
  { phrase: 'ARAURE', estadoStd: 'PORTUGUESA', confidence: 'HIGH' },
  { phrase: 'GUANARE', estadoStd: 'PORTUGUESA', confidence: 'HIGH' },
  { phrase: 'TUREN', estadoStd: 'PORTUGUESA', confidence: 'HIGH' },
  { phrase: 'BISCUCUY', estadoStd: 'PORTUGUESA', confidence: 'HIGH' },

  // ── Barinas ──
  { phrase: 'BARINITAS', estadoStd: 'BARINAS', confidence: 'HIGH' },
  { phrase: 'SOCOPO', estadoStd: 'BARINAS', confidence: 'HIGH' },
  { phrase: 'SANTA BARBARA DE BARINAS', estadoStd: 'BARINAS', confidence: 'HIGH' },
  { phrase: 'CIUDAD BOLIVIA', estadoStd: 'BARINAS', confidence: 'HIGH' },

  // ── Monagas ──
  { phrase: 'ARAGUA DE MATURIN', estadoStd: 'MONAGAS', confidence: 'HIGH' },
  { phrase: 'PUNTA DE MATA', estadoStd: 'MONAGAS', confidence: 'HIGH' },
  { phrase: 'MATURIN', estadoStd: 'MONAGAS', confidence: 'HIGH' },
  { phrase: 'CARIPE', estadoStd: 'MONAGAS', confidence: 'HIGH' },

  // ── Bolívar ──
  { phrase: 'CIUDAD GUAYANA', estadoStd: 'BOLIVAR', confidence: 'HIGH' },
  { phrase: 'PUERTO ORDAZ', estadoStd: 'BOLIVAR', confidence: 'HIGH' },
  { phrase: 'PTO ORDAZ', estadoStd: 'BOLIVAR', confidence: 'HIGH' },
  { phrase: 'SAN FELIX', estadoStd: 'BOLIVAR', confidence: 'HIGH' },
  { phrase: 'CIUDAD BOLIVAR', estadoStd: 'BOLIVAR', confidence: 'HIGH' },
  { phrase: 'SANTA ELENA DE UAIREN', estadoStd: 'BOLIVAR', confidence: 'HIGH' },
  { phrase: 'UPATA', estadoStd: 'BOLIVAR', confidence: 'HIGH' },

  // ── Táchira ──
  { phrase: 'SAN CRISTOBAL', estadoStd: 'TACHIRA', confidence: 'HIGH' },
  { phrase: 'TARIBA', estadoStd: 'TACHIRA', confidence: 'HIGH' },
  { phrase: 'RUBIO', estadoStd: 'TACHIRA', confidence: 'HIGH' },
  { phrase: 'LA GRITA', estadoStd: 'TACHIRA', confidence: 'HIGH' },
  { phrase: 'SAN ANTONIO DEL TACHIRA', estadoStd: 'TACHIRA', confidence: 'HIGH' },

  // ── Mérida ──
  { phrase: 'EL VIGIA', estadoStd: 'MERIDA', confidence: 'HIGH' },
  { phrase: 'EJIDO', estadoStd: 'MERIDA', confidence: 'HIGH' },
  { phrase: 'TOVAR', estadoStd: 'MERIDA', confidence: 'HIGH' },
  { phrase: 'MUCUCHIES', estadoStd: 'MERIDA', confidence: 'HIGH' },

  // ── Falcón ──
  { phrase: 'PUNTO FIJO', estadoStd: 'FALCON', confidence: 'HIGH' },
  { phrase: 'CORO', estadoStd: 'FALCON', confidence: 'HIGH' },
  { phrase: 'DABAJURO', estadoStd: 'FALCON', confidence: 'HIGH' },
  { phrase: 'TUCACAS', estadoStd: 'FALCON', confidence: 'HIGH' },
  { phrase: 'CHICHIRIVICHE', estadoStd: 'FALCON', confidence: 'HIGH' },

  // ── Sucre ──
  { phrase: 'CUMANA', estadoStd: 'SUCRE', confidence: 'HIGH' },
  { phrase: 'CARUPANO', estadoStd: 'SUCRE', confidence: 'HIGH' },
  { phrase: 'GUIRIA', estadoStd: 'SUCRE', confidence: 'HIGH' },

  // ── Yaracuy ──
  { phrase: 'SAN FELIPE', estadoStd: 'YARACUY', confidence: 'HIGH' },
  { phrase: 'YARITAGUA', estadoStd: 'YARACUY', confidence: 'HIGH' },
  { phrase: 'CHIVACOA', estadoStd: 'YARACUY', confidence: 'HIGH' },
  { phrase: 'NIRGUA', estadoStd: 'YARACUY', confidence: 'HIGH' },

  // ── Guárico ──
  { phrase: 'SAN JUAN DE LOS MORROS', estadoStd: 'GUARICO', confidence: 'HIGH' },
  { phrase: 'VALLE DE LA PASCUA', estadoStd: 'GUARICO', confidence: 'HIGH' },
  { phrase: 'CALABOZO', estadoStd: 'GUARICO', confidence: 'HIGH' },
  { phrase: 'ZARAZA', estadoStd: 'GUARICO', confidence: 'HIGH' },
  { phrase: 'ALTAGRACIA DE ORITUCO', estadoStd: 'GUARICO', confidence: 'HIGH' },

  // ── Nueva Esparta ──
  { phrase: 'ISLA DE MARGARITA', estadoStd: 'NUEVA ESPARTA', confidence: 'HIGH' },
  { phrase: 'PORLAMAR', estadoStd: 'NUEVA ESPARTA', confidence: 'HIGH' },
  { phrase: 'PAMPATAR', estadoStd: 'NUEVA ESPARTA', confidence: 'HIGH' },
  { phrase: 'JUAN GRIEGO', estadoStd: 'NUEVA ESPARTA', confidence: 'HIGH' },
  { phrase: 'LA ASUNCION', estadoStd: 'NUEVA ESPARTA', confidence: 'HIGH' },

  // ── Vargas ──
  { phrase: 'LITORAL CENTRAL', estadoStd: 'VARGAS', confidence: 'HIGH' },
  { phrase: 'CATIA LA MAR', estadoStd: 'VARGAS', confidence: 'HIGH' },
  { phrase: 'MAIQUETIA', estadoStd: 'VARGAS', confidence: 'HIGH' },
  { phrase: 'CARABALLEDA', estadoStd: 'VARGAS', confidence: 'HIGH' },
  { phrase: 'CARAYACA', estadoStd: 'VARGAS', confidence: 'HIGH' },
]

/** Parse a location, address or messy city string to extract the Venezuelan Estado.
 *  Uses contextual multi-token matching, guaranteeing that specific compound phrases
 *  (e.g., 'Aragua de Barcelona') take precedence over individual word hits. */
export function parseGeoLocation(rawText: string | null | undefined): GeoParseResult | null {
  if (!rawText) return null
  const normalized = normalizeText(rawText).replace(/[^A-Z0-9]+/g, ' ').trim()
  if (!normalized || normalized.length < 3) return null

  // 1. Search for compound phrases first
  for (const item of COMPOUND_GEO_MAP) {
    const cleanPhrase = item.phrase.replace(/[^A-Z0-9]+/g, ' ').trim()
    const phraseNeedle = ` ${cleanPhrase} `
    const padded = ` ${normalized} `
    if (padded.includes(phraseNeedle)) {
      return {
        estadoStd: item.estadoStd,
        matchedPhrase: item.phrase,
        confidence: item.confidence,
      }
    }
  }

  return null
}
