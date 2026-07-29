import { useEffect, useState } from 'react';
import { WifiSetup } from './WifiSetup';
import type { ClaudeUsage } from '../types';

type UpdateInfo = { version: string; firmwareUrl: string } | null;

function fmtResetsIn(unixSeconds: number | null): string | null {
	if (!unixSeconds) return null;
	const ms = unixSeconds * 1000 - Date.now();
	if (ms <= 0) return 'resets now';
	const hrs = Math.floor(ms / 3_600_000);
	const mins = Math.floor((ms % 3_600_000) / 60_000);
	if (hrs >= 24) return `resets in ${Math.floor(hrs / 24)}d ${hrs % 24}h`;
	if (hrs > 0) return `resets in ${hrs}h ${mins}m`;
	return `resets in ${mins}m`;
}

function pctColor(pct: number | null): string {
	if (pct === null) return '#a8a29e'; // stone-400
	if (pct >= 90) return '#f87171'; // red-400
	if (pct >= 70) return '#fbbf24'; // amber-400
	return '#22c55e'; // green-500
}

const STATE_LABEL: Record<string, string> = {
	idle: 'Idle',
	working: 'Working…',
	done: 'Done',
	waiting: 'Needs attention',
};
const STATE_COLOR: Record<string, string> = {
	idle: '#a8a29e', // stone-400
	working: '#a855f7', // brand-500
	done: '#4ade80', // green-400
	waiting: '#f87171', // red-400
};

// $CLAUDE_CODE_ENTRYPOINT values Claude Code is known to set — anything else
// falls back to showing the raw value.
const SOURCE_LABEL: Record<string, string> = {
	cli: 'via terminal',
	'claude-vscode': 'via VS Code extension',
};

export function DevicePage({ connected }: { connected: boolean }) {
	const [deviceVersion, setDeviceVersion] = useState<string | null>(null);
	const [latest, setLatest] = useState<UpdateInfo>(null);
	const [checking, setChecking] = useState(false);
	const [flashing, setFlashing] = useState(false);
	const [progress, setProgress] = useState<{ pct: number; status: string } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	const [hooksSetup, setHooksSetup] = useState<boolean | null>(null);
	const [settingUp, setSettingUp] = useState(false);
	const [claudeState, setClaudeState] = useState('idle');
	const [claudeSource, setClaudeSource] = useState<string | null>(null);
	const [claudeUsage, setClaudeUsage] = useState<ClaudeUsage>({
		hasData: false, fiveHourPct: null, fiveHourResetsAt: null, sevenDayPct: null, sevenDayResetsAt: null,
	});

	useEffect(() => {
		window.api.firmware.onProgress((pct, status) => {
			setProgress({ pct, status });
			if (pct === 100) {
				setFlashing(false);
				setDone(true);
			}
		});
		window.api.firmware.onError((msg) => {
			setError(msg);
			setFlashing(false);
		});
		window.api.firmware.onVersion(setDeviceVersion);
		window.api.claude.isSetup().then(setHooksSetup);
		window.api.claude.getUsage().then(setClaudeUsage);
		window.api.claude.getSource().then(setClaudeSource);
		window.api.claude.onState(setClaudeState);
		window.api.claude.onUsage(setClaudeUsage);
		window.api.claude.onSource(setClaudeSource);
	}, []);

	useEffect(() => {
		if (!connected) {
			setDeviceVersion(null);
			setDone(false);
			return;
		}
		window.api.firmware.getDeviceVersion().then(setDeviceVersion);
	}, [connected]);

	function checkForUpdate() {
		setChecking(true);
		setError(null);
		window.api.firmware.checkUpdate().then(info => {
			setLatest(info);
			setChecking(false);
		}).catch(() => {
			setError('Could not reach GitHub. Check your internet connection.');
			setChecking(false);
		});
	}

	async function setupHooks() {
		setSettingUp(true);
		await window.api.claude.setup();
		setHooksSetup(true);
		setSettingUp(false);
	}

	async function startFlash() {
		setError(null);
		setDone(false);
		setProgress(null);
		setFlashing(true);
		try {
			const newVersion = await window.api.firmware.flash();
			setDeviceVersion(newVersion);
		} catch (e: unknown) {
			// error is already sent via firmware:error event
			console.error('[firmware flash]', e);
		}
	}

	const updateAvailable =
		latest && deviceVersion && latest.version !== deviceVersion;

	return (
		<div className="flex h-full flex-col gap-6 overflow-x-hidden overflow-y-auto px-4 py-6 pb-20 sm:px-8 sm:py-8 md:pb-8">
			<div>
				<h1 className="text-2xl font-black tracking-tight text-stone-900">Device</h1>
				<p className="mt-1 text-sm text-stone-500">Firmware management</p>
			</div>

			<div className="flex w-full max-w-130 min-w-0 flex-col gap-5 rounded-2xl border border-stone-200 bg-white p-7">
				<Row label="Device firmware">
					<span className="font-mono text-stone-800">
						{deviceVersion ?? (connected ? 'Reading…' : '–')}
					</span>
				</Row>

				<Row label="Latest available">
					{latest ? (
						<span className={`font-mono ${updateAvailable ? 'text-brand-600' : 'text-emerald-600'}`}>
							{latest.version}
							{updateAvailable && (
								<span className="ml-2 text-xs text-brand-600">new</span>
							)}
						</span>
					) : (
						<button
							onClick={checkForUpdate}
							disabled={checking}
							className="cursor-pointer rounded-md border border-stone-200 bg-transparent px-3.5 py-1.5 text-[13px] text-stone-500 hover:bg-stone-100"
						>
							{checking ? 'Checking…' : 'Check for update'}
						</button>
					)}
				</Row>

				{error && (
					<div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-[13px] text-red-600">
						{error}
					</div>
				)}

				{done && !error && (
					<div className="rounded-lg bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-600">
						Firmware updated successfully. Device is reconnecting…
					</div>
				)}

				{flashing && progress && (
					<div className="flex flex-col gap-2">
						<div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
							<div
								className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
								style={{ width: `${progress.pct}%` }}
							/>
						</div>
						<span className="text-xs text-stone-500">{progress.status}</span>
					</div>
				)}

				{(updateAvailable || (latest && !updateAvailable)) && !flashing && (
					<button
						disabled={!updateAvailable || !connected || flashing}
						onClick={startFlash}
						className={`self-start rounded-lg px-6 py-2.5 text-sm font-semibold disabled:cursor-not-allowed ${
							updateAvailable && connected
								? 'cursor-pointer bg-brand-600 text-white hover:bg-brand-700'
								: 'bg-stone-100 text-stone-400'
						}`}
					>
						{updateAvailable ? 'Update Firmware' : 'Up to date'}
					</button>
				)}
			</div>

			{/* ── Claude Code integration ── */}
			<div>
				<h2 className="text-xl font-bold text-stone-900">Claude Code</h2>
				<p className="mb-4 mt-1 text-sm text-stone-500">
					Device reacts to AI activity — animations change while Claude works
				</p>
			</div>

			<div className="flex w-full max-w-130 min-w-0 flex-col gap-5 rounded-2xl border border-stone-200 bg-white p-7">
				{hooksSetup === false ? (
					<>
						<p className="text-sm leading-relaxed text-stone-500">
							Hooks are not configured on this machine. Click below to install them automatically —
							Gaze Buddy will then react to Claude Code activity on this PC.
						</p>
						<button
							onClick={setupHooks}
							disabled={settingUp}
							className={`self-start rounded-lg px-6 py-2.5 text-sm font-semibold text-white ${
								settingUp ? 'cursor-not-allowed bg-brand-400' : 'cursor-pointer bg-brand-600 hover:bg-brand-700'
							}`}
						>
							{settingUp ? 'Setting up…' : 'Setup Claude Code integration'}
						</button>
					</>
				) : hooksSetup === true ? (
					<>
						<Row label="Status">
							<span className="flex items-center gap-2">
								<span
									className="h-2 w-2 rounded-full"
									style={{
										backgroundColor: STATE_COLOR[claudeState] ?? '#a8a29e',
										boxShadow: claudeState === 'working' ? `0 0 6px ${STATE_COLOR.working}` : undefined,
									}}
								/>
								<span className="text-sm" style={{ color: STATE_COLOR[claudeState] ?? '#78716c' }}>
									{STATE_LABEL[claudeState] ?? claudeState}
								</span>
							</span>
						</Row>
						{claudeSource && (
							<Row label="Last activity">
								<span className="text-stone-500">{SOURCE_LABEL[claudeSource] ?? claudeSource}</span>
							</Row>
						)}
						{claudeUsage.hasData ? (
							<>
								<UsageBar
									label="Session limit (5h)"
									pct={claudeUsage.fiveHourPct}
									resetsAt={claudeUsage.fiveHourResetsAt}
								/>
								<UsageBar
									label="Weekly limit"
									pct={claudeUsage.sevenDayPct}
									resetsAt={claudeUsage.sevenDayResetsAt}
								/>
							</>
						) : claudeSource === 'claude-vscode' ? (
							<p className="text-[13px] leading-relaxed text-stone-500">
								No usage data yet — the VS Code extension doesn't render a terminal status line, so
								this falls back to checking your account usage directly, which can take a few minutes
								to show up. (Only available on Pro/Max plans.)
							</p>
						) : (
							<p className="text-[13px] leading-relaxed text-stone-500">
								No usage data yet — open a Claude Code session in a terminal and it will appear here
								within a few seconds. (Only available on Pro/Max plans; API-key usage isn't rate-limited
								this way.)
							</p>
						)}
					</>
				) : (
					<p className="text-sm text-stone-500">Checking…</p>
				)}
			</div>

			{/* ── WiFi ── */}
			<div>
				<h2 className="text-xl font-bold text-stone-900">WiFi</h2>
				<p className="mb-4 mt-1 text-sm text-stone-500">
					Connect the device to your network so Claude Code updates keep working even when this app is closed
				</p>
			</div>

			<div className="w-full max-w-130 min-w-0 rounded-2xl border border-stone-200 bg-white p-7">
				<WifiSetup />
			</div>
		</div>
	);
}

function UsageBar({ label, pct, resetsAt }: { label: string; pct: number | null; resetsAt: number | null }) {
	const resetsIn = fmtResetsIn(resetsAt);
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex justify-between text-[13px]">
				<span className="text-stone-500">{label}</span>
				<span className="font-mono" style={{ color: pctColor(pct) }}>
					{pct !== null ? `${Math.round(pct)}%` : '–'}
				</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
				<div
					className="h-full rounded-full transition-[width] duration-300 ease-out"
					style={{ backgroundColor: pctColor(pct), width: `${pct ?? 0}%` }}
				/>
			</div>
			{resetsIn && <span className="text-[11px] text-stone-400">{resetsIn}</span>}
		</div>
	);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
			<span className="shrink-0 text-sm text-stone-500">{label}</span>
			<span className="min-w-0 truncate text-sm">{children}</span>
		</div>
	);
}
