import type { ComponentType, ReactNode } from "react";

export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center animate-fade-in">
      {/* Icon with colored background pill + subtle outer ring */}
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-md scale-110" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/10">
          <Icon className="h-7 w-7 text-primary" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
