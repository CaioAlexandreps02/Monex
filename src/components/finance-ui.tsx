import { formatCurrency, formatMonthLabel, monthValueToDate } from "@/lib/finance";
import { navItems } from "@/lib/mock-data";
import type { FinancePriority, ViewId } from "@/types/finance";

import Image from "next/image";

const priorityClasses: Record<string, string> = {
  "Urgente": "bg-red-50 text-red-600 ring-red-200",
  "Alta": "bg-orange-50 text-orange-600 ring-orange-200",
  "MÃ©dia": "bg-sky-50 text-sky-600 ring-sky-200",
  "Baixa": "bg-emerald-50 text-emerald-600 ring-emerald-200",
  "AdiÃ¡vel": "bg-slate-100 text-slate-500 ring-slate-200",
};

export function NavigationRail({
  activeView,
  onNavigate,
}: {
  activeView: ViewId;
  onNavigate: (viewId: ViewId) => void;
}) {
  return (
    <aside className="relative z-30 hidden w-[268px] shrink-0 pointer-events-auto lg:block">
      <div className="sticky top-6 z-30 rounded-[32px] bg-gradient-to-b from-[#0f56be] via-[#1d63cf] to-[#163878] p-4 text-white shadow-[0_24px_80px_rgba(16,63,145,0.32)]">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-center">
            <Image
              src="/branding/monex-logo.png"
              alt="Monex"
              width={180}
              height={44}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>
        </div>

        <nav className="mt-5 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-pressed={activeView === item.id}
              className={`flex w-full items-center rounded-2xl px-4 py-2.5 text-left text-sm transition ${
                activeView === item.id
                  ? "bg-white text-slate-950 shadow-[0_20px_40px_rgba(255,255,255,0.18)]"
                  : "bg-white/8 text-white/82 hover:bg-white/14"
              }`}
            >
              <span className="font-semibold">{item.label}</span>
            </button>
          ))}
        </nav>

      </div>
    </aside>
  );
}

export function MobileNavigation({
  activeView,
  onNavigate,
}: {
  activeView: ViewId;
  onNavigate: (viewId: ViewId) => void;
}) {
  return (
    <div className="lg:hidden">
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-pressed={activeView === item.id}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeView === item.id
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
              }`}
            >
              {item.shortLabel}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-white/70 bg-white/85 p-5 shadow-[0_22px_60px_rgba(31,58,126,0.08)] backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-semibold tracking-tight text-slate-950">{title}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function ViewHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,247,255,0.88))] p-5 shadow-[0_22px_60px_rgba(31,58,126,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.28em] text-sky-600">{eyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
        </div>
        {aside ? <div className="min-w-[220px] flex-1 sm:flex-none">{aside}</div> : null}
      </div>
    </section>
  );
}

export function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <div
      className={`rounded-2xl border border-white/15 px-4 py-3 ${
        tone === "positive"
          ? "bg-emerald-400/16"
          : tone === "negative"
            ? "bg-red-400/16"
            : "bg-white/12"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.22em] text-white/70">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  support?: string;
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="rounded-[26px] border border-white/60 bg-white/85 p-5 shadow-[0_20px_48px_rgba(17,34,68,0.07)]">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          tone === "positive"
            ? "text-emerald-600"
            : tone === "negative"
              ? "text-red-500"
              : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function MetricStack({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: string;
  support?: string;
  dark?: boolean;
}) {
  return (
    <div>
      <p className={`text-sm ${dark ? "text-white/75" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${dark ? "text-white" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

export function PriorityPill({ priority }: { priority: FinancePriority }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${priorityClasses[priority]}`}
    >
      {priority}
    </span>
  );
}

export function PriorityCard({
  title,
  subtitle,
  amount,
  progress,
  pill,
}: {
  title: string;
  subtitle: string;
  amount: number;
  progress: number;
  pill: FinancePriority;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <PriorityPill priority={pill} />
      </div>
      <p className="mt-4 text-2xl font-semibold text-slate-900">{formatCurrency(amount)}</p>
      <ProgressBar value={progress} />
    </div>
  );
}

export function ProgressBar({ value, danger = false }: { value: number; danger?: boolean }) {
  const percentage = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="mt-3 h-2 rounded-full bg-slate-200">
      <div
        className={`h-full rounded-full ${
          danger ? "bg-red-400" : percentage > 0.84 ? "bg-orange-400" : "bg-sky-500"
        }`}
        style={{ width: `${Math.max(percentage * 100, 5)}%` }}
      />
    </div>
  );
}

export function CategoryDonut({ items }: { items: Array<{ categoryName: string; amount: number }> }) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const palette = ["#1d63cf", "#5aa0ff", "#ff8a65", "#00b894", "#8f62ff"];
  const stops: string[] = [];
  let previous = 0;

  items.forEach((item, index) => {
    const percentage = total > 0 ? (item.amount / total) * 100 : 0;
    const next = previous + percentage;
    stops.push(`${palette[index % palette.length]} ${previous}% ${next}%`);
    previous = next;
  });

  return (
    <div className="mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
      <div
        className="flex h-[168px] w-[168px] items-center justify-center rounded-full"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      >
        <div className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-white">
          <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Total</span>
          <span className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

export function LegendBadge({ index }: { index: number }) {
  const colors = ["bg-[#1d63cf]", "bg-[#5aa0ff]", "bg-[#ff8a65]", "bg-[#00b894]", "bg-[#8f62ff]"];
  return <span className={`h-3 w-3 rounded-full ${colors[index % colors.length]}`} />;
}

export function LegendRow({
  label,
  value,
  index,
}: {
  label: string;
  value: number;
  index: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <LegendBadge index={index} />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-900">{formatCurrency(value)}</span>
    </div>
  );
}

export function TrendBars({
  items,
}: {
  items: Array<{ month: string; label: string; income: number; expenses: number; result: number }>;
}) {
  const biggest = items.reduce((max, item) => Math.max(max, item.income, item.expenses), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.month} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">
              {formatMonthLabel(monthValueToDate(item.label))}
            </p>
            <p
              className={`text-sm font-semibold ${
                item.result >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {formatCurrency(item.result)}
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <Bar label="Entradas" value={item.income} max={biggest} tone="positive" />
            <Bar label="SaÃ­das" value={item.expenses} max={biggest} tone="negative" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MiniBarChart({
  items,
  currency = true,
}: {
  items: Array<{ label: string; value: number; color?: string }>;
  currency?: boolean;
}) {
  const biggest = items.reduce((max, item) => Math.max(max, item.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600">{item.label}</span>
            <span className="font-semibold text-slate-900">
              {currency ? formatCurrency(item.value) : item.value.toFixed(0)}
            </span>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-slate-200">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(6, (item.value / biggest) * 100)}%`,
                background: item.color ?? "#2f86ed",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SegmentBarChart({
  items,
}: {
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-200">
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              width: `${total > 0 ? (item.value / total) * 100 : 0}%`,
              background: item.color,
            }}
          />
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              <span className="text-slate-600">{item.label}</span>
            </div>
            <span className="font-semibold text-slate-900">{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SparklineChart({
  values,
  color = "#1d63cf",
  fill = "rgba(29,99,207,0.12)",
  height = 72,
}: {
  values: number[];
  color?: string;
  fill?: string;
  height?: number;
}) {
  const width = 320;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[72px] w-full overflow-visible">
      <polyline points={area} fill={fill} stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Bar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "positive" | "negative";
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{label}</span>
        <span>{formatCurrency(value)}</span>
      </div>
      <div className="mt-2 h-3 rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${
            tone === "positive" ? "bg-emerald-500" : "bg-red-400"
          }`}
          style={{ width: `${Math.max(8, (value / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function QuickAction({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50"
    >
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </button>
  );
}

export function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function SimulationRow({
  label,
  value,
}: {
  label: string;
  value: string;
  support: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
        </div>
        <p className="text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export function ConfigField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <FormField label={label}>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="field"
      />
    </FormField>
  );
}


