import { Wifi } from 'lucide-react';
import { WifiSetup } from './WifiSetup';

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
	return (
		<div className="flex h-screen items-center justify-center bg-stone-50 px-6">
			<div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
				<div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
					<Wifi size={20} />
				</div>
				<h1 className="text-xl font-bold text-stone-900">Keep Gaze Buddy updated over WiFi</h1>
				<p className="mt-2 text-sm leading-relaxed text-stone-500">
					Connecting Gaze Buddy to your WiFi lets it receive firmware updates and ambient notifications
					directly, without this app needing to stay open. For the Claude Code integration, keep this app
					running — that's what keeps session status and usage stats on the device accurate. Your WiFi
					password is sent to the device over this USB cable, never typed on the device itself or sent
					anywhere else.
				</p>
				<div className="mt-6">
					<WifiSetup onConnected={onDone} onSkip={onDone} />
				</div>
				<p className="mt-6 text-xs text-stone-400">
					You can always set this up later from the Device page.
				</p>
			</div>
		</div>
	);
}
