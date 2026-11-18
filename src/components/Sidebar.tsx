import React from 'react';
import { ActiveTab } from '../types';
import { useSupermarket } from '../context/SupermarketContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Layers,
  CalendarDays,
  Truck,
  ArrowLeftRight,
  Coins,
  Users,
  Database,
  X,
  AlertCircle,
} from 'lucide-react';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
}) => {
  const { metrics, state } = useSupermarket();

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Panel Principal',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'pos' as ActiveTab,
      label: 'Panel Cajero',
      icon: ShoppingCart,
      badge: 'F2',
      badgeClass: 'bg-lime-400/20 text-lime-400 border border-lime-400/40',
    },
    {
      id: 'inventory' as ActiveTab,
      label: 'Control de Stock',
      icon: Boxes,
      badge: metrics.lowStockCount > 0 ? `${metrics.lowStockCount} bajo` : null,
      badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse',
    },
    {
      id: 'combos' as ActiveTab,
      label: 'Super Combos',
      icon: Layers,
      badge: state.combos.length > 0 ? String(state.combos.length) : null,
      badgeClass: 'bg-zinc-800 text-lime-400 border border-lime-400/20',
    },
    {
      id: 'orders' as ActiveTab,
      label: 'Cronograma Pedidos',
      icon: CalendarDays,
      badge: metrics.pendingOrdersCount > 0 ? `${metrics.pendingOrdersCount} activos` : null,
      badgeClass: 'bg-lime-400/20 text-lime-400 border border-lime-400/40',
    },
    {
      id: 'suppliers' as ActiveTab,
      label: 'Datos de Proveedores',
      icon: Truck,
      badge: (state.suppliers || []).length > 0 ? String((state.suppliers || []).length) : null,
      badgeClass: 'bg-zinc-800 text-zinc-300',
    },
    {
      id: 'finances' as ActiveTab,
      label: 'Ventas y Compras',
      icon: ArrowLeftRight,
      badge: null,
    },
    {
      id: 'cash' as ActiveTab,
      label: 'Caja & Balance',
      icon: Coins,
      badge: null,
    },
    {
      id: 'customers' as ActiveTab,
      label: 'Clientes Frecuentes',
      icon: Users,
      badge: state.customers.length > 0 ? String(state.customers.length) : null,
      badgeClass: 'bg-zinc-800 text-zinc-300',
    },
    {
      id: 'backups' as ActiveTab,
      label: 'Ajustes & Respaldo',
      icon: Database,
      badge: null,
    },
  ];

  const handleSelect = (id: ActiveTab) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Overlay para móviles */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Menú Lateral en Negro Profundo con Borde Zinc y Acentos Lima */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 md:static ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabecera del sidebar móvil */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 md:hidden">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-lime-400 text-black flex items-center justify-center font-black text-xs">
              SC
            </div>
            <span className="font-black text-white text-base">Super Combos</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 text-zinc-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Navegación Simple y Práctica */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-lime-400 text-black shadow-lg shadow-lime-400/20 font-black'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-black stroke-[2.5]' : 'text-zinc-400 group-hover:text-lime-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isActive ? 'bg-black text-lime-400' : (item.badgeClass || 'bg-zinc-800 text-zinc-300')
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Alerta de Stock Bajo */}
        {metrics.lowStockCount > 0 && (
          <div className="p-3 mx-3 mb-3 bg-amber-950/30 border border-amber-500/30 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-300">
                  {metrics.lowStockCount} {metrics.lowStockCount === 1 ? 'producto' : 'productos'} con stock bajo
                </p>
                <button
                  type="button"
                  onClick={() => handleSelect('inventory')}
                  className="mt-1 text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  Reponer stock →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer del sidebar */}
        <div className="p-3 border-t border-zinc-800/80 text-center bg-black/40">
          <div className="text-[11px] text-zinc-300 font-bold tracking-wide">
            Super Combos • Sistema ERP
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
            <span>100% Offline • Datos Seguros</span>
          </div>
        </div>
      </aside>
    </>
  );
};
