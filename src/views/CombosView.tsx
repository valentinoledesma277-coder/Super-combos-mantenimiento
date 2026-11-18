import React, { useState, useMemo } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { Combo, ComboItem } from '../types';
import { formatCurrency } from '../utils/formatters';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  Layers,
  Plus,
  Trash2,
  Edit,
  ShoppingCart,
  AlertCircle,
  X,
  Sparkles,
  PackageCheck,
  TrendingUp,
} from 'lucide-react';

interface CombosViewProps {
  onStartSaleWithCombo?: (combo: Combo) => void;
}

export const CombosView: React.FC<CombosViewProps> = ({ onStartSaleWithCombo }) => {
  const { state, createCombo, updateCombo, deleteCombo } = useSupermarket();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [comboToDelete, setComboToDelete] = useState<Combo | null>(null);

  // Formulario del Combo
  const [comboName, setComboName] = useState('');
  const [comboCode, setComboCode] = useState('');
  const [comboDescription, setComboDescription] = useState('');
  const [comboPrice, setComboPrice] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<
    { productId: string; quantity: number }[]
  >([]);

  // Buscar producto a añadir en el creador
  const [productToAddId, setProductToAddId] = useState<string>('');
  const [productToAddQty, setProductToAddQty] = useState<number>(1);

  // Cálculos automáticos del modal
  const modalCalculations = useMemo(() => {
    let totalCost = 0;
    let regularTotalPrice = 0;

    selectedItems.forEach((item) => {
      const prod = state.products.find((p) => p.id === item.productId);
      if (prod) {
        totalCost += prod.costPrice * item.quantity;
        regularTotalPrice += prod.salePrice * item.quantity;
      }
    });

    const profit = Math.max(0, comboPrice - totalCost);
    const savings = Math.max(0, regularTotalPrice - comboPrice);
    const margin = comboPrice > 0 ? Math.round((profit / comboPrice) * 100) : 0;

    return { totalCost, regularTotalPrice, profit, savings, margin };
  }, [selectedItems, comboPrice, state.products]);

  // Abrir modal nuevo / editar
  const handleOpenModal = (combo?: Combo) => {
    if (combo) {
      setEditingCombo(combo);
      setComboName(combo.name);
      setComboCode(combo.code);
      setComboDescription(combo.description || '');
      setComboPrice(combo.salePrice);
      setSelectedItems(
        combo.items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      );
    } else {
      setEditingCombo(null);
      setComboName('');
      setComboCode(`CMB-${String(state.combos.length + 1).padStart(3, '0')}`);
      setComboDescription('');
      setComboPrice(0);
      setSelectedItems([]);
    }
    setProductToAddId('');
    setProductToAddQty(1);
    setIsModalOpen(true);
  };

  const handleAddItemToCombo = () => {
    if (!productToAddId || productToAddQty <= 0) return;
    const existingIndex = selectedItems.findIndex((i) => i.productId === productToAddId);
    if (existingIndex >= 0) {
      const updated = [...selectedItems];
      updated[existingIndex].quantity += productToAddQty;
      setSelectedItems(updated);
    } else {
      setSelectedItems([...selectedItems, { productId: productToAddId, quantity: productToAddQty }]);
    }
    setProductToAddId('');
    setProductToAddQty(1);
  };

  const handleRemoveItemFromCombo = (productId: string) => {
    setSelectedItems(selectedItems.filter((i) => i.productId !== productId));
  };

  const handleSaveCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comboName.trim() || !comboCode.trim() || selectedItems.length === 0 || comboPrice <= 0) {
      return;
    }

    const items: ComboItem[] = selectedItems.map((item) => {
      const prod = state.products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        productName: prod?.name || 'Producto',
        quantity: item.quantity,
        costPrice: prod?.costPrice || 0,
        regularSalePrice: prod?.salePrice || 0,
      };
    });

    if (editingCombo) {
      await updateCombo(editingCombo.id, {
        name: comboName,
        code: comboCode,
        description: comboDescription,
        salePrice: Number(comboPrice),
        items,
      });
    } else {
      await createCombo({
        name: comboName,
        code: comboCode,
        description: comboDescription,
        salePrice: Number(comboPrice),
        items,
      });
    }

    setIsModalOpen(false);
  };

  // Calcular disponibilidad real del combo en base al stock actual de sus productos
  const getComboAvailability = (combo: Combo) => {
    let maxCombos = Infinity;
    const missingItems: string[] = [];

    combo.items.forEach((item) => {
      const prod = state.products.find((p) => p.id === item.productId);
      const stock = prod ? prod.stock : 0;
      const canMake = Math.floor(stock / item.quantity);
      if (canMake < maxCombos) {
        maxCombos = canMake;
      }
      if (stock < item.quantity) {
        missingItems.push(prod?.name || 'Producto sin stock');
      }
    });

    return {
      availableCombos: maxCombos === Infinity ? 0 : maxCombos,
      hasStock: maxCombos > 0,
      missingItems,
    };
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal - Black & Lime */}
      <div className="bg-zinc-950 p-5 sm:p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-lime-400 text-black flex items-center justify-center font-black shadow-md shadow-lime-400/20">
              <Layers className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Super Combos & Paquetes Promocionales
              </h2>
              <span className="text-[11px] font-mono text-lime-400">
                {state.combos.length} combos activos • Descuento de stock en cascada
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2 max-w-2xl leading-relaxed">
            Arma paquetes promocionales para el supermercado. Al facturar un combo, el sistema descuenta automáticamente las unidades individuales del inventario y recalcula las existencias al instante.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-lime-400 hover:bg-lime-300 text-black font-black rounded-xl text-xs shadow-lg shadow-lime-400/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Crear Super Combo</span>
        </button>
      </div>

      {/* Grid de Super Combos */}
      {state.combos.length === 0 ? (
        <div className="bg-zinc-950 rounded-2xl border border-dashed border-zinc-800 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <h4 className="font-black text-white text-base">No hay combos configurados</h4>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
              Crea combos estratégicos como "Super Combo Asado Familiar", "Combo Desayuno" o "Pack Limpieza Hogar" para acelerar las ventas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="px-5 py-2.5 bg-lime-400 text-black text-xs font-black rounded-xl shadow-md hover:bg-lime-300 cursor-pointer"
          >
            Crear Primer Combo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {state.combos.map((combo) => {
            const avail = getComboAvailability(combo);
            const totalCost = combo.items.reduce((sum, item) => {
              const prod = state.products.find((p) => p.id === item.productId);
              return sum + (prod ? prod.costPrice * item.quantity : item.costPrice * item.quantity);
            }, 0);
            const regularTotal = combo.items.reduce((sum, item) => {
              const prod = state.products.find((p) => p.id === item.productId);
              return (
                sum + (prod ? prod.salePrice * item.quantity : item.regularSalePrice * item.quantity)
              );
            }, 0);
            const clientSavings = Math.max(0, regularTotal - combo.salePrice);
            const profit = Math.max(0, combo.salePrice - totalCost);
            const margin = combo.salePrice > 0 ? Math.round((profit / combo.salePrice) * 100) : 0;

            return (
              <div
                key={combo.id}
                className={`bg-zinc-950 rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden group ${
                  avail.hasStock
                    ? 'border-zinc-800/90 hover:border-lime-400/50 hover:shadow-xl hover:shadow-lime-950/20'
                    : 'border-red-900/40 bg-zinc-950/80'
                }`}
              >
                {/* Indicador de stock armable en esquina */}
                <div className="absolute top-4 right-4">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full ${
                      avail.hasStock
                        ? 'bg-lime-400/10 text-lime-400 border border-lime-400/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {avail.hasStock ? (
                      <>
                        <PackageCheck className="w-3 h-3" />
                        <span>{avail.availableCombos} listos</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        <span>Sin stock</span>
                      </>
                    )}
                  </span>
                </div>

                <div>
                  {/* Encabezado Tarjeta */}
                  <div className="pr-20 pb-3 border-b border-zinc-900">
                    <span className="text-[10px] font-mono font-bold text-zinc-500 block">
                      {combo.code}
                    </span>
                    <h3 className="font-black text-base text-white leading-snug group-hover:text-lime-400 transition-colors">
                      {combo.name}
                    </h3>
                    {combo.description && (
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                        {combo.description}
                      </p>
                    )}
                  </div>

                  {/* Artículos componentes */}
                  <div className="py-3 space-y-2">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      <span>Componentes ({combo.items.length}):</span>
                      <span>Stock en góndola</span>
                    </div>

                    <ul className="space-y-1.5">
                      {combo.items.map((item, idx) => {
                        const prod = state.products.find((p) => p.id === item.productId);
                        const currentStock = prod ? prod.stock : 0;
                        const hasEnough = currentStock >= item.quantity;
                        return (
                          <li
                            key={idx}
                            className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-zinc-900/60 border border-zinc-900"
                          >
                            <span className="truncate max-w-[170px] text-zinc-200">
                              <strong className="text-lime-400 font-mono">{item.quantity}x</strong>{' '}
                              {item.productName}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                hasEnough
                                  ? 'bg-zinc-800 text-zinc-300'
                                  : 'bg-red-950/60 text-red-400 border border-red-800/40'
                              }`}
                            >
                              {currentStock} disp.
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Métricas Financieras del Combo */}
                  <div className="pt-2 grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-medium">Costo Total</span>
                      <span className="font-bold text-zinc-300 font-mono text-[11px]">
                        {formatCurrency(totalCost)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-medium">Ahorro Cliente</span>
                      <span className="font-bold text-lime-400 font-mono text-[11px]">
                        {clientSavings > 0 ? formatCurrency(clientSavings) : '$0'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-medium">Margen</span>
                      <span className="font-bold text-lime-400 font-mono text-[11px] flex items-center justify-center gap-0.5">
                        <TrendingUp className="w-3 h-3" />
                        {margin}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer del Combo: Precio y Botón de Venta */}
                <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-mono font-bold">
                      PRECIO SUPER COMBO
                    </span>
                    <span className="text-xl font-black text-lime-400 font-mono">
                      {formatCurrency(combo.salePrice)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenModal(combo)}
                      title="Editar combo"
                      className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setComboToDelete(combo)}
                      title="Eliminar combo"
                      className="p-2 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-950/20 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {onStartSaleWithCombo && (
                      <button
                        type="button"
                        disabled={!avail.hasStock}
                        onClick={() => onStartSaleWithCombo(combo)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-lime-400 hover:bg-lime-300 disabled:opacity-30 disabled:cursor-not-allowed text-black font-black rounded-xl text-xs transition shadow-sm cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Vender</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nuevo / Editar Combo en Negro & Verde Lima */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-4 my-6 text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-lime-400 text-black flex items-center justify-center font-black">
                  <Layers className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="font-black text-base text-white">
                  {editingCombo ? 'Editar Super Combo' : 'Crear Nuevo Super Combo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCombo} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="font-bold text-zinc-300 block mb-1">Código *</label>
                  <input
                    type="text"
                    required
                    value={comboCode}
                    onChange={(e) => setComboCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-mono focus:border-lime-400 focus:outline-hidden"
                    placeholder="CMB-001"
                  />
                </div>
                <div className="col-span-2">
                  <label className="font-bold text-zinc-300 block mb-1">Nombre del Combo *</label>
                  <input
                    type="text"
                    required
                    value={comboName}
                    onChange={(e) => setComboName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-bold focus:border-lime-400 focus:outline-hidden"
                    placeholder="Ej. Super Combo Asado Fin de Semana"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Descripción / Contenido</label>
                <input
                  type="text"
                  value={comboDescription}
                  onChange={(e) => setComboDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:border-lime-400 focus:outline-hidden"
                  placeholder="Detalles y beneficios del combo..."
                />
              </div>

              {/* Selector de Productos */}
              <div className="p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-2.5">
                <span className="font-black text-lime-400 block tracking-wide uppercase text-[10px]">
                  1. Agregar Productos Componentes
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={productToAddId}
                    onChange={(e) => setProductToAddId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-white text-xs focus:border-lime-400"
                  >
                    <option value="">Seleccionar producto del inventario...</option>
                    {state.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Venta: {formatCurrency(p.salePrice)} | Stock: {p.stock})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={productToAddQty}
                    onChange={(e) => setProductToAddQty(parseInt(e.target.value, 10) || 1)}
                    className="w-16 px-2 py-2 text-center rounded-xl border border-zinc-700 bg-zinc-950 text-white font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleAddItemToCombo}
                    className="px-3.5 py-2 bg-lime-400 hover:bg-lime-300 text-black font-black rounded-xl cursor-pointer"
                  >
                    Añadir
                  </button>
                </div>

                {/* Lista de productos agregados */}
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1 divide-y divide-zinc-800">
                  {selectedItems.map((item) => {
                    const prod = state.products.find((p) => p.id === item.productId);
                    return (
                      <div
                        key={item.productId}
                        className="pt-1.5 flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-zinc-200 truncate max-w-[220px]">
                          <strong className="text-lime-400 font-mono">{item.quantity}x</strong>{' '}
                          {prod?.name || 'Producto'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 font-mono text-[11px]">
                            {formatCurrency((prod?.salePrice || 0) * item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromCombo(item.productId)}
                            className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {selectedItems.length === 0 && (
                    <p className="text-zinc-500 py-3 text-center text-[11px]">
                      Ningún producto agregado todavía. Selecciona arriba para armar el combo.
                    </p>
                  )}
                </div>
              </div>

              {/* Precio Especial */}
              <div>
                <label className="font-black text-zinc-300 block mb-1 uppercase tracking-wide text-[10px]">
                  2. Precio de Venta Promocional del Combo (ARS) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lime-400 font-black text-base">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={comboPrice || ''}
                    onChange={(e) => setComboPrice(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-lime-400 font-black text-lg font-mono focus:border-lime-400 focus:outline-hidden"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Rentabilidad y Ahorro */}
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1.5 text-zinc-300 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total productos individuales:</span>
                  <span className="font-bold text-white">
                    {formatCurrency(modalCalculations.regularTotalPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Costo compra componentes:</span>
                  <span>{formatCurrency(modalCalculations.totalCost)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-zinc-800 pt-1 text-lime-400">
                  <span>Ganancia neta estimada:</span>
                  <span>
                    {formatCurrency(modalCalculations.profit)} ({modalCalculations.margin}%)
                  </span>
                </div>
                {modalCalculations.savings > 0 && (
                  <div className="flex justify-between text-zinc-300">
                    <span className="text-zinc-400">Ahorro para el cliente:</span>
                    <span className="font-bold text-lime-300">
                      {formatCurrency(modalCalculations.savings)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={selectedItems.length === 0 || comboPrice <= 0}
                  className="px-5 py-2 font-black text-black bg-lime-400 hover:bg-lime-300 disabled:opacity-40 rounded-xl shadow-lg shadow-lime-400/20 cursor-pointer"
                >
                  Guardar Super Combo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar Eliminación */}
      <ConfirmModal
        isOpen={!!comboToDelete}
        title="¿Eliminar este Super Combo?"
        message={`Estás por eliminar "${comboToDelete?.name}". Los productos que lo componen seguirán en el inventario.`}
        confirmText="Eliminar Combo"
        isDestructive={true}
        onConfirm={async () => {
          if (comboToDelete) {
            await deleteCombo(comboToDelete.id);
            setComboToDelete(null);
          }
        }}
        onCancel={() => setComboToDelete(null)}
      />
    </div>
  );
};
