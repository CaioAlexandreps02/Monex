import { formatCurrency, formatMonthLabel, monthValueToDate } from "@/lib/finance";
import { navItems } from "@/lib/mock-data";
import type { FinancePriority, ViewId } from "@/types/finance";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  FileDown,
  LayoutList,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type CustomSelectOption = {
  value: string;
  label: string;
  icon?: LucideIcon;
};

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  className = "",
  id,
}: {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((opt) => opt.value === value);

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightedIndex]) {
        (items[highlightedIndex] as HTMLElement).scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, highlightedIndex]);

  function handleButtonKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(event.key === "ArrowDown" ? 0 : options.length - 1);
      } else {
        setHighlightedIndex((prev) => {
          if (event.key === "ArrowDown") return Math.min(prev + 1, options.length - 1);
          return Math.max(prev - 1, 0);
        });
      }
    } else if (event.key === "Enter" && isOpen && highlightedIndex >= 0) {
      event.preventDefault();
      onChange(options[highlightedIndex].value);
      close();
    } else if (event.key === "Escape") {
      close();
    } else if (event.key === "Tab") {
      close();
    }
  }

  function handleOptionClick(optValue: string) {
    onChange(optValue);
    close();
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleButtonKeyDown}
        className={`field flex w-full items-center justify-between gap-2 text-left ${
          !selected ? "text-slate-400" : ""
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.icon && <selected.icon className="h-4 w-4 shrink-0 text-slate-400" />}
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <ul
        ref={listRef}
        className={`absolute z-50 mt-1 max-h-[200px] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg transition-all duration-150 ease-out ${
          isOpen
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{ scrollBehavior: "smooth" }}
      >
        {options.map((opt, index) => {
          const isSelected = opt.value === value;
          const isHighlighted = index === highlightedIndex;
          return (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => handleOptionClick(opt.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition ${
                  isHighlighted ? "bg-sky-50" : ""
                } ${isSelected ? "bg-sky-100 font-semibold text-slate-900" : "text-slate-700"}`}
              >
                <span className="flex items-center gap-2 truncate">
                  {opt.icon && <opt.icon className="h-4 w-4 shrink-0 text-slate-400" />}
                  {opt.label}
                </span>
                {isSelected ? <Check className="h-4 w-4 shrink-0 text-sky-600" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const priorityClasses: Record<string, string> = {
  "Urgente": "bg-red-50 text-red-600 ring-red-200",
  "Alta": "bg-orange-50 text-orange-600 ring-orange-200",
  "Media": "bg-sky-50 text-sky-600 ring-sky-200",
  "Baixa": "bg-emerald-50 text-emerald-600 ring-emerald-200",
  "Adiavel": "bg-slate-100 text-slate-500 ring-slate-200",
};

export function NavigationRail({
  activeView,
  onNavigate,
  activeHomeTab = "grid",
  onHomeTabNavigate,
}: {
  activeView: ViewId;
  onNavigate: (viewId: ViewId) => void;
  activeHomeTab?: string;
  onHomeTabNavigate?: (tabId: "grid" | "planning" | "accounts" | "cards" | "imports") => void;
}) {
  const planilhaSubItems: Array<{
    id: "grid" | "planning" | "accounts" | "cards" | "imports";
    label: string;
    icon: LucideIcon;
  }> = [
    { id: "grid", label: "Resumo", icon: LayoutList },
    { id: "planning", label: "Planejamento", icon: Target },
    { id: "accounts", label: "Contas", icon: Wallet },
    { id: "cards", label: "Cartoes", icon: CreditCard },
    { id: "imports", label: "Importar", icon: FileDown },
  ];

  return (
    <aside className="relative z-30 hidden w-[180px] shrink-0 pointer-events-auto lg:block">
      <div className="sticky top-0 z-30 flex min-h-screen flex-col border-r border-slate-950/10 bg-[#08275f] px-3 py-5 text-white shadow-[12px_0_40px_rgba(8,39,95,0.12)]">
        <div className="border-b border-white/12 pb-5">
          <div className="flex items-center">
            <Image
              src="/branding/monex-logo.png"
              alt="Monex"
              width={134}
              height={44}
              className="h-9 w-auto rounded-xl bg-white px-2 py-1 object-contain"
              priority
            />
          </div>
        </div>

        <nav className="mt-5 flex-1 space-y-1">
          {navItems.map((item) => (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-pressed={activeView === item.id}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  activeView === item.id
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-white/74 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.icon && <item.icon className="h-[17px] w-[17px] shrink-0" />}
                <span className="font-semibold">{item.label}</span>
                {item.id === "home" ? (
                  <ChevronDown
                    className={`ml-auto h-4 w-4 transition ${activeView === "home" ? "rotate-180" : ""}`}
                  />
                ) : null}
              </button>

              {item.id === "home" && activeView === "home" ? (
                <div className="mt-2 space-y-1 border-l border-white/14 pl-3">
                  {planilhaSubItems.map((subItem) => (
                    <button
                      key={subItem.id}
                      type="button"
                      onClick={() => onHomeTabNavigate?.(subItem.id)}
                      aria-pressed={activeHomeTab === subItem.id}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                        activeHomeTab === subItem.id
                          ? "bg-blue-500 text-white"
                          : "text-white/68 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <subItem.icon className="h-3.5 w-3.5 shrink-0" />
                      {subItem.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <button
          type="button"
          className="mt-5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <CircleDollarSign className="h-4 w-4" />
          Recolher
        </button>
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
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-pressed={activeView === item.id}
            className={`flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-semibold transition ${
              activeView === item.id ? "text-blue-600" : "text-slate-500"
            }`}
          >
            {item.icon && <item.icon className="h-5 w-5" />}
            <span className="truncate">{item.shortLabel}</span>
          </button>
        ))}
      </div>
    </nav>
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
    <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      {title || action ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          {title ? (
            <div>
              <p className="text-lg font-semibold tracking-tight text-slate-950">{title}</p>
            </div>
          ) : null}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
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
  icon: Icon,
}: {
  label: string;
  value: string;
  support?: string;
  tone: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-[26px] border border-white/60 bg-white/85 p-5 shadow-[0_20px_48px_rgba(17,34,68,0.07)]">
      <div className="flex items-center gap-2">
        {Icon && (
          <Icon
            className={`h-5 w-5 ${
              tone === "positive"
                ? "text-emerald-500"
                : tone === "negative"
                  ? "text-red-400"
                  : "text-slate-400"
            }`}
          />
        )}
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
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
            <Bar label="Saidas" value={item.expenses} max={biggest} tone="negative" />
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


