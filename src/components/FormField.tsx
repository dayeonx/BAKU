export const inputClass =
  "w-full rounded-lg border border-brand-100 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-brand-300 focus:border-accent-500";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-brand-700">
        {label}
      </span>
      {children}
    </label>
  );
}
