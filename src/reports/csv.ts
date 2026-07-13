// Pure CSV serialization (RFC 4180-style quoting). No DOM, no worker APIs — safe to
// import from either side (worker export pass, or a future report elsewhere).

/** Quote a single CSV field when it contains a comma, double quote, or a line break
 *  (CR or LF), doubling any internal quotes. Plain values pass through unquoted. */
export function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Join a row of field values into one CSV line (no trailing newline). */
export function csvLine(cells: string[]): string {
  return cells.map(csvCell).join(',')
}
