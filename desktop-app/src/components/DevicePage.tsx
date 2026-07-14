import { useEffect, useState } from 'react';
import { colors } from '../theme';

type UpdateInfo = { version: string; firmwareUrl: string } | null;

export function DevicePage({ connected }: { connected: boolean }) {
	const [deviceVersion, setDeviceVersion] = useState<string | null>(null);
	const [latest, setLatest] = useState<UpdateInfo>(null);
	const [checking, setChecking] = useState(false);
	const [flashing, setFlashing] = useState(false);
	const [progress, setProgress] = useState<{ pct: number; status: string } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);

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
		<>
			<div>
				<h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>Device</h1>
				<p style={{ color: colors.textMuted, marginTop: '6px', marginBottom: 0, fontSize: '16px' }}>
					Firmware management
				</p>
			</div>

			<div style={{
				backgroundColor: colors.surface,
				borderRadius: '12px',
				border: `1px solid ${colors.border}`,
				padding: '28px',
				display: 'flex',
				flexDirection: 'column',
				gap: '20px',
				maxWidth: '520px',
			}}>
				<Row label="Device firmware">
					<span style={{ fontFamily: 'monospace', color: colors.textPrimary }}>
						{deviceVersion ?? (connected ? 'Reading…' : '–')}
					</span>
				</Row>

				<Row label="Latest available">
					{latest ? (
						<span style={{ fontFamily: 'monospace', color: updateAvailable ? colors.accent : colors.success }}>
							{latest.version}
							{updateAvailable && (
								<span style={{ marginLeft: '8px', fontSize: '12px', color: colors.accent }}>
									new
								</span>
							)}
						</span>
					) : (
						<button
							onClick={checkForUpdate}
							disabled={checking}
							style={ghostBtn}
						>
							{checking ? 'Checking…' : 'Check for update'}
						</button>
					)}
				</Row>

				{error && (
					<div style={{ fontSize: '13px', color: '#f87171', padding: '10px 14px', backgroundColor: '#1c0a0a', borderRadius: '8px' }}>
						{error}
					</div>
				)}

				{done && !error && (
					<div style={{ fontSize: '13px', color: colors.success, padding: '10px 14px', backgroundColor: '#052e16', borderRadius: '8px' }}>
						Firmware updated successfully. Device is reconnecting…
					</div>
				)}

				{flashing && progress && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						<div style={{
							height: '6px', borderRadius: '3px', backgroundColor: colors.border, overflow: 'hidden',
						}}>
							<div style={{
								height: '100%', borderRadius: '3px',
								backgroundColor: colors.accent,
								width: `${progress.pct}%`,
								transition: 'width 0.3s ease',
							}} />
						</div>
						<span style={{ fontSize: '12px', color: colors.textMuted }}>{progress.status}</span>
					</div>
				)}

				{(updateAvailable || (latest && !updateAvailable)) && !flashing && (
					<button
						disabled={!updateAvailable || !connected || flashing}
						onClick={startFlash}
						style={{
							padding: '11px 24px',
							borderRadius: '8px',
							border: 'none',
							backgroundColor: updateAvailable && connected ? colors.accent : colors.border,
							color: updateAvailable && connected ? colors.bg : colors.textDisabled,
							fontSize: '14px',
							fontWeight: '600',
							cursor: updateAvailable && connected ? 'pointer' : 'not-allowed',
							alignSelf: 'flex-start',
						}}
					>
						{updateAvailable ? 'Update Firmware' : 'Up to date'}
					</button>
				)}
			</div>
		</>
	);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
			<span style={{ fontSize: '14px', color: colors.textMuted, flexShrink: 0 }}>{label}</span>
			<span style={{ fontSize: '14px' }}>{children}</span>
		</div>
	);
}

const ghostBtn: React.CSSProperties = {
	padding: '6px 14px',
	borderRadius: '6px',
	border: `1px solid ${colors.border}`,
	backgroundColor: 'transparent',
	color: colors.textFaint,
	fontSize: '13px',
	cursor: 'pointer',
};
