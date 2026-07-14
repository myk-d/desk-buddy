import { SerialPort } from 'serialport';
import { ESPLoader, Transport } from 'esptool-js';

const TARGET_VID = '303a';
const APP_FLASH_ADDR = 0x10000; // standard ESP32 app0 partition offset

// Fake WebSerial SerialPort backed by Node.js serialport.
// The real Transport class from esptool-js handles all SLIP framing and buffering;
// we only need to implement the device interface it calls.
class NodeSerialPort {
	readable: ReadableStream<Uint8Array> | null = null;
	writable: WritableStream<Uint8Array> | null = null;
	private port: SerialPort | null = null;

	constructor(private readonly _path: string) {}

	async open(opts: { baudRate: number }): Promise<void> {
		this.port = new SerialPort({ path: this._path, baudRate: opts.baudRate, autoOpen: false });
		await new Promise<void>((res, rej) => this.port!.open(e => (e ? rej(e) : res())));

		this.readable = new ReadableStream<Uint8Array>({
			start: (controller) => {
				this.port!.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
				this.port!.on('close', () => controller.close());
				this.port!.on('error', (e: Error) => controller.error(e));
			},
		});

		this.writable = new WritableStream<Uint8Array>({
			write: (chunk) =>
				new Promise<void>((res, rej) =>
					this.port!.write(Buffer.from(chunk), e => (e ? rej(e) : res())),
				),
		});
	}

	async close(): Promise<void> {
		if (this.port?.isOpen) {
			await new Promise<void>(res => this.port!.close(() => res()));
		}
		this.readable = null;
		this.writable = null;
		this.port = null;
	}

	async setSignals(s: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void> {
		const opts: { dtr?: boolean; rts?: boolean } = {};
		if (s.dataTerminalReady !== undefined) opts.dtr = s.dataTerminalReady;
		if (s.requestToSend !== undefined) opts.rts = s.requestToSend;
		await new Promise<void>(res => this.port!.set(opts, () => res()));
	}

	getInfo(): { usbVendorId?: number; usbProductId?: number } {
		return { usbVendorId: 0x303a };
	}
}

// Open port at 1200 baud then close — this triggers the Arduino ESP32 USB CDC
// auto-reset into ROM download mode (same as PlatformIO --before=usb_reset).
export async function triggerBootloaderReset(portPath: string): Promise<void> {
	const p = new SerialPort({ path: portPath, baudRate: 1200, autoOpen: false });
	await new Promise<void>((res, rej) => p.open(e => (e ? rej(e) : res())));
	await new Promise(res => setTimeout(res, 300));
	await new Promise<void>(res => p.close(() => res()));
}

// Poll until the ESP32 (VID 303a) reappears after bootloader reset.
export async function findEspPort(maxWaitMs = 10000): Promise<string> {
	const deadline = Date.now() + maxWaitMs;
	while (Date.now() < deadline) {
		await new Promise(res => setTimeout(res, 400));
		const ports = await SerialPort.list();
		const esp = ports.find(p => p.vendorId?.toLowerCase() === TARGET_VID);
		if (esp) return esp.path;
	}
	throw new Error(
		'ESP32 not found in bootloader mode. ' +
		'Try holding the BOOT button and pressing RESET on the device, then retry.',
	);
}

export async function flashFirmware(
	portPath: string,
	firmware: Uint8Array,
	onProgress: (pct: number, status: string) => void,
): Promise<void> {
	onProgress(5, 'Connecting to bootloader...');

	const device = new NodeSerialPort(portPath);
	const transport = new Transport(device as any, false);
	const loader = new ESPLoader({
		transport,
		baudrate: 115200,
		terminal: {
			clean: () => {},
			writeLine: (s: string) => console.log('[esptool]', s),
			write: (s: string) => process.stdout.write(s),
		},
	});

	// "no_reset" — device is already in bootloader mode via the 1200-baud trick
	await loader.main('no_reset');
	onProgress(15, 'Chip detected. Writing firmware...');

	await loader.writeFlash({
		fileArray: [{ data: firmware, address: APP_FLASH_ADDR }],
		flashSize: 'keep',
		flashMode: 'dio',
		flashFreq: '80m',
		eraseAll: false,
		compress: true,
		reportProgress: (_i: number, written: number, total: number) => {
			const pct = 15 + Math.round((written / total) * 80);
			onProgress(pct, `Writing ${pct}%`);
		},
	});

	onProgress(97, 'Resetting device...');
	await loader.after('hard_reset');
	await transport.disconnect();
	onProgress(100, 'Done!');
}
