import React, { useState, useMemo } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { Customer, Sale } from '../types';
import { formatCurrency, formatDateTime, formatDate } from '../utils/formatters';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Calendar,
  ShoppingBag,
  DollarSign,
  Edit,
  Trash2,
  Receipt,
  X,
  Award,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface CustomersViewProps {
  onStartSaleForCustomer?: (customer: Customer) => void;
  onOpenTicket?: (sale: Sale) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  onStartSaleForCustomer,
  onOpenTicket,
}) => {
  const { state, addCustomer, updateCustomer, deleteCustomer } = useSupermarket();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Ficha detallada de cliente
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  // Formulario
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });

  // Clientes ordenados por gasto (los que más compran primero)
  const sortedAndFilteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return state.customers
      .filter((c) => {
        return (
          !term ||
          c.name.toLowerCase().includes(term) ||
          c.phone.toLowerCase().includes(term) ||
          (c.address && c.address.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
  }, [state.customers, searchTerm]);

  // Historial de compras del cliente seleccionado en la ficha
  const customerSales = useMemo(() => {
    if (!viewingCustomer) return [];
    return state.sales.filter(
      (s) => s.customerId === viewingCustomer.id && s.status === 'completed'
    );
  }, [viewingCustomer, state.sales]);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        address: customer.address || '',
        notes: customer.notes || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        phone: '',
        address: '',
        notes: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });
    } else {
      await addCustomer({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal - Black & Lime */}
      <div className="bg-zinc-950 p-5 sm:p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-lime-400 text-black flex items-center justify-center font-black shadow-md shadow-lime-400/20">
              <Users className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Clientes Frecuentes & Fidelización
              </h2>
              <span className="text-[11px] font-mono text-lime-400">
                {state.customers.length} clientes registrados • Ranking por volumen de compra
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2 max-w-2xl leading-relaxed">
            Administra los datos comerciales de tus compradores, conoce su historial de tickets, volumen de compras y asócialos rápidamente al punto de venta o a los pedidos programados.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-lime-400 hover:bg-lime-300 text-black font-black rounded-xl text-xs shadow-lg shadow-lime-400/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Registrar Cliente</span>
        </button>
      </div>

      {/* Buscador & Métricas */}
      <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, teléfono o dirección..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 focus:outline-hidden focus:border-lime-400 font-medium"
          />
        </div>
        <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
          <span>Total en Cartera:</span>
          <span className="text-lime-400 font-black">{state.customers.length}</span>
        </div>
      </div>

      {/* Grid de Fichas de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sortedAndFilteredCustomers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-zinc-500 text-xs bg-zinc-950 rounded-2xl border border-dashed border-zinc-800">
            No se encontraron clientes registrados con ese criterio.
          </div>
        ) : (
          sortedAndFilteredCustomers.map((customer, idx) => {
            const isTopBuyer = idx < 3 && customer.totalSpent > 0;

            return (
              <div
                key={customer.id}
                className="bg-zinc-950 rounded-2xl border border-zinc-800/90 shadow-sm p-5 hover:border-lime-400/50 hover:shadow-xl hover:shadow-lime-950/20 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Encabezado con medalla de Top Buyer */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-900">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-lime-400 flex items-center justify-center font-black text-sm group-hover:border-lime-400/40">
                        {customer.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-black text-sm text-white leading-tight group-hover:text-lime-400 transition-colors">
                            {customer.name}
                          </h4>
                          {isTopBuyer && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full bg-lime-400/15 text-lime-400 border border-lime-400/30 font-black flex items-center gap-1 font-mono"
                              title="Cliente frecuente con mayor volumen de compra"
                            >
                              <Award className="w-3 h-3 text-lime-400" />
                              Top #{idx + 1}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5 font-mono">
                          <Calendar className="w-3 h-3" />
                          Alta: {formatDate(customer.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenModal(customer)}
                        className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
                        title="Editar cliente"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerToDelete(customer)}
                        className="p-1.5 text-zinc-600 hover:text-red-400 rounded-lg hover:bg-red-950/20 transition-colors cursor-pointer"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Datos de contacto */}
                  <div className="py-3 space-y-1.5 text-xs text-zinc-300">
                    {customer.phone && (
                      <p className="flex items-center gap-2 font-mono text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-lime-400" />
                        <span className="text-zinc-200">{customer.phone}</span>
                      </p>
                    )}
                    {customer.address && (
                      <p className="flex items-center gap-2 truncate text-[11px] text-zinc-400">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{customer.address}</span>
                      </p>
                    )}
                    {customer.notes && (
                      <p className="text-[11px] text-zinc-400 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-900 italic">
                        "{customer.notes}"
                      </p>
                    )}
                  </div>

                  {/* Estadísticas de Compra */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-mono">Total Gastado</span>
                      <span className="font-black text-lime-400 text-sm font-mono">
                        {formatCurrency(customer.totalSpent || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-mono">Operaciones</span>
                      <span className="font-bold text-white text-sm font-mono">
                        {customer.purchaseCount || 0} compras
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones de la Tarjeta */}
                <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingCustomer(customer)}
                    className="text-xs font-bold text-zinc-400 hover:text-lime-400 transition-colors cursor-pointer"
                  >
                    Ver Historial ({customer.purchaseCount || 0})
                  </button>

                  {onStartSaleForCustomer && (
                    <button
                      type="button"
                      onClick={() => onStartSaleForCustomer(customer)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-lime-400 hover:bg-lime-300 text-black font-black rounded-xl text-xs transition shadow-sm cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Nueva Venta</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Ficha Completa con Historial de Compras */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-4 my-6 text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-lime-400 text-black flex items-center justify-center font-black">
                  <Receipt className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    Historial de Compras • {viewingCustomer.name}
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {viewingCustomer.phone || 'Sin teléfono'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen Superior */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-center font-mono">
              <div>
                <span className="text-zinc-500 block text-[10px]">Total Acumulado</span>
                <span className="font-black text-sm text-lime-400">
                  {formatCurrency(viewingCustomer.totalSpent)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Ventas Concluidas</span>
                <span className="font-bold text-sm text-white">
                  {viewingCustomer.purchaseCount}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Última Operación</span>
                <span className="font-medium text-xs text-zinc-300">
                  {formatDate(viewingCustomer.lastPurchaseDate) || 'Sin compras'}
                </span>
              </div>
            </div>

            {/* Lista detallada de tickets */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              <span className="font-black text-xs text-zinc-300 block uppercase tracking-wider text-[10px]">
                Comprobantes Emitidos ({customerSales.length}):
              </span>
              {customerSales.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-500">
                  No se registran compras todavía para este cliente.
                </p>
              ) : (
                customerSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-lime-400">
                          {sale.receiptNumber}
                        </span>
                        <span className="text-zinc-500 font-mono text-[11px]">
                          {formatDateTime(sale.date)}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 truncate max-w-[300px]">
                        {sale.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-white text-sm font-mono">
                        {formatCurrency(sale.total)}
                      </span>
                      {onOpenTicket && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewingCustomer(null);
                            onOpenTicket(sale);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-lime-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Ver Ticket"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="px-4 py-2 font-bold text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-4 text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-lime-400 text-black flex items-center justify-center font-black">
                  <Users className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="font-black text-base text-white">
                  {editingCustomer ? 'Editar Ficha de Cliente' : 'Registrar Nuevo Cliente'}
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

            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Nombre y Apellido *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-bold focus:border-lime-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">
                  Número de Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Ej. 11-4567-8910"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-mono focus:border-lime-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Dirección (Opcional)</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ej. Av. San Martín 1420"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:border-lime-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">
                  Observaciones / Preferencias
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Preferencia de pago, horarios para pedidos, etc."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:border-lime-400 focus:outline-hidden"
                />
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
                  className="px-5 py-2 font-black text-black bg-lime-400 hover:bg-lime-300 rounded-xl shadow-lg shadow-lime-400/20 cursor-pointer"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar Eliminación */}
      <ConfirmModal
        isOpen={!!customerToDelete}
        title="¿Eliminar este cliente?"
        message={`Estás por eliminar a "${customerToDelete?.name}". Su historial de compras seguirá existiendo en los reportes financieros.`}
        confirmText="Eliminar Cliente"
        isDestructive={true}
        onConfirm={async () => {
          if (customerToDelete) {
            await deleteCustomer(customerToDelete.id);
            setCustomerToDelete(null);
          }
        }}
        onCancel={() => setCustomerToDelete(null)}
      />
    </div>
  );
};
