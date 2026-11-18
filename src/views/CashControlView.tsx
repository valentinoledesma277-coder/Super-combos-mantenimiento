import React, { useState, useMemo } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { CashClosure } from '../types';
import {
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Lock,
  History,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Smartphone,
  CreditCard,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export const CashControlView: React.FC = () => {
  const { state, performCashClosure, updateInitialCashDrawer } = useSupermarket();

  // Estados del Arqueo / Cierre de caja
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [isEditInitialOpen, setIsEditInitialOpen] = useState(false);
  const [newInitialAmount, setNewInitialAmount] = useState<string>(
    String(state.currentCashDrawer.initialBalance || 50000)
  );

  // Arqueo físico: conteo de billetes argentinos ($20.000, $10.000, $2.000, $1.000, $500, $200, $100) o entrada libre
  const [billCounts, setBillCounts] = useState<{ [denom: number]: number }>({
    20000: 0,
    10000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    200: 0,
    100: 0,
  });
  const [additionalCoins, setAdditionalCoins] = useState<string>('');
  const [customCashTotal, setCustomCashTotal] = useState<string>('');
  const [useBillBreakdown, setUseBillBreakdown] = useState<boolean>(true);
  const [closureNotes, setClosureNotes] = useState<string>('');
  const [closedByName, setClosedByName] = useState<string>('Cajero / Encargado');
  const [nextInitialBalanceInput, setNextInitialBalanceInput] = useState<string>('50000');

  // Cálculos del turno actual
  const currentOpenedAt = new Date(state.currentCashDrawer.openedAt).getTime();
  const currentIncomes = state.incomes.filter(
    (i) => new Date(i.date).getTime() >= currentOpenedAt
  );
  const currentExpenses = state.expenses.filter(
    (e) => new Date(e.date).getTime() >= currentOpenedAt
  );

  const totalIncomesInTurn = currentIncomes.reduce((acc, i) => acc + i.amount, 0);
  const totalExpensesInTurn = currentExpenses.reduce((acc, e) => acc + e.amount, 0);

  // Desglose por medio de pago en el turno actual
  const cashIncomes = currentIncomes
    .filter((i) => i.paymentMethod === 'efectivo')
    .reduce((acc, i) => acc + i.amount, 0);
  const cashExpenses = currentExpenses
    .filter((e) => e.paymentMethod === 'efectivo')
    .reduce((acc, e) => acc + e.amount, 0);

  const transferIncomes = currentIncomes
    .filter((i) => i.paymentMethod === 'transferencia')
    .reduce((acc, i) => acc + i.amount, 0);

  const cardIncomes = currentIncomes
    .filter((i) => i.paymentMethod === 'debito' || i.paymentMethod === 'credito')
    .reduce((acc, i) => acc + i.amount, 0);

  // Efectivo esperado en el cajón físico
  const expectedCashInDrawer = state.currentCashDrawer.initialBalance + cashIncomes - cashExpenses;

  // Total de dinero contado en el modal de arqueo
  const countedPhysicalCash = useMemo(() => {
    if (!useBillBreakdown) {
      return parseFloat(customCashTotal) || 0;
    }
    let total = 0;
    Object.entries(billCounts).forEach(([denom, count]) => {
      total += Number(denom) * (count || 0);
    });
    total += parseFloat(additionalCoins) || 0;
    return total;
  }, [billCounts, additionalCoins, useBillBreakdown, customCashTotal]);

  const currentDiscrepancy = countedPhysicalCash - expectedCashInDrawer;

  // Actualizar conteo de billete
  const handleBillCountChange = (denom: number, count: number) => {
    setBillCounts((prev) => ({
      ...prev,
      [denom]: Math.max(0, count),
    }));
  };

  const handleOpenClosureModal = () => {
    setBillCounts({
      20000: 0,
      10000: 0,
      2000: 0,
      1000: 0,
      500: 0,
      200: 0,
      100: 0,
    });
    setAdditionalCoins('');
    setCustomCashTotal(String(expectedCashInDrawer));
    setClosureNotes('');
    setNextInitialBalanceInput(String(state.settings.initialBalanceDefault || 50000));
    setIsClosureModalOpen(true);
  };

  const handleConfirmClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    await performCashClosure({
      actualCash: countedPhysicalCash,
      notes: closureNotes.trim() || undefined,
      closedBy: closedByName.trim() || 'Encargado',
      nextInitialBalance: parseFloat(nextInitialBalanceInput) || 50000,
    });
    setIsClosureModalOpen(false);
  };

  const handleSaveInitialBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newInitialAmount) || 0;
    await updateInitialCashDrawer(val);
    setIsEditInitialOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal - Black & Lime */}
      <div className="bg-zinc-950 p-5 sm:p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-lime-400 text-black flex items-center justify-center font-black shadow-md shadow-lime-400/20">
              <Coins className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Caja & Balance Financiero
              </h2>
              <span className="text-[11px] font-mono text-lime-400">
                Turno iniciado: {formatDateTime(state.currentCashDrawer.openedAt)}
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2 max-w-2xl leading-relaxed">
            Monitoreo en tiempo real del dinero en cajón, cuadratura de caja diaria, arqueo de billetes en pesos argentinos y balance entre ventas y egresos.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsEditInitialOpen(true)}
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition border border-zinc-800 cursor-pointer"
          >
            Ajustar Saldo Inicial
          </button>
          <button
            type="button"
            onClick={handleOpenClosureModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-lime-400 hover:bg-lime-300 text-black font-black rounded-xl text-xs shadow-lg shadow-lime-400/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Lock className="w-4 h-4 stroke-[3]" />
            <span>Cierre de Caja (Arqueo)</span>
          </button>
        </div>
      </div>

      {/* Fórmula del Balance: Saldo Inicial + Ingresos - Egresos = Saldo Actual */}
      <div className="bg-zinc-950 border border-zinc-800 text-white p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <span className="text-xs font-black text-lime-400 uppercase tracking-wider font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
            Balance del Turno en Curso
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">
            Saldo Actual = Saldo Inicial + Ventas/Ingresos - Compras/Egresos
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Saldo Inicial */}
          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block font-mono uppercase tracking-wide">
              Saldo Inicial (Apertura)
            </span>
            <span className="text-xl font-black text-zinc-100 mt-1 block font-mono">
              {formatCurrency(state.currentCashDrawer.initialBalance)}
            </span>
          </div>

          {/* Ingresos del Turno */}
          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-lime-400 block font-mono uppercase tracking-wide flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> Total Ingresos / Ventas
            </span>
            <span className="text-xl font-black text-lime-400 mt-1 block font-mono">
              +{formatCurrency(totalIncomesInTurn)}
            </span>
          </div>

          {/* Egresos del Turno */}
          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-red-400 block font-mono uppercase tracking-wide flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" /> Total Compras / Gastos
            </span>
            <span className="text-xl font-black text-red-400 mt-1 block font-mono">
              -{formatCurrency(totalExpensesInTurn)}
            </span>
          </div>

          {/* Saldo Actual Consolidado */}
          <div className="p-4 bg-zinc-900/90 rounded-xl border border-lime-400/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-lime-400/10 rounded-full blur-xl pointer-events-none" />
            <span className="text-[10px] text-lime-400 block font-black uppercase tracking-wide font-mono">
              = Saldo Actual Consolidado
            </span>
            <span className="text-xl font-black text-white mt-1 block font-mono">
              {formatCurrency(
                state.currentCashDrawer.initialBalance + totalIncomesInTurn - totalExpensesInTurn
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Desglose por Medio de Pago en Caja */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Efectivo Físico en Cajón */}
        <div className="bg-zinc-950 p-5 rounded-2xl border-2 border-lime-400/40 shadow-xl relative">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-lime-400/10 border border-lime-400/30 text-lime-400 rounded-xl flex items-center justify-center font-bold">
                <Banknote className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white">Efectivo en Cajón</h4>
                <p className="text-[10px] text-zinc-500 font-mono">Billetes y monedas físicas</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-lime-400 font-mono">
              {formatCurrency(expectedCashInDrawer)}
            </span>
          </div>
          <div className="mt-3 text-[11px] text-zinc-400 space-y-1 pt-3 border-t border-zinc-900 font-mono">
            <div className="flex justify-between">
              <span>Ventas en efectivo:</span>
              <span className="font-bold text-lime-400">+{formatCurrency(cashIncomes)}</span>
            </div>
            <div className="flex justify-between">
              <span>Gastos en efectivo:</span>
              <span className="font-bold text-red-400">-{formatCurrency(cashExpenses)}</span>
            </div>
          </div>
        </div>

        {/* Transferencias / Electrónico */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white">Transferencias</h4>
                <p className="text-[10px] text-zinc-500 font-mono">Bancarias y billeteras</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-white font-mono">
              {formatCurrency(transferIncomes)}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-zinc-500 pt-3 border-t border-zinc-900 font-mono">
            Acreditado directamente en cuentas bancarias.
          </p>
        </div>

        {/* Tarjetas Débito / Crédito */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white">Tarjetas POS</h4>
                <p className="text-[10px] text-zinc-500 font-mono">Terminales Posnet / Débito</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-white font-mono">
              {formatCurrency(cardIncomes)}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-zinc-500 pt-3 border-t border-zinc-900 font-mono">
            Cupones y vouchers de cobro digital.
          </p>
        </div>
      </div>

      {/* Historial de Cierres de Caja Anteriores */}
      <div className="bg-zinc-950 rounded-2xl border border-zinc-800 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-lime-400" />
            <h3 className="font-black text-sm text-white">
              Historial de Cierres y Arqueos Anteriores ({state.cashClosures.length})
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">Auditoría permanente de diferencias</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-900 text-zinc-400 font-bold uppercase border-b border-zinc-800 font-mono text-[10px]">
              <tr>
                <th className="py-3 px-3">Fecha y Hora</th>
                <th className="py-3 px-3">Responsable</th>
                <th className="py-3 px-3 text-right">Saldo Inicial</th>
                <th className="py-3 px-3 text-right">Esperado</th>
                <th className="py-3 px-3 text-right">Contado</th>
                <th className="py-3 px-3 text-center">Cuadratura</th>
                <th className="py-3 px-3 text-right">Total Turno</th>
                <th className="py-3 px-3">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {state.cashClosures.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-zinc-500 font-mono">
                    Aún no se ha registrado ningún cierre de caja.
                  </td>
                </tr>
              ) : (
                state.cashClosures.map((close) => {
                  const hasDiscrepancy = Math.abs(close.discrepancy) > 1;
                  const isPositive = close.discrepancy > 0;

                  return (
                    <tr key={close.id} className="hover:bg-zinc-900/60 transition">
                      <td className="py-3 px-3 font-mono text-zinc-400">
                        {formatDateTime(close.closedAt)}
                      </td>
                      <td className="py-3 px-3 font-bold text-zinc-200">
                        {close.closedBy || 'Encargado'}
                      </td>
                      <td className="py-3 px-3 text-right text-zinc-400 font-mono">
                        {formatCurrency(close.initialBalance)}
                      </td>
                      <td className="py-3 px-3 text-right text-zinc-300 font-mono">
                        {formatCurrency(close.expectedCash)}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-white font-mono">
                        {formatCurrency(close.actualCash)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            !hasDiscrepancy
                              ? 'bg-lime-400/15 text-lime-400 border border-lime-400/30'
                              : isPositive
                              ? 'bg-blue-400/15 text-blue-400 border border-blue-400/30'
                              : 'bg-red-400/15 text-red-400 border border-red-400/30'
                          }`}
                        >
                          {!hasDiscrepancy
                            ? 'Exacto ($0)'
                            : isPositive
                            ? `+${formatCurrency(close.discrepancy)}`
                            : `${formatCurrency(close.discrepancy)}`}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-lime-400 font-mono">
                        {formatCurrency(close.totalIncome)}
                      </td>
                      <td className="py-3 px-3 text-zinc-400 max-w-[200px] truncate">
                        {close.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cierre de Caja / Arqueo en Negro & Verde Lima */}
      {isClosureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-4 my-6 text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-lime-400 text-black flex items-center justify-center font-black">
                  <Calculator className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="font-black text-base text-white">
                  Arqueo Físico & Cierre de Caja
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsClosureModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmClosure} className="space-y-4 text-xs">
              {/* Información esperada por el sistema */}
              <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 grid grid-cols-2 gap-3 text-zinc-300 font-mono">
                <div>
                  <span className="text-[10px] text-zinc-500 block">Saldo Apertura</span>
                  <span className="font-bold text-white">
                    {formatCurrency(state.currentCashDrawer.initialBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block">Efectivo Sistema</span>
                  <span className="font-black text-sm text-lime-400">
                    {formatCurrency(expectedCashInDrawer)}
                  </span>
                </div>
              </div>

              {/* Selector de modo de conteo */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-white">Conteo Físico en Mano</span>
                <button
                  type="button"
                  onClick={() => setUseBillBreakdown(!useBillBreakdown)}
                  className="text-lime-400 font-bold hover:underline cursor-pointer"
                >
                  {useBillBreakdown ? 'Ingresar Monto Total Directo' : 'Desglosar por Billetes ARS'}
                </button>
              </div>

              {useBillBreakdown ? (
                /* Conteo de billetes argentinos */
                <div className="space-y-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                    Cantidad de billetes por denominación:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[20000, 10000, 2000, 1000, 500, 200, 100].map((denom) => (
                      <div
                        key={denom}
                        className="flex items-center justify-between p-2 bg-zinc-950 rounded-lg border border-zinc-800"
                      >
                        <span className="font-bold text-lime-400 font-mono">${denom}</span>
                        <input
                          type="number"
                          min="0"
                          value={billCounts[denom] || ''}
                          onChange={(e) =>
                            handleBillCountChange(denom, parseInt(e.target.value, 10) || 0)
                          }
                          placeholder="0"
                          className="w-16 px-2 py-1 text-right font-mono font-bold bg-zinc-900 text-white border border-zinc-700 rounded focus:border-lime-400 focus:outline-hidden"
                        />
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                      <span className="font-bold text-zinc-400">Monedas / Otros</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={additionalCoins}
                        onChange={(e) => setAdditionalCoins(e.target.value)}
                        placeholder="0.00"
                        className="w-20 px-2 py-1 text-right font-mono font-bold bg-zinc-900 text-white border border-zinc-700 rounded focus:border-lime-400 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Monto directo contado */
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">
                    Dinero Total Contado en Mano (ARS) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={customCashTotal}
                    onChange={(e) => setCustomCashTotal(e.target.value)}
                    className="w-full px-3 py-2.5 text-base font-black text-lime-400 font-mono rounded-xl border border-zinc-800 bg-zinc-900 focus:border-lime-400 focus:outline-hidden"
                  />
                </div>
              )}

              {/* Resultado de la Cuadratura */}
              <div
                className={`p-3.5 rounded-xl border font-mono ${
                  Math.abs(currentDiscrepancy) <= 1
                    ? 'bg-lime-400/10 border-lime-400/40 text-lime-400'
                    : currentDiscrepancy > 0
                    ? 'bg-blue-400/10 border-blue-400/40 text-blue-400'
                    : 'bg-red-400/10 border-red-400/40 text-red-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs">Total Contado Físicamente:</span>
                  <span className="font-black text-sm">{formatCurrency(countedPhysicalCash)}</span>
                </div>
                <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-zinc-800">
                  <span className="font-bold text-xs">Diferencia de Caja:</span>
                  <span className="font-black text-base">
                    {Math.abs(currentDiscrepancy) <= 1
                      ? 'CAJA CUADRADA ($0)'
                      : currentDiscrepancy > 0
                      ? `SOBRANTE: +${formatCurrency(currentDiscrepancy)}`
                      : `FALTANTE: ${formatCurrency(currentDiscrepancy)}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Responsable del Cierre</label>
                  <input
                    type="text"
                    value={closedByName}
                    onChange={(e) => setClosedByName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:border-lime-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">
                    Fondo Próximo Turno (ARS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={nextInitialBalanceInput}
                    onChange={(e) => setNextInitialBalanceInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-mono font-bold focus:border-lime-400 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  placeholder="Detalles sobre diferencias o billetes guardados en caja fuerte..."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:border-lime-400 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsClosureModalOpen(false)}
                  className="px-4 py-2 font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-black text-black bg-lime-400 hover:bg-lime-300 rounded-xl shadow-lg shadow-lime-400/20 cursor-pointer"
                >
                  Confirmar y Guardar Cierre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajustar Saldo Inicial */}
      {isEditInitialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-4 text-zinc-100">
            <h3 className="font-black text-base text-white">
              Modificar Saldo Inicial del Turno
            </h3>
            <form onSubmit={handleSaveInitialBalance} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">
                  Monto de Apertura de Caja (ARS)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={newInitialAmount}
                  onChange={(e) => setNewInitialAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-lime-400 font-mono font-black text-lg focus:border-lime-400 focus:outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditInitialOpen(false)}
                  className="px-4 py-2 font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-black text-black bg-lime-400 hover:bg-lime-300 rounded-xl shadow-md cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
