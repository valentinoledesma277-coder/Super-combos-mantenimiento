import React from 'react';
import { Sale, StoreSettings } from '../types';
import { formatCurrency, formatDateTime } from '../utils/formatters';

interface PrintableReceiptProps {
  sale: Sale;
  settings: StoreSettings;
  id?: string;
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  sale,
  settings,
  id = 'printable-ticket',
}) => {
  const is58mm = settings.printerPaperWidth === 58;

  return (
    <div
      id={id}
      className={`w-full ${
        is58mm ? 'max-w-[240px]' : 'max-w-[340px]'
      } bg-white p-5 border border-dashed border-zinc-400 rounded-lg shadow-xl text-zinc-900 text-xs font-mono select-text`}
    >
      {/* Encabezado Comercio */}
      <div className="text-center pb-3 border-b border-dashed border-zinc-300">
        <h2 className="text-base font-black tracking-tight text-black uppercase">
          {settings.storeName || 'Super Combos'}
        </h2>
        {settings.cuit && <p className="text-[11px] text-zinc-600 mt-0.5">CUIT: {settings.cuit}</p>}
        {settings.address && <p className="text-[11px] text-zinc-600">{settings.address}</p>}
        {settings.phone && <p className="text-[11px] text-zinc-600">Tel: {settings.phone}</p>}
        <div className="mt-2 text-[10px] uppercase font-sans font-black bg-zinc-100 py-0.5 px-2 rounded-sm inline-block text-black">
          Ticket de Compra
        </div>
      </div>

      {/* Datos de la Venta */}
      <div className="py-2.5 border-b border-dashed border-zinc-300 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-zinc-500">N° Ticket:</span>
          <span className="font-bold text-black">{sale.receiptNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Fecha/Hora:</span>
          <span>{formatDateTime(sale.date)}</span>
        </div>
        {sale.customerName && sale.customerName !== 'Consumidor Final' && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Cliente:</span>
            <span className="font-semibold text-black truncate max-w-[170px]">
              {sale.customerName}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-zinc-500">Forma de Pago:</span>
          <span className="uppercase font-bold text-black">{sale.paymentMethod}</span>
        </div>
      </div>

      {/* Detalle de Artículos / Importes */}
      <div className="py-2.5 border-b border-dashed border-zinc-300">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-200">
              <th className="text-left font-bold pb-1">Detalle</th>
              <th className="text-right font-bold pb-1">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sale.items.map((item, idx) => (
              <tr key={idx} className="py-1">
                <td className="py-1 pr-2 align-top">
                  <div className="font-bold text-black leading-tight">{item.name}</div>
                  <div className="text-[10px] text-zinc-500">
                    {item.code && item.code !== 'PRECIO' && item.code !== 'RAPIDO'
                      ? `[${item.code}] `
                      : ''}
                    {item.quantity > 1
                      ? `${item.quantity} x ${formatCurrency(item.unitPrice)}`
                      : formatCurrency(item.unitPrice)}
                  </div>
                </td>
                <td className="py-1 text-right align-top font-bold text-black">
                  {formatCurrency(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Notas u observaciones de la compra */}
        {sale.notes && (
          <div className="mt-2 pt-1.5 border-t border-dashed border-zinc-200 text-[10px] text-zinc-700">
            <span className="font-bold text-black">Obs.:</span> {sale.notes}
          </div>
        )}
      </div>

      {/* Totales */}
      <div className="py-2.5 border-b border-dashed border-zinc-300 space-y-1 text-[11px]">
        <div className="flex justify-between text-zinc-600">
          <span>Subtotal:</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between text-emerald-700 font-bold">
            <span>Descuento aplicado:</span>
            <span>- {formatCurrency(sale.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-black text-black pt-1 border-t border-zinc-300">
          <span>TOTAL:</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>
        {sale.paymentMethod === 'efectivo' && sale.amountTendered && sale.amountTendered > 0 && (
          <>
            <div className="flex justify-between text-zinc-500 pt-1">
              <span>Abonó con:</span>
              <span>{formatCurrency(sale.amountTendered)}</span>
            </div>
            <div className="flex justify-between text-black font-bold">
              <span>Su Vuelto:</span>
              <span>{formatCurrency(sale.changeGiven || 0)}</span>
            </div>
          </>
        )}
      </div>

      {/* Pie del ticket */}
      <div className="pt-3 text-center text-[10px] text-zinc-600 space-y-1">
        <p className="font-bold text-black">
          {settings.ticketFooter || '¡Gracias por su compra!'}
        </p>
        <p>*** Super Combos ***</p>
      </div>
    </div>
  );
};
