import { AppDatabaseState } from '../types';
import { INITIAL_SEED_STATE } from './seedData';

const DB_NAME = 'SuperCombos_OfflineDB';
const DB_VERSION = 2;
const STORE_NAME = 'app_state_store';
const STATE_KEY = 'supercombos_full_state';
const LOCAL_STORAGE_KEY = 'supercombos_offline_data_mirror';

let dbInstance: IDBDatabase | null = null;
let saveQueue: Promise<void> = Promise.resolve();
let persistentRequested = false;

export async function requestDevicePersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      const alreadyPersisted = await navigator.storage.persisted?.();
      if (alreadyPersisted) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // Entornos sin navigator.storage.persist siguen guardando en IndexedDB + LocalStorage
  }
  return false;
}

export async function getDeviceStorageStatus(): Promise<{
  isPersistentGranted: boolean;
  localStorageKB: number;
  hasIndexedDB: boolean;
}> {
  let isPersistentGranted = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
      isPersistentGranted = await navigator.storage.persisted();
    }
  } catch {
    isPersistentGranted = false;
  }

  let localStorageKB = 0;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY) || '';
    localStorageKB = Math.round((raw.length * 2) / 1024);
  } catch {
    localStorageKB = 0;
  }

  return {
    isPersistentGranted,
    localStorageKB,
    hasIndexedDB: typeof indexedDB !== 'undefined',
  };
}

function getIDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este entorno'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        dbInstance = null;
      };
      db.onversionchange = () => {
        db.close();
        dbInstance = null;
      };
      dbInstance = db;
      resolve(db);
    };

    request.onerror = () => {
      console.warn('Error al abrir IndexedDB, usando fallback', request.error);
      reject(request.error);
    };
  });
}

const SEED_CUSTOMER_IDS = new Set(['cust-001', 'cust-002', 'cust-003', 'cust-004']);
const SEED_SALE_IDS = new Set(['sale-001', 'sale-002', 'sale-003']);
const SEED_ORDER_IDS = new Set(['ord-001', 'ord-002', 'ord-003']);
const SEED_INCOME_IDS = new Set(['inc-001', 'inc-002', 'inc-003', 'inc-004']);
const SEED_MOVEMENT_IDS = new Set(['sm-002']);

function reconcileAndMigrateState(storedState: AppDatabaseState): { state: AppDatabaseState; migrated: boolean } {
  const needsV3Cleanup = (storedState.version || 0) < 3;

  const rawCustomers = storedState.customers || [];
  const rawSales = storedState.sales || [];
  const rawOrders = storedState.orders || [];
  const rawIncomes = storedState.incomes || [];
  const rawMovements = storedState.stockMovements || [];

  const cleanCustomers = needsV3Cleanup
    ? rawCustomers.filter((c) => !SEED_CUSTOMER_IDS.has(c.id))
    : rawCustomers;

  const cleanSales = (needsV3Cleanup
    ? rawSales.filter((s) => !SEED_SALE_IDS.has(s.id))
    : rawSales
  ).map((s) =>
    s.customerName === 'Consumidor Final' ? { ...s, customerName: undefined } : s
  );

  const cleanOrders = needsV3Cleanup
    ? rawOrders.filter((o) => !SEED_ORDER_IDS.has(o.id))
    : rawOrders;

  const cleanIncomes = needsV3Cleanup
    ? rawIncomes.filter((i) => !SEED_INCOME_IDS.has(i.id) && (!i.saleId || !SEED_SALE_IDS.has(i.saleId)))
    : rawIncomes;

  const cleanMovements = needsV3Cleanup
    ? rawMovements.filter((m) => !SEED_MOVEMENT_IDS.has(m.id))
    : rawMovements;

  const reconciled: AppDatabaseState = {
    ...INITIAL_SEED_STATE,
    ...storedState,
    version: 3,
    customers: cleanCustomers,
    sales: cleanSales,
    orders: cleanOrders,
    incomes: cleanIncomes,
    expenses: Array.isArray(storedState.expenses) ? storedState.expenses : [],
    cashClosures: Array.isArray(storedState.cashClosures) ? storedState.cashClosures : [],
    stockMovements: cleanMovements,
    suppliers: Array.isArray(storedState.suppliers) ? storedState.suppliers : INITIAL_SEED_STATE.suppliers,
    settings: {
      ...INITIAL_SEED_STATE.settings,
      ...storedState.settings,
      storeName:
        storedState.settings?.storeName === 'Supermercado Central Express'
          ? 'Super Combos'
          : storedState.settings?.storeName || 'Super Combos',
    },
  };

  return { state: reconciled, migrated: needsV3Cleanup };
}

/**
 * Guarda síncronamente una copia espejo en LocalStorage para protección inmediata ante cierre.
 */
export function syncMirrorToLocalStorage(state: AppDatabaseState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (lsErr) {
    console.warn('Advertencia al escribir en LocalStorage:', lsErr);
  }
}

/**
 * Carga el estado inicial desde IndexedDB o localStorage.
 * Si es la primera vez que se ejecuta la app, inicializa con los datos base de Super Combos.
 */
export async function loadDatabaseState(): Promise<AppDatabaseState> {
  if (!persistentRequested) {
    persistentRequested = true;
    void requestDevicePersistentStorage();
  }

  // Primero intentamos leer de IndexedDB
  try {
    const db = await getIDB();
    const storedState = await new Promise<AppDatabaseState | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => resolve(req.result as AppDatabaseState | undefined);
      req.onerror = () => reject(req.error);
    });

    if (storedState && Array.isArray(storedState.products) && Array.isArray(storedState.sales)) {
      const { state: reconciled, migrated } = reconcileAndMigrateState(storedState);
      syncMirrorToLocalStorage(reconciled);
      if (migrated) {
        saveDatabaseState(reconciled).catch(console.error);
      }
      return reconciled;
    }
  } catch (err) {
    console.warn('IndexedDB no disponible o vacío, verificando LocalStorage:', err);
  }

  // Si no estaba en IndexedDB, comprobamos LocalStorage
  try {
    const lsItem = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (lsItem) {
      const parsed = JSON.parse(lsItem) as AppDatabaseState;
      if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.sales)) {
        const { state: reconciled } = reconcileAndMigrateState(parsed);
        saveDatabaseState(reconciled).catch(console.error);
        return reconciled;
      }
    }
  } catch (err) {
    console.error('Error al leer de LocalStorage:', err);
  }

  // Primera ejecución: Guardamos datos iniciales
  const defaultState = JSON.parse(JSON.stringify(INITIAL_SEED_STATE)) as AppDatabaseState;
  await saveDatabaseState(defaultState);
  return defaultState;
}

/**
 * Guarda el estado completo de manera atómica y secuencial tanto en LocalStorage como en IndexedDB.
 */
export async function saveDatabaseState(state: AppDatabaseState): Promise<void> {
  syncMirrorToLocalStorage(state);

  saveQueue = saveQueue.then(async () => {
    try {
      const db = await getIDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(state, STATE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (idbErr) {
      dbInstance = null;
      console.warn('Advertencia al guardar en IndexedDB:', idbErr);
    }
  });

  return saveQueue;
}

/**
 * Exporta un respaldo íntegro en formato JSON.
 */
export function generateBackupJSON(state: AppDatabaseState): string {
  const exportData = {
    ...state,
    lastBackupDate: new Date().toISOString(),
    exportMeta: {
      appName: 'Super Combos',
      exportedAt: new Date().toISOString(),
      recordCounts: {
        products: state.products.length,
        combos: state.combos.length,
        suppliers: state.suppliers?.length || 0,
        orders: state.orders?.length || 0,
        customers: state.customers.length,
        sales: state.sales.length,
        incomes: state.incomes.length,
        expenses: state.expenses.length,
      },
    },
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Valida un JSON de respaldo antes de restaurarlo.
 */
export function validateBackupJSON(jsonStr: string): { isValid: boolean; state?: AppDatabaseState; error?: string } {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'El archivo no contiene un JSON válido.' };
    }

    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.sales)) {
      return { isValid: false, error: 'El archivo no tiene la estructura de la base de datos de Super Combos.' };
    }

    const state: AppDatabaseState = {
      version: parsed.version || 3,
      lastBackupDate: parsed.lastBackupDate || new Date().toISOString(),
      settings: parsed.settings || INITIAL_SEED_STATE.settings,
      products: parsed.products || [],
      combos: parsed.combos || [],
      customers: parsed.customers || [],
      suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : INITIAL_SEED_STATE.suppliers,
      orders: Array.isArray(parsed.orders) ? parsed.orders : INITIAL_SEED_STATE.orders,
      sales: parsed.sales || [],
      incomes: parsed.incomes || [],
      expenses: parsed.expenses || [],
      cashClosures: parsed.cashClosures || [],
      stockMovements: parsed.stockMovements || [],
      currentCashDrawer: parsed.currentCashDrawer || INITIAL_SEED_STATE.currentCashDrawer,
    };

    return { isValid: true, state };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido al procesar el archivo';
    return { isValid: false, error: message };
  }
}
