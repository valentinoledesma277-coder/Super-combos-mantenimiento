import { Sale, StoreSettings } from '../types';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
}

export interface UsbDeviceLike {
  opened: boolean;
  productName?: string;
  manufacturerName?: string;
  configuration: {
    configurationValue: number;
    interfaces: Array<{
      interfaceNumber: number;
      alternates: Array<{
        endpoints: Array<{
          direction: 'in' | 'out';
          type: 'bulk' | 'interrupt' | 'isochronous';
          endpointNumber: number;
        }>;
      }>;
    }>;
  } | null;
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (configurationValue: number) => Promise<void>;
  claimInterface: (interfaceNumber: number) => Promise<void>;
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<{ status: string }>;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/**
 * Normaliza texto en español a caracteres ASCII seguros compatibles con cualquier impresora térmica ESC/POS
 * (evita símbolos raros en modelos PC437/PC850/GBK sin tabla UTF-8).
 */
function normalizeEscPosText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[°º]/g, 'o')
    .replace(/[¡¿]/g, '')
    .replace(/[^\x20-\x7E\n\r]/g, ' ');
}

function padLine(left: string, right: string, width: number): string {
  const cleanLeft = normalizeEscPosText(left);
  const cleanRight = normalizeEscPosText(right);
  const maxLeft = Math.max(4, width - cleanRight.length - 1);
  const truncatedLeft = cleanLeft.length > maxLeft ? cleanLeft.slice(0, maxLeft) : cleanLeft;
  const spaces = Math.max(1, width - truncatedLeft.length - cleanRight.length);
  return truncatedLeft + ' '.repeat(spaces) + cleanRight;
}

function encodeAscii(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes.push(code <= 0x7f ? code : 0x20);
  }
  return bytes;
}

/**
 * Construye el buffer binario ESC/POS listo para enviar a impresoras térmicas de 58mm u 80mm.
 */
export function buildEscPosTicket(sale: Sale, settings: StoreSettings): Uint8Array {
  const width = settings.printerPaperWidth === 58 ? 32 : 48;
  const divider = '-'.repeat(width);
  const autoCut = settings.printerAutoCut !== false;

  const buffer: number[] = [];
  const pushBytes = (...b: number[]) => buffer.push(...b);
  const pushLine = (line: string) => {
    buffer.push(...encodeAscii(normalizeEscPosText(line) + '\n'));
  };

  // Inicializar impresora (ESC @)
  pushBytes(0x1b, 0x40);

  // Encabezado centrado y en negrita grande
  pushBytes(0x1b, 0x61, 0x01); // Center
  pushBytes(0x1b, 0x45, 0x01); // Bold ON
  pushBytes(0x1d, 0x21, 0x11); // Double width & height
  pushLine((settings.storeName || 'Super Combos').toUpperCase());
  pushBytes(0x1d, 0x21, 0x00); // Normal size
  pushBytes(0x1b, 0x45, 0x00); // Bold OFF

  if (settings.cuit) pushLine(`CUIT: ${settings.cuit}`);
  if (settings.address) pushLine(settings.address);
  if (settings.phone) pushLine(`Tel: ${settings.phone}`);
  pushLine('TICKET DE COMPRA');

  // Datos del ticket alineados a la izquierda
  pushBytes(0x1b, 0x61, 0x00); // Left
  pushLine(divider);
  pushLine(padLine('Ticket:', sale.receiptNumber, width));
  pushLine(padLine('Fecha:', formatDateTime(sale.date), width));
  pushLine(padLine('Pago:', sale.paymentMethod.toUpperCase(), width));
  if (sale.customerName && sale.customerName !== 'Consumidor Final') {
    pushLine(padLine('Cliente:', sale.customerName, width));
  }
  pushLine(divider);

  // Detalle de productos / precios
  pushBytes(0x1b, 0x45, 0x01);
  pushLine(padLine('DETALLE', 'IMPORTE', width));
  pushBytes(0x1b, 0x45, 0x00);

  for (const item of sale.items) {
    const priceFormatted = formatCurrency(item.subtotal);
    const isManualPrice = item.code === 'PRECIO' || item.code === 'RAPIDO';

    if (isManualPrice) {
      pushLine(padLine(item.name, priceFormatted, width));
    } else {
      const label = item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name;
      if (label.length + priceFormatted.length + 1 <= width) {
        pushLine(padLine(label, priceFormatted, width));
      } else {
        pushLine(label.slice(0, width));
        const unitInfo =
          item.code && item.code !== 'ENCARGO'
            ? `  [${item.code}] ${item.quantity}x ${formatCurrency(item.unitPrice)}`
            : `  ${item.quantity}x ${formatCurrency(item.unitPrice)}`;
        pushLine(padLine(unitInfo, priceFormatted, width));
      }
    }
  }

  if (sale.notes) {
    pushLine(`Nota: ${sale.notes}`);
  }

  pushLine(divider);

  if (sale.discount > 0) {
    pushLine(padLine('Subtotal:', formatCurrency(sale.subtotal), width));
    pushLine(padLine('Descuento:', `-${formatCurrency(sale.discount)}`, width));
  }

  // Total en negrita doble altura
  pushBytes(0x1b, 0x45, 0x01);
  pushBytes(0x1d, 0x21, 0x01);
  pushLine(padLine('TOTAL:', formatCurrency(sale.total), width));
  pushBytes(0x1d, 0x21, 0x00);
  pushBytes(0x1b, 0x45, 0x00);

  if (sale.paymentMethod === 'efectivo' && sale.amountTendered && sale.amountTendered > 0) {
    pushLine(padLine('Abono con:', formatCurrency(sale.amountTendered), width));
    pushLine(padLine('Vuelto:', formatCurrency(sale.changeGiven || 0), width));
  }

  pushLine(divider);

  // Pie de página centrado
  pushBytes(0x1b, 0x61, 0x01);
  pushLine(settings.ticketFooter || 'Gracias por su compra!');
  pushLine('Super Combos');
  pushLine('');
  pushLine('');
  pushLine('');
  pushLine('');

  if (autoCut) {
    // GS V 66 0 (Feed and partial cut)
    pushBytes(0x1d, 0x56, 0x42, 0x00);
  }

  return new Uint8Array(buffer);
}

/**
 * Construye un ticket de prueba para verificar conexión física.
 */
export function buildEscPosTestTicket(settings: StoreSettings): Uint8Array {
  const mockSale: Sale = {
    id: 'test-print',
    receiptNumber: 'PRUEBA-001',
    date: new Date().toISOString(),
    items: [
      {
        isCombo: false,
        code: '77912340001',
        name: 'Prueba Lector / Impresora',
        unitPrice: 1500,
        costPrice: 1000,
        quantity: 1,
        subtotal: 1500,
      },
    ],
    subtotal: 1500,
    discount: 0,
    discountType: 'fixed',
    total: 1500,
    paymentMethod: 'efectivo',
    amountTendered: 2000,
    changeGiven: 500,
    notes: 'Ticket de verificacion de impresora local',
    status: 'completed',
  };
  return buildEscPosTicket(mockSale, settings);
}

export async function getAuthorizedSerialPorts(): Promise<SerialPortLike[]> {
  if (!isWebSerialSupported()) return [];
  try {
    const serialApi = (navigator as unknown as { serial: { getPorts: () => Promise<SerialPortLike[]> } }).serial;
    return await serialApi.getPorts();
  } catch {
    return [];
  }
}

export async function connectSerialPrinter(baudRate: number = 9600): Promise<SerialPortLike> {
  if (!isWebSerialSupported()) {
    throw new Error(
      'Tu navegador no soporta conexión directa por puerto Serie/USB (Web Serial). Usa Google Chrome o Edge en PC, o elige el modo Impresora del Sistema.'
    );
  }
  const serialApi = (navigator as unknown as { serial: { requestPort: () => Promise<SerialPortLike> } }).serial;
  const port = await serialApi.requestPort();
  if (!port.writable) {
    await port.open({ baudRate });
  }
  return port;
}

export async function printBytesToSerial(
  port: SerialPortLike,
  bytes: Uint8Array,
  baudRate: number = 9600
): Promise<void> {
  if (!port.writable) {
    await port.open({ baudRate });
  }
  if (!port.writable) {
    throw new Error('El puerto de la impresora no está disponible para escritura.');
  }
  const writer = port.writable.getWriter();
  try {
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
  }
}

export async function disconnectSerialPrinter(port: SerialPortLike | null): Promise<void> {
  if (!port) return;
  try {
    await port.close();
  } catch {
    // Ignore close errors if already closed
  }
}

export async function connectUsbPrinter(): Promise<UsbDeviceLike> {
  if (!isWebUsbSupported()) {
    throw new Error(
      'Tu navegador no soporta WebUSB. Usa Google Chrome o Edge, o utiliza la conexión Serie / Impresora del Sistema.'
    );
  }
  const usbApi = (navigator as unknown as { usb: { requestDevice: (opts: { filters: unknown[] }) => Promise<UsbDeviceLike> } }).usb;
  const device = await usbApi.requestDevice({ filters: [] });
  if (!device.opened) {
    await device.open();
  }
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }
  const outInfo = findUsbOutEndpoint(device);
  if (!outInfo) {
    throw new Error('El dispositivo USB seleccionado no tiene un canal de salida para impresión.');
  }
  await device.claimInterface(outInfo.interfaceNumber);
  return device;
}

function findUsbOutEndpoint(device: UsbDeviceLike): { interfaceNumber: number; endpointNumber: number } | null {
  const interfaces = device.configuration?.interfaces || [];
  for (const iface of interfaces) {
    for (const alt of iface.alternates) {
      for (const ep of alt.endpoints) {
        if (ep.direction === 'out') {
          return { interfaceNumber: iface.interfaceNumber, endpointNumber: ep.endpointNumber };
        }
      }
    }
  }
  return null;
}

export async function printBytesToUsb(device: UsbDeviceLike, bytes: Uint8Array): Promise<void> {
  if (!device.opened) {
    await device.open();
  }
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }
  const outInfo = findUsbOutEndpoint(device);
  if (!outInfo) {
    throw new Error('No se encontró el canal de impresión USB.');
  }
  await device.claimInterface(outInfo.interfaceNumber);
  await device.transferOut(outInfo.endpointNumber, bytes as unknown as BufferSource);
}

export async function disconnectUsbPrinter(device: UsbDeviceLike | null): Promise<void> {
  if (!device) return;
  try {
    if (device.opened) {
      await device.close();
    }
  } catch {
    // Ignore
  }
}
