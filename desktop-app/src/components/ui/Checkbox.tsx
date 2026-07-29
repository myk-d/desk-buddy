import { Check } from 'lucide-react';

interface CheckboxProps {
	checked: boolean;
	onChange: () => void;
	size?: 'sm' | 'md';
}

export function Checkbox({ checked, onChange, size = 'md' }: CheckboxProps) {
	const dims = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
	return (
		<button
			type="button"
			role="checkbox"
			aria-checked={checked}
			onClick={onChange}
			className={`flex ${dims} shrink-0 items-center justify-center rounded-full border-2 transition ${
				checked ? 'border-brand-600 bg-brand-600' : 'border-stone-300 bg-white hover:border-brand-400'
			}`}
		>
			{checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
		</button>
	);
}
