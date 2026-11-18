import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Sale } from '../types';
import { useSupermarket } from './SupermarketContext';
import {
  SerialPortLike,
  buildEscPosTicket,
  getAuthorizedSerialPorts,
  printBytesToSerial,
} from '../services/printerService';

interface PrinterContextType {
  isPrinting: boolean;
  systemPrintSale: Sale | null;
  printSaleTicket: (sale: Sale) => Promise<void>;
}

const PrinterContext = createContext<PrinterContextType | null>(null);

export const PrinterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useSupermarket();
  const serialPortRef = useRef<SerialPortLike | null>(null);

  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [systemPrintSale, setSystemPrintSale] = useState<Sale | null>(null);

  const baudRate = state.settings.printerBaudRate || 9600;

  // Si el dispositivo ya tiene una impresora térmica Serie/USB autorizada, la usa silenciosamente
  useEffect(() => {
    let active = true;
    getAuthorizedSerialPorts().then(async (ports) => {
      if (!active || ports.length === 0) return;
      const firstPort = ports[0];
      try {
        if (!firstPort.writable) {
          await firstPort.open({ baudRate });
        }
        if (active) {
          serialPortRef.current = firstPort;
        }
      } catch {
        // Si no está disponible, usará automáticamente la impresora del sistema
      }
    });
    return () => {
      active = false;
    };
  }, [baudRate]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setSystemPrintSale(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const triggerDevicePrint = useCallback((sale: Sale) => {
    flushSync(() => {
      setSystemPrintSale(sale);
    });
    window.print();
  }, []);

  const printSaleTicket = useCallback(
    async (sale: Sale): Promise<void> => {
      setIsPrinting(true);
      try {
        if (serialPortRef.current && serialPortRef.current.writable) {
          const bytes = buildEscPosTicket(sale, state.settings);
          await printBytesToSerial(serialPortRef.current, bytes, baudRate);
          return;
        }
        triggerDevicePrint(sale);
      } catch {
        // Fallback automático a cualquier impresora conectada al dispositivo
        triggerDevicePrint(sale);
      } finally {
        setIsPrinting(false);
      }
    },
    [state.settings, baudRate, triggerDevicePrint]
  );

  return (
    <PrinterContext.Provider
      value={{
        isPrinting,
        systemPrintSale,
        printSaleTicket,
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
};

export const usePrinter = () => {
  const ctx = useContext(PrinterContext);
  if (!ctx) {
    throw new Error('usePrinter debe usarse dentro de un PrinterProvider');
  }
  return ctx;
};
