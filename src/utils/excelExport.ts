import * as XLSX from 'xlsx';
import { AppDatabaseState } from '../types';
import { formatDate, formatDateTime } from './formatters';

function computeColWidths(headers: string[], rows: (string | number)[][], extraPadding = 4): { wch: number }[] {
  return headers.map((header, colIdx) => {
    let maxLen = header.length;
    for (const row of rows) {
      const val = row[colIdx];
      const len = String(val ?? '').length;
      if (len > maxLen) maxLen = len;
    }
    return { wch: Math.min(Math.max(maxLen + extraPadding, 12), 55) };
  });
}

function triggerExcelDownload(workbook: XLSX.WorkBook, filename: string): void {
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exporta una tabla individual a un archivo Excel (.xlsx) real con ancho de columnas ajustado.
 */
export function downloadExcelSheet(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const wb = XLSX.utils.book_new();
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = computeColWidths(headers, rows);

  const safeSheetName = sheetName.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Datos';
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  triggerExcelDownload(wb, filename);
}

/**
 * Genera y descarga una Plantilla Excel (.xlsx) completa multi-hoja con toda la información
 * guardada en el dispositivo: Resumen, Ventas, Detalle de Artículos, Stock, Combos,
 * Ingresos/Egresos, Pedidos de Clientes y Proveedores/Clientes.
 */
export function exportFullExcelWorkbook(state: AppDatabaseState): void {
  const wb = XLSX.utils.book_new();
  const nowISO = new Date().toISOString();
  const dateTag = formatDate(nowISO).replace(/\//g, '-');

  const completedSales = (state.sales || []).filter((s) => s.status === 'completed');
  const totalSalesRevenue = completedSales.reduce((acc, s) => acc + s.total, 0);
  const totalIncomes = (state.incomes || []).reduce((acc, i) => acc + i.amount, 0);
  const totalExpenses = (state.expenses || []).reduce((acc, e) => acc + e.amount, 0);
  const inventoryCostTotal = (state.products || []).reduce((acc, p) => acc + p.costPrice * p.stock, 0);
  const inventorySaleTotal = (state.products || []).reduce((acc, p) => acc + p.salePrice * p.stock, 0);

  // =========================================================
  // HOJA 1: RESUMEN GENERAL
  // =========================================================
  const summaryRows: (string | number)[][] = [
    ['PLANTILLA DE GESTIÓN COMERCIAL - SUPER COMBOS', '', ''],
    ['Comercio', state.settings.storeName || 'Super Combos', ''],
    ['CUIT', state.settings.cuit || '-', ''],
    ['Dirección', state.settings.address || '-', ''],
    ['Teléfono', state.settings.phone || '-', ''],
    ['Fecha de Exportación', formatDateTime(nowISO), ''],
    ['', '', ''],
    ['INDICADOR DEL NEGOCIO', 'VALOR', 'UNIDAD / DETALLE'],
    ['Ventas Concretadas', completedSales.length, 'Tickets emitidos'],
    ['Ventas Anuladas', (state.sales || []).filter((s) => s.status === 'cancelled').length, 'Tickets anulados'],
    ['Total Facturado en Ventas', totalSalesRevenue, 'ARS'],
    ['Total Ingresos Registrados', totalIncomes, 'ARS'],
    ['Total Egresos / Compras Registradas', totalExpenses, 'ARS'],
    ['Resultado Neto (Ingresos - Egresos)', totalIncomes - totalExpenses, 'ARS'],
    ['Saldo Inicial de Caja Actual', state.currentCashDrawer?.initialBalance || 0, 'ARS'],
    ['Cantidad de Productos en Catálogo', (state.products || []).length, 'Productos distintos'],
    ['Unidades Totales en Stock', (state.products || []).reduce((a, p) => a + p.stock, 0), 'Unidades'],
    ['Valorización Stock (Costo)', inventoryCostTotal, 'ARS'],
    ['Valorización Stock (Precio Venta)', inventorySaleTotal, 'ARS'],
    ['Super Combos Configurados', (state.combos || []).length, 'Combos'],
    ['Pedidos de Clientes Registrados', (state.orders || []).length, 'Pedidos'],
    ['Clientes Registrados', (state.customers || []).length, 'Clientes'],
    ['Proveedores Registrados', (state.suppliers || []).length, 'Proveedores'],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 24 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen General');

  // =========================================================
  // HOJA 2: VENTAS
  // =========================================================
  const salesHeaders = [
    'N° Ticket',
    'Fecha y Hora',
    'Estado',
    'Medio de Pago',
    'Detalle de Venta',
    'Subtotal (ARS)',
    'Descuento (ARS)',
    'Total (ARS)',
    'Abonó Con (ARS)',
    'Vuelto (ARS)',
    'Cliente',
    'Observaciones',
  ];
  const salesRows: (string | number)[][] = (state.sales || []).map((s) => [
    s.receiptNumber,
    formatDateTime(s.date),
    s.status === 'completed' ? 'CONCRETADA' : 'ANULADA',
    s.paymentMethod.toUpperCase(),
    s.items
      .map((i) => {
        const isPriceOnly = i.code === 'PRECIO' || i.code === 'RAPIDO';
        if (isPriceOnly) return `${i.quantity > 1 ? `${i.quantity}x ` : ''}$${i.unitPrice}`;
        return `${i.quantity}x ${i.name} ($${i.unitPrice})`;
      })
      .join(' | '),
    s.subtotal,
    s.discount,
    s.total,
    s.amountTendered ?? '',
    s.changeGiven ?? '',
    s.customerName && s.customerName !== 'Consumidor Final' ? s.customerName : '',
    s.notes || '',
  ]);
  if (salesRows.length > 0) {
    salesRows.push([
      'TOTAL CONCRETADAS',
      '',
      `${completedSales.length} tickets`,
      '',
      '',
      completedSales.reduce((a, s) => a + s.subtotal, 0),
      completedSales.reduce((a, s) => a + s.discount, 0),
      totalSalesRevenue,
      '',
      '',
      '',
      '',
    ]);
  }
  const wsSales = XLSX.utils.aoa_to_sheet([salesHeaders, ...salesRows]);
  wsSales['!cols'] = computeColWidths(salesHeaders, salesRows);
  XLSX.utils.book_append_sheet(wb, wsSales, 'Ventas');

  // =========================================================
  // HOJA 3: DETALLE POR ARTÍCULO VENDIDO
  // =========================================================
  const itemHeaders = [
    'N° Ticket',
    'Fecha y Hora',
    'Estado Ticket',
    'Código',
    'Producto / Concepto',
    'Tipo',
    'Cantidad',
    'Precio Unit. (ARS)',
    'Costo Unit. (ARS)',
    'Subtotal (ARS)',
    'Ganancia Est. (ARS)',
  ];
  const itemRows: (string | number)[][] = [];
  for (const s of state.sales || []) {
    for (const item of s.items) {
      const estProfit = (item.unitPrice - (item.costPrice || 0)) * item.quantity;
      itemRows.push([
        s.receiptNumber,
        formatDateTime(s.date),
        s.status === 'completed' ? 'CONCRETADA' : 'ANULADA',
        item.code || '-',
        item.name,
        item.isCombo ? 'COMBO' : item.code === 'PRECIO' || item.code === 'RAPIDO' ? 'PRECIO CAJA' : 'PRODUCTO',
        item.quantity,
        item.unitPrice,
        item.costPrice || 0,
        item.subtotal,
        item.costPrice ? estProfit : 0,
      ]);
    }
  }
  const wsItems = XLSX.utils.aoa_to_sheet([itemHeaders, ...itemRows]);
  wsItems['!cols'] = computeColWidths(itemHeaders, itemRows);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Detalle Artículos');

  // =========================================================
  // HOJA 4: STOCK E INVENTARIO
  // =========================================================
  const stockHeaders = [
    'Código',
    'Producto',
    'Categoría',
    'Stock Actual',
    'Stock Mínimo',
    'Estado Stock',
    'Precio Costo (ARS)',
    'Precio Venta (ARS)',
    'Margen (%)',
    'Valor Total Costo (ARS)',
    'Valor Total Venta (ARS)',
    'Proveedor',
    'Fecha Registro',
  ];
  const stockRows: (string | number)[][] = (state.products || []).map((p) => {
    const margin = p.salePrice > 0 ? Number((((p.salePrice - p.costPrice) / p.salePrice) * 100).toFixed(1)) : 0;
    const stockState = p.stock <= 0 ? 'SIN STOCK' : p.stock <= p.minStock ? 'STOCK BAJO' : 'OK';
    return [
      p.code,
      p.name,
      p.category,
      p.stock,
      p.minStock,
      stockState,
      p.costPrice,
      p.salePrice,
      margin,
      p.costPrice * p.stock,
      p.salePrice * p.stock,
      p.supplier || '',
      formatDate(p.createdAt),
    ];
  });
  const wsStock = XLSX.utils.aoa_to_sheet([stockHeaders, ...stockRows]);
  wsStock['!cols'] = computeColWidths(stockHeaders, stockRows);
  XLSX.utils.book_append_sheet(wb, wsStock, 'Stock e Inventario');

  // =========================================================
  // HOJA 5: SUPER COMBOS
  // =========================================================
  const comboHeaders = [
    'Código',
    'Nombre del Combo',
    'Productos Incluidos',
    'Costo Total (ARS)',
    'Precio Venta (ARS)',
    'Ganancia Est. (ARS)',
    'Descripción',
  ];
  const comboRows: (string | number)[][] = (state.combos || []).map((c) => {
    const cost = c.items.reduce((sum, ci) => {
      const prod = (state.products || []).find((p) => p.id === ci.productId);
      return sum + (prod ? prod.costPrice * ci.quantity : 0);
    }, 0);
    const itemsList = c.items.map((ci) => `${ci.quantity}x ${ci.productName}`).join(' + ');
    return [
      c.code,
      c.name,
      itemsList,
      cost,
      c.salePrice,
      c.salePrice - cost,
      c.description || '',
    ];
  });
  const wsCombos = XLSX.utils.aoa_to_sheet([comboHeaders, ...comboRows]);
  wsCombos['!cols'] = computeColWidths(comboHeaders, comboRows);
  XLSX.utils.book_append_sheet(wb, wsCombos, 'Super Combos');

  // =========================================================
  // HOJA 6: INGRESOS Y EGRESOS
  // =========================================================
  const financeHeaders = [
    'Tipo',
    'Fecha y Hora',
    'Categoría',
    'Descripción',
    'Medio de Pago',
    'Importe (ARS)',
    'Proveedor / Referencia',
    'Observaciones',
  ];
  const unifiedFinances = [
    ...(state.incomes || []).map((i) => ({
      sortTime: new Date(i.date).getTime(),
      row: [
        'INGRESO',
        formatDateTime(i.date),
        i.category,
        i.description,
        i.paymentMethod.toUpperCase(),
        i.amount,
        i.saleId || '',
        i.notes || '',
      ] as (string | number)[],
    })),
    ...(state.expenses || []).map((e) => ({
      sortTime: new Date(e.date).getTime(),
      row: [
        'EGRESO',
        formatDateTime(e.date),
        e.category,
        e.description,
        e.paymentMethod.toUpperCase(),
        -e.amount,
        e.supplier || '',
        e.notes || '',
      ] as (string | number)[],
    })),
  ]
    .sort((a, b) => b.sortTime - a.sortTime)
    .map((x) => x.row);

  const wsFinances = XLSX.utils.aoa_to_sheet([financeHeaders, ...unifiedFinances]);
  wsFinances['!cols'] = computeColWidths(financeHeaders, unifiedFinances);
  XLSX.utils.book_append_sheet(wb, wsFinances, 'Ingresos y Egresos');

  // =========================================================
  // HOJA 7: PEDIDOS DE CLIENTES
  // =========================================================
  const orderHeaders = [
    'N° Pedido',
    'Fecha Registro',
    'Fecha Entrega',
    'Horario',
    'Cliente',
    'Teléfono',
    'Estado Pedido',
    'Estado Pago',
    'Total (ARS)',
    'Seña / Pagado (ARS)',
    'Saldo Pendiente (ARS)',
    'Lo Que Lleva',
    'Notas',
  ];
  const orderRows: (string | number)[][] = (state.orders || []).map((o) => [
    o.orderNumber,
    formatDateTime(o.orderDate),
    o.deliveryDate,
    o.deliveryTimeSlot || '',
    o.customerName,
    o.customerPhone || '',
    o.status.toUpperCase(),
    o.paymentStatus.toUpperCase(),
    o.total,
    o.paidAmount,
    Math.max(0, o.total - o.paidAmount),
    o.itemsDescription || o.items.map((i) => `${i.quantity}x ${i.name}`).join(' | '),
    o.notes || '',
  ]);
  const wsOrders = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows]);
  wsOrders['!cols'] = computeColWidths(orderHeaders, orderRows);
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Pedidos Clientes');

  // =========================================================
  // HOJA 8: PROVEEDORES Y CLIENTES
  // =========================================================
  const directoryHeaders = [
    'Tipo Registro',
    'Nombre / Razón Social',
    'Contacto / Referencia',
    'Teléfono',
    'Categoría / Compras',
    'Días Entrega / Total Gastado (ARS)',
    'Dirección',
    'Observaciones',
  ];
  const directoryRows: (string | number)[][] = [
    ...(state.suppliers || []).map((sup) => [
      'PROVEEDOR',
      sup.name,
      sup.contactName || '',
      sup.phone,
      sup.category,
      sup.deliveryDays || '-',
      sup.address || '',
      sup.notes || '',
    ]),
    ...(state.customers || []).map((cust) => [
      'CLIENTE',
      cust.name,
      formatDate(cust.createdAt),
      cust.phone,
      `${cust.purchaseCount} compras`,
      cust.totalSpent,
      cust.address || '',
      cust.notes || '',
    ]),
  ];
  const wsDirectory = XLSX.utils.aoa_to_sheet([directoryHeaders, ...directoryRows]);
  wsDirectory['!cols'] = computeColWidths(directoryHeaders, directoryRows);
  XLSX.utils.book_append_sheet(wb, wsDirectory, 'Proveedores y Clientes');

  triggerExcelDownload(wb, `SuperCombos_Plantilla_Excel_${dateTag}.xlsx`);
}
