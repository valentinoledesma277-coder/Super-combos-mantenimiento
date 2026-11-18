import React, { useMemo } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { ActiveTab, Sale } from '../types';
import {
  Coins,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Layers,
  CalendarDays,
  Truck,
  ArrowLeftRight,
  PackageCheck,
  FileSpreadsheet,
} from 'lucide-react';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenTicket: (sale: Sale) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab, onOpenTicket }) => {
  const { state, metrics, exportExcelWorkbook } = useSupermarket();

  // Gráfico de los últimos 7 días
  const chartData = useMemo(() => {
    const days: { label: string; dateStr: string; income: number; expense: number; profit: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('es-AR', { weekday: 'short' });
      const dayNum = d.getDate();
      const label = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum}`;

      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + 86400000;

      const dayIncomes = (state.incomes || [])
        .filter((inc) => {
          const t = new Date(inc.date).getTime();
          return t >= startOfDay && t < endOfDay;
        })
        .reduce((sum, inc) => sum + inc.amount, 0);

      const dayExpenses = (state.expenses || [])
        .filter((exp) => {
          const t = new Date(exp.date).getTime();
          return t >= startOfDay && t < endOfDay;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);

      days.push({
        label,
        dateStr,
        income: dayIncomes,
        expense: dayExpenses,
        profit: Math.max(0, dayIncomes - dayExpenses),
      });
    }

    const maxFinanceValue = Math.max(
      ...days.map((d) => Math.max(d.income, d.expense)),
      1000
    );

    return { days, maxFinanceValue };
  }, [state.incomes, state.expenses]);

  // Top 5 Super Combos y Productos más vendidos
  const topProducts = useMemo(() => {
    const countMap = new Map<string, { name: string; quantity: number; revenue: number; isCombo: boolean }>();

    (state.sales || [])
      .filter((s) => s.status === 'completed')
      .forEach((sale) => {
        sale.items.forEach((item) => {
          const isPriceOnly = item.code === 'PRECIO' || item.code === 'RAPIDO';
          const key = isPriceOnly ? '__price_sales__' : (item.comboId || item.productId || item.name);
          const displayName = isPriceOnly ? 'Cobros por Precio en Caja' : item.name;
          const current = countMap.get(key) || {
            name: displayName,
            quantity: 0,
            revenue: 0,
            isCombo: item.isCombo,
          };
          current.quantity += item.quantity;
          current.revenue += item.subtotal;
          countMap.set(key, current);
        });
      });

    return Array.from(countMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [state.sales]);

  // Pedidos pendientes de entrega para hoy o próximos
  const upcomingOrders = useMemo(() => {
    return (state.orders || [])
      .filter((o) => o.status !== 'entregado' && o.status !== 'cancelado')
      .slice(0, 4);
  }, [state.orders]);

  // Últimas ventas concretadas
  const recentSales = useMemo(() => {
    return (state.sales || []).slice(0, 5);
  }, [state.sales]);

  return (
    <div className="space-y-6">
      {/* Banner Principal Super Combos */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-black p-5 sm:p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-ping" />
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Super Combos • Panel de Gestión
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Sistema simple y práctico: stock, proveedores, pedidos programados, ventas y compras 100% offline.
          </p>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('pos')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-lime-400 hover:bg-lime-300 text-black rounded-xl text-xs font-black shadow-lg shadow-lime-400/20 transition cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
            <span>Terminal POS</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-lime-400 border border-lime-400/30 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <CalendarDays className="w-4 h-4" />
            <span>Pedidos ({metrics.pendingOrdersCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-lime-400" />
            <span>Ingreso Stock</span>
          </button>
          <button
            onClick={() => setActiveTab('cash')}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5 text-lime-400" />
            <span>Arqueo Caja</span>
          </button>
          <button
            type="button"
            onClick={exportExcelWorkbook}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-lime-400 border border-lime-400/40 rounded-xl text-xs font-black transition cursor-pointer"
            title="Descargar plantilla Excel (.xlsx) con toda la información del negocio"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Plantilla Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Grid de Métricas Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Efectivo en Caja */}
        <div
          onClick={() => setActiveTab('cash')}
          className="bg-zinc-950 p-4.5 rounded-2xl border border-zinc-800/90 shadow-xs hover:border-lime-400/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Efectivo en Caja
            </span>
            <div className="p-2 rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20 group-hover:scale-110 transition-transform">
              <Coins className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white tracking-tight">
              {formatCurrency(metrics.cashInDrawer)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            Fondo inicial + ventas en efectivo - compras
          </p>
        </div>

        {/* 2. Ventas del Día */}
        <div
          onClick={() => setActiveTab('finances')}
          className="bg-zinc-950 p-4.5 rounded-2xl border border-zinc-800/90 shadow-xs hover:border-lime-400/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Ventas de Hoy
            </span>
            <div className="p-2 rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-lime-400 tracking-tight">
              {formatCurrency(metrics.todayIncomes)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5 text-lime-400" />
            {metrics.todaySalesCount} ventas registradas
          </p>
        </div>

        {/* 3. Compras & Egresos de Hoy */}
        <div
          onClick={() => setActiveTab('finances')}
          className="bg-zinc-950 p-4.5 rounded-2xl border border-zinc-800/90 shadow-xs hover:border-red-500/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Compras / Gastos Hoy
            </span>
            <div className="p-2 rounded-xl bg-red-400/10 text-red-400 border border-red-400/20 group-hover:scale-110 transition-transform">
              <TrendingDown className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-red-400 tracking-tight">
              {formatCurrency(metrics.todayExpenses)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
            Reposición y proveedores
          </p>
        </div>

        {/* 4. Pedidos Programados */}
        <div
          onClick={() => setActiveTab('orders')}
          className="bg-zinc-950 p-4.5 rounded-2xl border border-zinc-800/90 shadow-xs hover:border-lime-400/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Cronograma Pedidos
            </span>
            <div className="p-2 rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20 group-hover:scale-110 transition-transform">
              <CalendarDays className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white tracking-tight">
              {metrics.pendingOrdersCount}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-lime-400 font-bold">
            Pedidos de clientes por entregar
          </p>
        </div>
      </div>

      {/* Gráfico 7 Días & Super Combos Más Vendidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Comparativo: Ventas vs Compras */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h3 className="font-black text-white text-base">
                Flujo Semanal: Ventas vs. Compras
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Últimos 7 días de actividad</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-lime-400" />
                <span className="text-zinc-300 font-bold">Ventas</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-red-400" />
                <span className="text-zinc-300 font-bold">Compras</span>
              </span>
            </div>
          </div>

          <div className="mt-6 h-56 flex items-end justify-between gap-2 sm:gap-4 px-2">
            {chartData.days.map((d, idx) => {
              const incomeHeight = Math.max(8, (d.income / chartData.maxFinanceValue) * 180);
              const expenseHeight = Math.max(8, (d.expense / chartData.maxFinanceValue) * 180);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-[190px]">
                    <div
                      style={{ height: `${incomeHeight}px` }}
                      className="w-1/2 max-w-[20px] bg-lime-400 hover:bg-lime-300 rounded-t transition-all relative"
                      title={`Ventas ${d.label}: ${formatCurrency(d.income)}`}
                    />
                    <div
                      style={{ height: `${expenseHeight}px` }}
                      className="w-1/2 max-w-[20px] bg-red-400/90 hover:bg-red-300 rounded-t transition-all relative"
                      title={`Compras ${d.label}: ${formatCurrency(d.expense)}`}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-bold text-center truncate w-full">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ránking de Super Combos y Artículos */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h3 className="font-black text-white text-base">
                Combos & Productos Más Vendidos
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Top volumen de despacho</p>
            </div>
            <button
              onClick={() => setActiveTab('combos')}
              className="text-xs font-black text-lime-400 hover:underline cursor-pointer"
            >
              Ver Combos →
            </button>
          </div>

          <div className="mt-4 flex-1 flex flex-col justify-around space-y-3">
            {topProducts.length === 0 ? (
              <div className="py-10 text-center text-zinc-500 text-xs">
                Aún no hay ventas registradas.
              </div>
            ) : (
              topProducts.map((p, idx) => {
                const maxQty = topProducts[0]?.quantity || 1;
                const percentage = Math.round((p.quantity / maxQty) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-zinc-200 truncate max-w-[230px] flex items-center gap-1.5">
                        <span className="text-lime-400 font-black">#{idx + 1}</span>
                        {p.isCombo && (
                          <span className="text-[9px] bg-lime-400/20 text-lime-400 px-1 py-0.2 rounded font-bold">
                            COMBO
                          </span>
                        )}
                        <span>{p.name}</span>
                      </span>
                      <span className="font-black text-white font-mono">
                        {p.quantity} un. ({formatCurrency(p.revenue)})
                      </span>
                    </div>
                    <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        style={{ width: `${percentage}%` }}
                        className="bg-lime-400 h-full rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Pedidos Programados & Últimas Ventas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pedidos Programados Próximos */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-lime-400" />
              <h3 className="font-black text-white text-base">
                Próximas Entregas de Clientes
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('orders')}
              className="text-xs font-black text-lime-400 hover:underline cursor-pointer"
            >
              Ver Cronograma →
            </button>
          </div>

          <div className="mt-3 divide-y divide-zinc-800/80">
            {upcomingOrders.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">
                No hay pedidos pendientes de entrega.
              </p>
            ) : (
              upcomingOrders.map((ord) => (
                <div key={ord.id} className="py-2.5 flex items-center justify-between px-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lime-400 text-xs">
                        {ord.orderNumber}
                      </span>
                      <span className="font-bold text-white text-xs">
                        {ord.customerName}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Entrega: <strong className="text-zinc-200">{ord.deliveryDate}</strong> ({ord.deliveryTimeSlot || 'Sin franja'})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-sm text-white block">
                      {formatCurrency(ord.total)}
                    </span>
                    <span className="text-[10px] font-bold text-lime-400 uppercase">
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Últimas Ventas */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-lime-400" />
              <h3 className="font-black text-white text-base">Últimas Ventas Concretadas</h3>
            </div>
            <button
              onClick={() => setActiveTab('pos')}
              className="text-xs font-black text-lime-400 hover:underline cursor-pointer"
            >
              Terminal POS →
            </button>
          </div>

          <div className="mt-3 divide-y divide-zinc-800/80">
            {recentSales.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">
                No hay ventas registradas todavía.
              </p>
            ) : (
              recentSales.map((sale) => (
                <div
                  key={sale.id}
                  onClick={() => onOpenTicket(sale)}
                  className="py-2.5 flex items-center justify-between hover:bg-zinc-900/60 px-2 rounded-xl transition cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-lime-400">
                        {sale.receiptNumber}
                      </span>
                      <span className="text-xs font-semibold text-zinc-200">
                        {sale.customerName && sale.customerName !== 'Consumidor Final'
                          ? sale.customerName
                          : sale.notes || 'Cobro en Caja'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      {formatDateTime(sale.date)} • {sale.items.length} {sale.items.length === 1 ? 'importe' : 'importes'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-sm text-white block">
                      {formatCurrency(sale.total)}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-lime-400">
                      {sale.paymentMethod}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
