/**
 * KRAFT HEINZ VENEZUELA — PROGRAMA DE ESTANDARIZACIÓN DTT
 * @module security/memory-sanitizer
 * @author Ing. José Daniel Vergara <Chief Systems Architect>
 * @copyright 2026 Kraft Heinz / Ing. José Daniel Vergara. All Rights Reserved.
 *
 * PROPRIETARY SANITIZATION SPECIFICATION:
 * Mitigación activa de vulnerabilidades de inyección de fórmulas en Microsoft Excel
 * (CWE-1236: Improper Neutralization of Formula Elements in CSV File).
 */

export class MemorySanitizer {
  private static readonly INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

  /**
   * Sanitiza cualquier cadena de texto destinada a ser exportada a CSV o Excel.
   * Si detecta un prefijo ejecutable o fórmula de Excel, antepone una comilla simple segura.
   */
  public static sanitizeExportCell(value: unknown): string {
    if (value === null || value === undefined) return '';

    const stringValue = String(value).trim();
    if (stringValue.length === 0) return '';

    const firstChar = stringValue.charAt(0);
    if (this.INJECTION_PREFIXES.includes(firstChar)) {
      // Neutraliza la ejecución de fórmulas en Microsoft Excel
      return `'${stringValue}`;
    }

    return stringValue;
  }

  /** Sanitiza un registro completo de salida antes del volcado a Parquet/CSV */
  public static sanitizeRowRecord<T extends Record<string, unknown>>(record: T): T {
    const cleanRecord: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) {
      cleanRecord[key] = typeof val === 'string' ? this.sanitizeExportCell(val) : val;
    }
    return cleanRecord as T;
  }
}
