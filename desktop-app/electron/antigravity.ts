// Reads Google Antigravity's usage/quota data from its own local language
// server — there's no documented public API for this, so this follows the
// same reverse-engineered approach as a couple of community VS Code
// extensions (antigravity-usage-monitor, AntigravityQuotaWatcher): the
// language server (same one Antigravity inherited from Codeium/Windsurf)
// listens on a local port and speaks Connect RPC, authenticated with a CSRF
// token that's passed to it on the command line.
//
// This is unofficial and undocumented — Google can change the wire format
// or the process/port discovery mechanics at any time without notice. The
// Linux/macOS path (ps + lsof) mirrors the community implementations
// above, which are confirmed working; the Windows path (PowerShell +
// Get-CimInstance/Get-NetTCPConnection) is this project's own and hasn't
// been verified against a real Windows Antigravity install.

import { execFile, exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as https from 'node:https';
import * as http from 'node:http';

const execFileAsync = promisify(execFile);

export interface AntigravityModelQuota {
	modelId: string;
	label: string;
	remainingFraction: number; // 0–1
	resetAt: number | null; // epoch ms, only set if in the future
	isExhausted: boolean;
}

export interface AntigravityPromptCredits {
	used: number;
	limit: number;
	remaining: number;
}

export interface AntigravityStatus {
	connected: boolean;
	email: string | null;
	tierName: string | null;
	promptCredits: AntigravityPromptCredits | null;
	models: AntigravityModelQuota[];
}

const DISCONNECTED: AntigravityStatus = { connected: false, email: null, tierName: null, promptCredits: null, models: [] };

interface ConnectionInfo {
	port: number;
	authToken: string;
	isHttps: boolean;
}

// Re-probing the language server (process scan + port scan + a couple of
// HTTP probes) on every poll would be wasteful — cache the working
// connection for a while, the same way the reference extensions do.
const CONNECTION_CACHE_TTL_MS = 30_000;
let cachedConnection: ConnectionInfo | null = null;
let cacheExpiry = 0;

function invalidateConnectionCache() {
	cachedConnection = null;
	cacheExpiry = 0;
}

// ── Process + port discovery ────────────────────────────────────────────────

function extractArg(commandLine: string, key: string): string | null {
	const eqMatch = commandLine.match(new RegExp(`${key}=(\\S+)`));
	if (eqMatch) return eqMatch[1];
	const idx = commandLine.indexOf(key);
	if (idx === -1) return null;
	const after = commandLine.substring(idx + key.length).trim();
	return after.split(/\s/)[0] || null;
}

function looksLikeAntigravityServer(commandLine: string): boolean {
	const lower = commandLine.toLowerCase();
	return lower.includes('antigravity') && (lower.includes('language-server') || lower.includes('lsp') || lower.includes('server'));
}

async function findProcessUnix(): Promise<{ pid: number; csrfToken: string } | null> {
	try {
		const { stdout } = await execFileAsync('ps', ['aux'], { timeout: 5000 });
		for (const line of stdout.split('\n')) {
			if (!looksLikeAntigravityServer(line)) continue;
			const parts = line.trim().split(/\s+/);
			if (parts.length < 11) continue;
			const pid = parseInt(parts[1], 10);
			if (isNaN(pid)) continue;
			const csrfToken = extractArg(parts.slice(10).join(' '), '--csrf_token');
			if (csrfToken) return { pid, csrfToken };
		}
	} catch {
		// ps unavailable or failed — not fatal, caller treats this as "not found"
	}
	return null;
}

async function discoverPortsUnix(pid: number): Promise<number[]> {
	if (!Number.isInteger(pid) || pid <= 0) return [];
	try {
		const { stdout } = await execFileAsync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-a', '-p', String(pid)], { timeout: 5000 });
		const ports: number[] = [];
		for (const line of stdout.split('\n')) {
			const match = line.match(/:(\d+)\s+\(LISTEN\)/);
			if (match) {
				const port = parseInt(match[1], 10);
				if (!isNaN(port) && !ports.includes(port)) ports.push(port);
			}
		}
		return ports;
	} catch {
		return [];
	}
}

// Windows has no ps/lsof — one PowerShell round-trip does the equivalent of
// both: Win32_Process for the command line (to get the PID + csrf token),
// then Get-NetTCPConnection for that PID's listening ports.
const WIN_PS_SCRIPT = `
$procs = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -match 'antigravity' -and ($_.CommandLine -match 'language-server' -or $_.CommandLine -match 'lsp' -or $_.CommandLine -match 'server')
}
foreach ($p in $procs) {
  if ($p.CommandLine -match '--csrf_token[= ]([^ ]+)') {
    $token = $matches[1]
    $ports = (Get-NetTCPConnection -State Listen -OwningProcess $p.ProcessId -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort) -join ','
    if ($ports) {
      Write-Output "$($p.ProcessId)|$token|$ports"
      break
    }
  }
}
`;
const WIN_PS_ENCODED = process.platform === 'win32' ? Buffer.from(WIN_PS_SCRIPT, 'utf16le').toString('base64') : '';

function findProcessAndPortsWindows(): Promise<{ pid: number; csrfToken: string; ports: number[] } | null> {
	return new Promise((resolve) => {
		exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${WIN_PS_ENCODED}`, { timeout: 6000 }, (err, stdout) => {
			if (err || !stdout.trim()) return resolve(null);
			const [pidStr, token, portsStr] = stdout.trim().split('|');
			const pid = parseInt(pidStr, 10);
			const ports = (portsStr ?? '').split(',').map((p) => parseInt(p, 10)).filter((p) => !isNaN(p));
			if (isNaN(pid) || !token || ports.length === 0) return resolve(null);
			resolve({ pid, csrfToken: token, ports });
		});
	});
}

// ── Connect RPC (local-only, self-signed cert) ──────────────────────────────

function connectRequest(baseUrl: string, path: string, body: string, csrfToken: string | undefined, timeout = 5000): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const url = new URL(path, baseUrl);
		// Belt-and-suspenders — discovery only ever produces 127.0.0.1 URLs,
		// but a hostname never leaves this box regardless, even if that logic
		// is ever changed.
		if (!/^(127\.0\.0\.1|localhost|::1)$/.test(url.hostname)) {
			reject(new Error('Refusing non-localhost connection'));
			return;
		}
		const isHttps = baseUrl.startsWith('https://');
		const headers: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'Connect-Protocol-Version': '1',
		};
		if (csrfToken) headers['X-Codeium-Csrf-Token'] = csrfToken;

		const req = (isHttps ? https : http).request(
			{
				hostname: url.hostname,
				port: url.port,
				path: url.pathname,
				method: 'POST',
				headers,
				timeout,
				rejectUnauthorized: false, // the language server uses a self-signed cert
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => { data += chunk; });
				res.on('end', () => {
					if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
						try {
							resolve(JSON.parse(data));
						} catch {
							reject(new Error('Invalid JSON response'));
						}
					} else {
						reject(new Error(`HTTP ${res.statusCode}`));
					}
				});
			},
		);
		req.on('error', reject);
		req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
		req.write(body);
		req.end();
	});
}

async function probe(baseUrl: string, csrfToken: string): Promise<boolean> {
	try {
		await connectRequest(baseUrl, '/exa.language_server_pb.LanguageServerService/GetUnleashData', JSON.stringify({ wrapper_data: {} }), csrfToken, 2000);
		return true;
	} catch {
		return false;
	}
}

async function probeAndConnect(ports: number[], csrfToken: string): Promise<ConnectionInfo | null> {
	for (const port of ports) {
		if (await probe(`https://127.0.0.1:${port}`, csrfToken)) return { port, authToken: csrfToken, isHttps: true };
	}
	for (const port of ports) {
		if (await probe(`http://127.0.0.1:${port}`, csrfToken)) return { port, authToken: csrfToken, isHttps: false };
	}
	return null;
}

async function detectConnection(): Promise<ConnectionInfo | null> {
	if (cachedConnection && Date.now() < cacheExpiry) return cachedConnection;

	try {
		let ports: number[] = [];
		let csrfToken: string | null = null;

		if (process.platform === 'win32') {
			const found = await findProcessAndPortsWindows();
			ports = found?.ports ?? [];
			csrfToken = found?.csrfToken ?? null;
		} else {
			const found = await findProcessUnix();
			if (found) {
				ports = await discoverPortsUnix(found.pid);
				csrfToken = found.csrfToken;
			}
		}

		if (!csrfToken || ports.length === 0) {
			cachedConnection = null;
			return null;
		}

		const connection = await probeAndConnect(ports, csrfToken);
		cachedConnection = connection;
		if (connection) cacheExpiry = Date.now() + CONNECTION_CACHE_TTL_MS;
		return connection;
	} catch {
		cachedConnection = null;
		return null;
	}
}

// ── Response parsing ─────────────────────────────────────────────────────────

function parseStatus(raw: unknown): Omit<AntigravityStatus, 'connected'> {
	const result: Omit<AntigravityStatus, 'connected'> = { email: null, tierName: null, promptCredits: null, models: [] };
	if (typeof raw !== 'object' || raw === null) return result;

	const data = raw as Record<string, unknown>;
	const userStatus = (data.userStatus as Record<string, unknown>) || data;

	if (typeof userStatus.email === 'string') result.email = userStatus.email;

	const planStatus = userStatus.planStatus as Record<string, unknown> | undefined;
	if (planStatus) {
		const available = planStatus.availablePromptCredits;
		const planInfo = planStatus.planInfo as Record<string, unknown> | undefined;
		const monthly = planInfo?.monthlyPromptCredits;
		if (typeof available === 'number' && typeof monthly === 'number') {
			result.promptCredits = { used: monthly - available, limit: monthly, remaining: available };
		}
		if (typeof planInfo?.planName === 'string') result.tierName = planInfo.planName;
	}

	const cascadeData = userStatus.cascadeModelConfigData as Record<string, unknown> | undefined;
	const clientModelConfigs = cascadeData?.clientModelConfigs;
	if (Array.isArray(clientModelConfigs)) {
		result.models = clientModelConfigs
			.map((m): AntigravityModelQuota | null => {
				if (typeof m !== 'object' || m === null) return null;
				const model = m as Record<string, unknown>;
				const modelOrAlias = model.modelOrAlias as Record<string, unknown> | undefined;
				const modelId = (modelOrAlias?.model as string) || 'unknown';
				const label = (model.label as string) || (model.displayName as string) || modelId;
				const quotaInfo = model.quotaInfo as Record<string, unknown> | undefined;
				const remainingFraction = typeof quotaInfo?.remainingFraction === 'number' ? (quotaInfo.remainingFraction as number) : 1.0;
				const resetTimeStr = quotaInfo?.resetTime as string | undefined;

				let resetAt: number | null = null;
				if (resetTimeStr) {
					const t = new Date(resetTimeStr).getTime();
					if (!isNaN(t) && t > Date.now()) resetAt = t;
				}

				return {
					modelId,
					label,
					remainingFraction,
					resetAt,
					isExhausted: typeof model.isExhausted === 'boolean' ? (model.isExhausted as boolean) : remainingFraction === 0,
				};
			})
			.filter((m): m is AntigravityModelQuota => m !== null);
	}

	return result;
}

// ── Public API ───────────────────────────────────────────────────────────────

// forceRefresh bypasses the connection cache — used for the manual "Refresh"
// button, since a 30s-stale "not connected" result would be confusing right
// after the user just opened Antigravity.
export async function getAntigravityStatus(forceRefresh = false): Promise<AntigravityStatus> {
	if (forceRefresh) invalidateConnectionCache();

	const connection = await detectConnection();
	if (!connection) return DISCONNECTED;

	try {
		const baseUrl = `${connection.isHttps ? 'https' : 'http'}://127.0.0.1:${connection.port}`;
		const body = JSON.stringify({ metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' } });
		const raw = await connectRequest(baseUrl, '/exa.language_server_pb.LanguageServerService/GetUserStatus', body, connection.authToken);
		return { connected: true, ...parseStatus(raw) };
	} catch {
		// The cached connection might be stale (Antigravity restarted on a new
		// port) — drop it so the next poll re-detects from scratch.
		invalidateConnectionCache();
		return DISCONNECTED;
	}
}
