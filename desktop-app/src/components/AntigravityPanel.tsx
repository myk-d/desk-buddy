import { useEffect, useState } from 'react';
import type { AntigravityModelQuota, AntigravityStatus } from '../types';

// Deliberately not the stone/brand palette the rest of the app uses for
// Claude Code — this is a different product (Google's), so it gets its own
// look: a blue accent instead of brand purple/orange, and a dark card
// instead of the plain white ones elsewhere on this page.
const BLUE = '#4285F4';
const BLUE_DIM = '#8ab4f8';

function fmtResetsIn(epochMs: number | null): string | null {
	if (!epochMs) return null;
	const ms = epochMs - Date.now();
	if (ms <= 0) return 'resets now';
	const hrs = Math.floor(ms / 3_600_000);
	const mins = Math.floor((ms % 3_600_000) / 60_000);
	if (hrs >= 24) return `resets in ${Math.floor(hrs / 24)}d ${hrs % 24}h`;
	if (hrs > 0) return `resets in ${hrs}h ${mins}m`;
	return `resets in ${mins}m`;
}

function quotaColor(remainingFraction: number, isExhausted: boolean): string {
	if (isExhausted) return '#f87171'; // red-400
	if (remainingFraction <= 0.1) return '#f87171';
	if (remainingFraction <= 0.3) return '#fbbf24'; // amber-400
	return BLUE;
}

const EMPTY_STATUS: AntigravityStatus = { connected: false, email: null, tierName: null, promptCredits: null, models: [] };

export function AntigravityPanel() {
	const [status, setStatus] = useState<AntigravityStatus>(EMPTY_STATUS);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	useEffect(() => {
		window.api.antigravity.getStatus().then((s) => {
			setStatus(s);
			setLoading(false);
		});
		window.api.antigravity.onStatus((s) => {
			setStatus(s);
			setLoading(false);
		});
	}, []);

	async function refresh() {
		setRefreshing(true);
		const s = await window.api.antigravity.getStatus();
		setStatus(s);
		setRefreshing(false);
	}

	return (
		<div
			className="flex w-full max-w-130 min-w-0 flex-col gap-5 rounded-2xl p-7 text-white"
			style={{ background: 'linear-gradient(145deg, #1a1f2e, #10131c)', border: `1px solid ${BLUE}33` }}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2.5">
					<span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.connected ? BLUE : '#52525b' }} />
					<span className="text-lg font-bold">Antigravity</span>
					{status.tierName && (
						<span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${BLUE}26`, color: BLUE_DIM }}>
							{status.tierName}
						</span>
					)}
				</div>
				<button
					onClick={refresh}
					disabled={refreshing}
					className="cursor-pointer rounded-full border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
					style={{ borderColor: `${BLUE}4d`, color: BLUE_DIM }}
				>
					{refreshing ? 'Refreshing…' : 'Refresh'}
				</button>
			</div>

			{loading ? (
				<p className="text-sm text-zinc-400">Checking…</p>
			) : !status.connected ? (
				<p className="text-[13px] leading-relaxed text-zinc-400">
					Not detected. Open Antigravity (the IDE, or the VS Code extension) and hit Refresh — this reads
					its local usage data directly, nothing to set up.
				</p>
			) : (
				<>
					{status.email && <p className="text-xs text-zinc-400">{status.email}</p>}

					{status.promptCredits && (
						<QuotaBar
							label="Prompt credits"
							remainingFraction={status.promptCredits.remaining / Math.max(status.promptCredits.limit, 1)}
							isExhausted={status.promptCredits.remaining <= 0}
							detail={`${status.promptCredits.remaining} / ${status.promptCredits.limit}`}
						/>
					)}

					{status.models.length > 0 ? (
						<div className="flex flex-col gap-4 border-t pt-4" style={{ borderColor: `${BLUE}1f` }}>
							{status.models.map((m) => <ModelQuotaRow key={m.modelId} model={m} />)}
						</div>
					) : (
						<p className="text-[13px] text-zinc-400">No per-model quota data yet.</p>
					)}
				</>
			)}
		</div>
	);
}

function ModelQuotaRow({ model }: { model: AntigravityModelQuota }) {
	const resetsIn = fmtResetsIn(model.resetAt);
	return (
		<QuotaBar
			label={model.label}
			remainingFraction={model.remainingFraction}
			isExhausted={model.isExhausted}
			detail={resetsIn ?? undefined}
		/>
	);
}

function QuotaBar({ label, remainingFraction, isExhausted, detail }: { label: string; remainingFraction: number; isExhausted: boolean; detail?: string }) {
	const pctUsed = Math.round((1 - remainingFraction) * 100);
	const color = quotaColor(remainingFraction, isExhausted);
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex justify-between text-[13px]">
				<span className="text-zinc-300">{label}</span>
				<span className="font-mono" style={{ color }}>{isExhausted ? 'exhausted' : `${pctUsed}% used`}</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-white/10">
				<div
					className="h-full rounded-full transition-[width] duration-300 ease-out"
					style={{ backgroundColor: color, width: `${Math.round((1 - remainingFraction) * 100)}%` }}
				/>
			</div>
			{detail && <span className="text-[11px] text-zinc-500">{detail}</span>}
		</div>
	);
}
