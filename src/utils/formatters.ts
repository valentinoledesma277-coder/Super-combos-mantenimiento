/**
 * Formatea un número a moneda Pesos Argentinos (ARS)
 * Ejemplo: 1250.5 -> $ 1.250,50
 */
export function formatCurrency(amount: number): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

/**
 * Formatea un número simple con separador de miles
 */
export function formatNumber(value: number): string {
  const safe = isNaN(value) ? 0 : value;
  return new Intl.NumberFormat('es-AR').format(safe);
}

/**
 * Formatea fecha y hora en formato DD/MM/AAAA HH:mm
 */
export function formatDateTime(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
}

/**
 * Formatea fecha en formato DD/MM/AAAA
 */
export function formatDate(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
}

/**
 * Genera el siguiente número de ticket con formato TKT-000001 sin colisiones
 */
export function generateNextTicketNumber(existingSalesOrCount: number | { receiptNumber: string }[]): string {
  if (typeof existingSalesOrCount === 'number') {
    const nextNum = existingSalesOrCount + 1;
    return `TKT-${String(nextNum).padStart(6, '0')}`;
  }
  let maxNum = 0;
  for (const s of existingSalesOrCount) {
    const match = s.receiptNumber?.match(/(\d+)$/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }
  return `TKT-${String(maxNum + 1).padStart(6, '0')}`;
}

/**
 * Exporta un arreglo de datos a archivo CSV compatible con Excel (UTF-8 con BOM)
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const bom = '\uFEFF';
  const csvContent = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(';'),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '');
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(';')
    ),
  ].join('\r\n');

  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Descarga cualquier string como archivo JSON
 */
export function downloadJSON(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
