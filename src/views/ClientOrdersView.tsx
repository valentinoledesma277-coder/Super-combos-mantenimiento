import React, { useState, useMemo } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { ClientOrder, CartItem, PaymentMethod } from '../types';
import { formatCurrency, formatDateTime, formatDate } from '../utils/formatters';
import { downloadExcelSheet } from '../utils/excelExport';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  CalendarDays,
  Plus,
  Search,
  PackageCheck,
  Phone,
  FileSpreadsheet,
  X,
  ClipboardList,
  Edit,
  Trash2,
  FileText,
  User,
} from 'lucide-react';

interface ClientOrdersViewProps {
  onOpenTicket?: (sale: any) => void;
}

export const ClientOrdersView: React.FC<ClientOrdersViewProps> = ({ onOpenTicket }) => {
  const { state, addOrder, updateOrder, updateOrderStatus, updateOrderPayment, deliverOrderAsSale, deleteOrder } =
    useSupermarket();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<ClientOrder | null>(null);

  // Modal para editar la anotación de lo que lleva un pedido existente
  const [editingCarriedOrder, setEditingCarriedOrder] = useState<ClientOrder | null>(null);
  const [editedDescriptionText, setEditedDescriptionText] = useState('');

  // Formulario Nuevo Pedido
  const [customerId, setCustomerId] = useState<string>('');
  const [customCustomerName, setCustomCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    return new Date(Date.now() + 24 * 3600000).toISOString().split('T')[0];
  });
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<string>('17:00 a 19:00 hs');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transferencia');
  const [initialPayment, setInitialPayment] = useState<string>('0');
  const [orderNotes, setOrderNotes] = useState<string>('');
  
  // Campo clave pedido por el usuario: anotación detallada de lo que lleva el pedido
  const [itemsDescription, setItemsDescription] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('');

  // Artículos opcionales seleccionados del catálogo
  const [orderCart, setOrderCart] = useState<CartItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedItemIsCombo, setSelectedItemIsCombo] = useState<boolean>(true);
  const [selectedItemQty, setSelectedItemQty] = useState<number>(1);

  // Total calculado
  const cartSubtotal = useMemo(() => {
    return orderCart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [orderCart]);

  const orderTotal = useMemo(() => {
    if (cartSubtotal > 0) return cartSubtotal;
    const manualVal = parseFloat(manualAmount) || 0;
    return manualVal;
  }, [cartSubtotal, manualAmount]);

  // Lista de pedidos filtrados y ordenados por fecha de entrega
  const filteredOrders = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return (state.orders || [])
      .filter((o) => {
        const matchTerm =
          !term ||
          o.orderNumber.toLowerCase().includes(term) ||
          o.customerName.toLowerCase().includes(term) ||
          (o.customerPhone && o.customerPhone.toLowerCase().includes(term)) ||
          (o.itemsDescription && o.itemsDescription.toLowerCase().includes(term)) ||
          o.items.some((it) => it.name.toLowerCase().includes(term));

        const matchStatus = statusFilter === 'todos' || o.status === statusFilter;
        return matchTerm && matchStatus;
      })
      .sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime());
  }, [state.orders, searchTerm, statusFilter]);

  // Agregar artículo al carrito del pedido
  const handleAddItemToOrder = () => {
    if (!selectedItemId) return;

    if (selectedItemIsCombo) {
      const combo = state.combos.find((c) => c.id === selectedItemId);
      if (!combo) return;
      const newItem: CartItem = {
        id: `item-${Date.now()}`,
        comboId: combo.id,
        isCombo: true,
        code: combo.code,
        name: combo.name,
        unitPrice: combo.salePrice,
        costPrice: 0,
        quantity: selectedItemQty,
        subtotal: combo.salePrice * selectedItemQty,
        comboItems: combo.items,
      };
      setOrderCart((prev) => [...prev, newItem]);
      // Si la descripción está vacía, agregarla amigablemente
      setItemsDescription((prev) => {
        const itemLine = `${selectedItemQty}x ${combo.name}`;
        return prev ? `${prev}\n${itemLine}` : itemLine;
      });
    } else {
      const prod = state.products.find((p) => p.id === selectedItemId);
      if (!prod) return;
      const newItem: CartItem = {
        id: `item-${Date.now()}`,
        productId: prod.id,
        isCombo: false,
        code: prod.code,
        name: prod.name,
        unitPrice: prod.salePrice,
        costPrice: prod.costPrice,
        quantity: selectedItemQty,
        subtotal: prod.salePrice * selectedItemQty,
      };
      setOrderCart((prev) => [...prev, newItem]);
      setItemsDescription((prev) => {
        const itemLine = `${selectedItemQty}x ${prod.name}`;
        return prev ? `${prev}\n${itemLine}` : itemLine;
      });
    }

    setSelectedItemId('');
    setSelectedItemQty(1);
  };

  const handleRemoveItem = (id: string) => {
    setOrderCart((prev) => prev.filter((i) => i.id !== id));
  };

  const handleOpenModal = () => {
    setCustomerId('');
    setCustomCustomerName('');
    setCustomerPhone('');
    setDeliveryDate(new Date(Date.now() + 24 * 3600000).toISOString().split('T')[0]);
    setDeliveryTimeSlot('17:00 a 19:00 hs');
    setPaymentMethod('transferencia');
    setInitialPayment('0');
    setOrderNotes('');
    setItemsDescription('');
    setManualAmount('');
    setOrderCart([]);
    setIsModalOpen(true);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que tenga descripción de lo que lleva o artículos en carrito
    if (!itemsDescription.trim() && orderCart.length === 0) {
      alert('Por favor anota lo que lleva el pedido o selecciona productos/combos.');
      return;
    }

    let finalCustomerName = customCustomerName.trim();
    let finalPhone = customerPhone.trim();

    if (customerId) {
      const found = state.customers.find((c) => c.id === customerId);
      if (found) {
        finalCustomerName = found.name;
        finalPhone = found.phone || finalPhone;
      }
    }

    if (!finalCustomerName) {
      finalCustomerName = 'Cliente Precedente';
    }

    const paidVal = parseFloat(initialPayment) || 0;
    const finalTotal = orderTotal > 0 ? orderTotal : (parseFloat(manualAmount) || 0);

    const paymentStatus =
      paidVal >= finalTotal && finalTotal > 0 ? 'pagado' : paidVal > 0 ? 'parcial' : 'pendiente';

    // Si no cargó carrito formal, crear ítem genérico representativo
    let finalItems = orderCart;
    if (finalItems.length === 0) {
      finalItems = [
        {
          id: `item-gen-${Date.now()}`,
          isCombo: false,
          code: 'ENCARGO',
          name: itemsDescription.slice(0, 40) || 'Pedido Personalizado',
          unitPrice: finalTotal,
          costPrice: 0,
          quantity: 1,
          subtotal: finalTotal,
        },
      ];
    }

    await addOrder({
      customerId: customerId || `temp-cust-${Date.now()}`,
      customerName: finalCustomerName,
      customerPhone: finalPhone || undefined,
      deliveryDate,
      deliveryTimeSlot: deliveryTimeSlot || undefined,
      status: 'pendiente',
      items: finalItems,
      total: finalTotal,
      paidAmount: paidVal,
      paymentStatus,
      paymentMethod,
      itemsDescription: itemsDescription.trim() || undefined,
      notes: orderNotes.trim() || undefined,
      isComboOrder: finalItems.some((it) => it.isCombo),
    });

    setIsModalOpen(false);
  };

  // Guardar edición rápida de lo que lleva el pedido
  const handleSaveEditedDescription = async () => {
    if (!editingCarriedOrder) return;
    await updateOrder(editingCarriedOrder.id, {
      itemsDescription: editedDescriptionText.trim(),
    });
    setEditingCarriedOrder(null);
  };

  // Despachar / Entregar pedido
  const handleDeliverOrder = async (order: ClientOrder) => {
    const res = await deliverOrderAsSale(order.id);
    if (res.success && res.sale && onOpenTicket) {
      onOpenTicket(res.sale);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      'N° Pedido',
      'Cliente',
      'Teléfono',
      'Fecha Entrega',
      'Horario',
      'Estado Pedido',
      'Total (ARS)',
      'Seña / Pagado (ARS)',
      'Estado Pago',
      'Lo Que Lleva',
      'Notas',
    ];
    const rows = filteredOrders.map((o) => [
      o.orderNumber,
      o.customerName,
      o.customerPhone || '',
      o.deliveryDate,
      o.deliveryTimeSlot || '',
      o.status.toUpperCase(),
      o.total,
      o.paidAmount,
      o.paymentStatus.toUpperCase(),
      o.itemsDescription || o.items.map((i) => `${i.quantity}x ${i.name}`).join(' | '),
      o.notes || '',
    ]);
    downloadExcelSheet('Cronograma_Pedidos_SuperCombos.xlsx', 'Pedidos', headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal - Black & Lime */}
      <div className="bg-zinc-950 p-5 sm:p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-lime-400 text-black flex items-center justify-center font-black shadow-md shadow-lime-400/20">
              <CalendarDays className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Cronograma de Pedidos de Clientes Precedentes
              </h2>
              <span className="text-[11px] font-mono text-lime-400">
                Anotación de lo que lleva cada encargo • Señas, horarios y despacho como venta facturada
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2 max-w-2xl leading-relaxed">
            Registra los encargos de tus clientes, anota exactamente qué productos o combos incluye cada pedido, gestiona anticipos/señas y despáchalos con un clic generando su comprobante.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold border border-zinc-800 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-lime-400" />
            <span>Exportar Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-lime-400 hover:bg-lime-300 text-black rounded-xl text-xs font-black shadow-lg shadow-lime-400/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Programar Pedido</span>
          </button>
        </div>
      </div>

      {/* Filtros de Cronograma */}
      <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, N° pedido, lo que lleva o producto..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 focus:outline-hidden focus:border-lime-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 focus:border-lime-400 focus:outline-hidden"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="en_preparacion">En preparación</option>
            <option value="listo">Listos para entrega</option>
            <option value="entregado">Entregados</option>
          </select>
          <span className="text-xs font-mono font-bold text-zinc-400 whitespace-nowrap">
            Pedidos: <strong className="text-lime-400">{filteredOrders.length}</strong>
          </span>
        </div>
      </div>

      {/* Grid de Cronograma de Pedidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full py-16 text-center text-zinc-500 text-xs bg-zinc-950 rounded-2xl border border-dashed border-zinc-800">
            No se registran pedidos programados con ese criterio de búsqueda.
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isToday =
              order.deliveryDate === new Date().toISOString().split('T')[0];
            const isDelivered = order.status === 'entregado';

            return (
              <div
                key={order.id}
                className={`bg-zinc-950 rounded-2xl border shadow-xl p-5 flex flex-col justify-between transition-all duration-200 relative group ${
                  isToday && !isDelivered
                    ? 'border-lime-400/80 shadow-lime-950/30'
                    : 'border-zinc-800/90 hover:border-lime-400/40'
                }`}
              >
                <div>
                  {/* Encabezado */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-900">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-lime-400">
                          {order.orderNumber}
                        </span>
                        {isToday && !isDelivered && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-lime-400 text-black uppercase animate-pulse font-mono">
                            ¡Entrega Hoy!
                          </span>
                        )}
                      </div>
                      <h4 className="font-black text-base text-white mt-1 leading-snug group-hover:text-lime-400 transition-colors">
                        {order.customerName}
                      </h4>
                      {order.customerPhone && (
                        <p className="text-xs text-zinc-400 font-mono mt-0.5 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-lime-400" />
                          <span>{order.customerPhone}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Selector rápido de estado */}
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value as any)}
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border focus:outline-hidden cursor-pointer font-mono ${
                          order.status === 'entregado'
                            ? 'bg-zinc-900 text-zinc-400 border-zinc-700'
                            : order.status === 'listo'
                            ? 'bg-lime-400 text-black border-lime-400'
                            : order.status === 'en_preparacion'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                            : 'bg-zinc-900 text-zinc-300 border-zinc-800'
                        }`}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_preparacion">En Preparación</option>
                        <option value="listo">Listo</option>
                        <option value="entregado">Entregado</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setOrderToDelete(order)}
                        title="Eliminar pedido"
                        className="p-1 text-zinc-600 hover:text-red-400 rounded-lg hover:bg-red-950/20 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Fecha de Entrega y Turno */}
                  <div className="my-3 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1 font-mono">
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-500 flex items-center gap-1 text-[11px]">
                        <CalendarDays className="w-3.5 h-3.5 text-lime-400" />
                        Fecha de Entrega:
                      </span>
                      <strong className="text-white">{formatDate(order.deliveryDate)}</strong>
                    </div>
                    {order.deliveryTimeSlot && (
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Horario pactado:</span>
                        <span className="text-lime-300 font-bold">{order.deliveryTimeSlot}</span>
                      </div>
                    )}
                  </div>

                  {/* SECCIÓN DESTACADA: Lo que lleva el pedido (Requerimiento clave del usuario) */}
                  <div className="my-3 p-3 rounded-xl bg-lime-400/10 border border-lime-400/30 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase text-lime-400 tracking-wider flex items-center gap-1.5 font-mono">
                        <ClipboardList className="w-3.5 h-3.5 stroke-[2.5]" />
                        Lo que lleva el pedido:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCarriedOrder(order);
                          setEditedDescriptionText(order.itemsDescription || order.items.map((i) => `${i.quantity}x ${i.name}`).join('\n'));
                        }}
                        className="text-[10px] text-zinc-400 hover:text-lime-400 font-bold flex items-center gap-0.5 cursor-pointer transition-colors"
                      >
                        <Edit className="w-3 h-3" />
                        Editar
                      </button>
                    </div>
                    <p className="text-zinc-100 font-medium whitespace-pre-line leading-relaxed text-xs">
                      {order.itemsDescription || (order.items.length > 0
                        ? order.items.map((i) => `${i.quantity}x ${i.name}`).join(' • ')
                        : 'Sin detalle anotado')}
                    </p>
                  </div>

                  {/* Lista de ítems si están cargados individualmente */}
                  {order.items.length > 0 && (
                    <div className="space-y-1 py-1 text-xs">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">
                        Detalle valorizado:
                      </span>
                      <ul className="space-y-1 text-zinc-300">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between items-center text-xs py-0.5">
                            <span className="truncate max-w-[200px]">
                              <strong className="text-lime-400 font-mono">{item.quantity}x</strong> {item.name}
                            </span>
                            <span className="font-mono text-zinc-400 font-bold">
                              {formatCurrency(item.subtotal)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {order.notes && (
                    <p className="mt-2 text-[11px] text-zinc-400 italic bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-900">
                      "{order.notes}"
                    </p>
                  )}
                </div>

                {/* Footer de Pago y Acción de Entrega */}
                <div className="mt-4 pt-3 border-t border-zinc-900 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">TOTAL PEDIDO</span>
                      <span className="text-lg font-black text-lime-400">
                        {formatCurrency(order.total)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 block">
                        Seña: {formatCurrency(order.paidAmount)}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          order.paymentStatus === 'pagado'
                            ? 'bg-lime-400/20 text-lime-400 border border-lime-400/40'
                            : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        }`}
                      >
                        {order.paymentStatus === 'pagado'
                          ? 'Pagado Completo'
                          : `Resta ${formatCurrency(order.total - order.paidAmount)}`}
                      </span>
                    </div>
                  </div>

                  {/* Botón Despachar como Venta Facturada */}
                  {order.status !== 'entregado' && (
                    <button
                      type="button"
                      onClick={() => handleDeliverOrder(order)}
                      className="w-full py-2.5 bg-lime-400 hover:bg-lime-300 text-black rounded-xl text-xs font-black shadow-lg shadow-lime-400/20 flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <PackageCheck className="w-4 h-4 stroke-[2.5]" />
                      <span>Despachar & Emitir Ticket</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Programar Nuevo Pedido */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-950 p-6 shadow-2xl border border-zinc-800 space-y-4 my-6 text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-lime-400 text-black flex items-center justify-center font-black">
                  <CalendarDays className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="font-black text-base text-white">
                  Programar Encargo / Pedido de Cliente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-4 text-xs">
              {/* Cliente */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">
                    Seleccionar Cliente Frecuente
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setCustomerId(id);
                      const c = state.customers.find((cust) => cust.id === id);
                      if (c) {
                        setCustomCustomerName(c.name);
                        setCustomerPhone(c.phone || '');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:border-lime-400 focus:outline-hidden"
                  >
                    <option value="">Cliente Ocasional / Manual</option>
                    {state.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">
                    Nombre del Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={customCustomerName}
                    onChange={(e) => setCustomCustomerName(e.target.value)}
                    placeholder="Ej. Juan Gómez"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-bold focus:border-lime-400 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">
                  Teléfono de Contacto / WhatsApp
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Ej. 11-5544-3322"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-mono focus:border-lime-400 focus:outline-hidden"
                />
              </div>

              {/* Fecha y Horario de Entrega */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">
                    Fecha de Entrega Programada *
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-mono font-bold focus:border-lime-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Horario o Franja</label>
                  <input
                    type="text"
                    value={deliveryTimeSlot}
                    onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                    placeholder="Ej. 10:00 a 12:00 hs"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:border-lime-400 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* CAMPO SOLICITADO: Anotar lo que lleva el pedido */}
              <div className="p-3 bg-zinc-900/90 rounded-xl border border-lime-400/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-black text-lime-400 uppercase tracking-wide text-[10px] flex items-center gap-1 font-mono">
                    <ClipboardList className="w-3.5 h-3.5" />
                    ¿Qué lleva el pedido? (Anotación clara de lo que encarga) *
                  </label>
                  <span className="text-[10px] text-zinc-400">Detalle libre</span>
                </div>
                <textarea
                  rows={3}
                  required
                  value={itemsDescription}
                  onChange={(e) => setItemsDescription(e.target.value)}
                  placeholder="Ej. 2 Super Combos Asado, 1 gaseosa Coca-Cola 2.25L fría, 1kg de pan criollo crocante, 1 paquete de servilletas..."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-white font-medium focus:border-lime-400 focus:outline-hidden placeholder-zinc-500 text-xs"
                />
              </div>

              {/* Agregar Artículos (Combos o Productos Opcionales para Total) */}
              <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-300 text-xs">
                    Agregar Productos o Super Combos al Pedido
                  </span>
                  <div className="flex gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemIsCombo(true);
                        setSelectedItemId('');
                      }}
                      className={`px-2.5 py-0.5 rounded-lg font-bold ${
                        selectedItemIsCombo
                          ? 'bg-lime-400 text-black'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      Combos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemIsCombo(false);
                        setSelectedItemId('');
                      }}
                      className={`px-2.5 py-0.5 rounded-lg font-bold ${
                        !selectedItemIsCombo
                          ? 'bg-lime-400 text-black'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      Productos
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-white text-xs"
                  >
                    <option value="">
                      {selectedItemIsCombo ? 'Seleccionar Combo...' : 'Seleccionar Producto...'}
                    </option>
                    {selectedItemIsCombo
                      ? state.combos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({formatCurrency(c.salePrice)})
                          </option>
                        ))
                      : state.products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatCurrency(p.salePrice)})
                          </option>
                        ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={selectedItemQty}
                    onChange={(e) => setSelectedItemQty(parseInt(e.target.value, 10) || 1)}
                    className="w-16 px-2 py-2 text-center rounded-xl border border-zinc-800 bg-zinc-950 text-white font-mono font-bold"
                  />

                  <button
                    type="button"
                    onClick={handleAddItemToOrder}
                    className="px-3.5 py-2 bg-lime-400 text-black rounded-xl font-black hover:bg-lime-300 cursor-pointer"
                  >
                    Sumar
                  </button>
                </div>

                {/* Lista de ítems en el pedido */}
                {orderCart.length > 0 && (
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1 divide-y divide-zinc-800 pt-1">
                    {orderCart.map((item) => (
                      <div key={item.id} className="pt-1.5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-200 truncate max-w-[240px]">
                          <strong>{item.quantity}x</strong> {item.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lime-400 font-bold">
                            {formatCurrency(item.subtotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-zinc-500 hover:text-red-400 p-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Monto Total & Seña */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                <div>
                  <label className="font-black text-lime-400 block mb-1 uppercase tracking-wide text-[10px]">
                    Total del Pedido (ARS) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={cartSubtotal > 0 ? cartSubtotal : (manualAmount || '')}
                    disabled={cartSubtotal > 0}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-lime-400 font-mono font-black text-sm disabled:opacity-80"
                  />
                </div>
                <div>
                  <label className="font-black text-zinc-300 block mb-1 uppercase tracking-wide text-[10px]">
                    Seña / Adelanto (ARS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={initialPayment}
                    onChange={(e) => setInitialPayment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-white font-mono font-bold text-sm"
                  />
                </div>
              </div>

              {/* Medio de Pago para el Adelanto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">
                    Medio de Pago del Adelanto
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                  >
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="debito">Tarjeta Débito</option>
                    <option value="credito">Tarjeta Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">
                    Notas adicionales de entrega
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Ej. Tocar timbre 3B..."
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-bold text-zinc-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-black text-black bg-lime-400 hover:bg-lime-300 rounded-xl shadow-lg shadow-lime-400/20 cursor-pointer"
                >
                  Confirmar y Guardar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rápido para Editar "Lo que lleva el pedido" */}
      {editingCarriedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 p-6 shadow-2xl border border-zinc-800 space-y-4 text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-lime-400" />
                <h3 className="font-black text-sm text-white">
                  Editar lo que lleva • {editingCarriedOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCarriedOrder(null)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 block">
                Anotación de lo que lleva el cliente:
              </label>
              <textarea
                rows={4}
                value={editedDescriptionText}
                onChange={(e) => setEditedDescriptionText(e.target.value)}
                className="w-full p-3 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white font-medium focus:border-lime-400 focus:outline-hidden"
                placeholder="Escribe exactamente los productos, combos o requerimientos..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingCarriedOrder(null)}
                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditedDescription}
                className="px-4 py-2 text-xs font-black text-black bg-lime-400 hover:bg-lime-300 rounded-xl shadow-md"
              >
                Guardar Anotación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar Eliminación */}
      <ConfirmModal
        isOpen={!!orderToDelete}
        title="¿Eliminar este pedido programado?"
        message={`Estás por eliminar el pedido ${orderToDelete?.orderNumber} de ${orderToDelete?.customerName}. Esta acción no se puede deshacer.`}
        confirmText="Eliminar Pedido"
        isDestructive={true}
        onConfirm={async () => {
          if (orderToDelete) {
            await deleteOrder(orderToDelete.id);
            setOrderToDelete(null);
          }
        }}
        onCancel={() => setOrderToDelete(null)}
      />
    </div>
  );
};
