/**
 * KRAFT HEINZ VENEZUELA — PROGRAMA DE ESTANDARIZACIÓN DTT
 * @module security/cryptographic-vault
 * @author Ing. José Daniel Vergara <Chief Systems Architect>
 * @copyright 2026 Kraft Heinz / Ing. José Daniel Vergara. All Rights Reserved.
 *
 * PROPRIETARY CRYPTOGRAPHIC SPECIFICATION:
 * Generador de hashes SHA-256 inmutables por fila para trazabilidad forense
 * y prevención de manipulación de bonos de Trade Marketing.
 */

export class CryptographicProvenanceVault {
  /**
   * Calcula el hash SHA-256 determinístico de un registro transaccional.
   * Utiliza la API nativa Crypto de Web Crypto para rendimiento criptográfico acelerado por hardware.
   */
  public static async computeRowHash(
    rif: string | null,
    distribuidor: string,
    fecha: string | null,
    kilos: number,
    montoUSD: number,
    segmentoOriginal: string,
  ): Promise<string> {
    const rawPayload = `${rif ?? 'NO_RIF'}|${distribuidor}|${fecha ?? 'NO_DATE'}|${kilos}|${montoUSD}|${segmentoOriginal}`;
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(rawPayload);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback de hash rápido si Web Crypto no estuviese presente en el entorno
    let hash = 0;
    for (let i = 0; i < rawPayload.length; i++) {
      hash = (hash << 5) - hash + rawPayload.charCodeAt(i);
      hash |= 0;
    }
    return `FALLBACK_HASH_${Math.abs(hash).toString(16)}`;
  }
}
