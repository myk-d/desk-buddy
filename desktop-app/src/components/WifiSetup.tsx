import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2, Lock } from 'lucide-react';
import type { WifiNetwork, WifiStatus } from '../types';

function signalBars(rssi: number): number {
	if (rssi >= -60) return 3;
	if (rssi >= -75) return 2;
	return 1;
}

interface WifiSetupProps {
	// Called once after a successful connect (or an explicit skip, if
	// `onSkip` isn't provided separately) — the welcome screen uses this to
	// move on; the Device page section can just leave it unset.
	onConnected?: () => void;
	// Only rendered when provided — the welcome screen offers a skip path,
	// the Device page's own section doesn't need one.
	onSkip?: () => void;
}

export function WifiSetup({ onConnected, onSkip }: WifiSetupProps) {
	const [status, setStatus] = useState<WifiStatus | null>(null);
	const [networks, setNetworks] = useState<WifiNetwork[] | null>(null);
	const [scanning, setScanning] = useState(false);
	const [selectedSsid, setSelectedSsid] = useState<string | null>(null);
	const [password, setPassword] = useState('');
	const [connecting, setConnecting] = useState(false);
	const [connectedIp, setConnectedIp] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		window.api.wifi.status().then(setStatus);
	}, []);

	async function scan() {
		setError(null);
		setScanning(true);
		setSelectedSsid(null);
		try {
			const found = await window.api.wifi.scan();
			setNetworks([...found].sort((a, b) => b.rssi - a.rssi));
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : 'Could not scan for networks.');
		} finally {
			setScanning(false);
		}
	}

	async function connect() {
		if (!selectedSsid) return;
		setError(null);
		setConnecting(true);
		try {
			const result = await window.api.wifi.connect(selectedSsid, password);
			if (result.connected) {
				setConnectedIp(result.ip);
				setStatus({ configured: true, ssid: selectedSsid });
				onConnected?.();
			} else {
				setError('Could not connect to that network — check the password and try again.');
			}
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : 'Connection failed.');
		} finally {
			setConnecting(false);
		}
	}

	async function forget() {
		await window.api.wifi.forget();
		setStatus({ configured: false, ssid: null });
		setNetworks(null);
		setSelectedSsid(null);
		setConnectedIp(null);
		setPassword('');
	}

	// Already configured (and not mid-way through re-setup) — show status + forget.
	if (status?.configured && !networks) {
		return (
			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
					<Wifi size={18} className="text-brand-600" />
					<div className="min-w-0 flex-1">
						<div className="truncate text-sm font-medium text-stone-800">Connected to {status.ssid}</div>
						<div className="text-xs text-stone-500">
							Firmware updates and notifications now reach the device directly. Keep this app running
							for accurate Claude Code stats.
						</div>
					</div>
				</div>
				<button
					onClick={forget}
					className="self-start rounded-full border border-stone-200 px-4 py-1.5 text-sm text-stone-500 hover:bg-stone-100"
				>
					Forget network
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{error && (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
			)}

			{connectedIp && (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					Connected! The device is reachable at {connectedIp}.
				</div>
			)}

			{!networks && !connectedIp && (
				<button
					onClick={scan}
					disabled={scanning}
					className="flex items-center gap-2 self-start rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
				>
					{scanning ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
					{scanning ? 'Scanning…' : 'Scan for networks'}
				</button>
			)}

			{networks && !connectedIp && (
				<div className="flex flex-col gap-2">
					{networks.length === 0 ? (
						<div className="flex items-center gap-2 text-sm text-stone-500">
							<WifiOff size={16} /> No networks found nearby.
						</div>
					) : (
						<div className="flex flex-col divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
							{networks.map((net) => (
								<button
									key={net.ssid}
									onClick={() => setSelectedSsid(net.ssid)}
									className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition ${
										selectedSsid === net.ssid ? 'bg-brand-50 text-brand-700' : 'text-stone-700 hover:bg-stone-50'
									}`}
								>
									<span className="min-w-0 truncate">{net.ssid}</span>
									<span className="flex shrink-0 items-end gap-0.5">
										{[1, 2, 3].map((bar) => (
											<span
												key={bar}
												className={`w-1 rounded-sm ${bar <= signalBars(net.rssi) ? 'bg-brand-500' : 'bg-stone-200'}`}
												style={{ height: `${bar * 4}px` }}
											/>
										))}
									</span>
								</button>
							))}
						</div>
					)}

					{selectedSsid && (
						<div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
							<label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
								<Lock size={12} /> Password for {selectedSsid}
							</label>
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && connect()}
								placeholder="Leave blank for an open network"
								autoFocus
								className="w-full min-w-0 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
							/>
							<button
								onClick={connect}
								disabled={connecting}
								className="flex items-center justify-center gap-2 self-start rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
							>
								{connecting && <Loader2 size={16} className="animate-spin" />}
								{connecting ? 'Connecting…' : 'Connect'}
							</button>
						</div>
					)}

					<button onClick={scan} disabled={scanning} className="self-start text-xs text-stone-400 hover:text-stone-600">
						Rescan
					</button>
				</div>
			)}

			{onSkip && !connectedIp && (
				<button onClick={onSkip} className="self-start text-sm text-stone-400 hover:text-stone-600">
					Skip for now
				</button>
			)}
		</div>
	);
}
