import React, { useState, useMemo } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { Expense, ExpenseCategory, PaymentMethod } from '../types';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { downloadExcelSheet } from '../utils/excelExport';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  TrendingDown,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  X,
  Trash2,
  Receipt,
} from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const { state, addExpense, deleteExpense } = useSupermarket();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [selectedMethod, setSelectedMethod] = useState<string>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Formulario Egreso
  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    category: 'Mercadería' as ExpenseCategory,
    paymentMethod: 'efectivo' as PaymentMethod,
    supplier: '',
    notes: '',
  });

  const categories: ExpenseCategory[] = [
    'Mercadería',
    'Proveedores',
    'Sueldos',
    'Servicios',
    'Alquiler',
    'Transporte',
    'Mantenimiento',
    'Impuestos',
    'Otro',
  ];

  // Egresos filtrados
  const filteredExpenses = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return state.expenses.filter((exp) => {
      const matchTerm =
        !term ||
        exp.description.toLowerCase().includes(term) ||
        (exp.supplier && exp.supplier.toLowerCase().includes(term)) ||
        (exp.notes && exp.notes.toLowerCase().includes(term));
      const matchCat = selectedCategory === 'todos' || exp.category === selectedCategory;
      const matchMethod = selectedMethod === 'todos' || exp.paymentMethod === selectedMethod;
      return matchTerm && matchCat && matchMethod;
    });
  }, [state.expenses, searchTerm, selectedCategory, selectedMethod]);

  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [filteredExpenses]);

  const handleOpenModal = () => {
    setFormData({
      description: '',
      amount: 0,
      category: 'Mercadería',
      paymentMethod: 'efectivo',
      supplier: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim() || formData.amount <= 0) return;

    await addExpense({
      description: formData.description.trim(),
      amount: Number(formData.amount),
      category: formData.category,
      paymentMethod: formData.paymentMethod,
      supplier: formData.supplier.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    });

    setIsModalOpen(false);
  };

  const handleExportExcel = () => {
    const headers = ['Fecha y Hora', 'Descripción', 'Categoría', 'Medio de Pago', 'Proveedor', 'Importe (ARS)', 'Notas'];
    const rows = filteredExpenses.map((e) => [
      formatDateTime(e.date),
      e.description,
      e.category,
      e.paymentMethod,
      e.supplier || '',
      e.amount,
      e.notes || '',
    ]);
    downloadExcelSheet('Egresos_SuperCombos.xlsx', 'Egresos', headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Egresos y Gastos de la Empresa
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Control de salidas de dinero: compras de mercadería, sueldos, servicios e impuestos. Se descuenta automáticamente de la caja.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Exportar Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Nuevo Egreso</span>
          </button>
        </div>
      </div>

      {/* Tarjeta de Total Filtrado */}
      <div className="bg-gradient-to-r from-red-900 to-rose-900 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-red-300 uppercase tracking-wider block">
            Total Egresos Filtrados
          </span>
          <span className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5 block">
            {formatCurrency(totalAmount)}
          </span>
          <p className="text-xs text-red-200/80 mt-1">
            {filteredExpenses.length} movimientos de egreso registrados
          </p>
        </div>
        <div className="p-3 bg-white/10 rounded-2xl">
          <TrendingDown className="w-8 h-8 text-red-300" />
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por descripción, proveedor o notas..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
          >
            <option value="todos">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
          >
            <option value="todos">Todos los medios</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="debito">Débito</option>
            <option value="credito">Crédito</option>
          </select>
        </div>
      </div>

      {/* Tabla de Egresos */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Fecha y Hora</th>
                <th className="py-3 px-3">Descripción</th>
                <th className="py-3 px-3">Categoría</th>
                <th className="py-3 px-3">Proveedor</th>
                <th className="py-3 px-3">Medio de Pago</th>
                <th className="py-3 px-3 text-right">Importe</th>
                <th className="py-3 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No hay egresos registrados con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 text-slate-500 font-mono">
                      {formatDateTime(exp.date)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-900 block">{exp.description}</span>
                      {exp.notes && (
                        <span className="text-[11px] text-slate-400 block">{exp.notes}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-red-50 text-red-800">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{exp.supplier || '-'}</td>
                    <td className="py-3 px-3 uppercase font-semibold text-slate-600">
                      {exp.paymentMethod}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-red-600 text-sm">
                      -{formatCurrency(exp.amount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setExpenseToDelete(exp)}
                        className="p-1 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                        title="Eliminar egreso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Egreso */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">
                Registrar Salida de Dinero / Gasto
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Descripción del Gasto *
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej. Pago factura de luz, Compra de bolsas, etc."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Importe (ARS) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={formData.amount || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-black text-red-600 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Categoría *</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as ExpenseCategory })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Método de Pago *</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="efectivo">Efectivo (Caja)</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Proveedor / Beneficiario</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="Ej. Edenor, Distribuidora Litoral..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Detalles del comprobante o factura..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
                >
                  Confirmar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar Eliminación */}
      <ConfirmModal
        isOpen={!!expenseToDelete}
        title="¿Eliminar este egreso?"
        message={`Estás por eliminar el egreso de "${formatCurrency(expenseToDelete?.amount || 0)}". Se recalculará el balance de caja.`}
        confirmText="Eliminar Egreso"
        isDestructive={true}
        onConfirm={async () => {
          if (expenseToDelete) {
            await deleteExpense(expenseToDelete.id);
            setExpenseToDelete(null);
          }
        }}
        onCancel={() => setExpenseToDelete(null)}
      />
    </div>
  );
};
