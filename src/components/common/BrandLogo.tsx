import { Activity } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
  /** When false, render as a plain div (no link). Defaults to true. */
  asLink?: boolean;
  /** Link destination. Defaults to "/" (landing page). Pass "/dashboard" post-login. */
  to?: string;
}

export function BrandLogo({ size = "md", showTagline = true, className, asLink = true, to = "/" }: BrandLogoProps) {
  const iconSize = size === "sm" ? "h-[18px] w-[18px]" : size === "lg" ? "h-6 w-6" : "h-[18px] w-[18px]";
  const titleSize = size === "sm" ? "text-[19px]" : size === "lg" ? "text-2xl" : "text-[19px]";

  const inner = (
    <div className="flex flex-col justify-center">
      <div className="flex items-center gap-2">
        <Activity className={cn("shrink-0 text-[#1A7A6E]", iconSize)} strokeWidth={2.5} />
        <span className={cn("font-instrument leading-none text-current", titleSize)}>{BRAND.name}</span>
      </div>
      {showTagline && (
        <span className="font-plex-mono mt-0.5 block pl-[26px] text-[9px] uppercase tracking-[0.2em] text-current/70">
          {BRAND.tagline}
        </span>
      )}
    </div>
  );

  const baseClasses = cn("inline-block", className);

  if (!asLink) {
    return <div className={baseClasses}>{inner}</div>;
  }

  return (
    <Link
      to={to as "/"}
      aria-label={`${BRAND.name} — go to home`}
      className={cn(baseClasses, "rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring")}
    >
      {inner}
    </Link>
  );
}
