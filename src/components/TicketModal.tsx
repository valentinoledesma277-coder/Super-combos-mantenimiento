import React, { useEffect } from 'react';
import { Sale } from '../types';
import { useSupermarket } from '../context/SupermarketContext';
import { usePrinter } from '../context/PrinterContext';
import { PrintableReceipt } from './PrintableReceipt';
import { Printer, CheckCircle2, X, ShoppingCart } from 'lucide-react';

interface TicketModalProps {
  sale: Sale | null;
  onClose: () => void;
  onNewSale?: () => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({ sale, onClose, onNewSale }) => {
  const { state } = useSupermarket();
  const { printSaleTicket } = usePrinter();

  useEffect(() => {
    if (!sale) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [sale, onClose]);

  if (!sale) return null;

  const handlePrint = () => {
    void printSaleTicket(sale);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm overflow-y-auto no-print">
      <div className="w-full max-w-md rounded-2xl bg-zinc-950 shadow-2xl border border-zinc-800 overflow-hidden my-6 text-zinc-100">
        {/* Header con botón cerrar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-lime-400 stroke-[2.5]" />
            <span className="font-black text-sm text-white">Ticket de Compra Generado</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vista previa del Comprobante / Ticket Térmico */}
        <div className="p-5 bg-black flex flex-col items-center gap-3">
          <PrintableReceipt sale={sale} settings={state.settings} id="ticket-modal-preview" />
          <p className="text-[11px] text-zinc-400 text-center font-mono">
            Toca <strong className="text-lime-400">Imprimir Ticket</strong> para enviarlo a la impresora conectada en el dispositivo
          </p>
        </div>

        {/* Acciones del Modal */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-lime-400 hover:bg-lime-300 text-black rounded-xl text-xs font-black shadow-lg shadow-lime-400/20 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 stroke-[2.5]" />
            <span>Imprimir Ticket</span>
          </button>

          <div className="flex items-center gap-2">
            {onNewSale && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewSale();
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-lime-400/40 text-lime-400 rounded-xl text-xs font-black transition-colors cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
                <span>Nueva Venta</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
