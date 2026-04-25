export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-card">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

export function SettingsField({
  label,
  v,
  on,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium leading-none">{label}</label>
      <input
        type={type}
        value={v}
        onChange={(e) => on(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
      />
    </div>
  );
}
