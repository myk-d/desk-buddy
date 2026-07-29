import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
	title: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Imperative, promise-based confirm so any component can gate a destructive or
// discard-changes action without threading modal-open state through its parent.
export function ConfirmProvider({ children }: { children: ReactNode }) {
	const [options, setOptions] = useState<ConfirmOptions | null>(null);
	const resolveRef = useRef<((value: boolean) => void) | null>(null);

	const confirm = useCallback<ConfirmFn>((next) => {
		return new Promise((resolve) => {
			resolveRef.current = resolve;
			setOptions(next);
		});
	}, []);

	const settle = (value: boolean) => {
		resolveRef.current?.(value);
		resolveRef.current = null;
		setOptions(null);
	};

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			{options && (
				<div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="animate-popover-in w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-xl">
						<div className="mb-2 flex items-center gap-2">
							{options.danger !== false && <AlertTriangle size={18} className="shrink-0 text-red-500" />}
							<h2 className="text-base font-semibold text-stone-800">{options.title}</h2>
						</div>
						{options.message && <p className="mb-4 text-sm text-stone-500">{options.message}</p>}
						<div className="flex justify-end gap-2">
							<button
								onClick={() => settle(false)}
								className="rounded-full px-4 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100"
							>
								{options.cancelLabel ?? 'Cancel'}
							</button>
							<button
								onClick={() => settle(true)}
								className={`rounded-full px-4 py-1.5 text-sm font-medium text-white ${
									options.danger !== false ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-600 hover:bg-brand-700'
								}`}
							>
								{options.confirmLabel ?? 'Delete'}
							</button>
						</div>
					</div>
				</div>
			)}
		</ConfirmContext.Provider>
	);
}

// eslint-disable-next-line react-refresh/only-export-components -- context+provider+hook colocation is intentional
export function useConfirm(): ConfirmFn {
	const ctx = useContext(ConfirmContext);
	if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
	return ctx;
}
