import React, { useState, useMemo } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { Product } from '../types';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { downloadExcelSheet } from '../utils/excelExport';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  Edit,
  Trash2,
  PackagePlus,
  PackageMinus,
  History,
  FileSpreadsheet,
  X,
  Truck,
} from 'lucide-react';

interface InventoryViewProps {
  initialSupplierFilter?: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ initialSupplierFilter }) => {
  const {
    state,
    metrics,
    addProduct,
    updateProduct,
    deleteProduct,
    addStockEntry,
    recordStockLoss,
  } = useSupermarket();

  const [searchTerm, setSearchTerm] = useState(initialSupplierFilter || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'products' | 'movements'>('products');

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isStockEntryModalOpen, setIsStockEntryModalOpen] = useState(false);
  const [stockEntryProduct, setStockEntryProduct] = useState<Product | null>(null);
  const [stockEntryQty, setStockEntryQty] = useState<number>(10);
  const [stockEntryCost, setStockEntryCost] = useState<string>('');
  const [stockEntrySupplier, setStockEntrySupplier] = useState<string>('');
  const [stockEntryCreateExpense, setStockEntryCreateExpense] = useState<boolean>(true);

  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [lossProduct, setLossProduct] = useState<Product | null>(null);
  const [lossQty, setLossQty] = useState<number>(1);
  const [lossReason, setLossReason] = useState<string>('Vencimiento');
  const [lossNotes, setLossNotes] = useState<string>('');

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'Almacén',
    costPrice: 0,
    salePrice: 0,
    stock: 10,
    minStock: 5,
    supplier: '',
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    state.products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [state.products]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return state.products.filter((p) => {
      const matchTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        (p.supplier && p.supplier.toLowerCase().includes(term));

      const matchCat = selectedCategory === 'todos' || p.category === selectedCategory;
      const matchLow = !onlyLowStock || p.stock <= p.minStock;

      return matchTerm && matchCat && matchLow;
    });
  }, [state.products, searchTerm, selectedCategory, onlyLowStock]);

  const handleOpenProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        code: product.code,
        name: product.name,
        category: product.category,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        stock: product.stock,
        minStock: product.minStock,
        supplier: product.supplier || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        code: `779${Math.floor(10000000 + Math.random() * 90000000)}`,
        name: '',
        category: 'Almacén',
        costPrice: 0,
        salePrice: 0,
        stock: 10,
        minStock: 5,
        supplier: '',
      });
    }
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) return;

    if (editingProduct) {
      await updateProduct(editingProduct.id, {
        ...formData,
        costPrice: Number(formData.costPrice),
        salePrice: Number(formData.salePrice),
        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
      });
    } else {
      await addProduct({
        ...formData,
        costPrice: Number(formData.costPrice),
        salePrice: Number(formData.salePrice),
        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
      });
    }

    setIsProductModalOpen(false);
  };

  const handleOpenStockEntry = (product: Product) => {
    setStockEntryProduct(product);
    setStockEntryQty(10);
    setStockEntryCost(String(product.costPrice));
    setStockEntrySupplier(product.supplier || '');
    setStockEntryCreateExpense(true);
    setIsStockEntryModalOpen(true);
  };

  const handleConfirmStockEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockEntryProduct || stockEntryQty <= 0) return;

    await addStockEntry({
      productId: stockEntryProduct.id,
      quantity: stockEntryQty,
      costPerUnit: parseFloat(stockEntryCost) || stockEntryProduct.costPrice,
      supplier: stockEntrySupplier || undefined,
      registerExpense: stockEntryCreateExpense,
    });

    setIsStockEntryModalOpen(false);
  };

  const handleOpenLossModal = (product: Product) => {
    setLossProduct(product);
    setLossQty(1);
    setLossReason('Rotura / Dañado');
    setLossNotes('');
    setIsLossModalOpen(true);
  };

  const handleConfirmLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lossProduct || lossQty <= 0) return;

    await recordStockLoss({
      productId: lossProduct.id,
      quantity: lossQty,
      reason: lossReason,
      notes: lossNotes,
    });

    setIsLossModalOpen(false);
  };

  const handleExportExcel = () => {
    const headers = [
      'Código',
      'Producto',
      'Categoría',
      'Stock Actual',
      'Stock Mínimo',
      'Precio Costo (ARS)',
      'Precio Venta (ARS)',
      'Margen (%)',
      'Proveedor',
    ];

    const rows = state.products.map((p) => {
      const margin = p.salePrice > 0 ? Number((((p.salePrice - p.costPrice) / p.salePrice) * 100).toFixed(1)) : 0;
      return [
        p.code,
        p.name,
        p.category,
        p.stock,
        p.minStock,
        p.costPrice,
        p.salePrice,
        margin,
        p.supplier || '',
      ];
    });

    downloadExcelSheet('Inventario_SuperCombos.xlsx', 'Inventario', headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* 4 Métricas de Inventario */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-950 p-4.5 rounded-2xl border border-zinc-800 shadow-xs">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Total Artículos
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{metrics.totalStockCount}</span>
            <span className="text-xs text-zinc-500 font-semibold">{state.products.length} productos</span>
          </div>
        </div>

        <div className="bg-zinc-950 p-4.5 rounded-2xl border border-zinc-800 shadow-xs">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Valor Inversión (Costo)
          </span>
          <div className="mt-1">
            <span className="text-2xl font-black text-white">
              {formatCurrency(metrics.totalInventoryCostValue)}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">Capital en góndola</p>
        </div>

        <div className="bg-zinc-950 p-4.5 rounded-2xl border border-zinc-800 shadow-xs">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Valoración Venta
          </span>
          <div className="mt-1">
            <span className="text-2xl font-black text-lime-400">
              {formatCurrency(metrics.totalInventorySaleValue)}
            </span>
          </div>
          <p className="text-[11px] text-lime-400/80 mt-0.5">Recupero estimado al público</p>
        </div>

        <div className="bg-zinc-950 p-4.5 rounded-2xl border border-zinc-800 shadow-xs">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Stock Crítico / Bajo
          </span>
          <div className="mt-1">
            <span className={`text-2xl font-black ${metrics.lowStockCount > 0 ? 'text-amber-400' : 'text-zinc-200'}`}>
              {metrics.lowStockCount}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">Requieren reposición inmediata</p>
        </div>
      </div>

      {/* Barra de Filtros y Acciones */}
      <div className="bg-zinc-950 p-4 sm:p-5 rounded-2xl border border-zinc-800 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-lime-400 text-black shadow-lg shadow-lime-400/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Lista de Productos ({state.products.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'movements'
                  ? 'bg-lime-400 text-black shadow-lg shadow-lime-400/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Movimientos de Stock</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold border border-zinc-800 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-lime-400" />
              <span className="hidden sm:inline">Exportar Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenProductModal()}
              className="flex items-center gap-1.5 px-4 py-2 bg-lime-400 hover:bg-lime-300 text-black rounded-xl text-xs font-black shadow-lg shadow-lime-400/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nuevo Producto</span>
            </button>
          </div>
        </div>

        {activeTab === 'products' && (
          <div className="pt-2 border-t border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código de barras, nombre o proveedor..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300"
              >
                <option value="todos">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setOnlyLowStock(!onlyLowStock)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  onlyLowStock
                    ? 'bg-amber-400 text-black font-black'
                    : 'bg-zinc-900 text-amber-300 border border-amber-500/30 hover:bg-zinc-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Solo Stock Bajo ({metrics.lowStockCount})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contenido: Tabla de Productos o Auditoría */}
      {activeTab === 'products' ? (
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800/80 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-900 text-zinc-400 font-bold uppercase border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">Producto</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-3 text-right">Costo</th>
                  <th className="py-3 px-3 text-right">Precio Venta</th>
                  <th className="py-3 px-3 text-center">Margen</th>
                  <th className="py-3 px-3 text-center">Stock</th>
                  <th className="py-3 px-3">Proveedor</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.stock <= 0;
                  const isLow = p.stock > 0 && p.stock <= p.minStock;
                  const margin =
                    p.salePrice > 0
                      ? Math.round(((p.salePrice - p.costPrice) / p.salePrice) * 100)
                      : 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-zinc-900/60 transition ${
                        isOutOfStock ? 'bg-red-950/20' : isLow ? 'bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-zinc-400">{p.code}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{p.name}</div>
                        {isLow && (
                          <div className="text-[10px] text-amber-300 font-bold flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Mínimo requerido: {p.minStock} un.</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-zinc-300">{p.category}</td>
                      <td className="py-3 px-3 text-right text-zinc-400 font-mono">
                        {formatCurrency(p.costPrice)}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-white font-mono">
                        {formatCurrency(p.salePrice)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-lime-400/10 text-lime-400 border border-lime-400/20 font-black text-[10px]">
                          {margin}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full font-black text-xs ${
                            isOutOfStock
                              ? 'bg-red-950 text-red-400 border border-red-500/30'
                              : isLow
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                              : 'bg-zinc-900 text-lime-400 border border-lime-400/30'
                          }`}
                        >
                          {p.stock} un.
                        </span>
                      </td>
                      <td className="py-3 px-3 text-zinc-400">{p.supplier || '-'}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenStockEntry(p)}
                            className="p-1.5 rounded-lg text-lime-400 hover:bg-zinc-900 transition"
                            title="Ingreso de Mercadería"
                          >
                            <PackagePlus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenLossModal(p)}
                            className="p-1.5 rounded-lg text-amber-400 hover:bg-zinc-900 transition"
                            title="Registrar Pérdida / Dañado"
                          >
                            <PackageMinus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenProductModal(p)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductToDelete(p)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Movimientos */
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5">
          <h3 className="font-black text-sm text-white mb-3">
            Movimientos y Auditoría de Stock ({state.stockMovements.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-900 text-zinc-400 font-bold uppercase border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-3">Producto</th>
                  <th className="py-3 px-3 text-center">Tipo</th>
                  <th className="py-3 px-3 text-center">Cant.</th>
                  <th className="py-3 px-3 text-center">Previo</th>
                  <th className="py-3 px-3 text-center">Nuevo</th>
                  <th className="py-3 px-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {state.stockMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-zinc-900/60">
                    <td className="py-2.5 px-3 text-zinc-400 font-mono">
                      {formatDateTime(mov.date)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">{mov.productName}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded font-black text-[10px] uppercase bg-zinc-900 text-lime-400 border border-lime-400/20">
                        {mov.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-white">
                      {mov.type === 'entrada' || mov.type === 'cancelacion_venta' ? '+' : '-'}
                      {mov.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-center text-zinc-500">{mov.previousStock}</td>
                    <td className="py-2.5 px-3 text-center font-black text-lime-400">
                      {mov.newStock}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">{mov.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Nuevo / Editar Producto */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-950 p-6 shadow-2xl border border-zinc-800 space-y-4 my-6 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-black text-base">
                {editingProduct ? 'Editar Producto' : 'Registrar Nuevo Producto'}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Código de Barras *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Categoría *</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Precio Compra (Costo) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.costPrice || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Precio Venta al Público *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.salePrice || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, salePrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-lime-400 font-black text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Stock Disponible *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Stock Mínimo (Alerta) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.minStock}
                    onChange={(e) =>
                      setFormData({ ...formData, minStock: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Proveedor Habitual</label>
                <select
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                >
                  <option value="">Seleccionar de proveedores registrados o escribir</option>
                  {(state.suppliers || []).map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 font-bold text-zinc-400 hover:bg-zinc-900 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-black text-black bg-lime-400 hover:bg-lime-300 rounded-xl shadow-lg shadow-lime-400/20"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Entrada de Mercadería / Ingreso de Productos */}
      {isStockEntryModalOpen && stockEntryProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 p-6 shadow-2xl border border-zinc-800 space-y-4 text-white">
            <h3 className="font-black text-base">
              Ingreso de Productos • {stockEntryProduct.name}
            </h3>
            <p className="text-xs text-zinc-400">
              Stock actual en góndola: <strong className="text-lime-400">{stockEntryProduct.stock} un.</strong>
            </p>

            <form onSubmit={handleConfirmStockEntry} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Cantidad a Ingresar *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={stockEntryQty}
                  onChange={(e) => setStockEntryQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-black text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Costo Unitario Compra (ARS)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={stockEntryCost}
                  onChange={(e) => setStockEntryCost(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Proveedor / Remito</label>
                <input
                  type="text"
                  value={stockEntrySupplier}
                  onChange={(e) => setStockEntrySupplier(e.target.value)}
                  placeholder="Distribuidora..."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                />
              </div>

              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1">
                <label className="flex items-center gap-2 font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stockEntryCreateExpense}
                    onChange={(e) => setStockEntryCreateExpense(e.target.checked)}
                    className="accent-lime-400 w-4 h-4 rounded"
                  />
                  <span>Registrar Egreso / Compra Automático</span>
                </label>
                <p className="text-[11px] text-zinc-400 pl-6">
                  Se anotará una salida de{' '}
                  <strong className="text-lime-400">
                    {formatCurrency(
                      (parseFloat(stockEntryCost) || stockEntryProduct.costPrice) * stockEntryQty
                    )}
                  </strong>{' '}
                  en el panel de Compras.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsStockEntryModalOpen(false)}
                  className="px-4 py-2 font-bold text-zinc-400 hover:bg-zinc-900 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-black text-black bg-lime-400 hover:bg-lime-300 rounded-xl shadow-lg shadow-lime-400/20"
                >
                  Confirmar Ingreso (+{stockEntryQty} un.)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pérdida */}
      {isLossModalOpen && lossProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 p-6 shadow-2xl border border-zinc-800 space-y-4 text-white">
            <h3 className="font-black text-base text-red-400">
              Registrar Pérdida / Merma • {lossProduct.name}
            </h3>

            <form onSubmit={handleConfirmLoss} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Cantidad *</label>
                <input
                  type="number"
                  min="1"
                  max={lossProduct.stock}
                  required
                  value={lossQty}
                  onChange={(e) => setLossQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-red-400 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Motivo *</label>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                >
                  <option value="Vencimiento">Fecha de Vencimiento Cumplida</option>
                  <option value="Rotura / Dañado">Producto Roto / Paquete Dañado</option>
                  <option value="Diferencia de Inventario">Diferencia de Inventario Físico</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsLossModalOpen(false)}
                  className="px-4 py-2 font-bold text-zinc-400 hover:bg-zinc-900 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-black text-white bg-red-600 hover:bg-red-700 rounded-xl"
                >
                  Confirmar Pérdida (-{lossQty} un.)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar Eliminación */}
      <ConfirmModal
        isOpen={!!productToDelete}
        title="¿Eliminar este producto?"
        message={`Estás por eliminar "${productToDelete?.name}". Esta acción no se puede deshacer.`}
        confirmText="Eliminar Producto"
        isDestructive={true}
        onConfirm={async () => {
          if (productToDelete) {
            await deleteProduct(productToDelete.id);
            setProductToDelete(null);
          }
        }}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
};
