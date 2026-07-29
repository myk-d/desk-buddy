import http from 'http';
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

// OTA flash over WiFi — the device's own /update endpoint (web_server.h),
// sidestepping the whole USB bootloader-reset dance above entirely (this
// device's Linux USB-CDC driver doesn't support the DTR/RTS toggling esptool
// needs). Must be sent as multipart/form-data — the firmware's WebServer
// upload callback is the only path there that streams the body incrementally
// without buffering the whole multi-hundred-KB image into RAM first.
const OTA_BOUNDARY = '----GazeBuddyOTABoundary7f3a9c2e';

export async function otaFlash(
	host: string,
	token: string,
	firmware: Buffer,
	onProgress: (pct: number, status: string) => void,
): Promise<void> {
	const head = Buffer.from(
		`--${OTA_BOUNDARY}\r\n` +
		'Content-Disposition: form-data; name="firmware"; filename="firmware.bin"\r\n' +
		'Content-Type: application/octet-stream\r\n\r\n',
	);
	const tail = Buffer.from(`\r\n--${OTA_BOUNDARY}--\r\n`);
	const totalLength = head.length + firmware.length + tail.length;

	onProgress(5, 'Uploading over WiFi...');

	await new Promise<void>((resolve, reject) => {
		const req = http.request(
			{
				hostname: host,
				port: 80,
				path: '/update',
				method: 'POST',
				headers: {
					'X-Gaze-Token': token,
					'Content-Type': `multipart/form-data; boundary=${OTA_BOUNDARY}`,
					'Content-Length': totalLength,
				},
				timeout: 60000,
			},
			(res) => {
				let body = '';
				res.on('data', (c: string) => (body += c));
				res.on('end', () => {
					if (res.statusCode === 200) resolve();
					else reject(new Error(`Device rejected update (${res.statusCode}): ${body}`));
				});
			},
		);
		req.on('error', reject);
		req.on('timeout', () => { req.destroy(); reject(new Error('Upload timed out')); });

		req.write(head);
		const CHUNK_SIZE = 8192;
		let sent = 0;
		const writeNext = () => {
			if (sent >= firmware.length) {
				req.end(tail);
				return;
			}
			const chunk = firmware.subarray(sent, Math.min(sent + CHUNK_SIZE, firmware.length));
			sent += chunk.length;
			const pct = 5 + Math.round((sent / firmware.length) * 90);
			onProgress(pct, `Uploading ${pct}%`);
			if (req.write(chunk)) writeNext();
			else req.once('drain', writeNext);
		};
		writeNext();
	});

	onProgress(100, 'Done! Device is rebooting...');
}
