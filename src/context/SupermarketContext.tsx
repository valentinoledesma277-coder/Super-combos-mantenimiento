import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  AppDatabaseState,
  CartItem,
  CashClosure,
  ClientOrder,
  Combo,
  Customer,
  Expense,
  Income,
  PaymentMethod,
  Product,
  Sale,
  StockMovement,
  StoreSettings,
  Supplier,
} from '../types';
import {
  generateBackupJSON,
  loadDatabaseState,
  saveDatabaseState,
  syncMirrorToLocalStorage,
  validateBackupJSON,
} from '../db/indexedDb';
import { INITIAL_SEED_STATE } from '../db/seedData';
import { generateNextTicketNumber } from '../utils/formatters';
import { exportFullExcelWorkbook } from '../utils/excelExport';

interface SupermarketContextType {
  state: AppDatabaseState;
  isLoading: boolean;
  // Métricas rápidas calculadas en memoria
  metrics: {
    cashInDrawer: number;
    todayIncomes: number;
    todayExpenses: number;
    todayEstimatedProfit: number;
    todaySalesCount: number;
    totalStockCount: number;
    lowStockCount: number;
    totalInventoryCostValue: number;
    totalInventorySaleValue: number;
    activeCustomersCount: number;
    pendingOrdersCount: number;
    totalSuppliersCount: number;
  };
  // Acciones de Ventas y POS
  createSale: (saleInput: {
    items: CartItem[];
    paymentMethod: PaymentMethod;
    customerId?: string;
    customerName?: string;
    discount: number;
    discountType: 'percentage' | 'fixed';
    notes?: string;
    amountTendered?: number;
    changeGiven?: number;
  }) => Promise<{ success: boolean; sale?: Sale; error?: string }>;
  cancelSale: (saleId: string, reason: string) => Promise<boolean>;
  
  // Acciones de Productos e Inventario
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Product>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addStockEntry: (params: {
    productId: string;
    quantity: number;
    costPerUnit?: number;
    supplier?: string;
    registerExpense?: boolean;
    notes?: string;
  }) => Promise<void>;
  recordStockLoss: (params: {
    productId: string;
    quantity: number;
    reason: string;
    notes?: string;
  }) => Promise<void>;

  // Acciones de Combos
  createCombo: (combo: Omit<Combo, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Combo>;
  updateCombo: (id: string, combo: Partial<Combo>) => Promise<void>;
  deleteCombo: (id: string) => Promise<void>;

  // Acciones de Proveedores
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => Promise<Supplier>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;

  // Acciones de Cronograma de Pedidos de Clientes Precedentes
  addOrder: (order: Omit<ClientOrder, 'id' | 'orderNumber' | 'orderDate'>) => Promise<ClientOrder>;
  updateOrder: (id: string, updates: Partial<ClientOrder>) => Promise<void>;
  updateOrderStatus: (id: string, status: ClientOrder['status']) => Promise<void>;
  updateOrderPayment: (id: string, paidAmount: number, paymentStatus: ClientOrder['paymentStatus']) => Promise<void>;
  deliverOrderAsSale: (orderId: string) => Promise<{ success: boolean; sale?: Sale; error?: string }>;
  deleteOrder: (id: string) => Promise<void>;

  // Acciones de Clientes
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'totalSpent' | 'purchaseCount'>) => Promise<Customer>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  // Acciones Financieras
  addIncome: (income: Omit<Income, 'id' | 'date'>) => Promise<Income>;
  addExpense: (expense: Omit<Expense, 'id' | 'date'>) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;

  // Cierre y Control de Caja
  performCashClosure: (params: {
    actualCash: number;
    notes?: string;
    closedBy?: string;
    nextInitialBalance?: number;
  }) => Promise<CashClosure>;
  updateInitialCashDrawer: (amount: number) => Promise<void>;

  // Configuración y Respaldos
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
  exportBackupFile: () => void;
  exportExcelWorkbook: () => void;
  importBackupFile: (jsonContent: string) => Promise<{ success: boolean; error?: string }>;
  resetToDefault: () => Promise<void>;
}

const SupermarketContext = createContext<SupermarketContextType | null>(null);

export const SupermarketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppDatabaseState>(INITIAL_SEED_STATE);
  const stateRef = useRef<AppDatabaseState>(INITIAL_SEED_STATE);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Cargar estado inicial desde IndexedDB / LocalStorage al montar
  useEffect(() => {
    let isMounted = true;
    loadDatabaseState()
      .then((loaded) => {
        if (isMounted) {
          stateRef.current = loaded;
          setState(loaded);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error cargando base de datos:', err);
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Resguardo síncrono en el dispositivo al minimizar/cerrar pestaña
  useEffect(() => {
    const handleFlushStorage = () => {
      if (!isLoading) {
        syncMirrorToLocalStorage(stateRef.current);
      }
    };
    window.addEventListener('pagehide', handleFlushStorage);
    window.addEventListener('beforeunload', handleFlushStorage);
    return () => {
      window.removeEventListener('pagehide', handleFlushStorage);
      window.removeEventListener('beforeunload', handleFlushStorage);
    };
  }, [isLoading]);

  // Función interna para actualizar estado y persistir atómicamente usando referencia actualizada
  const updateAndSaveState = async (updater: (prev: AppDatabaseState) => AppDatabaseState): Promise<AppDatabaseState> => {
    const nextState = updater(stateRef.current);
    stateRef.current = nextState;
    setState(nextState);
    await saveDatabaseState(nextState);
    return nextState;
  };

  // Métricas calculadas en tiempo real
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Ingresos de hoy
    const todayIncomesList = (state.incomes || []).filter((inc) => new Date(inc.date).getTime() >= startOfToday);
    const todayIncomes = todayIncomesList.reduce((acc, i) => acc + i.amount, 0);

    // Egresos de hoy
    const todayExpensesList = (state.expenses || []).filter((exp) => new Date(exp.date).getTime() >= startOfToday);
    const todayExpenses = todayExpensesList.reduce((acc, e) => acc + e.amount, 0);

    // Ventas de hoy
    const todaySalesList = (state.sales || []).filter(
      (s) => s.status === 'completed' && new Date(s.date).getTime() >= startOfToday
    );
    const todaySalesCount = todaySalesList.length;

    // Ganancia estimada de hoy
    const todayEstimatedProfit = Math.max(0, todayIncomes - todayExpenses);

    // Control de efectivo en caja
    const currentDrawerOpenedAt = new Date(state.currentCashDrawer.openedAt).getTime();
    const cashIncomesSinceOpen = (state.incomes || [])
      .filter((inc) => inc.paymentMethod === 'efectivo' && new Date(inc.date).getTime() >= currentDrawerOpenedAt)
      .reduce((sum, inc) => sum + inc.amount, 0);
    const cashExpensesSinceOpen = (state.expenses || [])
      .filter((exp) => exp.paymentMethod === 'efectivo' && new Date(exp.date).getTime() >= currentDrawerOpenedAt)
      .reduce((sum, exp) => sum + exp.amount, 0);

    const cashInDrawer = (state.currentCashDrawer.initialBalance || 0) + cashIncomesSinceOpen - cashExpensesSinceOpen;

    // Métricas de inventario
    let totalStockCount = 0;
    let lowStockCount = 0;
    let totalInventoryCostValue = 0;
    let totalInventorySaleValue = 0;

    (state.products || []).forEach((p) => {
      totalStockCount += p.stock;
      if (p.stock <= p.minStock) {
        lowStockCount++;
      }
      totalInventoryCostValue += p.costPrice * p.stock;
      totalInventorySaleValue += p.salePrice * p.stock;
    });

    const pendingOrdersCount = (state.orders || []).filter(
      (o) => o.status === 'pendiente' || o.status === 'en_preparacion' || o.status === 'listo'
    ).length;

    return {
      cashInDrawer,
      todayIncomes,
      todayExpenses,
      todayEstimatedProfit,
      todaySalesCount,
      totalStockCount,
      lowStockCount,
      totalInventoryCostValue,
      totalInventorySaleValue,
      activeCustomersCount: (state.customers || []).length,
      pendingOrdersCount,
      totalSuppliersCount: (state.suppliers || []).length,
    };
  }, [state]);

  // CREAR VENTA (Punto de Venta)
  const createSale = async (input: {
    items: CartItem[];
    paymentMethod: PaymentMethod;
    customerId?: string;
    customerName?: string;
    discount: number;
    discountType: 'percentage' | 'fixed';
    notes?: string;
    amountTendered?: number;
    changeGiven?: number;
  }) => {
    if (input.items.length === 0) {
      return { success: false, error: 'El carrito de venta está vacío.' };
    }

    const currentState = stateRef.current;

    // 1. Validar existencias de stock (solo para ítems ligados a producto/combo)
    const productStockMap = new Map<string, number>();
    currentState.products.forEach((p) => productStockMap.set(p.id, p.stock));

    const stockDeductionMap = new Map<string, number>();

    for (const item of input.items) {
      if (item.isCombo && item.comboItems) {
        for (const cItem of item.comboItems) {
          const needed = cItem.quantity * item.quantity;
          const currentDeduction = stockDeductionMap.get(cItem.productId) || 0;
          stockDeductionMap.set(cItem.productId, currentDeduction + needed);
        }
      } else if (item.productId) {
        const needed = item.quantity;
        const currentDeduction = stockDeductionMap.get(item.productId) || 0;
        stockDeductionMap.set(item.productId, currentDeduction + needed);
      }
    }

    for (const [prodId, requiredQty] of stockDeductionMap.entries()) {
      const currentStock = productStockMap.get(prodId) ?? 0;
      if (currentStock < requiredQty) {
        const prod = currentState.products.find((p) => p.id === prodId);
        return {
          success: false,
          error: `Stock insuficiente para "${prod?.name || 'Producto'}": disponible ${currentStock}, necesario ${requiredQty}.`,
        };
      }
    }

    // 2. Calcular importes
    const subtotal = input.items.reduce((acc, item) => acc + item.subtotal, 0);
    let totalDiscount = 0;
    if (input.discount > 0) {
      if (input.discountType === 'percentage') {
        totalDiscount = (subtotal * input.discount) / 100;
      } else {
        totalDiscount = Math.min(subtotal, input.discount);
      }
    }
    const finalTotal = Math.max(0, subtotal - totalDiscount);
    const saleId = `sale-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const receiptNumber = generateNextTicketNumber(currentState.sales);
    const nowISO = new Date().toISOString();

    const newSale: Sale = {
      id: saleId,
      receiptNumber,
      date: nowISO,
      items: input.items.map((it) => ({
        productId: it.productId,
        comboId: it.comboId,
        isCombo: it.isCombo,
        code: it.code,
        name: it.name,
        unitPrice: it.unitPrice,
        costPrice: it.costPrice,
        quantity: it.quantity,
        subtotal: it.subtotal,
        comboItems: it.comboItems,
      })),
      subtotal,
      discount: totalDiscount,
      discountType: input.discountType,
      total: finalTotal,
      paymentMethod: input.paymentMethod,
      amountTendered: input.amountTendered,
      changeGiven: input.changeGiven,
      customerId: input.customerId,
      customerName: input.customerName || (input.customerId ? 'Cliente Registrado' : undefined),
      notes: input.notes,
      status: 'completed',
    };

    // 3. Crear el ingreso automático
    const newIncome: Income = {
      id: `inc-sale-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      description: newSale.customerName ? `Venta ${receiptNumber} (${newSale.customerName})` : `Venta ${receiptNumber}`,
      amount: finalTotal,
      date: nowISO,
      category: 'Venta',
      paymentMethod: input.paymentMethod,
      saleId: newSale.id,
      notes: input.notes || `Cobro vía ${input.paymentMethod.toUpperCase()}`,
    };

    // 4. Auditoría de stock y guardado atómico
    await updateAndSaveState((prev) => {
      const newStockMovements: StockMovement[] = [];
      const updatedProducts = prev.products.map((p) => {
        const deduction = stockDeductionMap.get(p.id);
        if (deduction && deduction > 0) {
          newStockMovements.push({
            id: `sm-${Date.now()}-${p.id}`,
            date: nowISO,
            productId: p.id,
            productName: p.name,
            type: 'salida_venta',
            quantity: deduction,
            previousStock: p.stock,
            newStock: p.stock - deduction,
            reason: `Venta ${receiptNumber}`,
          });
          return {
            ...p,
            stock: p.stock - deduction,
            updatedAt: nowISO,
          };
        }
        return p;
      });

      let updatedCustomers = prev.customers;
      if (input.customerId) {
        updatedCustomers = prev.customers.map((c) => {
          if (c.id === input.customerId) {
            return {
              ...c,
              totalSpent: (c.totalSpent || 0) + finalTotal,
              purchaseCount: (c.purchaseCount || 0) + 1,
              lastPurchaseDate: nowISO,
            };
          }
          return c;
        });
      }

      return {
        ...prev,
        products: updatedProducts,
        sales: [newSale, ...prev.sales],
        incomes: [newIncome, ...prev.incomes],
        stockMovements: [...newStockMovements, ...prev.stockMovements],
        customers: updatedCustomers,
      };
    });

    return { success: true, sale: newSale };
  };

  // CANCELAR VENTA
  const cancelSale = async (saleId: string, reason: string): Promise<boolean> => {
    const current = stateRef.current;
    const saleToCancel = current.sales.find((s) => s.id === saleId);
    if (!saleToCancel || saleToCancel.status === 'cancelled') {
      return false;
    }

    const nowISO = new Date().toISOString();

    const stockReturnMap = new Map<string, number>();
    saleToCancel.items.forEach((item) => {
      if (item.isCombo && item.comboItems) {
        item.comboItems.forEach((cItem) => {
          const qty = cItem.quantity * item.quantity;
          stockReturnMap.set(cItem.productId, (stockReturnMap.get(cItem.productId) || 0) + qty);
        });
      } else if (item.productId) {
        stockReturnMap.set(item.productId, (stockReturnMap.get(item.productId) || 0) + item.quantity);
      }
    });

    const newStockMovements: StockMovement[] = [];
    const updatedProducts = current.products.map((p) => {
      const toReturn = stockReturnMap.get(p.id);
      if (toReturn && toReturn > 0) {
        newStockMovements.push({
          id: `sm-cancel-${Date.now()}-${p.id}`,
          date: nowISO,
          productId: p.id,
          productName: p.name,
          type: 'cancelacion_venta',
          quantity: toReturn,
          previousStock: p.stock,
          newStock: p.stock + toReturn,
          reason: `Cancelación ${saleToCancel.receiptNumber}: ${reason}`,
        });
        return {
          ...p,
          stock: p.stock + toReturn,
          updatedAt: nowISO,
        };
      }
      return p;
    });

    const updatedIncomes = current.incomes.filter((inc) => inc.saleId !== saleId);

    let updatedCustomers = current.customers;
    if (saleToCancel.customerId) {
      updatedCustomers = current.customers.map((c) => {
        if (c.id === saleToCancel.customerId) {
          return {
            ...c,
            totalSpent: Math.max(0, (c.totalSpent || 0) - saleToCancel.total),
            purchaseCount: Math.max(0, (c.purchaseCount || 0) - 1),
          };
        }
        return c;
      });
    }

    const updatedSales = current.sales.map((s) => {
      if (s.id === saleId) {
        return {
          ...s,
          status: 'cancelled' as const,
          cancelledAt: nowISO,
          cancelReason: reason,
        };
      }
      return s;
    });

    await updateAndSaveState((prev) => ({
      ...prev,
      products: updatedProducts,
      sales: updatedSales,
      incomes: updatedIncomes,
      stockMovements: [...newStockMovements, ...prev.stockMovements],
      customers: updatedCustomers,
    }));

    return true;
  };

  // PRODUCTOS
  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const nowISO = new Date().toISOString();
    const newProduct: Product = {
      ...productData,
      id: `prod-${Date.now()}`,
      createdAt: nowISO,
      updatedAt: nowISO,
    };

    const newMovements: StockMovement[] = [];
    if (newProduct.stock > 0) {
      newMovements.push({
        id: `sm-init-${Date.now()}`,
        date: nowISO,
        productId: newProduct.id,
        productName: newProduct.name,
        type: 'entrada',
        quantity: newProduct.stock,
        previousStock: 0,
        newStock: newProduct.stock,
        reason: 'Stock inicial al crear producto',
      });
    }

    await updateAndSaveState((prev) => ({
      ...prev,
      products: [newProduct, ...prev.products],
      stockMovements: [...newMovements, ...prev.stockMovements],
    }));

    return newProduct;
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const nowISO = new Date().toISOString();
    await updateAndSaveState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: nowISO } : p
      ),
    }));
  };

  const deleteProduct = async (id: string) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
      combos: prev.combos.map((c) => ({
        ...c,
        items: c.items.filter((item) => item.productId !== id),
      })),
    }));
  };

  // ENTRADA DE MERCADERÍA / COMPRA DE PRODUCTOS
  const addStockEntry = async (params: {
    productId: string;
    quantity: number;
    costPerUnit?: number;
    supplier?: string;
    registerExpense?: boolean;
    notes?: string;
  }) => {
    const { productId, quantity, costPerUnit, supplier, registerExpense, notes } = params;
    const targetProduct = stateRef.current.products.find((p) => p.id === productId);
    if (!targetProduct || quantity <= 0) return;

    const nowISO = new Date().toISOString();
    const prevStock = targetProduct.stock;
    const newStock = prevStock + quantity;
    const effectiveCost = costPerUnit !== undefined && costPerUnit > 0 ? costPerUnit : targetProduct.costPrice;

    const movement: StockMovement = {
      id: `sm-entry-${Date.now()}`,
      date: nowISO,
      productId,
      productName: targetProduct.name,
      type: 'entrada',
      quantity,
      previousStock: prevStock,
      newStock,
      reason: notes || `Ingreso de mercadería (+${quantity} u.)`,
    };

    let newExpense: Expense | null = null;
    if (registerExpense) {
      const totalExpenseAmount = effectiveCost * quantity;
      newExpense = {
        id: `exp-entry-${Date.now()}`,
        description: `Compra stock: ${targetProduct.name} (${quantity} u.)`,
        amount: totalExpenseAmount,
        date: nowISO,
        category: 'Mercadería',
        paymentMethod: 'efectivo',
        supplier: supplier || targetProduct.supplier,
        notes: notes || 'Compra directa de mercadería a proveedor',
      };
    }

    await updateAndSaveState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId
          ? {
              ...p,
              stock: newStock,
              costPrice: effectiveCost,
              supplier: supplier || p.supplier,
              updatedAt: nowISO,
            }
          : p
      ),
      stockMovements: [movement, ...prev.stockMovements],
      expenses: newExpense ? [newExpense, ...prev.expenses] : prev.expenses,
    }));
  };

  // PÉRDIDA / DAÑADO
  const recordStockLoss = async (params: {
    productId: string;
    quantity: number;
    reason: string;
    notes?: string;
  }) => {
    const { productId, quantity, reason, notes } = params;
    const targetProduct = stateRef.current.products.find((p) => p.id === productId);
    if (!targetProduct || quantity <= 0) return;

    const nowISO = new Date().toISOString();
    const prevStock = targetProduct.stock;
    const newStock = Math.max(0, prevStock - quantity);

    const movement: StockMovement = {
      id: `sm-loss-${Date.now()}`,
      date: nowISO,
      productId,
      productName: targetProduct.name,
      type: 'perdida',
      quantity,
      previousStock: prevStock,
      newStock,
      reason: `Pérdida/Merma: ${reason}${notes ? ` - ${notes}` : ''}`,
    };

    await updateAndSaveState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId ? { ...p, stock: newStock, updatedAt: nowISO } : p
      ),
      stockMovements: [movement, ...prev.stockMovements],
    }));
  };

  // COMBOS
  const createCombo = async (comboData: Omit<Combo, 'id' | 'createdAt' | 'updatedAt'>) => {
    const nowISO = new Date().toISOString();
    const newCombo: Combo = {
      ...comboData,
      id: `combo-${Date.now()}`,
      createdAt: nowISO,
      updatedAt: nowISO,
    };
    await updateAndSaveState((prev) => ({
      ...prev,
      combos: [newCombo, ...prev.combos],
    }));
    return newCombo;
  };

  const updateCombo = async (id: string, updates: Partial<Combo>) => {
    const nowISO = new Date().toISOString();
    await updateAndSaveState((prev) => ({
      ...prev,
      combos: prev.combos.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: nowISO } : c
      ),
    }));
  };

  const deleteCombo = async (id: string) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      combos: prev.combos.filter((c) => c.id !== id),
    }));
  };

  // PROVEEDORES
  const addSupplier = async (supplierData: Omit<Supplier, 'id' | 'createdAt'>) => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: `sup-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    await updateAndSaveState((prev) => ({
      ...prev,
      suppliers: [newSupplier, ...(prev.suppliers || [])],
    }));
    return newSupplier;
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      suppliers: (prev.suppliers || []).map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  };

  const deleteSupplier = async (id: string) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      suppliers: (prev.suppliers || []).filter((s) => s.id !== id),
    }));
  };

  // CRONOGRAMA DE PEDIDOS DE CLIENTES
  const addOrder = async (orderData: Omit<ClientOrder, 'id' | 'orderNumber' | 'orderDate'>) => {
    const existingOrders = stateRef.current.orders || [];
    let maxOrderNum = 1000;
    for (const o of existingOrders) {
      const m = o.orderNumber?.match(/(\d+)$/);
      if (m) {
        const val = parseInt(m[1], 10);
        if (!isNaN(val) && val > maxOrderNum) maxOrderNum = val;
      }
    }
    const nextOrderNum = `PED-${String(maxOrderNum + 1)}`;
    const newOrder: ClientOrder = {
      ...orderData,
      id: `ord-${Date.now()}`,
      orderNumber: nextOrderNum,
      orderDate: new Date().toISOString(),
    };

    // Si hubo seña o pago por adelantado, registrar ingreso correspondiente
    let newIncome: Income | null = null;
    if (newOrder.paidAmount > 0) {
      newIncome = {
        id: `inc-ord-${Date.now()}`,
        description: `Adelanto / Seña ${newOrder.orderNumber} (${newOrder.customerName})`,
        amount: newOrder.paidAmount,
        date: new Date().toISOString(),
        category: 'Venta',
        paymentMethod: newOrder.paymentMethod,
        notes: 'Pago anticipado por pedido programado',
      };
    }

    await updateAndSaveState((prev) => ({
      ...prev,
      orders: [newOrder, ...(prev.orders || [])],
      incomes: newIncome ? [newIncome, ...prev.incomes] : prev.incomes,
    }));

    return newOrder;
  };

  const updateOrder = async (id: string, updates: Partial<ClientOrder>) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      orders: (prev.orders || []).map((o) => (o.id === id ? { ...o, ...updates } : o)),
    }));
  };

  const updateOrderStatus = async (id: string, status: ClientOrder['status']) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      orders: (prev.orders || []).map((o) => (o.id === id ? { ...o, status } : o)),
    }));
  };

  const updateOrderPayment = async (id: string, paidAmount: number, paymentStatus: ClientOrder['paymentStatus']) => {
    const existing = (stateRef.current.orders || []).find((o) => o.id === id);
    if (!existing) return;
    const additionalPaid = Math.max(0, paidAmount - existing.paidAmount);

    let newIncome: Income | null = null;
    if (additionalPaid > 0) {
      newIncome = {
        id: `inc-ord-pay-${Date.now()}`,
        description: `Pago saldo ${existing.orderNumber} (${existing.customerName})`,
        amount: additionalPaid,
        date: new Date().toISOString(),
        category: 'Venta',
        paymentMethod: existing.paymentMethod,
        notes: 'Abono de saldo de pedido previo',
      };
    }

    await updateAndSaveState((prev) => ({
      ...prev,
      orders: (prev.orders || []).map((o) =>
        o.id === id ? { ...o, paidAmount, paymentStatus } : o
      ),
      incomes: newIncome ? [newIncome, ...prev.incomes] : prev.incomes,
    }));
  };

  const deliverOrderAsSale = async (orderId: string) => {
    const order = (stateRef.current.orders || []).find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Pedido no encontrado' };

    // Realizar la venta formal para descontar stock e imprimir comprobante
    const saleResult = await createSale({
      items: order.items,
      paymentMethod: order.paymentMethod,
      customerId: order.customerId,
      customerName: order.customerName,
      discount: 0,
      discountType: 'fixed',
      notes: `Entrega de Pedido ${order.orderNumber}. ${order.notes || ''}`,
    });

    if (saleResult.success) {
      // Marcar orden como entregada y pagada completa
      await updateAndSaveState((prev) => ({
        ...prev,
        orders: (prev.orders || []).map((o) =>
          o.id === orderId ? { ...o, status: 'entregado', paymentStatus: 'pagado', paidAmount: order.total } : o
        ),
      }));
    }

    return saleResult;
  };

  const deleteOrder = async (id: string) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      orders: (prev.orders || []).filter((o) => o.id !== id),
    }));
  };

  // CLIENTES
  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'totalSpent' | 'purchaseCount'>) => {
    const nowISO = new Date().toISOString();
    const newCustomer: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`,
      createdAt: nowISO,
      totalSpent: 0,
      purchaseCount: 0,
    };
    await updateAndSaveState((prev) => ({
      ...prev,
      customers: [newCustomer, ...prev.customers],
    }));
    return newCustomer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  const deleteCustomer = async (id: string) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      customers: prev.customers.filter((c) => c.id !== id),
    }));
  };

  // FINANZAS (INGRESOS Y EGRESOS)
  const addIncome = async (incomeData: Omit<Income, 'id' | 'date'>) => {
    const newIncome: Income = {
      ...incomeData,
      id: `inc-manual-${Date.now()}`,
      date: new Date().toISOString(),
    };
    await updateAndSaveState((prev) => ({
      ...prev,
      incomes: [newIncome, ...prev.incomes],
    }));
    return newIncome;
  };

  const deleteIncome = async (id: string) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      incomes: prev.incomes.filter((i) => i.id !== id),
    }));
  };

  const addExpense = async (expenseData: Omit<Expense, 'id' | 'date'>) => {
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      date: new Date().toISOString(),
    };
    await updateAndSaveState((prev) => ({
      ...prev,
      expenses: [newExpense, ...prev.expenses],
    }));
    return newExpense;
  };

  const deleteExpense = async (id: string) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
  };

  // CIERRE DE CAJA
  const performCashClosure = async (params: {
    actualCash: number;
    notes?: string;
    closedBy?: string;
    nextInitialBalance?: number;
  }) => {
    const current = stateRef.current;
    const now = new Date();
    const nowISO = now.toISOString();
    const dateStr = now.toISOString().split('T')[0];
    const openedAt = current.currentCashDrawer.openedAt;
    const initialBalance = current.currentCashDrawer.initialBalance;

    const openedAtTime = new Date(openedAt).getTime();
    const periodIncomes = current.incomes.filter((i) => new Date(i.date).getTime() >= openedAtTime);
    const periodExpenses = current.expenses.filter((e) => new Date(e.date).getTime() >= openedAtTime);

    const totalIncome = periodIncomes.reduce((acc, i) => acc + i.amount, 0);
    const totalExpenses = periodExpenses.reduce((acc, e) => acc + e.amount, 0);

    const cashIncomes = periodIncomes.filter((i) => i.paymentMethod === 'efectivo').reduce((acc, i) => acc + i.amount, 0);
    const cashExpenses = periodExpenses.filter((e) => e.paymentMethod === 'efectivo').reduce((acc, e) => acc + e.amount, 0);

    const expectedCash = initialBalance + cashIncomes - cashExpenses;
    const discrepancy = params.actualCash - expectedCash;

    const periodSales = current.sales.filter(
      (s) => s.status === 'completed' && new Date(s.date).getTime() >= openedAtTime
    );
    const totalCashSales = periodSales
      .filter((s) => s.paymentMethod === 'efectivo')
      .reduce((acc, s) => acc + s.total, 0);
    const totalTransferSales = periodSales
      .filter((s) => s.paymentMethod === 'transferencia')
      .reduce((acc, s) => acc + s.total, 0);
    const totalCardSales = periodSales
      .filter((s) => s.paymentMethod === 'debito' || s.paymentMethod === 'credito')
      .reduce((acc, s) => acc + s.total, 0);

    const closureRecord: CashClosure = {
      id: `close-${Date.now()}`,
      date: dateStr,
      openedAt,
      closedAt: nowISO,
      initialBalance,
      totalIncome,
      totalExpenses,
      expectedCash,
      actualCash: params.actualCash,
      discrepancy,
      totalCashSales,
      totalTransferSales,
      totalCardSales,
      notes: params.notes,
      closedBy: params.closedBy || 'Encargado de Turno',
    };

    const nextOpeningBalance = params.nextInitialBalance !== undefined
      ? params.nextInitialBalance
      : current.settings.initialBalanceDefault || 60000;

    await updateAndSaveState((prev) => ({
      ...prev,
      cashClosures: [closureRecord, ...prev.cashClosures],
      currentCashDrawer: {
        initialBalance: nextOpeningBalance,
        openedAt: nowISO,
      },
    }));

    return closureRecord;
  };

  const updateInitialCashDrawer = async (amount: number) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      currentCashDrawer: {
        ...prev.currentCashDrawer,
        initialBalance: amount,
      },
    }));
  };

  // CONFIGURACIÓN Y RESPALDOS
  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    await updateAndSaveState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...newSettings,
      },
    }));
  };

  const exportBackupFile = () => {
    const jsonStr = generateBackupJSON(stateRef.current);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `SuperCombos_Respaldo_${timestamp}`;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportExcelWorkbook = () => {
    exportFullExcelWorkbook(stateRef.current);
  };

  const importBackupFile = async (jsonContent: string) => {
    const result = validateBackupJSON(jsonContent);
    if (!result.isValid || !result.state) {
      return { success: false, error: result.error || 'Archivo inválido.' };
    }

    stateRef.current = result.state;
    setState(result.state);
    await saveDatabaseState(result.state);
    return { success: true };
  };

  const resetToDefault = async () => {
    const fresh = JSON.parse(JSON.stringify(INITIAL_SEED_STATE)) as AppDatabaseState;
    stateRef.current = fresh;
    setState(fresh);
    await saveDatabaseState(fresh);
  };

  return (
    <SupermarketContext.Provider
      value={{
        state,
        isLoading,
        metrics,
        createSale,
        cancelSale,
        addProduct,
        updateProduct,
        deleteProduct,
        addStockEntry,
        recordStockLoss,
        createCombo,
        updateCombo,
        deleteCombo,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        addOrder,
        updateOrder,
        updateOrderStatus,
        updateOrderPayment,
        deliverOrderAsSale,
        deleteOrder,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addIncome,
        addExpense,
        deleteExpense,
        deleteIncome,
        performCashClosure,
        updateInitialCashDrawer,
        updateSettings,
        exportBackupFile,
        exportExcelWorkbook,
        importBackupFile,
        resetToDefault,
      }}
    >
      {children}
    </SupermarketContext.Provider>
  );
};

export const useSupermarket = () => {
  const context = useContext(SupermarketContext);
  if (!context) {
    throw new Error('useSupermarket debe utilizarse dentro de un SupermarketProvider');
  }
  return context;
};
