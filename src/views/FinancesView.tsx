import React, { useState, useMemo } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { Income, Expense, PaymentMethod, ExpenseCategory } from '../types';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { downloadExcelSheet } from '../utils/excelExport';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  X,
  Trash2,
  Calendar,
  Layers,
  ShoppingBag,
} from 'lucide-react';

export const FinancesView: React.FC = () => {
  const { state, addIncome, addExpense, deleteIncome, deleteExpense } = useSupermarket();

  const [activeTab, setActiveTab] = useState<'all' | 'sales_incomes' | 'purchases_expenses'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('todos');

  // Modales
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; isIncome: boolean; description: string } | null>(null);

  // Formulario Ingreso
  const [incomeForm, setIncomeForm] = useState({
    description: '',
    amount: 0,
    category: 'Venta' as any,
    paymentMethod: 'efectivo' as PaymentMethod,
    notes: '',
  });

  // Formulario Egreso / Compra
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: 0,
    category: 'Mercadería' as ExpenseCategory,
    paymentMethod: 'efectivo' as PaymentMethod,
    supplier: '',
    notes: '',
  });

  // Movimientos unificados
  const allMovements = useMemo(() => {
    const list: {
      id: string;
      date: string;
      description: string;
      amount: number;
      isIncome: boolean;
      category: string;
      method: string;
      supplier?: string;
      isSaleRecord?: boolean;
    }[] = [];

    (state.incomes || []).forEach((inc) => {
      list.push({
        id: inc.id,
        date: inc.date,
        description: inc.description,
        amount: inc.amount,
        isIncome: true,
        category: inc.category,
        method: inc.paymentMethod,
        isSaleRecord: !!inc.saleId,
      });
    });

    (state.expenses || []).forEach((exp) => {
      list.push({
        id: exp.id,
        date: exp.date,
        description: exp.description,
        amount: exp.amount,
        isIncome: false,
        category: exp.category,
        method: exp.paymentMethod,
        supplier: exp.supplier,
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.incomes, state.expenses]);

  // Filtrado
  const filteredMovements = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return allMovements.filter((m) => {
      if (activeTab === 'sales_incomes' && !m.isIncome) return false;
      if (activeTab === 'purchases_expenses' && m.isIncome) return false;

      const matchTerm =
        !term ||
        m.description.toLowerCase().includes(term) ||
        (m.supplier && m.supplier.toLowerCase().includes(term)) ||
        m.category.toLowerCase().includes(term);

      const matchMethod = selectedMethod === 'todos' || m.method === selectedMethod;

      return matchTerm && matchMethod;
    });
  }, [allMovements, activeTab, searchTerm, selectedMethod]);

  // Totales
  const totalIncomes = useMemo(() => {
    return (state.incomes || []).reduce((sum, i) => sum + i.amount, 0);
  }, [state.incomes]);

  const totalExpenses = useMemo(() => {
    return (state.expenses || []).reduce((sum, e) => sum + e.amount, 0);
  }, [state.expenses]);

  const netBalance = totalIncomes - totalExpenses;

  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeForm.description.trim() || incomeForm.amount <= 0) return;
    await addIncome({
      description: incomeForm.description.trim(),
      amount: Number(incomeForm.amount),
      category: incomeForm.category,
      paymentMethod: incomeForm.paymentMethod,
      notes: incomeForm.notes.trim() || undefined,
    });
    setIsIncomeModalOpen(false);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description.trim() || expenseForm.amount <= 0) return;
    await addExpense({
      description: expenseForm.description.trim(),
      amount: Number(expenseForm.amount),
      category: expenseForm.category,
      paymentMethod: expenseForm.paymentMethod,
      supplier: expenseForm.supplier.trim() || undefined,
      notes: expenseForm.notes.trim() || undefined,
    });
    setIsExpenseModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.isIncome) {
      await deleteIncome(itemToDelete.id);
    } else {
      await deleteExpense(itemToDelete.id);
    }
    setItemToDelete(null);
  };

  const handleExportExcel = () => {
    const headers = ['Fecha y Hora', 'Tipo', 'Descripción', 'Categoría', 'Medio de Pago', 'Importe (ARS)', 'Proveedor'];
    const rows = filteredMovements.map((m) => [
      formatDateTime(m.date),
      m.isIncome ? 'INGRESO / VENTA' : 'EGRESO / COMPRA',
      m.description,
      m.category,
      m.method.toUpperCase(),
      m.isIncome ? m.amount : -m.amount,
      m.supplier || '',
    ]);
    downloadExcelSheet('Control_Ventas_y_Compras.xlsx', 'Ventas y Compras', headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-lime-400/10 rounded-xl text-lime-400 border border-lime-400/30">
              <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Control de Ventas & Compras
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Panel unificado y práctico de entradas por ventas y salidas por compras a proveedores.
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
            onClick={() => {
              setIncomeForm({
                description: '',
                amount: 0,
                category: 'Cobro deudas',
                paymentMethod: 'efectivo',
                notes: '',
              });
              setIsIncomeModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-lime-400 border border-lime-400/30 rounded-xl text-xs font-black transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Ingreso Extra</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setExpenseForm({
                description: '',
                amount: 0,
                category: 'Mercadería',
                paymentMethod: 'efectivo',
                supplier: '',
                notes: '',
              });
              setIsExpenseModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-lime-400 hover:bg-lime-300 text-black rounded-xl text-xs font-black shadow-lg shadow-lime-400/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Registrar Compra / Gasto</span>
          </button>
        </div>
      </div>

      {/* 3 Métricas Rápidas: Ventas Totales, Compras y Balance Neto */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Total Ventas & Ingresos
            </span>
            <div className="p-2 bg-lime-400/10 rounded-xl text-lime-400">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-lime-400 tracking-tight">
              {formatCurrency(totalIncomes)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 font-medium">
            {(state.incomes || []).length} operaciones de ingreso
          </p>
        </div>

        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Total Compras & Gastos
            </span>
            <div className="p-2 bg-red-400/10 rounded-xl text-red-400">
              <TrendingDown className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-red-400 tracking-tight">
              {formatCurrency(totalExpenses)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 font-medium">
            {(state.expenses || []).length} pagos a proveedores e insumos
          </p>
        </div>

        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Balance Neto Global
            </span>
            <div className="p-2 bg-zinc-900 rounded-xl text-zinc-300">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                netBalance >= 0 ? 'text-lime-400' : 'text-red-400'
              }`}
            >
              {formatCurrency(netBalance)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 font-medium">
            {netBalance >= 0 ? 'Rendimiento superavitario' : 'Deficitario en el período'}
          </p>
        </div>
      </div>

      {/* Selector de Pestañas & Buscador */}
      <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Pestañas rápidas */}
        <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
              activeTab === 'all'
                ? 'bg-lime-400 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todos ({allMovements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sales_incomes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
              activeTab === 'sales_incomes'
                ? 'bg-lime-400 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Solo Ventas / Ingresos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('purchases_expenses')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
              activeTab === 'purchases_expenses'
                ? 'bg-lime-400 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Solo Compras / Gastos
          </button>
        </div>

        {/* Buscador */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar movimiento..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>

          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300"
          >
            <option value="todos">Todos los pagos</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="debito">Débito</option>
            <option value="credito">Crédito</option>
          </select>
        </div>
      </div>

      {/* Tabla Unificada */}
      <div className="bg-zinc-950 rounded-2xl border border-zinc-800/80 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-900 text-zinc-400 font-bold uppercase border-b border-zinc-800">
              <tr>
                <th className="py-3 px-3">Fecha y Hora</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3">Descripción</th>
                <th className="py-3 px-3">Categoría / Rubro</th>
                <th className="py-3 px-3">Proveedor / Cliente</th>
                <th className="py-3 px-3">Medio de Pago</th>
                <th className="py-3 px-3 text-right">Monto</th>
                <th className="py-3 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-zinc-500">
                    No se encontraron registros financieros.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-zinc-900/60 transition">
                    <td className="py-3 px-3 text-zinc-400 font-mono">
                      {formatDateTime(mov.date)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-black text-[10px] uppercase ${
                          mov.isIncome
                            ? 'bg-lime-400/10 text-lime-400 border border-lime-400/30'
                            : 'bg-red-400/10 text-red-400 border border-red-400/30'
                        }`}
                      >
                        {mov.isIncome ? 'Ingreso / Venta' : 'Egreso / Compra'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">
                      {mov.description}
                    </td>
                    <td className="py-3 px-3 text-zinc-300">
                      {mov.category}
                    </td>
                    <td className="py-3 px-3 text-zinc-400">
                      {mov.supplier || '-'}
                    </td>
                    <td className="py-3 px-3 uppercase font-bold text-zinc-300">
                      {mov.method}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-black text-sm ${
                        mov.isIncome ? 'text-lime-400' : 'text-red-400'
                      }`}
                    >
                      {mov.isIncome ? '+' : '-'} {formatCurrency(mov.amount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {!mov.isSaleRecord && (
                        <button
                          type="button"
                          onClick={() =>
                            setItemToDelete({
                              id: mov.id,
                              isIncome: mov.isIncome,
                              description: mov.description,
                            })
                          }
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-900 transition cursor-pointer"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar Ingreso Extra */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 p-6 shadow-2xl border border-zinc-800 space-y-4 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-black text-base text-white">Registrar Ingreso Manual</h3>
              <button onClick={() => setIsIncomeModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveIncome} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Descripción *</label>
                <input
                  type="text"
                  required
                  value={incomeForm.description}
                  onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                  placeholder="Ej. Cobro de saldo pendiente o aporte"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 font-bold text-white focus:ring-2 focus:ring-lime-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Importe (ARS) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={incomeForm.amount || ''}
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm font-black text-lime-400 rounded-xl border border-zinc-800 bg-zinc-900 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Medio de Pago</label>
                  <select
                    value={incomeForm.paymentMethod}
                    onChange={(e) => setIncomeForm({ ...incomeForm, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Categoría</label>
                  <select
                    value={incomeForm.category}
                    onChange={(e) => setIncomeForm({ ...incomeForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                  >
                    <option value="Venta">Venta</option>
                    <option value="Cobro deudas">Cobro deudas</option>
                    <option value="Inversión">Inversión / Aporte</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsIncomeModalOpen(false)}
                  className="px-4 py-2 font-bold text-zinc-400 hover:bg-zinc-900 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-black text-black bg-lime-400 hover:bg-lime-300 rounded-xl"
                >
                  Guardar Ingreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Compra / Gasto */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 p-6 shadow-2xl border border-zinc-800 space-y-4 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-black text-base text-white">Registrar Compra / Egreso</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Descripción del Gasto o Compra *</label>
                <input
                  type="text"
                  required
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Ej. Compra lácteos La Serenísima o pago flete"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 font-bold text-white focus:ring-2 focus:ring-lime-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Importe (ARS) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={expenseForm.amount || ''}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm font-black text-red-400 rounded-xl border border-zinc-800 bg-zinc-900 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Proveedor / Beneficiario</label>
                  <input
                    type="text"
                    value={expenseForm.supplier}
                    onChange={(e) => setExpenseForm({ ...expenseForm, supplier: e.target.value })}
                    placeholder="Distribuidora..."
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Medio de Pago</label>
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                  >
                    <option value="efectivo">Efectivo (Caja)</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Categoría</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
                >
                  <option value="Mercadería">Mercadería / Reposición</option>
                  <option value="Proveedores">Pago Proveedores</option>
                  <option value="Sueldos">Sueldos</option>
                  <option value="Servicios">Servicios (Luz, Agua, Gas)</option>
                  <option value="Alquiler">Alquiler</option>
                  <option value="Transporte">Transporte / Flete</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Impuestos">Impuestos</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 font-bold text-zinc-400 hover:bg-zinc-900 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-black text-black bg-lime-400 hover:bg-lime-300 rounded-xl"
                >
                  Guardar Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar Eliminación */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title="¿Eliminar este registro financiero?"
        message={`Estás por eliminar "${itemToDelete?.description}". El balance se actualizará.`}
        confirmText="Eliminar"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
