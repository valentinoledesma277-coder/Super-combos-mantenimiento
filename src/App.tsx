/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SupermarketProvider, useSupermarket } from './context/SupermarketContext';
import { PrinterProvider, usePrinter } from './context/PrinterContext';
import { ActiveTab, Sale, Customer, Combo } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TicketModal } from './components/TicketModal';
import { PrintableReceipt } from './components/PrintableReceipt';
import { DashboardView } from './views/DashboardView';
import { PosView } from './views/PosView';
import { InventoryView } from './views/InventoryView';
import { CombosView } from './views/CombosView';
import { CustomersView } from './views/CustomersView';
import { SuppliersView } from './views/SuppliersView';
import { ClientOrdersView } from './views/ClientOrdersView';
import { FinancesView } from './views/FinancesView';
import { CashControlView } from './views/CashControlView';
import { BackupSettingsView } from './views/BackupSettingsView';
import { Layers } from 'lucide-react';

const SupermarketApp: React.FC = () => {
  const { isLoading, state } = useSupermarket();
  const { systemPrintSale } = usePrinter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [ticketToView, setTicketToView] = useState<Sale | null>(null);

  // Atajos de teclado para supermercado rápido: F2 para POS, F1 para Dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('pos');
      } else if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Iniciar venta desde la vista de clientes
  const handleStartSaleForCustomer = (_customer: Customer) => {
    setActiveTab('pos');
  };

  // Iniciar venta de un combo desde la vista de combos
  const handleStartSaleWithCombo = (_combo: Combo) => {
    setActiveTab('pos');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-lime-400 flex items-center justify-center shadow-2xl shadow-lime-400/20 text-black">
            <Layers className="w-8 h-8 stroke-[2.5]" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-lime-500"></span>
          </span>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black tracking-tight text-white">Super Combos</h2>
          <p className="text-xs text-lime-400/80 mt-1 font-mono">
            Base de datos offline lista • 100% Sin Conexión
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#050505] flex flex-col text-zinc-100 font-sans selection:bg-lime-400 selection:text-black no-print">
        {/* Encabezado Superior */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Contenedor Principal con Menú Lateral */}
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            mobileOpen={mobileMenuOpen}
            setMobileOpen={setMobileMenuOpen}
          />

          {/* Área de Contenido de la Vista Activa */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            {activeTab === 'dashboard' && (
              <DashboardView
                setActiveTab={setActiveTab}
                onOpenTicket={(sale) => setTicketToView(sale)}
              />
            )}

            {activeTab === 'pos' && (
              <PosView onOpenTicket={(sale) => setTicketToView(sale)} />
            )}

            {activeTab === 'inventory' && <InventoryView />}

            {activeTab === 'combos' && (
              <CombosView onStartSaleWithCombo={handleStartSaleWithCombo} />
            )}

            {activeTab === 'orders' && (
              <ClientOrdersView onOpenTicket={(sale) => setTicketToView(sale)} />
            )}

            {activeTab === 'suppliers' && (
              <SuppliersView
                onOpenStockEntryForSupplier={(_supplierName) => {
                  setActiveTab('inventory');
                }}
              />
            )}

            {activeTab === 'finances' && <FinancesView />}

            {activeTab === 'cash' && <CashControlView />}

            {activeTab === 'customers' && (
              <CustomersView
                onStartSaleForCustomer={handleStartSaleForCustomer}
                onOpenTicket={(sale) => setTicketToView(sale)}
              />
            )}

            {activeTab === 'backups' && <BackupSettingsView />}
          </main>
        </div>

      </div>

      {/* Modal de Comprobante / Ticket Térmico Imprimible */}
      <TicketModal
        sale={ticketToView}
        onClose={() => setTicketToView(null)}
        onNewSale={() => {
          setTicketToView(null);
          setActiveTab('pos');
        }}
      />

      {/* Portal oculto en pantalla para impresión limpia en cualquier impresora conectada al dispositivo */}
      {(systemPrintSale || ticketToView) && (
        <div id="direct-print-portal" className="hidden print:block">
          <PrintableReceipt
            sale={(systemPrintSale || ticketToView)!}
            settings={state.settings}
            id="printable-ticket"
          />
        </div>
      )}
    </>
  );
};

export default function App() {
  return (
    <SupermarketProvider>
      <PrinterProvider>
        <SupermarketApp />
      </PrinterProvider>
    </SupermarketProvider>
  );
}
