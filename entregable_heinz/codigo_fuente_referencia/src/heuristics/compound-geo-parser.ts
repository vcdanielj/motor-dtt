/**
 * KRAFT HEINZ VENEZUELA — PROGRAMA DE ESTANDARIZACIÓN DTT
 * @module heuristics/compound-geo-parser
 * @author Ing. José Daniel Vergara <Chief Systems Architect>
 * @copyright 2026 Kraft Heinz / Ing. José Daniel Vergara. All Rights Reserved.
 *
 * PROPRIETARY GEOSPATIAL HEURISTIC SPECIFICATION:
 * Parser de frases compuestas toponímicas venezolanas con árbol de precedencia
 * para evitar colisiones toponímicas (e.g. Aragua de Barcelona -> Anzoátegui).
 */

export interface GeoDisambiguationResult {
  readonly estadoStd: string;
  readonly matchedPhrase: string;
  readonly confidence: 'HIGH' | 'MEDIUM';
}

export interface CompoundGeoRule {
  readonly phrase: string;
  readonly estadoStd: string;
  readonly confidence: 'HIGH' | 'MEDIUM';
}

export class CompoundGeoParserEngine {
  private readonly rulesTrie: ReadonlyArray<CompoundGeoRule>;

  constructor(customRules?: ReadonlyArray<CompoundGeoRule>) {
    // Reglas de referencia estructuradas por especificidad descendente
    this.rulesTrie = customRules ?? [
      { phrase: 'ARAGUA DE BARCELONA', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
      { phrase: 'PUERTO LA CRUZ', estadoStd: 'ANZOATEGUI', confidence: 'HIGH' },
      { phrase: 'AV FUERZAS ARMADAS', estadoStd: 'DISTRITO CAPITAL', confidence: 'HIGH' },
      { phrase: 'PUERTO CABELLO', estadoStd: 'CARABOBO', confidence: 'HIGH' },
      { phrase: 'CABUDARE', estadoStd: 'LARA', confidence: 'HIGH' },
      { phrase: 'EL VIGIA', estadoStd: 'MERIDA', confidence: 'HIGH' },
    ];
  }

  /** Parsea un texto libre de ciudad o dirección y resuelve el Estado venezolano canónico */
  public parseLocationString(rawText: string | null): GeoDisambiguationResult | null {
    if (!rawText) return null;

    const normalized = rawText
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    for (const rule of this.rulesTrie) {
      if (normalized.includes(rule.phrase)) {
        return {
          estadoStd: rule.estadoStd,
          matchedPhrase: rule.phrase,
          confidence: rule.confidence,
        };
      }
    }

    return null;
  }
}
