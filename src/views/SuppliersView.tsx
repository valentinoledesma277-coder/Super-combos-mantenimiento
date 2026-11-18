import React, { useState, useMemo } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { Supplier } from '../types';
import { formatDateTime, formatDate } from '../utils/formatters';
import { downloadExcelSheet } from '../utils/excelExport';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Edit,
  Trash2,
  FileSpreadsheet,
  X,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface SuppliersViewProps {
  onOpenStockEntryForSupplier?: (supplierName: string) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ onOpenStockEntryForSupplier }) => {
  const { state, addSupplier, updateSupplier, deleteSupplier } = useSupermarket();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Formulario Proveedor
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    category: 'Almacén Seco',
    leadTimeDays: 2,
    deliveryDays: 'Lunes y Jueves',
    notes: '',
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    (state.suppliers || []).forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [state.suppliers]);

  // Proveedores filtrados
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return (state.suppliers || []).filter((s) => {
      const matchTerm =
        !term ||
        s.name.toLowerCase().includes(term) ||
        (s.contactName && s.contactName.toLowerCase().includes(term)) ||
        s.phone.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term);

      const matchCat = selectedCategory === 'todos' || s.category === selectedCategory;
      return matchTerm && matchCat;
    });
  }, [state.suppliers, searchTerm, selectedCategory]);

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contactName: supplier.contactName || '',
        phone: supplier.phone,
        email: supplier.email || '',
        address: supplier.address || '',
        category: supplier.category,
        leadTimeDays: supplier.leadTimeDays || 2,
        deliveryDays: supplier.deliveryDays || '',
        notes: supplier.notes || '',
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        contactName: '',
        phone: '',
        email: '',
        address: '',
        category: 'Almacén General',
        leadTimeDays: 2,
        deliveryDays: 'Lunes a Viernes',
        notes: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;

    if (editingSupplier) {
      await updateSupplier(editingSupplier.id, {
        name: formData.name.trim(),
        contactName: formData.contactName.trim() || undefined,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        category: formData.category.trim(),
        leadTimeDays: Number(formData.leadTimeDays) || 1,
        deliveryDays: formData.deliveryDays.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });
    } else {
      await addSupplier({
        name: formData.name.trim(),
        contactName: formData.contactName.trim() || undefined,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        category: formData.category.trim(),
        leadTimeDays: Number(formData.leadTimeDays) || 1,
        deliveryDays: formData.deliveryDays.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });
    }

    setIsModalOpen(false);
  };

  const handleExportExcel = () => {
    const headers = [
      'Proveedor',
      'Contacto',
      'Teléfono',
      'Email',
      'Rubro / Categoría',
      'Días de Entrega',
      'Demora (días)',
      'Dirección',
      'Notas',
    ];
    const rows = filteredSuppliers.map((s) => [
      s.name,
      s.contactName || '',
      s.phone,
      s.email || '',
      s.category,
      s.deliveryDays || '',
      s.leadTimeDays || 1,
      s.address || '',
      s.notes || '',
    ]);
    downloadExcelSheet('Proveedores_SuperCombos.xlsx', 'Proveedores', headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-lime-400/10 rounded-xl text-lime-400 border border-lime-400/30">
              <Truck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Datos de Proveedores
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Agenda comercial, días de reparto, plazos de entrega y contacto para reposición de stock.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold border border-zinc-700 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-lime-400" />
            <span>Exportar Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-lime-400 hover:bg-lime-300 text-black rounded-xl text-xs font-black shadow-lg shadow-lime-400/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por empresa, contacto, teléfono o rubro..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200"
          >
            <option value="todos">Todos los rubros</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="text-xs font-bold text-zinc-400 whitespace-nowrap">
            Total: <strong className="text-lime-400">{filteredSuppliers.length}</strong>
          </span>
        </div>
      </div>

      {/* Grid de Tarjetas de Proveedores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-500 text-xs bg-zinc-950 rounded-2xl border border-zinc-800">
            No se encontraron proveedores registrados.
          </div>
        ) : (
          filteredSuppliers.map((supplier) => {
            // Contar productos asociados a este proveedor
            const associatedProducts = state.products.filter(
              (p) => p.supplier && p.supplier.toLowerCase().includes(supplier.name.toLowerCase())
            );

            return (
              <div
                key={supplier.id}
                className="bg-zinc-950 rounded-2xl border border-zinc-800/90 shadow-md p-5 hover:border-lime-400/50 hover:shadow-lime-400/5 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Encabezado */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-800/80">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-lime-400/10 text-lime-400 border border-lime-400/30 uppercase tracking-wider">
                        {supplier.category}
                      </span>
                      <h3 className="font-black text-base text-white mt-1.5 leading-snug group-hover:text-lime-400 transition-colors">
                        {supplier.name}
                      </h3>
                      {supplier.contactName && (
                        <p className="text-xs text-zinc-400 font-medium mt-0.5">
                          Contacto: <strong className="text-zinc-200">{supplier.contactName}</strong>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenModal(supplier)}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSupplierToDelete(supplier)}
                        className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Datos de contacto y logística */}
                  <div className="py-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Phone className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                      <span className="font-mono font-bold">{supplier.phone}</span>
                    </div>

                    {supplier.email && (
                      <div className="flex items-center gap-2 text-zinc-400 truncate">
                        <Mail className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                        <span className="truncate">{supplier.email}</span>
                      </div>
                    )}

                    {supplier.address && (
                      <div className="flex items-center gap-2 text-zinc-400 truncate">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                        <span className="truncate">{supplier.address}</span>
                      </div>
                    )}

                    {/* Días de Entrega y Plazo */}
                    <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3 text-lime-400" />
                          Días de reparto:
                        </span>
                        <span className="font-bold text-white">
                          {supplier.deliveryDays || 'A coordinar'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-lime-400" />
                          Plazo de demora:
                        </span>
                        <span className="font-bold text-lime-400">
                          {supplier.leadTimeDays ? `${supplier.leadTimeDays} días` : '24/48 hs'}
                        </span>
                      </div>
                    </div>

                    {supplier.notes && (
                      <p className="text-[11px] text-zinc-400 italic bg-black/40 p-2 rounded-lg border border-zinc-800/60">
                        "{supplier.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Tarjeta: Artículos asociados */}
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">
                    <strong className="text-white">{associatedProducts.length}</strong> productos en catálogo
                  </span>
                  {onOpenStockEntryForSupplier && (
                    <button
                      type="button"
                      onClick={() => onOpenStockEntryForSupplier(supplier.name)}
                      className="text-xs font-bold text-lime-400 hover:text-lime-300 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Cargar compra</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Crear / Editar Proveedor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 p-6 shadow-2xl border border-zinc-800 space-y-4 my-6 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-lime-400" />
                <h3 className="font-black text-base">
                  {editingSupplier ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">
                  Razón Social / Nombre de Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Distribuidora Litoral S.A."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-bold focus:ring-2 focus:ring-lime-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">
                    Nombre de Contacto / Vendedor
                  </label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:ring-2 focus:ring-lime-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">
                    Teléfono / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ej. 11-4567-8910"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-mono focus:ring-2 focus:ring-lime-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Rubro / Categoría *</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Lácteos, Bebidas, Almacén..."
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:ring-2 focus:ring-lime-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Email Comercial</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="pedidos@proveedor.com"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:ring-2 focus:ring-lime-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Días de Reparto / Entrega</label>
                  <input
                    type="text"
                    value={formData.deliveryDays}
                    onChange={(e) => setFormData({ ...formData, deliveryDays: e.target.value })}
                    placeholder="Ej. Martes y Jueves"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:ring-2 focus:ring-lime-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Plazo de Entrega (Días)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-bold focus:ring-2 focus:ring-lime-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Dirección / Planta</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Calle, Número, Localidad..."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:ring-2 focus:ring-lime-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Condiciones Comerciales / Notas</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Monto mínimo de pedido, descuentos por pronto pago..."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:ring-2 focus:ring-lime-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-bold text-zinc-400 hover:bg-zinc-900 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-black text-black bg-lime-400 hover:bg-lime-300 rounded-xl shadow-lg shadow-lime-400/20 cursor-pointer"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar Eliminación */}
      <ConfirmModal
        isOpen={!!supplierToDelete}
        title="¿Eliminar este proveedor?"
        message={`Estás por eliminar a "${supplierToDelete?.name}". Los productos existentes conservarán su historial.`}
        confirmText="Eliminar Proveedor"
        isDestructive={true}
        onConfirm={async () => {
          if (supplierToDelete) {
            await deleteSupplier(supplierToDelete.id);
            setSupplierToDelete(null);
          }
        }}
        onCancel={() => setSupplierToDelete(null)}
      />
    </div>
  );
};
