interface SwitchProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
}

export function Switch({ checked, onChange }: SwitchProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onChange(!checked)}
			className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-stone-300'}`}
		>
			<span
				className={`absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
					checked ? 'translate-x-4' : 'translate-x-0'
				}`}
			/>
		</button>
	);
}
