import React, { useEffect, useState } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { PWAInstallButton } from './PWAInstallButton';
import { formatCurrency } from '../utils/formatters';
import {
  Sparkles,
  WifiOff,
  Coins,
  ShoppingCart,
  Menu,
  Calendar,
  Layers,
  Clock,
} from 'lucide-react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ setActiveTab, onOpenMobileMenu }) => {
  const { state, metrics } = useSupermarket();
  const [currentDateTime, setCurrentDateTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentDateTime(`${day}/${month}/${year} ${hours}:${minutes}:${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 text-white shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Lado izquierdo: Hamburguesa móvil y Marca Super Combos */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-lime-400 to-lime-500 flex items-center justify-center text-black font-black shadow-lg shadow-lime-400/20 group-hover:scale-105 transition-all">
              <Layers className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-white group-hover:text-lime-400 transition-colors">
                  Super Combos
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-lime-400/15 text-lime-400 rounded-md border border-lime-400/30 uppercase tracking-widest">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium truncate max-w-[150px] sm:max-w-[220px]">
                {state.settings.storeName}
              </p>
            </div>
          </div>
        </div>

        {/* Centro: Estado Offline e Indicador de Hora */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Indicador de Funcionamiento 100% Offline */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-950/40 border border-lime-400/30 text-lime-400 text-xs font-semibold shadow-inner"
            title="La aplicación almacena todos los datos en tu dispositivo y funciona sin internet."
          >
            <WifiOff className="w-3.5 h-3.5 text-lime-400" />
            <span>100% Offline</span>
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse ml-0.5" />
          </div>

          {/* Reloj con formato DD/MM/AAAA */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
            <Clock className="w-3.5 h-3.5 text-lime-400" />
            <span>{currentDateTime}</span>
          </div>
        </div>

        {/* Lado derecho: Caja en tiempo real, Botón Instalar PWA y Botón Nueva Venta */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Badge de Dinero en Caja */}
          <button
            onClick={() => setActiveTab('cash')}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl text-xs transition-colors cursor-pointer group"
            title="Ver control de caja y arqueo"
          >
            <Coins className="w-4 h-4 text-lime-400 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <span className="text-[10px] text-zinc-400 block leading-tight font-medium">En Caja</span>
              <span className="font-bold text-white text-xs">{formatCurrency(metrics.cashInDrawer)}</span>
            </div>
          </button>

          {/* Botón de instalación PWA */}
          <PWAInstallButton />

          {/* Botón Acción Rápida POS */}
          <button
            onClick={() => setActiveTab('pos')}
            className="flex items-center gap-1.5 bg-lime-400 hover:bg-lime-300 text-black px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-lime-400/20 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden xs:inline">Panel Cajero</span>
            <span className="xs:hidden">Cajero</span>
          </button>
        </div>
      </div>
    </header>
  );
};
