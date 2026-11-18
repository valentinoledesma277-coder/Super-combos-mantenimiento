import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSupermarket } from '../context/SupermarketContext';
import { usePrinter } from '../context/PrinterContext';
import { CartItem, ComboItem, Sale } from '../types';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { downloadExcelSheet } from '../utils/excelExport';
import {
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  History,
  Calculator,
  Delete,
  CornerDownLeft,
  X,
  Check,
  Copy,
  ShoppingBag,
  FileSpreadsheet,
  RotateCcw,
  ScanBarcode,
  Printer,
} from 'lucide-react';

interface PosViewProps {
  onOpenTicket: (sale: Sale) => void;
}

interface SaleEntry {
  id: string;
  amount: number;
  productId?: string;
  comboId?: string;
  isCombo?: boolean;
  code?: string;
  name?: string;
  costPrice?: number;
  comboItems?: ComboItem[];
}

export const PosView: React.FC<PosViewProps> = ({ onOpenTicket }) => {
  const { state, createSale, cancelSale, exportExcelWorkbook } = useSupermarket();
  const { printSaleTicket } = usePrinter();

  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');

  // Lector de código de barras + registro por precio
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<string>('');
  const [priceEntries, setPriceEntries] = useState<SaleEntry[]>([]);
  const [saleNotes, setSaleNotes] = useState<string>('');

  // Método de pago en caja: Efectivo, Transferencia o Tarjeta Bancaria
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia' | 'tarjeta'>('efectivo');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [cardType, setCardType] = useState<'debito' | 'credito'>('debito');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRegisteredSale, setLastRegisteredSale] = useState<Sale | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedAlias, setCopiedAlias] = useState<boolean>(false);

  // Lupa de Stock en la esquina (consulta rápida de inventario)
  const [isStockLookupOpen, setIsStockLookupOpen] = useState<boolean>(false);
  const [stockLookupTerm, setStockLookupTerm] = useState<string>('');

  // Calculadora integrada
  const [calcDisplay, setCalcDisplay] = useState<string>('0');
  const [calcFormula, setCalcFormula] = useState<string>('');
  const [calcHistory, setCalcHistory] = useState<string[]>([]);

  // Filtros e historial de ventas
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState<string>('todos');
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Corrección de cobro en caja');

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const stockSearchInputRef = useRef<HTMLInputElement>(null);

  // Monto escrito actualmente sin presionar "+"
  const pendingTypedAmount = useMemo(() => {
    const val = parseFloat(priceInput);
    if (isNaN(val) || val <= 0) return 0;
    return val;
  }, [priceInput]);

  // Total acumulado de los precios en la lista
  const listSubtotal = useMemo(() => {
    return priceEntries.reduce((sum, entry) => sum + entry.amount, 0);
  }, [priceEntries]);

  // Total final a cobrar (incluye automáticamente lo que esté escrito en el campo de precio para cero errores)
  const finalTotal = useMemo(() => {
    return Math.round((listSubtotal + pendingTypedAmount) * 100) / 100;
  }, [listSubtotal, pendingTypedAmount]);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(amountTendered) || 0;
    if (tendered >= finalTotal && finalTotal > 0) {
      return Math.round((tendered - finalTotal) * 100) / 100;
    }
    return 0;
  }, [amountTendered, finalTotal]);

  // Atajos de teclado: F2 para cobrar, F3 para lupa de stock, Escape para cerrar modales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (activeTab === 'pos' && finalTotal > 0 && !isSubmitting) {
          handleConfirmSale();
        }
      } else if (e.key === 'F3' || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setIsStockLookupOpen(true);
      } else if (e.key === 'Escape') {
        setIsStockLookupOpen(false);
        setSaleToCancel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    if (isStockLookupOpen) {
      setTimeout(() => stockSearchInputRef.current?.focus(), 50);
    } else if (activeTab === 'pos') {
      barcodeInputRef.current?.focus();
    }
  }, [isStockLookupOpen, activeTab]);

  // Sugerencias rápidas al escribir código parcial o nombre en el campo del lector
  const barcodeSuggestions = useMemo(() => {
    const term = barcodeInput.trim().toLowerCase();
    if (!term || term.length < 2) return [];
    const prodMatches = state.products
      .filter((p) => p.code.toLowerCase().includes(term) || p.name.toLowerCase().includes(term))
      .slice(0, 4)
      .map((p) => ({
        kind: 'product' as const,
        id: p.id,
        code: p.code,
        name: p.name,
        price: p.salePrice,
        stock: p.stock,
      }));
    const comboMatches = state.combos
      .filter((c) => c.code.toLowerCase().includes(term) || c.name.toLowerCase().includes(term))
      .slice(0, 2)
      .map((c) => ({
        kind: 'combo' as const,
        id: c.id,
        code: c.code,
        name: c.name,
        price: c.salePrice,
        stock: 999,
      }));
    return [...prodMatches, ...comboMatches].slice(0, 5);
  }, [barcodeInput, state.products, state.combos]);

  const addScannedProductOrCombo = (item: { kind: 'product' | 'combo'; id: string }) => {
    setErrorMessage(null);
    if (item.kind === 'product') {
      const product = state.products.find((p) => p.id === item.id);
      if (!product) return;
      const alreadyAdded = priceEntries.filter((e) => e.productId === product.id).length;
      if (product.stock <= alreadyAdded) {
        setErrorMessage(
          `Stock insuficiente para "${product.name}" (disponible: ${product.stock} un.).`
        );
        return;
      }
      setPriceEntries((prev) => [
        ...prev,
        {
          id: `scan-${Date.now()}-${Math.random()}`,
          amount: product.salePrice,
          productId: product.id,
          isCombo: false,
          code: product.code,
          name: product.name,
          costPrice: product.costPrice,
        },
      ]);
      setScanFeedback(`✓ ${product.name} (${formatCurrency(product.salePrice)})`);
    } else {
      const combo = state.combos.find((c) => c.id === item.id);
      if (!combo) return;
      const costSum = combo.items.reduce((s, ci) => s + ci.costPrice * ci.quantity, 0);
      setPriceEntries((prev) => [
        ...prev,
        {
          id: `scan-cmb-${Date.now()}-${Math.random()}`,
          amount: combo.salePrice,
          comboId: combo.id,
          isCombo: true,
          code: combo.code,
          name: combo.name,
          costPrice: costSum,
          comboItems: combo.items,
        },
      ]);
      setScanFeedback(`✓ ${combo.name} (${formatCurrency(combo.salePrice)})`);
    }
    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  };

  // Procesar código leído por el lector de barras (o escrito + Enter)
  const handleBarcodeSubmit = (rawCode?: string) => {
    const code = (rawCode ?? barcodeInput).trim().toLowerCase();
    if (!code) return;

    setErrorMessage(null);
    const matchedProduct = state.products.find((p) => p.code.trim().toLowerCase() === code);
    if (matchedProduct) {
      addScannedProductOrCombo({ kind: 'product', id: matchedProduct.id });
      return;
    }

    const matchedCombo = state.combos.find((c) => c.code.trim().toLowerCase() === code);
    if (matchedCombo) {
      addScannedProductOrCombo({ kind: 'combo', id: matchedCombo.id });
      return;
    }

    setScanFeedback(null);
    setErrorMessage(
      `Código "${(rawCode ?? barcodeInput).trim()}" no encontrado en el catálogo. Verifica el código o ingresa el precio abajo.`
    );
    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeSubmit();
    }
  };

  // --- ACCIONES DE LISTA DE PRECIOS ---
  const addPriceToList = (customAmount?: number, productMeta?: Partial<SaleEntry>) => {
    setErrorMessage(null);
    const amount = customAmount !== undefined ? customAmount : parseFloat(priceInput);

    if (isNaN(amount) || amount <= 0) {
      setErrorMessage('Ingresa un precio mayor a $0 para sumar a la venta.');
      return;
    }

    setPriceEntries((prev) => [
      ...prev,
      {
        id: `price-${Date.now()}-${Math.random()}`,
        amount: Math.round(amount * 100) / 100,
        ...productMeta,
      },
    ]);

    if (customAmount === undefined) {
      setPriceInput('');
      priceInputRef.current?.focus();
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (parseFloat(priceInput) > 0) {
        addPriceToList();
      }
    }
  };

  const removePriceEntry = (id: string) => {
    setPriceEntries((prev) => prev.filter((item) => item.id !== id));
  };

  const clearSale = () => {
    setPriceEntries([]);
    setBarcodeInput('');
    setScanFeedback(null);
    setPriceInput('');
    setAmountTendered('');
    setSaleNotes('');
    setErrorMessage(null);
    barcodeInputRef.current?.focus();
  };

  // --- CALCULADORA INTEGRADA ---
  const handleCalcNumber = (val: string) => {
    setCalcDisplay((prev) => {
      if (prev === 'Error') return val;
      if (prev === '0' && val !== '.' && val !== '00') return val;
      if (prev === '0' && val === '00') return '0';
      if (val === '.' && prev.includes('.')) return prev;
      return prev + val;
    });
  };

  const handleCalcOperation = (op: string) => {
    if (calcDisplay === 'Error') return;
    setCalcFormula(`${calcDisplay} ${op} `);
    setCalcDisplay('0');
  };

  const handleCalcClear = () => {
    setCalcDisplay('0');
    setCalcFormula('');
  };

  const handleCalcBackspace = () => {
    setCalcDisplay((prev) => (prev.length > 1 && prev !== 'Error' ? prev.slice(0, -1) : '0'));
  };

  const handleCalcEquals = () => {
    try {
      if (!calcFormula) return;
      const fullExpr = `${calcFormula}${calcDisplay}`
        .replace(/×/g, '*')
        .replace(/÷/g, '/');
      const sanitized = fullExpr.replace(/[^0-9+\-*/.%]/g, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (!isFinite(result) || isNaN(result)) {
        setCalcDisplay('Error');
        return;
      }
      const rounded = Math.round(Number(result) * 100) / 100;
      setCalcHistory((prev) => [`${calcFormula}${calcDisplay} = ${rounded}`, ...prev.slice(0, 4)]);
      setCalcDisplay(String(rounded));
      setCalcFormula('');
    } catch {
      setCalcDisplay('Error');
    }
  };

  const handleCalcAddBill = (amount: number) => {
    const current = parseFloat(calcDisplay);
    const safeCurrent = isNaN(current) ? 0 : current;
    setCalcDisplay(String(Math.round((safeCurrent + amount) * 100) / 100));
  };

  const handleTransferCalcToPriceInput = () => {
    const amountVal = parseFloat(calcDisplay);
    if (!isNaN(amountVal) && amountVal > 0) {
      setPriceInput(String(amountVal));
      setErrorMessage(null);
      priceInputRef.current?.focus();
    }
  };

  const handleAddCalcDirectToList = () => {
    const amountVal = parseFloat(calcDisplay);
    if (!isNaN(amountVal) && amountVal > 0) {
      addPriceToList(amountVal);
      handleCalcClear();
    }
  };

  // --- REGISTRAR VENTA E IMPRIMIR TICKET ---
  const handleConfirmSale = async () => {
    setErrorMessage(null);

    // Combinar artículos escaneados / precios agregados + precio escrito en el campo (si hay uno válido)
    const combinedEntries: SaleEntry[] = [...priceEntries];
    const typedPrice = parseFloat(priceInput);
    if (!isNaN(typedPrice) && typedPrice > 0) {
      combinedEntries.push({
        id: `price-direct-${Date.now()}`,
        amount: Math.round(typedPrice * 100) / 100,
      });
    }

    if (combinedEntries.length === 0) {
      setErrorMessage('Escanea un producto, ingresa un precio o pásalo desde la calculadora.');
      barcodeInputRef.current?.focus();
      return;
    }

    // Construir ítems (conserva código/producto si fue escaneado, o importe por precio si fue manual)
    const saleItems: CartItem[] = combinedEntries.map((entry, idx) => {
      const isScannedProduct = Boolean(entry.productId || entry.comboId);
      return {
        id: `item-${Date.now()}-${idx}`,
        productId: entry.productId,
        comboId: entry.comboId,
        isCombo: Boolean(entry.isCombo),
        code: isScannedProduct ? entry.code || 'ART' : 'PRECIO',
        name: isScannedProduct
          ? entry.name || 'Producto'
          : combinedEntries.length === 1
          ? `Cobro ${formatCurrency(entry.amount)}`
          : `Importe #${idx + 1} (${formatCurrency(entry.amount)})`,
        unitPrice: entry.amount,
        costPrice: entry.costPrice || 0,
        quantity: 1,
        subtotal: entry.amount,
        comboItems: entry.comboItems,
      };
    });

    setIsSubmitting(true);

    const tendered = paymentMethod === 'efectivo' ? parseFloat(amountTendered) || undefined : undefined;
    const change =
      paymentMethod === 'efectivo' && tendered && tendered >= finalTotal
        ? Math.round((tendered - finalTotal) * 100) / 100
        : undefined;

    const finalMethod =
      paymentMethod === 'tarjeta' ? (cardType === 'credito' ? 'credito' : 'debito') : paymentMethod;

    const res = await createSale({
      items: saleItems,
      paymentMethod: finalMethod,
      discount: 0,
      discountType: 'fixed',
      notes: saleNotes.trim() || undefined,
      amountTendered: tendered,
      changeGiven: change,
    });

    setIsSubmitting(false);

    if (res.success && res.sale) {
      setLastRegisteredSale(res.sale);
      clearSale();
      onOpenTicket(res.sale);
      await printSaleTicket(res.sale);
    } else {
      setErrorMessage(res.error || 'No se pudo guardar la venta.');
    }
  };

  // Ventas de hoy para mostrar siempre debajo al cajero
  const todaySales = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return state.sales.filter((s) => new Date(s.date).getTime() >= startOfToday);
  }, [state.sales]);

  const todayTotalAmount = useMemo(() => {
    return todaySales
      .filter((s) => s.status === 'completed')
      .reduce((sum, s) => sum + s.total, 0);
  }, [todaySales]);

  // Historial completo filtrado
  const filteredHistorySales = useMemo(() => {
    const term = historySearch.toLowerCase().trim();
    return state.sales.filter((sale) => {
      const matchMethod =
        historyPaymentFilter === 'todos' || sale.paymentMethod === historyPaymentFilter;
      const matchSearch =
        !term ||
        sale.receiptNumber.toLowerCase().includes(term) ||
        (sale.customerName && sale.customerName.toLowerCase().includes(term)) ||
        (sale.notes && sale.notes.toLowerCase().includes(term)) ||
        String(sale.total).includes(term) ||
        sale.items.some((i) => i.name.toLowerCase().includes(term) || String(i.unitPrice).includes(term));
      return matchMethod && matchSearch;
    });
  }, [state.sales, historySearch, historyPaymentFilter]);

  const handleExportSalesExcel = () => {
    const headers = [
      'N° Ticket',
      'Fecha y Hora',
      'Estado',
      'Medio de Pago',
      'Detalle por Precio / Artículo',
      'Total (ARS)',
      'Abonó Con (ARS)',
      'Vuelto (ARS)',
      'Cliente',
      'Notas',
    ];
    const rows = filteredHistorySales.map((s) => [
      s.receiptNumber,
      formatDateTime(s.date),
      s.status === 'completed' ? 'REGISTRADA' : 'ANULADA',
      s.paymentMethod.toUpperCase(),
      s.items
        .map((i) => {
          const isPriceOnly = i.code === 'PRECIO' || i.code === 'RAPIDO';
          if (isPriceOnly) {
            return i.quantity > 1 ? `${i.quantity}x ${formatCurrency(i.unitPrice)}` : formatCurrency(i.unitPrice);
          }
          return `${i.quantity}x ${i.name} (${formatCurrency(i.unitPrice)})`;
        })
        .join(' + '),
      s.total,
      s.amountTendered ?? '',
      s.changeGiven ?? '',
      s.customerName && s.customerName !== 'Consumidor Final' ? s.customerName : '',
      s.notes || '',
    ]);
    downloadExcelSheet('Registro_Ventas_SuperCombos.xlsx', 'Ventas', headers, rows);
  };

  // Lupa de stock
  const stockSearchResults = useMemo(() => {
    const term = stockLookupTerm.toLowerCase().trim();
    if (!term) return state.products.slice(0, 12);
    return state.products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
    );
  }, [state.products, stockLookupTerm]);

  return (
    <div className="space-y-5">
      {/* Cabecera Principal del PANEL CAJERO + LUPA DE STOCK EN LA ESQUINA */}
      <div className="bg-zinc-950 p-4 sm:p-5 rounded-2xl border border-zinc-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-lime-400 text-black flex items-center justify-center font-black shadow-lg shadow-lime-400/20">
            <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">Panel Cajero</h2>
              <span className="px-2 py-0.5 text-[10px] font-black bg-lime-400/20 text-lime-400 rounded-full border border-lime-400/40 uppercase font-mono">
                Cobro por Precio
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Escanea con lector o ingresa precios • Un solo botón para cobrar e imprimir el ticket
            </p>
          </div>
        </div>

        {/* ESQUINA SUPERIOR DERECHA: Pestañas + LUPA LIGADA AL STOCK */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('pos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'pos'
                  ? 'bg-lime-400 text-black font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Cobrar Venta
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-lime-400 text-black font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Registro Completo ({state.sales.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsStockLookupOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border-2 border-lime-400/70 hover:border-lime-400 text-lime-400 font-black rounded-xl text-xs shadow-lg shadow-lime-950/40 transition-all cursor-pointer group"
            title="Consultar si hay stock de algún producto (F3)"
          >
            <Search className="w-4 h-4 stroke-[3] group-hover:scale-110 transition-transform" />
            <span>Consultar Stock (F3)</span>
          </button>
        </div>
      </div>

      {/* Confirmación inmediata no bloqueante tras registrar una venta */}
      {lastRegisteredSale && activeTab === 'pos' && (
        <div className="p-4 bg-lime-400/15 border-2 border-lime-400 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-lime-400 text-black flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 stroke-[3]" />
            </div>
            <div>
              <p className="text-sm font-black text-white">
                ¡Ticket {lastRegisteredSale.receiptNumber} generado por{' '}
                <span className="text-lime-400 font-mono">
                  {formatCurrency(lastRegisteredSale.total)}
                </span>
                !
              </p>
              <p className="text-xs text-zinc-300 font-mono mt-0.5">
                Pago: <strong className="uppercase">{lastRegisteredSale.paymentMethod}</strong>
                {lastRegisteredSale.changeGiven !== undefined && lastRegisteredSale.changeGiven > 0
                  ? ` • Vuelto: ${formatCurrency(lastRegisteredSale.changeGiven)}`
                  : ''}
                {' • Enviado a la impresora del dispositivo'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => printSaleTicket(lastRegisteredSale)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-lime-400 hover:bg-lime-300 text-black font-black text-xs rounded-xl cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Reimprimir Ticket</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenTicket(lastRegisteredSale)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-lime-400" />
              <span>Ver Ticket</span>
            </button>
            <button
              type="button"
              onClick={() => setLastRegisteredSale(null)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              title="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-white font-bold px-2"
          >
            ×
          </button>
        </div>
      )}

      {activeTab === 'pos' ? (
        <div className="space-y-6">
          {/* ZONA DE COBRO ULTRA-SIMPLE: LECTOR + PRECIO (IZQUIERDA) + CALCULADORA (DERECHA) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* PANEL IZQUIERDO: LECTOR DE BARRAS, PRECIO(S), MEDIO DE PAGO Y COBRAR */}
            <div className="lg:col-span-8 space-y-5">
              {/* BLOQUE 1: LECTOR DE CÓDIGO DE BARRAS + INGRESO DE PRECIO */}
              <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
                  <div>
                    <h3 className="font-black text-base text-white">
                      1. Lector de Barras y Precio de Venta
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Escanea el código de barras del producto o ingresa el precio manualmente
                    </p>
                  </div>
                  {(priceEntries.length > 0 || priceInput || barcodeInput) && (
                    <button
                      type="button"
                      onClick={clearSale}
                      className="text-xs font-bold text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      Limpiar todo
                    </button>
                  )}
                </div>

                {/* CAMPO DEDICADO PARA LECTOR DE CÓDIGO DE BARRAS */}
                <div className="p-3.5 rounded-xl bg-lime-400/5 border border-lime-400/40 space-y-2 relative">
                  <label className="text-[10px] font-black uppercase text-lime-400 tracking-wider font-mono flex items-center gap-1.5">
                    <ScanBarcode className="w-4 h-4 stroke-[2.5]" />
                    <span>Lector de Código de Barras (Escanea o escribe el código + Enter)</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <ScanBarcode className="w-5 h-5 text-lime-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => {
                          setBarcodeInput(e.target.value);
                          setErrorMessage(null);
                        }}
                        onKeyDown={handleBarcodeKeyDown}
                        placeholder="Escanea el código de barras aquí (ej. 77912340001)..."
                        className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-zinc-800 bg-zinc-950 text-white font-mono font-bold text-sm focus:border-lime-400 focus:outline-hidden placeholder-zinc-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBarcodeSubmit()}
                      className="px-4 py-3 bg-lime-400 hover:bg-lime-300 text-black font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Agregar Código</span>
                    </button>
                  </div>

                  {scanFeedback && (
                    <p className="text-[11px] font-mono font-bold text-lime-400">{scanFeedback}</p>
                  )}

                  {/* Sugerencias desplegables si escribe parte del código o nombre */}
                  {barcodeSuggestions.length > 0 && (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl divide-y divide-zinc-900 overflow-hidden shadow-xl">
                      {barcodeSuggestions.map((item) => (
                        <button
                          key={`${item.kind}-${item.id}`}
                          type="button"
                          onClick={() => addScannedProductOrCombo({ kind: item.kind, id: item.id })}
                          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-zinc-900 transition cursor-pointer text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-mono text-[10px] text-lime-400 mr-2">
                              [{item.code}]
                            </span>
                            <span className="font-bold text-white truncate">{item.name}</span>
                          </div>
                          <span className="font-mono font-black text-lime-400 whitespace-nowrap">
                            {formatCurrency(item.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input grande de Precio Manual + Botón Sumar */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end">
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider font-mono block mb-1">
                      O Ingresar Precio Manual (ARS)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lime-400 font-black text-2xl">
                        $
                      </span>
                      <input
                        ref={priceInputRef}
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceInput}
                        onChange={(e) => {
                          setPriceInput(e.target.value);
                          setErrorMessage(null);
                        }}
                        onKeyDown={handlePriceKeyDown}
                        placeholder="0.00"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-zinc-800 bg-zinc-900 text-white font-mono font-black text-2xl focus:border-lime-400 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => addPriceToList()}
                    className="px-5 py-3.5 bg-zinc-900 hover:bg-zinc-800 border-2 border-lime-400/60 hover:border-lime-400 text-lime-400 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Sumar Precio</span>
                  </button>
                </div>

                {/* Lista de productos escaneados / precios agregados a esta venta */}
                {priceEntries.length > 0 && (
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-400 pb-1 border-b border-zinc-800">
                      <span>Ítems en esta venta ({priceEntries.length})</span>
                      <span>Subtotal lista: {formatCurrency(listSubtotal)}</span>
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                      {priceEntries.map((entry, idx) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800/80 text-xs gap-2"
                        >
                          <div className="flex items-center gap-2 font-mono min-w-0">
                            <span className="text-zinc-500 font-bold">#{idx + 1}</span>
                            {entry.name ? (
                              <span className="text-white font-bold truncate font-sans">
                                <span className="text-lime-400 font-mono text-[10px] mr-1.5">
                                  [{entry.code}]
                                </span>
                                {entry.name}
                              </span>
                            ) : (
                              <span className="text-white font-bold">
                                {formatCurrency(entry.amount)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="font-mono font-black text-lime-400">
                              {formatCurrency(entry.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removePriceEntry(entry.id)}
                              className="text-zinc-500 hover:text-red-400 p-1 cursor-pointer"
                              title="Quitar de la venta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nota breve opcional */}
                <div className="pt-1">
                  <input
                    type="text"
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                    placeholder="Nota u observación opcional (ej. seña, fiado, combo)..."
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 text-xs focus:border-lime-400 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* BLOQUE 2: FORMA DE PAGO, TOTAL Y BOTÓN COBRAR */}
              <div className="bg-zinc-950 p-5 rounded-2xl border-2 border-zinc-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
                  <div>
                    <span className="font-black text-base text-white block">2. Medio de Pago y Cobro</span>
                    {priceEntries.length > 0 && pendingTypedAmount > 0 && (
                      <span className="text-[11px] font-mono text-lime-400">
                        Incluye lista ({formatCurrency(listSubtotal)}) + campo ({formatCurrency(pendingTypedAmount)})
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 uppercase font-mono block">
                      TOTAL A COBRAR
                    </span>
                    <span className="text-3xl font-black text-lime-400 font-mono">
                      {formatCurrency(finalTotal)}
                    </span>
                  </div>
                </div>

                {/* 3 Botones Claros: Efectivo, Transferencia, Tarjeta Bancaria */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('efectivo')}
                    className={`p-3.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                      paymentMethod === 'efectivo'
                        ? 'bg-lime-400 text-black border-lime-400 shadow-lg shadow-lime-400/20 font-black'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    <Banknote className="w-5 h-5 stroke-[2.5]" />
                    <span className="text-xs font-bold">Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transferencia')}
                    className={`p-3.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                      paymentMethod === 'transferencia'
                        ? 'bg-lime-400 text-black border-lime-400 shadow-lg shadow-lime-400/20 font-black'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 stroke-[2.5]" />
                    <span className="text-xs font-bold">Transferencia</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('tarjeta')}
                    className={`p-3.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                      paymentMethod === 'tarjeta'
                        ? 'bg-lime-400 text-black border-lime-400 shadow-lg shadow-lime-400/20 font-black'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 stroke-[2.5]" />
                    <span className="text-xs font-bold">Tarjeta Bancaria</span>
                  </button>
                </div>

                {/* Detalle Efectivo / Transferencia / Tarjeta */}
                {paymentMethod === 'efectivo' && (
                  <div className="p-3.5 bg-zinc-900 rounded-xl border border-zinc-800 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="font-bold text-zinc-300 block mb-1 text-xs">
                          Paga con (opcional, para calcular vuelto):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lime-400 font-bold">
                            $
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amountTendered}
                            onChange={(e) => setAmountTendered(e.target.value)}
                            placeholder="Ej. 10000"
                            className="w-full pl-7 pr-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-white font-mono font-bold text-sm focus:border-lime-400 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between">
                        <span className="text-xs text-zinc-400 font-medium">Vuelto:</span>
                        <span className="text-xl font-black text-lime-400 font-mono">
                          {formatCurrency(changeDue)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-wrap pt-1 border-t border-zinc-800/80 items-center">
                      <span className="text-[10px] text-zinc-500 font-mono">Billetes:</span>
                      <button
                        type="button"
                        onClick={() => setAmountTendered(String(finalTotal))}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-lime-400 font-mono text-[11px] font-bold rounded-lg border border-zinc-700 cursor-pointer"
                      >
                        Exacto
                      </button>
                      {[1000, 2000, 5000, 10000, 20000].map((bill) => (
                        <button
                          key={bill}
                          type="button"
                          onClick={() => setAmountTendered(String(bill))}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-[11px] rounded-lg border border-zinc-700 cursor-pointer"
                        >
                          ${bill}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {paymentMethod === 'transferencia' && (
                  <div className="p-3.5 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-lime-400" />
                      Alias del Comercio:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText('supercombos.pos');
                        setCopiedAlias(true);
                        setTimeout(() => setCopiedAlias(false), 2000);
                      }}
                      className="text-lime-400 hover:underline flex items-center gap-1 font-mono font-bold cursor-pointer"
                    >
                      {copiedAlias ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>supercombos.pos</span>
                    </button>
                  </div>
                )}

                {paymentMethod === 'tarjeta' && (
                  <div className="p-3.5 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-white">Modalidad Tarjeta:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCardType('debito')}
                        className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                          cardType === 'debito'
                            ? 'bg-lime-400 text-black'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        Débito
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardType('credito')}
                        className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                          cardType === 'credito'
                            ? 'bg-lime-400 text-black'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        Crédito
                      </button>
                    </div>
                  </div>
                )}

                {/* BOTÓN ÚNICO DE COBRO E IMPRESIÓN DIRECTA */}
                <button
                  type="button"
                  disabled={finalTotal <= 0 || isSubmitting}
                  onClick={handleConfirmSale}
                  className="w-full py-4 bg-lime-400 hover:bg-lime-300 disabled:opacity-30 disabled:cursor-not-allowed text-black rounded-2xl text-base font-black shadow-xl shadow-lime-400/20 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  <Printer className="w-5 h-5 stroke-[2.5]" />
                  <span>
                    {isSubmitting
                      ? 'GENERANDO TICKET...'
                      : `COBRAR E IMPRIMIR TICKET ${finalTotal > 0 ? formatCurrency(finalTotal) : ''} (F2)`}
                  </span>
                </button>
              </div>
            </div>

            {/* PANEL DERECHO: CALCULADORA DEL CAJERO */}
            <div className="lg:col-span-4 bg-zinc-950 p-4 sm:p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-3 sticky top-20">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-lime-400" />
                  <h3 className="font-black text-sm text-white">Calculadora</h3>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">Cuentas rápidas</span>
              </div>

              {/* Pantalla Digital */}
              <div className="p-3 bg-black rounded-xl border border-zinc-800 text-right space-y-1 font-mono">
                <div className="text-[11px] text-zinc-500 min-h-[16px] truncate">
                  {calcFormula || 'Listo para sumar'}
                </div>
                <div className="text-2xl font-black text-lime-400 truncate">{calcDisplay}</div>
              </div>

              {/* Botones para pasar directo a la venta */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleTransferCalcToPriceInput}
                  className="py-2 px-2 bg-lime-400 hover:bg-lime-300 text-black font-black text-[11px] rounded-xl shadow-md shadow-lime-400/20 flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Pone este número en el campo de cobro"
                >
                  <CornerDownLeft className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Pasar a Venta</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddCalcDirectToList}
                  className="py-2 px-2 bg-zinc-900 hover:bg-zinc-800 border border-lime-400/50 text-lime-400 font-black text-[11px] rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Agrega este resultado a la lista de precios de la venta"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Sumar a Lista</span>
                </button>
              </div>

              {/* Sumas rápidas */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[500, 1000, 2000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleCalcAddBill(amt)}
                    className="py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-lime-400 text-[10px] font-mono font-bold rounded-lg transition cursor-pointer"
                  >
                    +${amt}
                  </button>
                ))}
              </div>

              {/* Teclado */}
              <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-sm">
                <button
                  type="button"
                  onClick={handleCalcClear}
                  className="py-3 bg-red-950/60 hover:bg-red-900 text-red-300 font-black rounded-xl border border-red-900/40 cursor-pointer"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={handleCalcBackspace}
                  className="py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-800 flex items-center justify-center cursor-pointer"
                >
                  <Delete className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcOperation('%')}
                  className="py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl border border-zinc-800 cursor-pointer"
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcOperation('÷')}
                  className="py-3 bg-zinc-900 hover:bg-zinc-800 text-lime-400 font-bold rounded-xl border border-zinc-800 text-base cursor-pointer"
                >
                  ÷
                </button>

                {['7', '8', '9'].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleCalcNumber(n)}
                    className="py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl border border-zinc-800 cursor-pointer"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleCalcOperation('×')}
                  className="py-3 bg-zinc-900 hover:bg-zinc-800 text-lime-400 font-bold rounded-xl border border-zinc-800 text-base cursor-pointer"
                >
                  ×
                </button>

                {['4', '5', '6'].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleCalcNumber(n)}
                    className="py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl border border-zinc-800 cursor-pointer"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleCalcOperation('-')}
                  className="py-3 bg-zinc-900 hover:bg-zinc-800 text-lime-400 font-bold rounded-xl border border-zinc-800 text-base cursor-pointer"
                >
                  -
                </button>

                {['1', '2', '3'].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleCalcNumber(n)}
                    className="py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl border border-zinc-800 cursor-pointer"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleCalcOperation('+')}
                  className="py-3 bg-zinc-900 hover:bg-zinc-800 text-lime-400 font-bold rounded-xl border border-zinc-800 text-base cursor-pointer"
                >
                  +
                </button>

                <button
                  type="button"
                  onClick={() => handleCalcNumber('0')}
                  className="py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl border border-zinc-800 cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcNumber('00')}
                  className="py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl border border-zinc-800 cursor-pointer"
                >
                  00
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcNumber('.')}
                  className="py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl border border-zinc-800 cursor-pointer"
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={handleCalcEquals}
                  className="py-3 bg-lime-400 hover:bg-lime-300 text-black font-black rounded-xl text-base shadow-md cursor-pointer"
                >
                  =
                </button>
              </div>

              {calcHistory.length > 0 && (
                <div className="pt-2 border-t border-zinc-900 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase block">
                    Cálculos recientes:
                  </span>
                  <div className="space-y-0.5 text-[11px] font-mono text-zinc-400">
                    {calcHistory.map((h, i) => (
                      <div key={i} className="truncate text-right">
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BLOQUE INFERIOR SIEMPRE VISIBLE: ÚLTIMAS VENTAS ANOTADAS HOY */}
          <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-900">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-lime-400" />
                <h3 className="font-black text-sm text-white">
                  Ventas Anotadas Hoy ({todaySales.filter((s) => s.status === 'completed').length})
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-lime-400/15 text-lime-400 border border-lime-400/30">
                  Guardado 100% Offline
                </span>
              </div>
              <div className="text-xs font-mono">
                <span className="text-zinc-400">Total cobrado hoy: </span>
                <strong className="text-lime-400 text-sm">{formatCurrency(todayTotalAmount)}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-900 text-zinc-400 font-bold uppercase text-[10px] font-mono border-b border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-3">Ticket</th>
                    <th className="py-2.5 px-3">Hora</th>
                    <th className="py-2.5 px-3">Precios Anotados</th>
                    <th className="py-2.5 px-3">Medio de Pago</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {todaySales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        Todavía no hay ventas registradas hoy. Todas las ventas nuevas aparecerán aquí al instante.
                      </td>
                    </tr>
                  ) : (
                    todaySales.slice(0, 8).map((sale) => (
                      <tr
                        key={sale.id}
                        className={`transition ${
                          sale.status === 'cancelled'
                            ? 'opacity-45 bg-red-950/10'
                            : 'hover:bg-zinc-900/60'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-black text-lime-400">
                          {sale.receiptNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-400">
                          {formatDateTime(sale.date)}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-200 font-mono">
                          {sale.items
                            .map((i) => {
                              const isPriceOnly = i.code === 'PRECIO' || i.code === 'RAPIDO';
                              if (isPriceOnly) {
                                return i.quantity > 1
                                  ? `${i.quantity}x ${formatCurrency(i.unitPrice)}`
                                  : formatCurrency(i.unitPrice);
                              }
                              return `${i.name} (${formatCurrency(i.unitPrice)})`;
                            })
                            .join(' + ')}
                          {sale.notes && (
                            <span className="block text-[10px] text-zinc-500 font-sans italic">
                              Nota: {sale.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 uppercase font-mono text-[11px] text-zinc-300">
                          {sale.paymentMethod}
                          {sale.status === 'cancelled' && (
                            <span className="ml-2 text-[10px] text-red-400 font-bold">(ANULADA)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-white font-mono">
                          {formatCurrency(sale.total)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenTicket(sale)}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-lime-400 rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              Ticket
                            </button>
                            {sale.status === 'completed' && (
                              <button
                                type="button"
                                onClick={() => setSaleToCancel(sale)}
                                className="p-1 text-zinc-500 hover:text-red-400 rounded-lg cursor-pointer"
                                title="Anular venta"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* PESTAÑA DE REGISTRO COMPLETO DE VENTAS */
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-900">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-lime-400" />
              <h3 className="font-black text-base text-white">
                Registro Histórico Completo de Ventas ({filteredHistorySales.length})
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportSalesExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-lime-400" />
                <span>Exportar Ventas (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={exportExcelWorkbook}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-lime-400 hover:bg-lime-300 text-black rounded-xl text-xs font-black shadow-md shadow-lime-400/20 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
                <span>Plantilla Completa (.xlsx)</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar por ticket, monto, cliente o nota..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:border-lime-400 focus:outline-hidden"
              />
            </div>
            <select
              value={historyPaymentFilter}
              onChange={(e) => setHistoryPaymentFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200"
            >
              <option value="todos">Todos los medios de pago</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="debito">Tarjeta Débito</option>
              <option value="credito">Tarjeta Crédito</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-900 text-zinc-400 font-bold uppercase text-[10px] font-mono border-b border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3">Ticket</th>
                  <th className="py-2.5 px-3">Fecha y Hora</th>
                  <th className="py-2.5 px-3">Precios Registrados</th>
                  <th className="py-2.5 px-3">Nota / Detalle</th>
                  <th className="py-2.5 px-3">Medio</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filteredHistorySales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500">
                      No se encontraron ventas con ese filtro.
                    </td>
                  </tr>
                ) : (
                  filteredHistorySales.map((sale) => (
                    <tr
                      key={sale.id}
                      className={`transition ${
                        sale.status === 'cancelled'
                          ? 'opacity-45 bg-red-950/10'
                          : 'hover:bg-zinc-900/60'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-black text-lime-400">
                        {sale.receiptNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-400">
                        {formatDateTime(sale.date)}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-200 font-mono">
                        {sale.items
                          .map((i) => {
                            const isPriceOnly = i.code === 'PRECIO' || i.code === 'RAPIDO';
                            if (isPriceOnly) {
                              return i.quantity > 1
                                ? `${i.quantity}x ${formatCurrency(i.unitPrice)}`
                                : formatCurrency(i.unitPrice);
                            }
                            return `${i.name} (${formatCurrency(i.unitPrice)})`;
                          })
                          .join(' + ')}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-300">
                        {sale.customerName && sale.customerName !== 'Consumidor Final' && (
                          <span className="font-semibold block">{sale.customerName}</span>
                        )}
                        {sale.notes ? (
                          <span className="text-[11px] text-zinc-400 italic">{sale.notes}</span>
                        ) : !(sale.customerName && sale.customerName !== 'Consumidor Final') ? (
                          <span className="text-zinc-600">-</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 uppercase font-mono text-[11px] text-zinc-400">
                        {sale.paymentMethod}
                        {sale.status === 'cancelled' && (
                          <span className="block text-[10px] text-red-400 font-bold">ANULADA</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-white font-mono">
                        {formatCurrency(sale.total)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenTicket(sale)}
                            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-lime-400 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            Ver Ticket
                          </button>
                          {sale.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => setSaleToCancel(sale)}
                              className="p-1 text-zinc-500 hover:text-red-400 rounded-lg cursor-pointer"
                              title="Anular venta"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL LUPA DE STOCK EN LA ESQUINA */}
      {isStockLookupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-zinc-950 p-6 shadow-2xl border-2 border-lime-400/60 space-y-4 text-zinc-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-lime-400 text-black flex items-center justify-center font-black shadow-md shadow-lime-400/20">
                  <Search className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    Consulta Rápida de Stock
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Verifica al instante si hay existencias del producto que busca el cliente y su precio
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStockLookupOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-lime-400" />
              <input
                ref={stockSearchInputRef}
                type="text"
                value={stockLookupTerm}
                onChange={(e) => setStockLookupTerm(e.target.value)}
                placeholder="Buscar producto por nombre, código o categoría..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-white font-medium text-sm focus:border-lime-400 focus:outline-hidden"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-zinc-900">
              {stockSearchResults.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No se encontraron productos coincidentes en el registro de stock.
                </div>
              ) : (
                stockSearchResults.map((prod) => {
                  const hasStock = prod.stock > 0;
                  const isLow = prod.stock <= prod.minStock && hasStock;

                  return (
                    <div
                      key={prod.id}
                      className="pt-2.5 pb-1 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm truncate">{prod.name}</h4>
                          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                            {prod.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-0.5">
                          <span>Cat: {prod.category}</span>
                          <span>•</span>
                          <span className="text-lime-400 font-mono font-bold">
                            Precio: {formatCurrency(prod.salePrice)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-black text-xs px-2.5 py-1 rounded-full border ${
                            !hasStock
                              ? 'bg-red-950/70 text-red-400 border-red-800/60'
                              : isLow
                              ? 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                              : 'bg-lime-400/15 text-lime-400 border-lime-400/40'
                          }`}
                        >
                          {!hasStock
                            ? '✕ SIN STOCK'
                            : isLow
                            ? `⚠ ${prod.stock} un. (Bajo)`
                            : `✓ ${prod.stock} un. HAY`}
                        </span>

                        <button
                          type="button"
                          disabled={!hasStock}
                          onClick={() => {
                            addScannedProductOrCombo({ kind: 'product', id: prod.id });
                            setIsStockLookupOpen(false);
                          }}
                          className="px-3 py-1.5 bg-lime-400 hover:bg-lime-300 disabled:opacity-35 disabled:cursor-not-allowed text-black font-black text-xs rounded-xl shadow-md cursor-pointer whitespace-nowrap"
                          title="Sumar este producto a la venta actual"
                        >
                          + Sumar {formatCurrency(prod.salePrice)}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => setIsStockLookupOpen(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ANULAR VENTA */}
      {saleToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-4 text-zinc-100">
            <h3 className="font-black text-base text-white">
              Anular Venta {saleToCancel.receiptNumber}
            </h3>
            <p className="text-xs text-zinc-400">
              Se anulará el cobro por{' '}
              <strong className="text-lime-400 font-mono">
                {formatCurrency(saleToCancel.total)}
              </strong>{' '}
              y se descontará de la caja. La venta permanecerá visible como ANULADA en el historial para auditoría.
            </p>
            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1">
                Motivo de la anulación:
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => setSaleToCancel(null)}
                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await cancelSale(saleToCancel.id, cancelReason || 'Anulación en caja');
                  setSaleToCancel(null);
                }}
                className="px-4 py-2 text-xs font-black bg-red-600 hover:bg-red-500 text-white rounded-xl cursor-pointer"
              >
                Confirmar Anulación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
