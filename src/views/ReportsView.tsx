import React, { useState, useMemo } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { formatCurrency, formatDateTime, formatDate } from '../utils/formatters';
import { downloadExcelSheet } from '../utils/excelExport';
import {
  BarChart3,
  Calendar,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  ShoppingCart,
  Users,
  Award,
  AlertCircle,
  Package,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { state } = useSupermarket();

  // Filtro de Período: 'hoy' | 'semana' | 'mes' | 'año' | 'personalizado'
  const [period, setPeriod] = useState<'hoy' | 'semana' | 'mes' | 'año' | 'personalizado'>('mes');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Primer día del mes
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Rango de fechas calculado según el período
  const dateRange = useMemo(() => {
    const now = new Date();
    let start = 0;
    let end = Date.now();

    if (period === 'hoy') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      end = start + 86400000;
    } else if (period === 'semana') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // lunes
      start = new Date(now.setDate(diff)).setHours(0, 0, 0, 0);
      end = Date.now();
    } else if (period === 'mes') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      end = Date.now();
    } else if (period === 'año') {
      start = new Date(now.getFullYear(), 0, 1).getTime();
      end = Date.now();
    } else if (period === 'personalizado') {
      start = new Date(startDate).getTime();
      end = new Date(endDate).getTime() + 86400000;
    }

    return { start, end };
  }, [period, startDate, endDate]);

  // Filtrado de Ventas, Ingresos y Egresos en el rango
  const periodSales = useMemo(() => {
    return state.sales.filter((s) => {
      const t = new Date(s.date).getTime();
      return s.status === 'completed' && t >= dateRange.start && t <= dateRange.end;
    });
  }, [state.sales, dateRange]);

  const periodIncomes = useMemo(() => {
    return state.incomes.filter((i) => {
      const t = new Date(i.date).getTime();
      return t >= dateRange.start && t <= dateRange.end;
    });
  }, [state.incomes, dateRange]);

  const periodExpenses = useMemo(() => {
    return state.expenses.filter((e) => {
      const t = new Date(e.date).getTime();
      return t >= dateRange.start && t <= dateRange.end;
    });
  }, [state.expenses, dateRange]);

  // Totales financieros
  const totalIncome = useMemo(() => {
    return periodIncomes.reduce((acc, i) => acc + i.amount, 0);
  }, [periodIncomes]);

  const totalExpense = useMemo(() => {
    return periodExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [periodExpenses]);

  // Costo total de mercadería vendida en el período
  const totalCostOfGoodsSold = useMemo(() => {
    let cost = 0;
    periodSales.forEach((sale) => {
      sale.items.forEach((item) => {
        cost += (item.costPrice || 0) * item.quantity;
      });
    });
    return cost;
  }, [periodSales]);

  // Ganancia Bruta (Ventas - Costo mercadería) y Ganancia Neta (Ingresos - Egresos)
  const grossProfit = Math.max(0, totalIncome - totalCostOfGoodsSold);
  const netProfit = totalIncome - totalExpense;

  // Gastos desglosados por categoría
  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    periodExpenses.forEach((exp) => {
      map.set(exp.category, (map.get(exp.category) || 0) + exp.amount);
    });
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodExpenses]);

  // Ranking de productos más vendidos y menos vendidos
  const productPerformance = useMemo(() => {
    const map = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();

    // Inicializar con todos los productos del inventario
    state.products.forEach((p) => {
      map.set(p.id, { id: p.id, name: p.name, quantity: 0, revenue: 0 });
    });

    periodSales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (item.productId && map.has(item.productId)) {
          const current = map.get(item.productId)!;
          current.quantity += item.quantity;
          current.revenue += item.subtotal;
        } else if (item.isCombo && item.comboItems) {
          item.comboItems.forEach((c) => {
            if (map.has(c.productId)) {
              const current = map.get(c.productId)!;
              current.quantity += c.quantity * item.quantity;
            }
          });
        }
      });
    });

    const all = Array.from(map.values());
    const top = [...all].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const worst = [...all]
      .filter((p) => p.quantity === 0 || p.quantity <= 2)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 5);

    return { top, worst };
  }, [state.products, periodSales]);

  // Clientes con mayor gasto en el período
  const topCustomersInPeriod = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>();

    periodSales.forEach((sale) => {
      if (sale.customerId) {
        const current = map.get(sale.customerId) || {
          name: sale.customerName || 'Cliente',
          count: 0,
          total: 0,
        };
        current.count += 1;
        current.total += sale.total;
        map.set(sale.customerId, current);
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [periodSales]);

  // Exportar informe completo a Excel
  const handleExportReportExcel = () => {
    const headers = ['Métrica / Concepto', 'Valor'];
    const rows = [
      ['Período analizado', period.toUpperCase()],
      ['Cantidad de ventas concretadas', periodSales.length],
      ['Total de Ingresos (ARS)', totalIncome],
      ['Total de Egresos (ARS)', totalExpense],
      ['Costo de mercadería vendida (ARS)', totalCostOfGoodsSold],
      ['Ganancia bruta estimada (ARS)', grossProfit],
      ['Resultado neto del período (ARS)', netProfit],
    ];

    downloadExcelSheet(`Informe_Rendimiento_${period}.xlsx`, 'Informe', headers, rows);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Informes & Estadísticas de Rendimiento
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Análisis de rentabilidad, ventas, rotación de mercadería y control de gastos por períodos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportReportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Exportar Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Selector de Período */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'hoy', label: 'Hoy' },
            { id: 'semana', label: 'Esta Semana' },
            { id: 'mes', label: 'Este Mes' },
            { id: 'año', label: 'Este Año' },
            { id: 'personalizado', label: 'Personalizado' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                period === p.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'personalizado' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50"
            />
            <span className="text-slate-500 font-medium">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>
        )}
      </div>

      {/* Tarjetas KPI del Período */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ingresos */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Ingresos
          </span>
          <div className="mt-1">
            <span className="text-2xl font-black text-emerald-600">
              {formatCurrency(totalIncome)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {periodSales.length} ventas en el período
          </p>
        </div>

        {/* Total Egresos */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Egresos
          </span>
          <div className="mt-1">
            <span className="text-2xl font-black text-red-600">
              {formatCurrency(totalExpense)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {periodExpenses.length} egresos contabilizados
          </p>
        </div>

        {/* Ganancia Bruta Estimada */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Ganancia Bruta
          </span>
          <div className="mt-1">
            <span className="text-2xl font-black text-teal-700">
              {formatCurrency(grossProfit)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Ventas menos costo de mercadería ({formatCurrency(totalCostOfGoodsSold)})
          </p>
        </div>

        {/* Resultado Neto */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Balance Neto Período
          </span>
          <div className="mt-1">
            <span
              className={`text-2xl font-black ${
                netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {formatCurrency(netProfit)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Ingresos totales menos todos los gastos
          </p>
        </div>
      </div>

      {/* Grilla de Desgloses: Gastos por Categoría & Ránking de Productos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gastos por Categoría */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">
              Gastos Desglosados por Categoría
            </h3>
            <div className="mt-4 space-y-3">
              {expensesByCategory.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  No se registran gastos en este período.
                </p>
              ) : (
                expensesByCategory.map((item, idx) => {
                  const percentage = totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-800">{item.category}</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(item.amount)} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percentage}%` }}
                          className="bg-red-400 h-full rounded-full"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Productos Más Vendidos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">
              Top 5 Productos de Mayor Rotación
            </h3>
            <div className="mt-4 space-y-3">
              {productPerformance.top.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  Sin ventas registradas en el período.
                </p>
              ) : (
                productPerformance.top.map((item, idx) => {
                  const maxQty = productPerformance.top[0]?.quantity || 1;
                  const percentage = Math.round((item.quantity / maxQty) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate max-w-[240px]">
                          {idx + 1}. {item.name}
                        </span>
                        <span className="font-bold text-slate-900">
                          {item.quantity} un. ({formatCurrency(item.revenue)})
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percentage}%` }}
                          className="bg-emerald-500 h-full rounded-full"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Productos Menos Vendidos & Clientes Destacados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos Menos Vendidos o Sin Rotación */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-900">
              Productos con Baja o Nula Rotación
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Artículos con escasas ventas que convendría promocionar o liquidar.
          </p>

          <div className="mt-3 divide-y divide-slate-100">
            {productPerformance.worst.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-800 truncate max-w-[240px]">
                  {item.name}
                </span>
                <span className="font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {item.quantity} un. vendidas
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Clientes con Mayor Compra en el Período */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Award className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900">
              Clientes con Mayor Gasto en el Período
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Clientes fidelizados que más aportaron a la facturación del período.
          </p>

          <div className="mt-3 divide-y divide-slate-100">
            {topCustomersInPeriod.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                No hay compras asociadas a clientes frecuentes en este período.
              </p>
            ) : (
              topCustomersInPeriod.map((c, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{c.name}</span>
                    <span className="text-[10px] text-slate-400">{c.count} compras</span>
                  </div>
                  <span className="font-black text-indigo-700 text-sm">
                    {formatCurrency(c.total)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
