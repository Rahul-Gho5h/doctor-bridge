import { Activity, ShieldCheck, Building2, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { ThemeToggle } from "@/components/common/ThemeToggle";

interface AuthShellProps {
  /** Right-side card */
  children: React.ReactNode;
  /** Hero headline (left side) */
  heroTitle: React.ReactNode;
  /** Hero subhead (left side) */
  heroSubtitle: React.ReactNode;
}

/**
 * Split-screen auth layout:
 *  - Left: deep navy hero — fixed 50 % column, never resizes
 *  - Right: soft mint gradient — scrolls internally so the left panel
 *    is completely isolated from card-height changes
 *
 * Both columns are locked to 100 vh via `h-screen overflow-hidden` on
 * the grid wrapper plus `h-full overflow-y-auto` on each panel.
 */
export function AuthShell({ children, heroTitle, heroSubtitle }: AuthShellProps) {
  return (
    /* Lock the grid to exactly the viewport — columns can't grow taller */
    <div className="grid h-screen grid-cols-1 overflow-hidden lg:grid-cols-2">

      {/* ── Left — hero (hidden on mobile) ── */}
      <aside
        className="relative hidden h-full flex-col justify-between overflow-hidden px-12 py-10 lg:flex"
        style={{
          backgroundColor: "var(--auth-hero-bg)",
          color: "var(--auth-hero-fg)",
        }}
      >
        {/* Radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-24 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, var(--auth-hero-glow) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 left-20 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, oklch(0.45 0.18 265) 0%, transparent 70%)",
          }}
        />

        {/* Brand */}
        <Link
          to="/"
          className="relative z-10 flex items-center gap-3 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, var(--auth-teal), oklch(0.55 0.14 175))",
              color: "var(--auth-teal-foreground)",
            }}
          >
            <Activity className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight">{BRAND.name}</div>
            <div
              className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em]"
              style={{ color: "var(--auth-hero-glow)" }}
            >
              {BRAND.tagline}
            </div>
          </div>
        </Link>

        {/* Hero copy */}
        <div className="relative z-10 max-w-xl">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight md:text-[44px]">
            {heroTitle}
          </h1>
          <p
            className="mt-5 text-base leading-relaxed"
            style={{ color: "var(--auth-hero-muted)" }}
          >
            {heroSubtitle}
          </p>
        </div>

        {/* Footer pills */}
        <div className="relative z-10 flex flex-wrap items-center gap-x-10 gap-y-3 text-sm">
          {[
            { icon: ShieldCheck, label: "NMC verified" },
            { icon: Building2, label: "Clinic isolated" },
            { icon: MapPin, label: "India ready" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2"
              style={{ color: "var(--auth-hero-muted)" }}
            >
              <Icon className="h-4 w-4" style={{ color: "var(--auth-hero-glow)" }} />
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Right — scrollable form panel ── */}
      <main
        className="relative h-full overflow-y-auto px-4 py-12 sm:px-8"
        style={{
          background:
            "linear-gradient(135deg, var(--auth-side-from) 0%, var(--auth-side-to) 100%)",
        }}
      >
        {/* Dark mode toggle — top right */}
        <div className="absolute right-4 top-4 sm:right-6 sm:top-5 z-10">
          <ThemeToggle />
        </div>

        {/* Vertically centre on desktop when content is short */}
        <div className="flex min-h-full flex-col items-center justify-center">
          <div className="w-full max-w-md">
            {/* Mobile brand */}
            <Link
              to="/"
              className="mb-8 flex items-center justify-center gap-2.5 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{
                  background:
                    "linear-gradient(135deg, var(--auth-teal), oklch(0.55 0.14 175))",
                  color: "var(--auth-teal-foreground)",
                }}
              >
                <Activity className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <div className="text-base font-semibold tracking-tight">{BRAND.name}</div>
            </Link>

            <div className="rounded-2xl border bg-card p-8 shadow-elevated">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
