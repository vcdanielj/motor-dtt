// Curated city/municipality → estado seed (not part of Entregable 2.1). Feeds the CIUDAD step of
// the estado cascade, which only runs when the estado column itself could not be resolved (R4).
//
// Inclusion rule: a name goes in ONLY if it identifies exactly one estado in commercial practice.
// Names that repeat across estados — San Carlos, Libertador, Bolívar, La Victoria, Independencia,
// Lagunillas, Santa Rita, La Concepción, Sabaneta, La Candelaria, San Mateo — are deliberately
// absent: a wrong estado is worse than SIN_ESTADO, and unresolved values reach the cola as
// CIUDAD_SIN_MAPEAR for an analyst to map explicitly (and permanently).
//
// Entries marked "(verificado)" were cross-checked against a 740K-row Heinz sell-out file: the
// rows that DO carry a state agreed on the value shown, at the share noted.
export const CIUDAD_ESTADO: Record<string, string> = {
  // ── Distrito Capital — parroquias del municipio Libertador ──
  CARACAS: 'DISTRITO CAPITAL',
  'CIUDAD DE CARACAS': 'DISTRITO CAPITAL',
  CATIA: 'DISTRITO CAPITAL',
  'EL JUNQUITO': 'DISTRITO CAPITAL',
  ANTIMANO: 'DISTRITO CAPITAL',
  CARICUAO: 'DISTRITO CAPITAL',
  PROPATRIA: 'DISTRITO CAPITAL',
  'QUINTA CRESPO': 'DISTRITO CAPITAL',
  'LAS ADJUNTAS': 'DISTRITO CAPITAL',
  'EL PARAISO': 'DISTRITO CAPITAL',
  'LA VEGA': 'DISTRITO CAPITAL',
  'SAN AGUSTIN': 'DISTRITO CAPITAL',
  'SAN AGUSTIN SUR': 'DISTRITO CAPITAL',
  'LA PASTORA': 'DISTRITO CAPITAL',
  'EL RECREO': 'DISTRITO CAPITAL',
  'EL CEMENTERIO': 'DISTRITO CAPITAL',
  MACARAO: 'DISTRITO CAPITAL',

  // ── Miranda — Baruta, Chacao, El Hatillo y Sucre son municipios de MIRANDA, no del Distrito
  //    Capital, aunque comercialmente se hable de «Gran Caracas». (verificado: BARUTA 1.895/1.895
  //    y CHACAO 794/794 de las filas con estado conocido dicen MIRANDA.) ──
  BARUTA: 'MIRANDA',
  CHACAO: 'MIRANDA',
  'EL HATILLO': 'MIRANDA',
  PETARE: 'MIRANDA',
  'FILAS DE MARICHE': 'MIRANDA',
  MESUCA: 'MIRANDA',
  'PALO VERDE': 'MIRANDA',
  SEBUCAN: 'MIRANDA',
  BOLEITA: 'MIRANDA',
  'LOS DOS CAMINOS': 'MIRANDA',
  CARTANAL: 'MIRANDA',
  'LOS TEQUES': 'MIRANDA',
  GUARENAS: 'MIRANDA',
  GUATIRE: 'MIRANDA',
  CHARALLAVE: 'MIRANDA',
  CUA: 'MIRANDA',
  'SANTA TERESA DEL TUY': 'MIRANDA',
  'SAN ANTONIO DE LOS ALTOS': 'MIRANDA',
  CARRIZAL: 'MIRANDA',
  HIGUEROTE: 'MIRANDA',
  'RIO CHICO': 'MIRANDA',
  CAUCAGUA: 'MIRANDA',
  'OCUMARE DEL TUY': 'MIRANDA',
  'SAN FRANCISCO DE YARE': 'MIRANDA',

  // ── Vargas (La Guaira) ──
  'LA GUAIRA': 'VARGAS',
  MAIQUETIA: 'VARGAS',
  'CATIA LA MAR': 'VARGAS',
  MACUTO: 'VARGAS',
  CARABALLEDA: 'VARGAS',
  CARAYACA: 'VARGAS',              // verificado: 529/529
  NAIGUATA: 'VARGAS',

  // ── Zulia ──
  MARACAIBO: 'ZULIA',
  CABIMAS: 'ZULIA',
  'CIUDAD OJEDA': 'ZULIA',
  MACHIQUES: 'ZULIA',
  'SANTA BARBARA DEL ZULIA': 'ZULIA',
  'MENE GRANDE': 'ZULIA',
  BACHAQUERO: 'ZULIA',

  // ── Carabobo ──
  VALENCIA: 'CARABOBO',
  'PUERTO CABELLO': 'CARABOBO',
  'PTO CABELLO': 'CARABOBO',
  GUACARA: 'CARABOBO',
  'SAN JOAQUIN': 'CARABOBO',
  MARIARA: 'CARABOBO',
  BEJUMA: 'CARABOBO',
  MORON: 'CARABOBO',
  TOCUYITO: 'CARABOBO',
  NAGUANAGUA: 'CARABOBO',
  'SAN DIEGO': 'CARABOBO',
  'LOS GUAYOS': 'CARABOBO',

  // ── Aragua ──
  MARACAY: 'ARAGUA',
  TURMERO: 'ARAGUA',
  CAGUA: 'ARAGUA',
  'EL LIMON': 'ARAGUA',
  'VILLA DE CURA': 'ARAGUA',
  'PALO NEGRO': 'ARAGUA',
  'SANTA CRUZ DE ARAGUA': 'ARAGUA',
  'COLONIA TOVAR': 'ARAGUA',
  'OCUMARE DE LA COSTA': 'ARAGUA',
  CHORONI: 'ARAGUA',

  // ── Lara ──
  BARQUISIMETO: 'LARA',
  CABUDARE: 'LARA',
  'EL TOCUYO': 'LARA',
  CARORA: 'LARA',
  QUIBOR: 'LARA',
  DUACA: 'LARA',
  SANARE: 'LARA',

  // ── Bolívar ──
  'CIUDAD GUAYANA': 'BOLIVAR',
  'PUERTO ORDAZ': 'BOLIVAR',
  'PTO ORDAZ': 'BOLIVAR',
  'SAN FELIX': 'BOLIVAR',
  'SAN FELIX BOLIVAR': 'BOLIVAR',      // verificado: 626/626
  'PUERTO ORDAZ BOLIVAR': 'BOLIVAR',   // verificado: 1.873/1.873
  'CIUDAD BOLIVAR': 'BOLIVAR',
  UPATA: 'BOLIVAR',
  'EL CALLAO': 'BOLIVAR',
  TUMEREMO: 'BOLIVAR',
  'SANTA ELENA DE UAIREN': 'BOLIVAR',
  'CAICARA DEL ORINOCO': 'BOLIVAR',

  // ── Anzoátegui ──
  BARCELONA: 'ANZOATEGUI',
  'PUERTO LA CRUZ': 'ANZOATEGUI',
  'PTO LA CRUZ': 'ANZOATEGUI',
  LECHERIA: 'ANZOATEGUI',
  'EL TIGRE': 'ANZOATEGUI',
  ANACO: 'ANZOATEGUI',
  CANTAURA: 'ANZOATEGUI',
  'PUERTO PIRITU': 'ANZOATEGUI',
  GUANTA: 'ANZOATEGUI',
  PARIAGUAN: 'ANZOATEGUI',

  // ── Monagas ──
  MATURIN: 'MONAGAS',
  'PUNTA DE MATA': 'MONAGAS',
  CARIPITO: 'MONAGAS',
  TEMBLADOR: 'MONAGAS',
  CARIPE: 'MONAGAS',

  // ── Sucre ──
  CUMANA: 'SUCRE',
  CARUPANO: 'SUCRE',
  GUIRIA: 'SUCRE',
  CARIACO: 'SUCRE',
  MARIGUITAR: 'SUCRE',

  // ── Nueva Esparta ──
  PORLAMAR: 'NUEVA ESPARTA',
  'LA ASUNCION': 'NUEVA ESPARTA',
  PAMPATAR: 'NUEVA ESPARTA',
  'JUAN GRIEGO': 'NUEVA ESPARTA',
  'EL VALLE DEL ESPIRITU SANTO': 'NUEVA ESPARTA',

  // ── Táchira ──
  'SAN CRISTOBAL': 'TACHIRA',
  'SAN ANTONIO DEL TACHIRA': 'TACHIRA',
  RUBIO: 'TACHIRA',
  'LA FRIA': 'TACHIRA',
  TARIBA: 'TACHIRA',
  'SAN JUAN DE COLON': 'TACHIRA',
  UREÑA: 'TACHIRA',

  // ── Mérida ──
  MERIDA: 'MERIDA',
  'EL VIGIA': 'MERIDA',
  TOVAR: 'MERIDA',
  EJIDO: 'MERIDA',
  'SANTA CRUZ DE MORA': 'MERIDA',

  // ── Trujillo ──
  TRUJILLO: 'TRUJILLO',
  VALERA: 'TRUJILLO',
  BOCONO: 'TRUJILLO',
  'SABANA DE MENDOZA': 'TRUJILLO',
  BETIJOQUE: 'TRUJILLO',

  // ── Falcón ──
  CORO: 'FALCON',
  'SANTA ANA DE CORO': 'FALCON',
  'PUNTO FIJO': 'FALCON',
  'PUERTO CUMAREBO': 'FALCON',
  TUCACAS: 'FALCON',
  CHICHIRIVICHE: 'FALCON',
  DABAJURO: 'FALCON',
  CHURUGUARA: 'FALCON',

  // ── Portuguesa ──
  GUANARE: 'PORTUGUESA',
  ACARIGUA: 'PORTUGUESA',
  ARAURE: 'PORTUGUESA',
  'VILLA BRUZUAL': 'PORTUGUESA',
  BISCUCUY: 'PORTUGUESA',
  TUREN: 'PORTUGUESA',

  // ── Barinas ──
  BARINAS: 'BARINAS',
  'SANTA BARBARA DE BARINAS': 'BARINAS',
  SOCOPO: 'BARINAS',
  BARINITAS: 'BARINAS',

  // ── Guárico ──
  'SAN JUAN DE LOS MORROS': 'GUARICO',
  'VALLE DE LA PASCUA': 'GUARICO',
  CALABOZO: 'GUARICO',
  ZARAZA: 'GUARICO',
  'ALTAGRACIA DE ORITUCO': 'GUARICO',
  TUCUPIDO: 'GUARICO',

  // ── Cojedes ──
  'SAN CARLOS DE COJEDES': 'COJEDES',
  TINAQUILLO: 'COJEDES',
  'EL BAUL': 'COJEDES',

  // ── Yaracuy ──
  'SAN FELIPE': 'YARACUY',
  YARITAGUA: 'YARACUY',
  CHIVACOA: 'YARACUY',
  NIRGUA: 'YARACUY',

  // ── Apure ──
  'SAN FERNANDO DE APURE': 'APURE',
  GUASDUALITO: 'APURE',
  ACHAGUAS: 'APURE',
  BIRUACA: 'APURE',
  ELORZA: 'APURE',

  // ── Amazonas ──
  'PUERTO AYACUCHO': 'AMAZONAS',

  // ── Delta Amacuro ──
  TUCUPITA: 'DELTA AMACURO',
}
