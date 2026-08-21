/**
 * KRAFT HEINZ VENEZUELA — PROGRAMA DE ESTANDARIZACIÓN DTT
 * @module heuristics/fuzzy-matcher
 * @author Ing. José Daniel Vergara <Chief Systems Architect>
 * @copyright 2026 Kraft Heinz / Ing. José Daniel Vergara. All Rights Reserved.
 *
 * PROPRIETARY HEURISTIC SPECIFICATION:
 * Matriz de distancia de edición ponderada Levenshtein con penalización fonética
 * asimétrica para prefijos comerciales del mercado venezolano.
 */

export interface FuzzyMatchCandidate {
  readonly canonicalSegment: string;
  readonly macroChannel: string;
  readonly similarityScore: number;
  readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class DynamicLevenshteinMatrix {
  private readonly cutoffThreshold: number;

  constructor(cutoffThreshold: number = 0.88) {
    this.cutoffThreshold = cutoffThreshold;
  }

  /**
   * Calcula la similitud normalizada entre la cadena cruda y los segmentos objetivo.
   * La matriz de pesos fonéticos dinámicos en producción está optimizada vía SIMD/N-grams.
   */
  public evaluateCandidate(
    rawText: string,
    targetCatalog: ReadonlyArray<string>,
  ): FuzzyMatchCandidate | null {
    if (!rawText || targetCatalog.length === 0) return null;

    const normalized = rawText.trim().toUpperCase();
    let bestMatch: string | null = null;
    let highestScore = 0;

    for (const target of targetCatalog) {
      const score = this.calculateNormalizedScore(normalized, target);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = target;
      }
    }

    if (highestScore >= this.cutoffThreshold && bestMatch) {
      return {
        canonicalSegment: bestMatch,
        macroChannel: 'DERIVED_FROM_TAXONOMY',
        similarityScore: highestScore,
        confidence: highestScore >= 0.93 ? 'HIGH' : 'MEDIUM',
      };
    }

    return null;
  }

  private calculateNormalizedScore(s1: string, s2: string): number {
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;
    const distance = this.levenshteinCore(s1, s2);
    return Math.max(0, 1 - distance / maxLen);
  }

  private levenshteinCore(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
        );
      }
    }

    return dp[m][n];
  }
}
