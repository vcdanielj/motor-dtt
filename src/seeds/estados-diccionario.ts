import type { EstadoDiccionarioEntry } from '@/contracts/config'

const E = (variante: string, estadoStd: string): EstadoDiccionarioEntry => ({
  variante,
  estadoStd,
  activa: true,
})

// Raw→canonical state variants. The 24 estados of src/seeds/estados.ts stay authoritative: every
// `estadoStd` below MUST be one of them (enforced by test/seeds.test.ts), so an official rename
// like Vargas→La Guaira is modelled as a VARIANTE of VARGAS, never as a 25th estado.
//
// The generic prefix/suffix noise ("EDO. ZULIA", "ESTADO DE MIRANDA", "13 ZULIA") is handled by
// cleanEstadoString and is deliberately NOT enumerated here — this file only carries mappings
// the cleaner cannot derive: abbreviations, renames, metonymy and habitual misspellings.
export const ESTADO_DICCIONARIO: EstadoDiccionarioEntry[] = [
  // ── DISTRITO CAPITAL ──
  E('DISTRITO FEDERAL', 'DISTRITO CAPITAL'),
  E('DTTO CAPITAL', 'DISTRITO CAPITAL'),
  E('DTO CAPITAL', 'DISTRITO CAPITAL'),
  E('DTTO FEDERAL', 'DISTRITO CAPITAL'),
  E('DTO FEDERAL', 'DISTRITO CAPITAL'),
  E('DIST CAPITAL', 'DISTRITO CAPITAL'),
  E('DIST. CAPITAL', 'DISTRITO CAPITAL'),
  E('DC', 'DISTRITO CAPITAL'),
  E('D.C.', 'DISTRITO CAPITAL'),
  E('CAPITAL', 'DISTRITO CAPITAL'),
  E('CARACAS', 'DISTRITO CAPITAL'),
  E('GRAN CARACAS', 'DISTRITO CAPITAL'),
  E('AREA METROPOLITANA', 'DISTRITO CAPITAL'),
  E('AREA METROPOLITANA DE CARACAS', 'DISTRITO CAPITAL'),
  E('CCS', 'DISTRITO CAPITAL'),

  // ── VARGAS (official rename to La Guaira in 2019; catalog keeps VARGAS) ──
  E('LA GUAIRA', 'VARGAS'),
  E('EDO LA GUAIRA', 'VARGAS'),
  E('ESTADO LA GUAIRA', 'VARGAS'),
  E('GUAIRA', 'VARGAS'),
  E('VARGAS LA GUAIRA', 'VARGAS'),
  E('LITORAL', 'VARGAS'),
  E('LITORAL CENTRAL', 'VARGAS'),
  E('MAIQUETIA', 'VARGAS'),
  E('CATIA LA MAR', 'VARGAS'),

  // ── ANZOATEGUI ──
  E('ANZ', 'ANZOATEGUI'),
  E('ANZOA', 'ANZOATEGUI'),
  E('ANZOAT', 'ANZOATEGUI'),
  E('ANSOATEGUI', 'ANZOATEGUI'),
  E('ANZOATEQUI', 'ANZOATEGUI'),
  E('ANZOTEGUI', 'ANZOATEGUI'),
  E('ANZOATEGU', 'ANZOATEGUI'),

  // ── NUEVA ESPARTA ──
  E('NVA ESPARTA', 'NUEVA ESPARTA'),
  E('NVA. ESPARTA', 'NUEVA ESPARTA'),
  E('N ESPARTA', 'NUEVA ESPARTA'),
  E('NUEVA. ESPARTA', 'NUEVA ESPARTA'),
  E('NUEVAESPARTA', 'NUEVA ESPARTA'),
  E('MARGARITA', 'NUEVA ESPARTA'),
  E('ISLA DE MARGARITA', 'NUEVA ESPARTA'),
  E('PORLAMAR', 'NUEVA ESPARTA'),

  // ── DELTA AMACURO ──
  E('DELTA', 'DELTA AMACURO'),
  E('DELTAAMACURO', 'DELTA AMACURO'),
  E('DELTA AMACUR', 'DELTA AMACURO'),
  E('DELTA AMAKURO', 'DELTA AMACURO'),
  E('TUCUPITA', 'DELTA AMACURO'),

  // ── ZULIA ──
  E('ZUL', 'ZULIA'),
  E('ZULIANO', 'ZULIA'),
  E('SULIA', 'ZULIA'),
  E('MARACAIBO', 'ZULIA'),
  E('COL', 'ZULIA'),
  E('COSTA ORIENTAL DEL LAGO', 'ZULIA'),

  // ── CARABOBO ──
  E('CARABOB', 'CARABOBO'),
  E('CARBOBO', 'CARABOBO'),
  E('CARABOBO VALENCIA', 'CARABOBO'),
  E('VALENCIA', 'CARABOBO'),
  E('PTO CABELLO', 'CARABOBO'),
  E('PUERTO CABELLO', 'CARABOBO'),

  // ── MIRANDA ──
  E('MIR', 'MIRANDA'),
  E('MIRAND', 'MIRANDA'),
  E('MIRANDA ALTOS MIRANDINOS', 'MIRANDA'),
  E('ALTOS MIRANDINOS', 'MIRANDA'),
  E('VALLES DEL TUY', 'MIRANDA'),
  E('BARLOVENTO', 'MIRANDA'),
  E('GUARENAS GUATIRE', 'MIRANDA'),
  E('LOS TEQUES', 'MIRANDA'),
  E('CHARALLAVE', 'MIRANDA'),

  // ── LARA ──
  E('LARA BARQUISIMETO', 'LARA'),
  E('BARQUISIMETO', 'LARA'),
  E('BQTO', 'LARA'),

  // ── ARAGUA ──
  E('ARAG', 'ARAGUA'),
  E('ARAGUA MARACAY', 'ARAGUA'),
  E('MARACAY', 'ARAGUA'),

  // ── BOLIVAR ──
  E('BOL', 'BOLIVAR'),
  E('BOLIVA', 'BOLIVAR'),
  E('BOLIVAR CIUDAD GUAYANA', 'BOLIVAR'),
  E('GUAYANA', 'BOLIVAR'),
  E('CIUDAD GUAYANA', 'BOLIVAR'),
  E('PTO ORDAZ', 'BOLIVAR'),
  E('PUERTO ORDAZ', 'BOLIVAR'),
  E('CIUDAD BOLIVAR', 'BOLIVAR'),

  // ── TACHIRA ──
  E('TACH', 'TACHIRA'),
  E('TACHIR', 'TACHIRA'),
  E('TASCHIRA', 'TACHIRA'),
  E('SAN CRISTOBAL', 'TACHIRA'),

  // ── MERIDA ──
  E('MER', 'MERIDA'),
  E('MERID', 'MERIDA'),
  E('EL VIGIA', 'MERIDA'),

  // ── TRUJILLO ──
  E('TRUJ', 'TRUJILLO'),
  E('TRUJILL', 'TRUJILLO'),
  E('VALERA', 'TRUJILLO'),

  // ── FALCON ──
  E('FALC', 'FALCON'),
  E('FALCO', 'FALCON'),
  E('PUNTO FIJO', 'FALCON'),
  E('CORO', 'FALCON'),
  E('PARAGUANA', 'FALCON'),

  // ── PORTUGUESA ──
  E('PORT', 'PORTUGUESA'),
  E('PORTUG', 'PORTUGUESA'),
  E('PORTUGESA', 'PORTUGUESA'),
  E('ACARIGUA', 'PORTUGUESA'),
  E('ACARIGUA ARAURE', 'PORTUGUESA'),

  // ── GUARICO ──
  E('GUAR', 'GUARICO'),
  E('GUARIC', 'GUARICO'),
  E('SAN JUAN DE LOS MORROS', 'GUARICO'),
  E('VALLE DE LA PASCUA', 'GUARICO'),

  // ── MONAGAS ──
  E('MON', 'MONAGAS'),
  E('MONAG', 'MONAGAS'),
  E('MATURIN', 'MONAGAS'),

  // ── SUCRE ──
  E('SUC', 'SUCRE'),
  E('CUMANA', 'SUCRE'),
  E('CARUPANO', 'SUCRE'),

  // ── BARINAS ── ('BAR' is deliberately absent: too close to BARCELONA/Anzoátegui)
  E('BARIN', 'BARINAS'),
  E('BARINES', 'BARINAS'),

  // ── APURE ──
  E('APU', 'APURE'),
  E('SAN FERNANDO DE APURE', 'APURE'),

  // ── COJEDES ── (SAN CARLOS is deliberately absent: it also names a Zulia town)
  E('COJ', 'COJEDES'),
  E('COJEDE', 'COJEDES'),

  // ── YARACUY ──
  E('YAR', 'YARACUY'),
  E('YARACU', 'YARACUY'),
  E('YARACUI', 'YARACUY'),
  E('SAN FELIPE', 'YARACUY'),

  // ── AMAZONAS ──
  E('AMA', 'AMAZONAS'),
  E('AMAZONA', 'AMAZONAS'),
  E('PUERTO AYACUCHO', 'AMAZONAS'),
]

// Deliberately NOT mapped, because guessing wrong is worse than SIN_ESTADO: multi-state commercial
// regions ('ORIENTE', 'OCCIDENTE', 'CENTRO OCCIDENTAL') and municipio names that repeat across
// estados ('LIBERTADOR', 'SAN CARLOS', 'BOLIVAR'). Those reach the cola so an analyst decides.
