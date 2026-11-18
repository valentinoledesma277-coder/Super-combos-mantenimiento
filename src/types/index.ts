export type PaymentMethod = 'efectivo' | 'transferencia' | 'debito' | 'credito' | 'otro';

export type IncomeCategory = 'Venta' | 'Cobro deudas' | 'Inversión' | 'Otro';

export type ExpenseCategory = 
  | 'Mercadería' 
  | 'Proveedores' 
  | 'Sueldos' 
  | 'Servicios' 
  | 'Alquiler' 
  | 'Transporte' 
  | 'Mantenimiento' 
  | 'Impuestos' 
  | 'Otro';

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone: string;
  email?: string;
  address?: string;
  category: string;
  leadTimeDays?: number; // Días promedio de entrega
  deliveryDays?: string; // Ej: "Lunes y Jueves"
  notes?: string;
  createdAt: string;
}

export interface ClientOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  orderDate: string; // ISO
  deliveryDate: string; // Fecha acordada de entrega (ISO o YYYY-MM-DD)
  deliveryTimeSlot?: string; // Ej: "Mañana 10:00 - 13:00"
  status: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado';
  items: CartItem[];
  total: number;
  paidAmount: number; // Adelanto / seña
  paymentStatus: 'pendiente' | 'parcial' | 'pagado';
  paymentMethod: PaymentMethod;
  itemsDescription?: string; // Anotación detallada de lo que lleva el pedido
  notes?: string;
  isComboOrder?: boolean;
}

export interface Product {
  id: string;
  code: string; // Barcode or SKU
  name: string;
  category: string;
  costPrice: number; // Precio de compra
  salePrice: number; // Precio de venta
  stock: number; // Cantidad disponible
  minStock: number; // Stock mínimo para alertas
  supplier?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComboItem {
  productId: string;
  productName: string;
  quantity: number;
  costPrice: number;
  regularSalePrice: number;
}

export interface Combo {
  id: string;
  code: string;
  name: string;
  description?: string;
  salePrice: number; // Precio especial del combo
  items: ComboItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  createdAt: string;
  totalSpent: number;
  purchaseCount: number;
  lastPurchaseDate?: string;
}

export interface CartItem {
  id: string; // generated unique cart id
  productId?: string;
  comboId?: string;
  isCombo: boolean;
  code: string;
  name: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  subtotal: number;
  comboItems?: ComboItem[];
}

export interface SaleItem {
  productId?: string;
  comboId?: string;
  isCombo: boolean;
  code: string;
  name: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  subtotal: number;
  comboItems?: ComboItem[];
}

export interface Sale {
  id: string;
  receiptNumber: string; // e.g. "TKT-000104"
  date: string; // ISO string
  items: SaleItem[];
  subtotal: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered?: number; // Dinero recibido
  changeGiven?: number; // Vuelto
  customerId?: string;
  customerName?: string;
  notes?: string;
  status: 'completed' | 'cancelled';
  cancelledAt?: string;
  cancelReason?: string;
}

export interface Income {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: IncomeCategory;
  paymentMethod: PaymentMethod;
  saleId?: string;
  notes?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  notes?: string;
  supplier?: string;
  stockEntryId?: string;
}

export interface CashClosure {
  id: string;
  date: string;
  openedAt: string;
  closedAt: string;
  initialBalance: number;
  totalIncome: number;
  totalExpenses: number;
  expectedCash: number;
  actualCash: number;
  discrepancy: number; // actualCash - expectedCash (positivo = sobrante, negativo = faltante)
  totalCashSales: number;
  totalTransferSales: number;
  totalCardSales: number;
  notes?: string;
  closedBy?: string;
}

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  type: 'entrada' | 'salida_venta' | 'cancelacion_venta' | 'perdida' | 'ajuste';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
}

export interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
  cuit: string;
  ticketFooter: string;
  initialBalanceDefault: number;
  enablePinSecurity: boolean;
  adminPin: string;
  printerMode?: 'escpos-serial' | 'escpos-usb' | 'system-print';
  printerPaperWidth?: 58 | 80;
  printerBaudRate?: 9600 | 19200 | 38400 | 115200;
  printerAutoPrint?: boolean;
  printerAutoCut?: boolean;
  printerName?: string;
}

export interface AppDatabaseState {
  version: number;
  lastBackupDate?: string;
  settings: StoreSettings;
  products: Product[];
  combos: Combo[];
  customers: Customer[];
  suppliers: Supplier[];
  orders: ClientOrder[];
  sales: Sale[];
  incomes: Income[];
  expenses: Expense[];
  cashClosures: CashClosure[];
  stockMovements: StockMovement[];
  currentCashDrawer: {
    initialBalance: number;
    openedAt: string;
  };
}

export type ActiveTab = 
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'combos'
  | 'orders'
  | 'suppliers'
  | 'finances'
  | 'cash'
  | 'customers'
  | 'backups';
