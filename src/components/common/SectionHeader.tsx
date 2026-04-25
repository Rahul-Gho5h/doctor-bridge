import type { ReactNode } from "react";

/**
 * Eyebrow + large display title page header (matches reference UI).
 *
 * Example: <SectionHeader eyebrow="Clinical" title="Common patient database" actions={...} />
 */
export function SectionHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.55_0.14_165)]">
          {eyebrow}
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-primary md:text-4xl">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
