import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Ocultar si ya se está ejecutando instalada en modo standalone
  if (isInstalled) {
    return null;
  }

  // Flujo Chrome / Chromium / Edge / Android
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-black px-3 py-1.5 text-xs font-black shadow-lg shadow-lime-400/20 transition-all cursor-pointer"
        title="Instalar Super Combos en este dispositivo para uso 100% offline"
      >
        <Download className="w-3.5 h-3.5 stroke-[3]" />
        <span>Instalar App</span>
      </button>
    );
  }

  // Flujo Safari en iOS
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-lime-400 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-lime-400" />
          <span>Instalar en iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl text-zinc-100">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-base font-black text-white">Instalar en iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-3 text-xs text-zinc-300 leading-relaxed">
                Para usar <strong className="text-lime-400">Super Combos</strong> 100% sin conexión desde tu pantalla de inicio:
              </p>
              <ol className="mt-3 space-y-2 text-xs text-zinc-400 list-decimal pl-4">
                <li>Toca el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba) en la barra de Safari.</li>
                <li>Desliza hacia abajo y selecciona <strong>"Agregar a Inicio"</strong>.</li>
                <li>Confirma tocando <strong>"Agregar"</strong> en la esquina superior derecha.</li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-lime-400 py-2.5 text-xs font-black text-black hover:bg-lime-300 shadow-md cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
