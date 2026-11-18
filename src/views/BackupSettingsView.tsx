import React, { useState, useRef, useEffect } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { getDeviceStorageStatus } from '../db/indexedDb';
import { formatDateTime } from '../utils/formatters';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  Store,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  KeyRound,
  FileSpreadsheet,
} from 'lucide-react';

export const BackupSettingsView: React.FC = () => {
  const {
    state,
    exportBackupFile,
    exportExcelWorkbook,
    importBackupFile,
    resetToDefault,
    updateSettings,
  } = useSupermarket();

  const [storageStatus, setStorageStatus] = useState<{
    isPersistentGranted: boolean;
    localStorageKB: number;
    hasIndexedDB: boolean;
  } | null>(null);

  useEffect(() => {
    getDeviceStorageStatus().then(setStorageStatus).catch(() => {});
  }, [state.sales.length, state.products.length, state.orders?.length]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de Configuración
  const [storeSettings, setStoreSettings] = useState({
    storeName: state.settings.storeName,
    address: state.settings.address,
    phone: state.settings.phone,
    cuit: state.settings.cuit,
    ticketFooter: state.settings.ticketFooter,
    initialBalanceDefault: state.settings.initialBalanceDefault,
    enablePinSecurity: state.settings.enablePinSecurity,
    adminPin: state.settings.adminPin,
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Modales de Confirmación
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [pendingFileContent, setPendingFileContent] = useState<string | null>(null);

  // Guardar datos del comercio
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      ...storeSettings,
      initialBalanceDefault: Number(storeSettings.initialBalanceDefault),
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Manejo de carga de archivo de respaldo
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPendingFileContent(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!pendingFileContent) return;
    const res = await importBackupFile(pendingFileContent);
    setPendingFileContent(null);
    if (res.success) {
      setImportStatus({
        type: 'success',
        message: '¡Copia de seguridad restaurada exitosamente! Todos los datos han sido actualizados.',
      });
    } else {
      setImportStatus({
        type: 'error',
        message: res.error || 'Error al restaurar la copia de seguridad.',
      });
    }
  };

  const handleConfirmReset = async () => {
    await resetToDefault();
    setIsResetConfirmOpen(false);
    setImportStatus({
      type: 'success',
      message: 'Sistema restablecido con los datos de Super Combos.',
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Cabecera Principal - Black & Lime */}
      <div className="bg-zinc-950 p-5 sm:p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-lime-400 text-black flex items-center justify-center font-black shadow-md shadow-lime-400/20">
              <Database className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Ajustes, Almacenamiento & Exportación Excel
              </h2>
              <span className="text-[11px] font-mono text-lime-400">
                Guardado automático en el dispositivo • Descarga en Plantilla Excel (.xlsx) y Respaldo JSON
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2 max-w-2xl leading-relaxed">
            Super Combos guarda automáticamente todas tus ventas, productos, combos, pedidos, ingresos y gastos en la memoria del dispositivo sin internet. Además podés exportar todo en una plantilla Excel lista para abrir y analizar.
          </p>
        </div>
      </div>

      {importStatus && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between font-mono ${
            importStatus.type === 'success'
              ? 'bg-lime-400/10 border-lime-400/40 text-lime-300'
              : 'bg-red-500/10 border-red-500/40 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {importStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-lime-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <span>{importStatus.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportStatus(null)}
            className="font-bold text-sm text-zinc-400 hover:text-white cursor-pointer px-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Tarjeta de Estado del Almacenamiento Local Offline */}
      <div className="bg-zinc-950 text-white p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-lime-400/10 rounded-xl border border-lime-400/30 text-lime-400 flex items-center justify-center font-bold">
              <HardDrive className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight text-white flex items-center gap-2">
                Motor IndexedDB + LocalStorage Espejo
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                Base de datos local: SuperCombos_OfflineDB
              </p>
            </div>
          </div>
          <span className="px-3.5 py-1.5 bg-lime-400 text-black rounded-full text-xs font-black shadow-md font-mono">
            100% OPERATIVO SIN INTERNET
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
          <div className="bg-zinc-900/90 p-3.5 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block text-[10px] uppercase">Productos en Stock</span>
            <span className="text-lg font-black text-white mt-0.5 block">{state.products.length}</span>
          </div>
          <div className="bg-zinc-900/90 p-3.5 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block text-[10px] uppercase">Ventas Históricas</span>
            <span className="text-lg font-black text-lime-400 mt-0.5 block">{state.sales.length}</span>
          </div>
          <div className="bg-zinc-900/90 p-3.5 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block text-[10px] uppercase">Super Combos</span>
            <span className="text-lg font-black text-white mt-0.5 block">{state.combos.length}</span>
          </div>
          <div className="bg-zinc-900/90 p-3.5 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block text-[10px] uppercase">Proveedores & Pedidos</span>
            <span className="text-lg font-black text-lime-400 mt-0.5 block">
              {(state.suppliers || []).length} / {(state.orders || []).length}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-900 pt-3">
          <span>
            Todas las ventas y registros agregados quedan guardados automáticamente en el almacenamiento local de este dispositivo.
          </span>
          {storageStatus && (
            <span className="font-mono text-lime-400 font-bold">
              {storageStatus.isPersistentGranted ? 'Almacenamiento Protegido Activo' : 'Doble Copia Local Activa'} • {storageStatus.localStorageKB} KB
            </span>
          )}
        </div>
      </div>

      {/* Sección Exportación en Plantilla Excel + Copias de Seguridad */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Exportar Plantilla Excel Completa */}
        <div className="bg-zinc-950 p-6 rounded-2xl border-2 border-lime-400/50 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-lime-400 text-black flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
              </div>
              <h3 className="font-black text-base text-white">
                Plantilla Excel (.xlsx)
              </h3>
            </div>
            <p className="text-xs text-zinc-300 mt-2.5 leading-relaxed">
              Descarga un libro de Excel organizado en <strong>8 hojas</strong>: Resumen General, Ventas, Detalle de Artículos, Stock e Inventario, Super Combos, Ingresos/Egresos, Pedidos y Proveedores/Clientes.
            </p>
          </div>

          <button
            type="button"
            onClick={exportExcelWorkbook}
            className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-black rounded-xl text-xs font-black shadow-lg shadow-lime-400/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
            <span>Descargar Plantilla Excel (.xlsx)</span>
          </button>
        </div>

        {/* Exportar Respaldo */}
        <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-lime-400/40 text-lime-400 flex items-center justify-center font-bold">
                <Download className="w-4 h-4 stroke-[2.5]" />
              </div>
              <h3 className="font-black text-base text-white">
                Respaldo Completo (.json)
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
              Genera una copia íntegra en JSON para guardar en un pendrive o migrar todos los datos a otro dispositivo.
            </p>
            {state.lastBackupDate && (
              <p className="text-[11px] text-lime-400 font-mono mt-2">
                Última copia: {formatDateTime(state.lastBackupDate)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={exportBackupFile}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-lime-400 border border-lime-400/40 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Descargar Respaldo (.json)</span>
          </button>
        </div>

        {/* Restaurar Respaldo */}
        <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-white flex items-center justify-center font-bold">
                <Upload className="w-4 h-4 stroke-[2.5]" />
              </div>
              <h3 className="font-black text-base text-white">
                Restaurar Copia (.json)
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
              Selecciona un archivo de respaldo previo (.json) para restaurar todos los registros en este dispositivo sin internet.
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-lime-400" />
              <span>Seleccionar Archivo (.json)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Configuración de la Empresa y Comprobantes */}
      <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
          <div className="flex items-center gap-2.5">
            <Store className="w-5 h-5 text-lime-400" />
            <h3 className="font-black text-base text-white">
              Datos del Supermercado & Tickets Térmicos
            </h3>
          </div>
          {saveSuccess && (
            <span className="text-xs font-bold text-lime-400 flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-4 h-4" />
              ¡Configuración guardada!
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-zinc-300 block mb-1">
                Nombre Comercial del Supermercado *
              </label>
              <input
                type="text"
                required
                value={storeSettings.storeName}
                onChange={(e) =>
                  setStoreSettings({ ...storeSettings, storeName: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-bold focus:border-lime-400 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="font-bold text-zinc-300 block mb-1">
                CUIT / Identificación Tributaria
              </label>
              <input
                type="text"
                value={storeSettings.cuit}
                onChange={(e) => setStoreSettings({ ...storeSettings, cuit: e.target.value })}
                placeholder="30-71458921-8"
                className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-mono focus:border-lime-400 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-zinc-300 block mb-1">Dirección del Local</label>
              <input
                type="text"
                value={storeSettings.address}
                onChange={(e) =>
                  setStoreSettings({ ...storeSettings, address: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:border-lime-400 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="font-bold text-zinc-300 block mb-1">Teléfono / WhatsApp</label>
              <input
                type="text"
                value={storeSettings.phone}
                onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-mono focus:border-lime-400 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-zinc-300 block mb-1">
                Pie de Página del Ticket
              </label>
              <input
                type="text"
                value={storeSettings.ticketFooter}
                onChange={(e) =>
                  setStoreSettings({ ...storeSettings, ticketFooter: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:border-lime-400 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="font-bold text-zinc-300 block mb-1">
                Fondo de Caja Predeterminado (ARS)
              </label>
              <input
                type="number"
                min="0"
                value={storeSettings.initialBalanceDefault}
                onChange={(e) =>
                  setStoreSettings({
                    ...storeSettings,
                    initialBalanceDefault: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-lime-400 font-mono font-bold focus:border-lime-400 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Seguridad con PIN Opcional */}
          <div className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-lime-400" />
                <span className="font-bold text-zinc-200">
                  Protección de Seguridad con Código PIN de Administrador
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={storeSettings.enablePinSecurity}
                  onChange={(e) =>
                    setStoreSettings({ ...storeSettings, enablePinSecurity: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lime-400"></div>
              </label>
            </div>
            {storeSettings.enablePinSecurity && (
              <div className="pt-2 border-t border-zinc-800">
                <label className="font-bold text-zinc-300 block mb-1">
                  Código PIN de Administrador (4 dígitos)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={storeSettings.adminPin}
                  onChange={(e) =>
                    setStoreSettings({ ...storeSettings, adminPin: e.target.value })
                  }
                  className="w-32 px-3 py-2 text-center text-sm font-mono tracking-widest rounded-xl border border-zinc-700 bg-zinc-950 text-lime-400 font-black focus:border-lime-400 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-lime-400 hover:bg-lime-300 text-black font-black rounded-xl shadow-lg shadow-lime-400/20 transition cursor-pointer"
            >
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>

      {/* Zona de Peligro / Restablecer Fábrica */}
      <div className="bg-zinc-950 p-6 rounded-2xl border border-red-900/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-black text-sm text-red-400">Restablecer Datos de Demostración</h4>
          <p className="text-xs text-zinc-400 mt-0.5">
            Reinicia el catálogo con los productos, combos, proveedores y pedidos de prueba de Super Combos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsResetConfirmOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/50 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Restablecer Fábrica</span>
        </button>
      </div>

      {/* Confirmar Importación de Archivo */}
      <ConfirmModal
        isOpen={!!pendingFileContent}
        title="¿Restaurar copia de seguridad?"
        message="Se reemplazarán los datos actuales por los contenidos en el archivo de respaldo seleccionado. Te sugerimos descargar primero una copia actual."
        confirmText="Restaurar Ahora"
        isDestructive={false}
        onConfirm={handleConfirmImport}
        onCancel={() => setPendingFileContent(null)}
      />

      {/* Confirmar Restablecer Fábrica */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="¿Restablecer datos de prueba?"
        message="Esta acción borrará las ventas y movimientos actuales y restaurará los datos de prueba de Super Combos."
        confirmText="Sí, Restablecer"
        isDestructive={true}
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};
