/**
 * Doctor Bridge — Landing Page
 * "Clinical editorial" — Instrument Serif headlines, IBM Plex Sans body,
 * IBM Plex Mono data. Warm parchment + deep ink palette.
 */

import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, CSSProperties } from "react";
import {
  Activity, ArrowRight, ClipboardList, Search,
  ShieldCheck, TrendingUp, Zap,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { ThemeToggle } from "@/components/common/ThemeToggle";

/* ─────────────────────────────────────────────────────────────────────────────
   HOOKS
───────────────────────────────────────────────────────────────────────────── */

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);
  return scrolled;
}

/** Returns [ref, inView] — triggers once when the element enters the viewport. */
function useInView(threshold = 0.08) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/** CSS transition helper for scroll-reveal. */
function reveal(inView: boolean, delay = 0, distance = 28): CSSProperties {
  return {
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : `translateY(${distance}px)`,
    transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   1. NAVBAR
───────────────────────────────────────────────────────────────────────────── */
function Navbar() {
  const scrolled = useScrolled();
  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-[#E5E2DA] bg-[#F7F6F2]/92 backdrop-blur-md shadow-[0_1px_0_0_rgba(17,16,9,0.06)] dark:border-border dark:bg-background/90"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Brand */}
        <Link to="/" className="block">
          <div className="flex items-center gap-2">
            <Activity className="h-[18px] w-[18px] shrink-0 text-[#1A7A6E]" strokeWidth={2.5} />
            <span className="font-instrument text-[19px] leading-none text-[#111009]">{BRAND.name}</span>
          </div>
          <span className="font-plex-mono mt-0.5 block pl-[26px] text-[9px] uppercase tracking-[0.2em] text-[#4A4740]/50">
            {BRAND.tagline}
          </span>
        </Link>

        {/* Centre nav */}
        <div className="hidden items-center gap-8 md:flex">
          {(["Features", "How it Works", "For Specialists"] as const).map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase().replace(/\s+/g, "-")}`}
              className="font-plex text-[13px] font-medium text-[#4A4740] transition-colors hover:text-[#1A7A6E]"
            >
              {label}
            </a>
          ))}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/login"
            className="font-plex hidden rounded-lg px-4 py-2 text-[13px] font-medium text-[#111009] transition-colors hover:bg-[#111009]/6 dark:text-foreground dark:hover:bg-white/10 sm:block"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="font-plex rounded-lg bg-[#1A7A6E] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-[#166860] hover:shadow-md"
          >
            Register
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. HERO
───────────────────────────────────────────────────────────────────────────── */

const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Kochi"];

function HeroCard() {
  return (
    <div
      className="animate-lp-float animate-lp-glow w-full max-w-[400px] rounded-2xl border border-[#1F3347] bg-[#132030] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]"
      style={{ backdropFilter: "blur(2px)" }}
    >
      {/* Card header */}
      <div className="flex items-center gap-2 border-b border-[#1F3347] px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-[#1A7A6E]" />
        <span className="font-plex-mono text-[10px] uppercase tracking-[0.18em] text-[#4A6070]">
          Sub-specialist search
        </span>
      </div>

      <div className="p-4">
        {/* Fake search input */}
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#1F3347] bg-[#0A111A] px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#4A6070]" />
          <span className="font-plex-mono text-[11px] text-[#6B8A9E]">
            ICD-10: I20 &nbsp;·&nbsp; DM Cardiology &nbsp;·&nbsp; Chennai
          </span>
          <span className="ml-auto h-3.5 w-0.5 animate-pulse bg-[#1A7A6E]" />
        </div>

        {/* Doctor result */}
        <div className="flex items-center gap-3 rounded-xl border border-[#1A7A6E]/20 bg-[#0C1824] p-3">
          <div className="font-plex-mono flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A7A6E]/20 text-[13px] font-semibold text-[#1A7A6E]">
            PM
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-plex text-[13px] font-semibold text-white">Dr. Priya Menon</div>
            <div className="font-plex-mono text-[10px] text-[#4A6070]">DM Cardiology · Apollo Chennai</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A6E]" />
              <span className="font-plex-mono text-[10px] text-[#1A7A6E]">Available today · 3 slots</span>
            </div>
          </div>
          <button className="font-plex shrink-0 rounded-lg bg-[#1A7A6E] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#166860]">
            Refer
          </button>
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-[#1F3347]" />

        {/* Status thread */}
        <div className="mb-2 flex items-center justify-between">
          <span className="font-plex-mono text-[10px] uppercase tracking-[0.18em] text-[#4A6070]">Referral status</span>
          <span className="font-plex-mono rounded bg-[#1A7A6E]/10 px-1.5 py-0.5 text-[9px] text-[#1A7A6E]">
            REF-001
          </span>
        </div>
        <div className="space-y-2.5 rounded-lg bg-[#0A111A] px-3 py-3">
          {([
            { dot: "bg-[#4A9D8F]", label: "Referral sent",       time: "09:14" },
            { dot: "bg-[#E8B86D]", label: "Accepted",            time: "09:31" },
            { dot: "bg-[#4CAF7D]", label: "Appointment booked",  time: "10:02" },
          ] as const).map(({ dot, label, time }) => (
            <div key={label} className="flex items-center gap-2.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <span className="font-plex flex-1 text-[11px] text-[#8BA4B4]">{label}</span>
              <span className="font-plex-mono text-[10px] tabular-nums text-[#4A6070]">{time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const cityStr = CITIES.join("  ·  ") + "  ·  ";

  return (
    <section className="relative overflow-hidden bg-[#F7F6F2] px-6 pb-20 pt-28">
      {/* ── Animated background layer ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Fine grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(#111009 1px, transparent 1px), linear-gradient(90deg, #111009 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
        {/* Drifting teal orb — top left */}
        <div
          className="animate-lp-drift-a absolute -left-40 -top-40 h-[700px] w-[700px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(closest-side, #1A7A6E, transparent)" }}
        />
        {/* Drifting amber orb — bottom right */}
        <div
          className="animate-lp-drift-b absolute -bottom-20 -right-20 h-[500px] w-[500px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(closest-side, #E8B86D, transparent)" }}
        />
        {/* Small accent orb — center */}
        <div
          className="animate-lp-drift-c absolute left-1/2 top-1/3 h-[320px] w-[320px] -translate-x-1/2 rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(closest-side, #4CAF7D, transparent)" }}
        />
      </div>

      {/* ── Content wrapper — 2-col on lg ── */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-start gap-12 lg:flex-row lg:items-center lg:gap-16">

        {/* LEFT: text — staggered reveal */}
        <div className="flex w-full max-w-xl flex-col items-center text-center lg:max-w-none lg:flex-1 lg:items-start lg:text-left">

          {/* Pill badge */}
          <div
            className="lp-fade font-plex-mono inline-flex items-center gap-2 rounded-full border border-[#1A7A6E]/30 px-3.5 py-1.5 text-[11px] text-[#1A7A6E]"
            style={{ backgroundColor: "rgba(26,122,110,0.07)", animationDelay: "0ms" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A6E]" />
            Doctor-to-doctor only &nbsp;·&nbsp; No patient login required
          </div>

          {/* Headline */}
          <h1
            className="lp-fade font-instrument mt-6 leading-[1.05] tracking-tight text-[#111009]"
            style={{ fontSize: "clamp(44px, 5.5vw, 68px)", animationDelay: "90ms" }}
          >
            Stop losing patients
            <br />
            <em>between specialists.</em>
          </h1>

          {/* Subheadline */}
          <p
            className="lp-fade font-plex mt-5 max-w-[480px] leading-[1.7] text-[#4A4740]"
            style={{ fontSize: "clamp(15px, 1.4vw, 17px)", animationDelay: "200ms" }}
          >
            A verified network of NMC-registered specialists. Search by
            condition, confirm availability, send clinical context — all in one
            structured thread.
          </p>

          {/* CTAs */}
          <div
            className="lp-fade mt-8 flex flex-wrap items-center gap-4"
            style={{ animationDelay: "310ms" }}
          >
            <Link
              to="/register"
              className="font-plex inline-flex items-center gap-2 rounded-xl bg-[#E8B86D] px-6 py-3.5 text-[13px] font-semibold text-[#111009] shadow-sm transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]"
            >
              Start referring <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a
              href="#how-it-works"
              className="font-plex text-[13px] font-medium text-[#4A4740] underline-offset-4 transition-colors hover:text-[#1A7A6E] hover:underline"
            >
              See a walkthrough →
            </a>
          </div>

          {/* City scroll */}
          <div
            className="lp-fade mt-8 w-full"
            style={{ animationDelay: "420ms" }}
          >
            <p className="font-plex-mono mb-1.5 text-[9px] uppercase tracking-[0.2em] text-[#4A4740]/40">
              Used by doctors in
            </p>
            <div className="max-w-xs overflow-hidden lg:max-w-sm">
              <div className="animate-lp-marquee font-plex-mono text-[11px] text-[#4A4740]/50">
                {cityStr}{cityStr}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: card — slides in from right */}
        <div
          className="lp-fade flex w-full shrink-0 justify-center lg:w-[400px] lg:justify-end"
          style={{ animationDelay: "150ms" }}
        >
          <HeroCard />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. TRUST BAR
───────────────────────────────────────────────────────────────────────────── */
const STATS = [
  { number: "2,000+",  label: "Verified specialists" },
  { number: "15",      label: "Specialties"           },
  { number: "< 2 hr",  label: "Avg. response time"   },
  { number: "20+",     label: "Cities"                },
];

function TrustBar() {
  const [ref, inView] = useInView(0.3);
  return (
    <section className="bg-[#0C1824] py-10">
      <div ref={ref} className="mx-auto max-w-4xl px-6">
        <div className="flex flex-wrap items-center justify-center">
          {STATS.map(({ number, label }, i) => (
            <div
              key={label}
              style={reveal(inView, i * 100)}
              className={`flex flex-1 basis-1/2 flex-col items-center px-8 py-3 text-center md:basis-auto ${
                i < STATS.length - 1 ? "md:border-r md:border-[#1F3347]" : ""
              }`}
            >
              <span className="font-plex-mono text-2xl font-semibold text-white md:text-[28px]">
                {number}
              </span>
              <span className="font-plex mt-1 text-[11px] uppercase tracking-widest text-[#4A6070]">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. PROBLEM SECTION
───────────────────────────────────────────────────────────────────────────── */
const PAIN_POINTS = [
  {
    num: "01",
    title: "Clinical context gets lost",
    body: "Patient history, current medications, imaging reports — scattered across WhatsApp. The specialist receives a name and a diagnosis. Not a patient.",
  },
  {
    num: "02",
    title: "No follow-through confirmation",
    body: "You send the referral. The patient says they'll go. You never hear back. Did they make it? Was the diagnosis confirmed? There's no way to know.",
  },
  {
    num: "03",
    title: "Finding the right sub-specialist takes calls",
    body: "A POTS patient doesn't need a cardiologist — they need an electrophysiologist who accepts cases in your patient's city. That search shouldn't take 20 minutes.",
  },
];

function ProblemSection() {
  const [headerRef, headerInView] = useInView();
  const [cardsRef, cardsInView] = useInView();

  return (
    <section className="bg-[#F7F6F2] px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div ref={headerRef} className="mb-12 text-center" style={reveal(headerInView)}>
          <div className="font-plex-mono mb-3 text-[10px] uppercase tracking-[0.22em] text-[#C0392B]">
            The problem
          </div>
          <h2
            className="font-instrument leading-[1.1] text-[#111009]"
            style={{ fontSize: "clamp(26px, 3.5vw, 42px)" }}
          >
            Referrals in India still run on WhatsApp.
          </h2>
          <p className="font-plex mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-[#4A4740]">
            There is no structured system. No accountability. No record of what happens after the patient walks out.
          </p>
        </div>

        <div ref={cardsRef} className="grid gap-4 md:grid-cols-3">
          {PAIN_POINTS.map(({ num, title, body }, i) => (
            <div
              key={title}
              style={reveal(cardsInView, i * 130)}
              className="group relative overflow-hidden rounded-xl border border-[#E5E2DA] bg-white dark:border-border dark:bg-card px-6 pb-7 pt-6 shadow-sm transition-shadow duration-300 hover:shadow-md hover:-translate-y-1"
            >
              <div
                className="absolute inset-y-0 left-0 w-[3px] bg-[#C0392B] transition-opacity duration-300 opacity-100"
              />
              <div className="font-plex-mono mb-4 text-[10px] font-semibold tracking-widest text-[#C0392B]/50">
                {num}
              </div>
              <h3 className="font-plex text-[14px] font-semibold leading-snug text-[#111009]">
                {title}
              </h3>
              <p className="font-plex mt-3 text-[13px] leading-[1.7] text-[#4A4740]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   5. FEATURES SECTION
───────────────────────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    Icon: Search,
    category: "Discovery",
    title: "Sub-specialist search",
    body: "ICD-10 condition codes, city, hospital network, language preference, and live case capacity. Find the right doctor in seconds, not phone calls.",
  },
  {
    Icon: ClipboardList,
    category: "Clinical data",
    title: "Structured referrals",
    body: "Patient snapshot, chief complaint, current medications, urgency, and documents — all in a single thread the specialist actually wants to read.",
  },
  {
    Icon: ShieldCheck,
    category: "Verification",
    title: "NMC-verified profiles",
    body: "Every specialist is verified against NMC registration. Credentials, hospital affiliations, and response-rate metrics are visible before you refer.",
  },
  {
    Icon: Zap,
    category: "Availability",
    title: "Real-time availability",
    body: "Specialists mark their own case capacity. You only see doctors who can actually respond this week — no more calling to find out.",
  },
  {
    Icon: TrendingUp,
    category: "Outcomes",
    title: "Outcome tracking",
    body: "Know when the referral completes. Request outcome notes. Close the loop between referring and receiving doctor — something WhatsApp never let you do.",
  },
];

function FeatureCard({
  Icon, category, title, body, style,
}: { Icon: React.ComponentType<{ className?: string }>; category: string; title: string; body: string; style?: CSSProperties }) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-[#1F3347] bg-[#132030] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#1A7A6E]/50 hover:shadow-[0_8px_32px_-4px_rgba(26,122,110,0.2)]"
      style={style}
    >
      <div className="absolute inset-y-0 left-0 w-[3px] bg-[#1A7A6E] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1A7A6E]/20 bg-[#1A7A6E]/10 transition-colors duration-200 group-hover:bg-[#1A7A6E]/20">
          <Icon className="h-[18px] w-[18px] text-[#1A7A6E]" />
        </div>
        <div>
          <div className="font-plex-mono mb-1.5 text-[10px] uppercase tracking-widest text-[#4A6070]">
            {category}
          </div>
          <h3 className="font-instrument text-[19px] leading-snug text-white">{title}</h3>
          <p className="font-plex mt-2 text-[13px] leading-relaxed text-[#6B8A9E]">{body}</p>
        </div>
      </div>
    </div>
  );
}

function FeaturesSection() {
  const [headerRef, headerInView] = useInView();
  const [cardsRef, cardsInView] = useInView();

  return (
    <section id="features" className="bg-[#0C1824] px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div ref={headerRef} className="mb-12 text-center" style={reveal(headerInView)}>
          <div className="font-plex-mono mb-3 text-[10px] uppercase tracking-[0.22em] text-[#1A7A6E]">
            Capabilities
          </div>
          <h2
            className="font-instrument leading-[1.1] text-white"
            style={{ fontSize: "clamp(26px, 3.5vw, 42px)" }}
          >
            One platform closes every gap.
          </h2>
        </div>

        {/* 2×2 grid */}
        <div ref={cardsRef} className="grid gap-3 md:grid-cols-2">
          {FEATURES.slice(0, 4).map(({ Icon, category, title, body }, i) => (
            <FeatureCard
              key={title}
              Icon={Icon}
              category={category}
              title={title}
              body={body}
              style={reveal(cardsInView, i * 100)}
            />
          ))}
        </div>

        {/* Last card — full width */}
        <div className="mt-3" style={reveal(cardsInView, 400)}>
          <div className="group relative overflow-hidden rounded-xl border border-[#1F3347] bg-[#132030] px-8 py-6 transition-all duration-300 hover:border-[#1A7A6E]/50 hover:shadow-[0_8px_32px_-4px_rgba(26,122,110,0.2)]">
            <div className="absolute inset-y-0 left-0 w-[3px] bg-[#1A7A6E] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#1A7A6E]/20 bg-[#1A7A6E]/10 transition-colors duration-200 group-hover:bg-[#1A7A6E]/20">
                <TrendingUp className="h-5 w-5 text-[#1A7A6E]" />
              </div>
              <div className="flex-1">
                <div className="font-plex-mono mb-1 text-[10px] uppercase tracking-widest text-[#4A6070]">
                  {FEATURES[4].category}
                </div>
                <h3 className="font-instrument text-[20px] text-white">{FEATURES[4].title}</h3>
                <p className="font-plex mt-1.5 max-w-xl text-[13px] leading-relaxed text-[#6B8A9E]">
                  {FEATURES[4].body}
                </p>
              </div>
              <div className="hidden shrink-0 md:block">
                <div className="font-plex-mono rounded-lg border border-[#1A7A6E]/20 bg-[#1A7A6E]/8 px-4 py-3 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-[#4A6070]">Avg. loop closure</div>
                  <div className="mt-1 text-[22px] font-semibold text-[#1A7A6E]">&lt; 4 hr</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   6. HOW IT WORKS
───────────────────────────────────────────────────────────────────────────── */
const STEPS = [
  { n: "01", title: "Search",          body: "Search by condition, ICD-10 code, or specialist name. Filter by city, language, and live availability." },
  { n: "02", title: "Review",          body: "Open the specialist's profile. Check credentials, hospital affiliations, and average response time."      },
  { n: "03", title: "Send referral",   body: "Patient summary, urgency level, and clinical documents — sent in a structured thread in under 60 seconds." },
  { n: "04", title: "Close the loop",  body: "Track status in real time. Receive outcome notes. The case is closed when you confirm it."                 },
];

function HowItWorks() {
  const [ref, inView] = useInView(0.15);
  return (
    <section id="how-it-works" className="bg-[#F7F6F2] px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div style={reveal(inView)} className="mb-14 text-center">
          <div className="font-plex-mono mb-3 text-[10px] uppercase tracking-[0.22em] text-[#1A7A6E]">
            How it works
          </div>
          <h2
            className="font-instrument leading-[1.1] text-[#111009]"
            style={{ fontSize: "clamp(26px, 3.5vw, 42px)" }}
          >
            A referral in four steps.
          </h2>
        </div>

        <div ref={ref} className="relative">
          {/* Animated connector line */}
          <div className="absolute left-[12.5%] right-[12.5%] top-5 hidden overflow-hidden md:block">
            <div
              className={`h-0 border-t-2 border-dashed border-[#1A7A6E]/30 ${inView ? "animate-lp-line" : ""}`}
              style={{ animationDelay: "200ms" }}
            />
          </div>

          <div className="grid gap-10 md:grid-cols-4">
            {STEPS.map(({ n, title, body }, i) => (
              <div
                key={n}
                className="relative flex flex-col items-center text-center"
                style={reveal(inView, 100 + i * 140)}
              >
                {/* Pop-in step dot */}
                <div
                  className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#1A7A6E] bg-[#F7F6F2] shadow-[0_0_0_4px_#F7F6F2] ${inView ? "animate-lp-pop" : "opacity-0"}`}
                  style={{ animationDelay: `${250 + i * 140}ms` }}
                >
                  <span className="font-plex-mono text-[11px] font-semibold text-[#1A7A6E]">{n}</span>
                </div>
                <h3 className="font-instrument mt-5 text-[18px] leading-snug text-[#111009]">{title}</h3>
                <p className="font-plex mt-2 text-[13px] leading-[1.65] text-[#4A4740]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   7. PRODUCT MOCKUP
───────────────────────────────────────────────────────────────────────────── */
const REFERRAL_LIST_ITEMS = [
  { initials: "RS", name: "Rajan Sharma",  age: "58M", spec: "Dr. Menon — Cardiology",   status: "Pending",   chipCls: "bg-[#E8B86D]/15 text-[#E8B86D]",  active: true  },
  { initials: "KI", name: "Kavya Iyer",    age: "34F", spec: "Dr. Patel — Pulmonology",  status: "Accepted",  chipCls: "bg-[#1A7A6E]/15 text-[#1A7A6E]",  active: false },
  { initials: "MD", name: "Manohar Das",   age: "71M", spec: "Dr. Singh — Nephrology",   status: "Completed", chipCls: "bg-[#4CAF7D]/15 text-[#4CAF7D]",  active: false },
];

function ProductMockup() {
  const [ref, inView] = useInView(0.1);
  return (
    <section className="bg-[#0C1824] px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div style={reveal(inView)} className="mb-10 text-center">
          <div className="font-plex-mono mb-3 text-[10px] uppercase tracking-[0.22em] text-[#1A7A6E]">
            Product
          </div>
          <h2
            className="font-instrument leading-[1.1] text-white"
            style={{ fontSize: "clamp(26px, 3.5vw, 42px)" }}
          >
            Built to match how you actually work.
          </h2>
        </div>

        {/* Browser shell */}
        <div
          ref={ref}
          style={reveal(inView, 150, 40)}
          className="overflow-hidden rounded-2xl border border-[#1F3347] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)]"
        >
          {/* Chrome bar */}
          <div className="flex items-center gap-2 border-b border-[#1F3347] bg-[#0C1824] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
            <span className="font-plex-mono ml-4 text-[11px] text-[#4A6070]">
              doctorbridge.in  ·  Referrals
            </span>
          </div>

          <div className="flex flex-col md:flex-row" style={{ backgroundColor: "#0A111A" }}>
            {/* Left: list */}
            <div className="w-full border-b border-[#1F3347] md:w-56 md:shrink-0 md:border-b-0 md:border-r">
              <div className="border-b border-[#1F3347] px-4 py-2.5">
                <span className="font-plex-mono text-[10px] uppercase tracking-widest text-[#4A6070]">My Referrals</span>
              </div>
              {REFERRAL_LIST_ITEMS.map(({ initials, name, age, spec, status, chipCls, active }) => (
                <div
                  key={name}
                  className={`flex items-start gap-3 border-b border-[#1F3347] px-3.5 py-3 ${active ? "bg-[#132030]" : ""}`}
                  style={{ opacity: active ? 1 : 0.55 }}
                >
                  <div className="font-plex-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1A7A6E]/15 text-[10px] font-semibold text-[#1A7A6E]">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-plex truncate text-[12px] font-medium text-white">{name}</span>
                      <span className="font-plex-mono shrink-0 text-[9px] text-[#4A6070]">{age}</span>
                    </div>
                    <div className="font-plex mt-0.5 truncate text-[10px] text-[#4A6070]">{spec}</div>
                    <span className={`font-plex-mono mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-medium ${chipCls}`}>
                      {status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: detail */}
            <div className="flex-1 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-plex-mono text-[9px] uppercase tracking-widest text-[#4A6070]">REF-20240419-001</div>
                  <h4 className="font-instrument mt-1 text-[20px] leading-snug text-white">
                    Rajan Sharma — Chest pain, exertional
                  </h4>
                </div>
                <span className="font-plex-mono shrink-0 rounded-full bg-[#E8B86D]/15 px-2.5 py-1 text-[10px] font-medium text-[#E8B86D]">
                  Pending
                </span>
              </div>

              {/* Patient snapshot */}
              <div className="mb-3 grid grid-cols-3 gap-2">
                {([
                  { label: "Age / Sex",        value: "58M"                   },
                  { label: "Chief complaint",  value: "Exertional chest pain" },
                  { label: "Urgency",          value: "Semi-urgent"            },
                ] as const).map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-[#1F3347] bg-[#0C1824] p-2.5">
                    <div className="font-plex-mono text-[8px] uppercase tracking-widest text-[#4A6070]">{label}</div>
                    <div className="font-plex mt-1 text-[11px] font-medium text-[#A0BCC8]">{value}</div>
                  </div>
                ))}
              </div>

              {/* Doctors */}
              <div className="mb-3 grid grid-cols-2 gap-2">
                {([
                  { label: "Referring doctor",    name: "Dr. Arun Verma, MBBS",           detail: "GP · Nagpur"              },
                  { label: "Specialist assigned",  name: "Dr. Priya Menon, DM Cardiology", detail: "Apollo Hospitals · Chennai" },
                ] as const).map(({ label, name, detail }) => (
                  <div key={label} className="rounded-lg border border-[#1F3347] bg-[#0C1824] p-2.5">
                    <div className="font-plex-mono text-[8px] uppercase tracking-widest text-[#4A6070]">{label}</div>
                    <div className="font-plex mt-1 text-[11px] font-semibold text-white">{name}</div>
                    <div className="font-plex-mono mt-0.5 text-[9px] text-[#4A6070]">{detail}</div>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div className="rounded-lg border border-[#1F3347] bg-[#0C1824] p-3">
                <div className="font-plex-mono mb-2.5 text-[8px] uppercase tracking-widest text-[#4A6070]">Timeline</div>
                <div className="space-y-2">
                  {([
                    { dot: "bg-[#4A9D8F]", text: "Referral sent",            time: "09:14 AM" },
                    { dot: "bg-[#E8B86D]", text: "Accepted by Dr. Menon",    time: "09:31 AM" },
                    { dot: "bg-[#4CAF7D]", text: "Appointment scheduled",    time: "10:02 AM" },
                  ] as const).map(({ dot, text, time }) => (
                    <div key={text} className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                      <span className="font-plex flex-1 text-[11px] text-[#8BA4B4]">{text}</span>
                      <span className="font-plex-mono text-[10px] tabular-nums text-[#4A6070]">{time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   8. TESTIMONIALS
───────────────────────────────────────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    initials: "AK",
    quote: "I used to spend 15 minutes coordinating a cardiology referral. Now it's done before the patient leaves my room.",
    name: "Dr. Anand Krishnamurthy",
    role: "General Physician · Pune",
  },
  {
    initials: "SR",
    quote: "I finally know which GPs in my city send well-documented cases. The referral quality has genuinely improved.",
    name: "Dr. Sunita Rao",
    role: "DM Neurology · Bengaluru",
  },
];

function Testimonials() {
  const [ref, inView] = useInView();
  return (
    <section className="bg-[#F7F6F2] px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div style={reveal(inView)} className="mb-12 text-center">
          <div className="font-plex-mono mb-3 text-[10px] uppercase tracking-[0.22em] text-[#1A7A6E]">
            From the network
          </div>
          <h2
            className="font-instrument leading-[1.1] text-[#111009]"
            style={{ fontSize: "clamp(26px, 3.5vw, 42px)" }}
          >
            Doctors who've made the switch.
          </h2>
        </div>

        <div ref={ref} className="grid gap-5 md:grid-cols-2">
          {TESTIMONIALS.map(({ initials, quote, name, role }, i) => (
            <div
              key={name}
              style={reveal(inView, i * 150)}
              className="flex flex-col rounded-xl border border-[#E5E2DA] bg-white dark:border-border dark:bg-card px-7 pb-7 pt-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              {/* Quote mark */}
              <div
                className="font-instrument -ml-1 mb-3 leading-none text-[#1A7A6E]"
                style={{ fontSize: "52px", lineHeight: 1 }}
              >
                &ldquo;
              </div>

              {/* Quote body */}
              <p className="font-plex flex-1 text-[15px] leading-[1.7] text-[#111009]">
                {quote}
              </p>

              {/* Attribution */}
              <div className="mt-6 flex items-center gap-3 border-t border-[#E5E2DA] pt-5">
                <div className="font-plex-mono flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A7A6E]/10 text-[12px] font-semibold text-[#1A7A6E]">
                  {initials}
                </div>
                <div>
                  <div className="font-plex text-[13px] font-semibold text-[#111009]">{name}</div>
                  <div className="font-plex-mono mt-0.5 text-[10px] text-[#4A4740]/70">{role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   9. FINAL CTA
───────────────────────────────────────────────────────────────────────────── */
function FinalCTA() {
  const [ref, inView] = useInView(0.2);
  return (
    <section id="for-specialists" className="relative overflow-hidden bg-[#1A7A6E] px-6 py-20">
      {/* Animated orb accents */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="animate-lp-drift-a absolute -left-32 top-0 h-[400px] w-[400px] rounded-full opacity-20"
          style={{ background: "radial-gradient(closest-side, #4CAF7D, transparent)" }}
        />
        <div
          className="animate-lp-drift-b absolute -bottom-20 right-0 h-[350px] w-[350px] rounded-full opacity-15"
          style={{ background: "radial-gradient(closest-side, #E8B86D, transparent)" }}
        />
        {/* Dot texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div ref={ref} className="relative mx-auto max-w-2xl text-center" style={reveal(inView)}>
        <h2
          className="font-instrument leading-[1.1] text-white"
          style={{ fontSize: "clamp(30px, 4.5vw, 50px)" }}
        >
          Modernise your referral workflow.
        </h2>
        <p className="font-plex mx-auto mt-4 max-w-sm text-[16px] leading-relaxed text-white/70">
          Free for referring doctors. Setup takes 3 minutes.
        </p>
        <Link
          to="/register"
          className="font-plex mt-9 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[13px] font-semibold text-[#111009] shadow-md transition-all hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
        >
          Create your account <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="font-plex-mono mt-5 text-[10px] uppercase tracking-widest text-white/40">
          NMC-registered specialists only · No hospital integration required
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   10. FOOTER
───────────────────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-[#1F3347] bg-[#0C1824]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#1A7A6E]" strokeWidth={2.5} />
              <span className="font-instrument text-[17px] text-white">Doctor Bridge</span>
            </div>
            <p className="font-plex-mono mt-1.5 text-[10px] uppercase tracking-widest text-[#4A6070]">
              Built for Indian Healthcare
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-7 gap-y-3 md:justify-center">
            {["Product", "Docs", "Pricing", "Privacy", "Terms"].map((link) => (
              <a key={link} href="#" className="font-plex text-[13px] text-[#4A6070] transition-colors hover:text-white">
                {link}
              </a>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 md:justify-end">
            {["NMC Verification Policy", "Contact"].map((link) => (
              <a key={link} href="#" className="font-plex text-[13px] text-[#4A6070] transition-colors hover:text-white">
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[#1F3347] px-6 py-4">
        <div className="mx-auto max-w-6xl text-center">
          <span className="font-plex-mono text-[10px] text-[#4A6070]">
            © 2025 Doctor Bridge by Agentica AI Labs &nbsp;·&nbsp; Made in India 🇮🇳
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROOT EXPORT
───────────────────────────────────────────────────────────────────────────── */
export function LandingPage() {
  return (
    <div className="font-plex">
      <Navbar />
      <Hero />
      <TrustBar />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorks />
      <ProductMockup />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </div>
  );
}
