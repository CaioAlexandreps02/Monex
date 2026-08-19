"use client";

import { Fragment, useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import {
  accounts as seedAccounts,
  bankPresets as seedBankPresets,
  bills as seedBills,
  cards as seedCards,
  categories as seedCategories,
  debts as seedDebts,
  fixedFlowEntries as seedFixedFlowEntries,
  investments as seedInvestments,
  monthlyPlan as seedMonthlyPlan,
  monthlyPlansByMonth as seedMonthlyPlansByMonth,
  navItems,
  plannedPurchases as seedPlannedPurchases,
  referenceDate,
  settings as seedSettings,
  transactions as seedTransactions,
} from "@/lib/mock-data";
import {
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  getAccountsSnapshot,
  getAlerts,
  getAvailableMonths,
  getBoardColumns,
  getCardSummaries,
  getCategoryBreakdown,
  createTransactionGroup,
  deleteTransactionGroup,
  renameTransactionGroup,
  addToGroup,
  removeFromGroup,
  getGroupTotal,
  getGroupTransactions,
  getTransactionGroups,
  getInvestmentSnapshot,
  getMonthlySummary,
  getMonthlyTrend,
  getMonthTransactions,
  getUpcomingInstallments,
  getWeeklySummary,
  monthValueToDate,
} from "@/lib/finance";
import type {
  Account,
  BankPreset,
  Bill,
  BoardColumn,
  Card,
  CardBillEstimate,
  CardMode,
    Category,
    Debt,
  FinancePriority,
  FixedFlowEntry,
  FixedFlowSection,
  ImportAutomationConfig,
  ImportTransport,
  ImportLearningRule,
  ImportMerchant,
  ImportedStatementBatch,
  ImportedStatementItem,
  Investment,
    MonthlyGridRow,
    MonthlyPlan,
    Settings,
    PaymentPlanMethod,
  PaymentMethod,
  PlannedPurchase,
  Transaction,
  TransactionGroup,
  ViewId,
} from "@/types/finance";
import {
  CategoryDonut,
  ConfigField,
  CustomSelect,
  FormField,
  InfoBlock,
  LegendBadge,
  LegendRow,
  MetricStack,
  MiniBarChart,
  MobileNavigation,
  NavigationRail,
  Panel,
  PriorityPill,
  ProgressBar,
  SegmentBarChart,
  SimulationRow,
  TrendBars,
} from "@/components/finance-ui";

import {
  Table,
  Target,
  Tag,
  Building2,
  Wallet,
  CreditCard,
  Plus,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  CheckCircle2,
  Check,
  Tags,
} from "lucide-react";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false },
);

type DraftTransaction = {
  title: string;
  type: "income" | "expense";
  operationKind:
    | "income"
    | "variable"
    | "basic_bill"
    | "recurring_bill"
    | "debt_payment"
    | "investment"
    | "planned_purchase";
  amount: string;
  date: string;
  categoryId: string;
  paymentOption: "pix" | "cash" | "bank_transfer" | "card";
  accountId: string;
  cardId: string;
  cardMode: CardMode;
  installments: number;
  description: string;
  linkedPlannedPurchaseId: string;
};

type PlanningScreen = "purchases" | "reserves" | "investments" | "board";
type PlanningBoardView = "default" | "weeks" | "months";
type ReportsSection = "cashflow" | "categories" | "payment-methods" | "monthly-trend" | "exports";
type SettingsSection = "main" | "salary" | "categories" | "banks" | "accounts" | "security";
type AccountsSection = "overview" | "normal" | "recurring" | "debts" | "archived";
type HomeTab = "grid" | "planning" | "accounts" | "cards" | "imports";
type AccountEntryKind = "bill" | "debt";
type BillDisplayItem =
  | { source: "manual"; bill: Bill }
  | { source: "card_auto"; bill: Bill; cardId: string; statementMonth: string };

type DraftPurchase = {
  name: string;
  description: string;
  estimatedValue: string;
  savedAmount: string;
  suggestedPeriodAmount: string;
  priority: FinancePriority;
  scheduleType: "week" | "month";
  specificMonthTarget: boolean;
  boardColumn: Exclude<BoardColumn, "bought">;
  desiredDate: string;
  planningMode: "save_over_time" | "buy_in_target_period" | "card_parcelado";
  paymentOption: PaymentPlanMethod;
  cardId: string;
  cardMode: CardMode;
  installments: number;
};

type DraftCategory = {
  name: string;
  type: "income" | "expense";
  color: string;
  parentId: string;
};

type DraftSalaryMonth = {
  monthValue: string;
  fixedIncomePlanned: string;
};

type PurchaseModalOptions = {
  planningMode?: DraftPurchase["planningMode"];
  paymentOption?: DraftPurchase["paymentOption"];
};

const viewPathMap: Record<ViewId, string> = {
  home: "/",
  transactions: "/transacoes",
  history: "/relatorios",
  reconciliation: "/conciliacao",
  settings: "/configuracoes",
};

function isHomeTab(value: string | null): value is HomeTab {
  return value === "grid" || value === "planning" || value === "accounts" || value === "cards" || value === "imports";
}

function isPlanningScreen(value: string | null): value is Exclude<PlanningScreen, "board"> {
  return value === "purchases" || value === "reserves" || value === "investments";
}

function isAccountsSection(value: string | null): value is AccountsSection {
  return value === "overview" || value === "normal" || value === "recurring" || value === "debts";
}

type DraftCard = {
  name: string;
  issuer: string;
  brand: string;
  lastDigits: string;
  accentColor: string;
  availableMode: "credit" | "debit" | "both";
  closingDay: string;
  dueDay: string;
  creditLimit: string;
  linkedAccountId: string;
};

type DraftBankPreset = {
  issuer: string;
  brand: string;
  color: string;
};

type DraftBill = {
  title: string;
  amount: string;
  categoryId: string;
  dueDate: string;
  priority: FinancePriority;
  status: "pending" | "paid" | "overdue";
  isRecurring: boolean;
  recurringDay: string;
  plannedPaymentMethod: PaymentPlanMethod;
  plannedCardId: string;
  plannedCardMode: CardMode;
  installments: string;
  notes: string;
};

type DraftDebt = {
  name: string;
  description: string;
  totalAmount: string;
  paidAmount: string;
  installments: string;
  installmentAmount: string;
  nextDueDate: string;
  priority: FinancePriority;
  status: "active" | "paused" | "settled";
  plannedPaymentMethod: PaymentPlanMethod;
  plannedCardId: string;
};

type DraftDebtPlan = {
  debtId: string;
  monthCount: string;
  installmentAmount: string;
};

type CommitmentSchedule = "once" | "recurring" | "installments" | "saving_goal";

type DraftCommitment = {
  title: string;
  kind: "expense" | "income";
  schedule: CommitmentSchedule;
  categoryId: string;
  totalAmount: string;
  installmentAmount: string;
  installments: string;
  startDate: string;
  paymentMethod: PaymentPlanMethod;
  cardId: string;
  cardMode: CardMode;
  notes: string;
  amountByMonth: Record<string, string>;
};

type CommitmentConversionKind = "agreement" | "recurring" | "installment";

type CommitmentEditTarget =
  | { sourceType: "bill"; sourceId: string; monthValue: string }
  | { sourceType: "fixed"; sourceId: string; monthValue: string }
  | { sourceType: "planned_purchase"; sourceId: string; monthValue: string }
  | { sourceType: "debt"; sourceId: string; monthValue: string }
  | { sourceType: "card_auto_bill"; sourceId: string; monthValue: string };

type MonthlyGridDeleteTarget = {
  rowId: string;
  sourceId: string;
  sourceType: MonthlyGridRow["sourceType"];
  title: string;
  linkedBillGroupId?: string;
  linkedDebtId?: string;
};

type DraftAccount = {
  name: string;
  type: string;
  initialBalance: string;
  currentBalance: string;
};

type DraftFixedEntry = {
  section: FixedFlowSection;
  title: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  accountId: string;
  cardId: string;
  cardMode: CardMode;
  syncCardLimit: boolean;
  notes: string;
  amountByMonth: Record<string, string>;
};

type DraftInvestment = {
  name: string;
  type: string;
  objective: string;
  totalGrossInvested: string;
  currentManualValue: string;
  monthlyTarget: string;
  paymentMethod: PaymentMethod;
  accountId: string;
  cardId: string;
  cardMode: CardMode;
  notes: string;
};

type DraftInvestmentContribution = {
  investmentId: string;
  amount: string;
  contributionDate: string;
  paymentMethod: PaymentMethod;
  accountId: string;
  cardId: string;
  cardMode: CardMode;
  notes: string;
};

const paymentLabels: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  bank_transfer: "Transferencia",
  credit_card: "Cartao credito",
  debit_card: "Cartao debito",
};

const planningBoardViewLabels: Record<PlanningBoardView, string> = {
  default: "Formato padrao",
  weeks: "Por semana",
  months: "Por mes",
};

const planningSectionLabels: Record<Exclude<PlanningScreen, "board">, string> = {
  purchases: "Compras",
  reserves: "Reservas",
  investments: "Investimentos",
};

const paymentPlanLabels: Record<PaymentPlanMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  bank_transfer: "Transferencia",
  card: "Cartao",
};

const importAutomationStatusLabels: Record<ImportAutomationConfig["status"], string> = {
  planned: "Planejada",
  needs_authorization: "Aguardando autorizacao",
  active: "Ativa",
  paused: "Pausada",
  disabled: "Desativada",
};

function getCardGradient(color: string) {
  return {
    background: `linear-gradient(135deg, ${color} 0%, #1e293b 100%)`,
  };
}

const boardColumnClasses: Record<BoardColumn, string> = {
  this_week: "border-red-200 bg-red-50/70",
  next_week: "border-orange-200 bg-orange-50/70",
  this_month: "border-sky-200 bg-sky-50/70",
  next_month: "border-violet-200 bg-violet-50/70",
  later: "border-slate-200 bg-slate-50/70",
  bought: "border-emerald-200 bg-emerald-50/70",
};

function getWeekOfMonthLabel(dateValue?: string) {
  if (!dateValue) {
    return undefined;
  }

  const date = new Date(`${dateValue}T12:00:00`);
  return `Semana ${Math.min(5, Math.max(1, Math.ceil(date.getDate() / 7)))}`;
}

function getWeeksInMonth(monthValue: string) {
  const date = monthValueToDate(monthValue);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.min(5, Math.max(4, Math.ceil(daysInMonth / 7)));
}

function getMonthValueOffset(monthValue: string, offset: number) {
  const date = monthValueToDate(monthValue);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getPurchaseScheduleType(purchase: Pick<PlannedPurchase, "scheduleType" | "boardColumn" | "targetWeek">) {
  if (purchase.scheduleType) {
    return purchase.scheduleType;
  }

  if (purchase.targetWeek || purchase.boardColumn === "this_week" || purchase.boardColumn === "next_week") {
    return "week";
  }

  return "month";
}

function getDefaultBoardColumnForPurchase(
  purchase: Pick<PlannedPurchase, "scheduleType" | "boardColumn" | "targetWeek">,
) {
  const scheduleType = getPurchaseScheduleType(purchase);

  if (scheduleType === "week") {
    return purchase.boardColumn === "this_week" || purchase.boardColumn === "next_week"
      ? purchase.boardColumn
      : "later";
  }

  return purchase.boardColumn === "this_month" || purchase.boardColumn === "next_month"
    ? purchase.boardColumn
    : "later";
}

const initialMonth = getTodayMonthValue();
const FINANCE_STORAGE_KEY = "monex-app-state-v1";
const FINANCE_STORAGE_BACKUP_KEY = "monex-app-state-v1-backup";

const initialImportAutomationConfigs: ImportAutomationConfig[] = [
  {
    id: "email-attachments",
    transport: "email_attachment",
    label: "Email",
    status: "planned",
    isEnabled: false,
    allowedSenders: [],
    keywords: ["extrato", "fatura"],
    processedExternalIds: [],
    notes: "Preparado para buscar anexos de extratos/faturas por email quando houver conector autorizado.",
  },
  {
    id: "open-finance",
    transport: "open_finance",
    label: "Open Finance",
    status: "planned",
    isEnabled: false,
    processedExternalIds: [],
    notes: "Preparado para receber transacoes por API Open Finance mantendo revisao, deduplicacao e reconciliacao.",
  },
];

type FinancePersistedState = {
  selectedMonth: string;
  accounts: Account[];
  cards: Card[];
  transactions: Transaction[];
  transactionGroups: TransactionGroup[];
  bills: Bill[];
  categories: Category[];
  debts: Debt[];
  fixedEntries: FixedFlowEntry[];
  plannedPurchases: PlannedPurchase[];
  investments: Investment[];
  cardBillEstimates: Record<string, CardBillEstimate>;
  importedStatementBatches: ImportedStatementBatch[];
  importedStatementItems: ImportedStatementItem[];
  importLearningRules: ImportLearningRule[];
  importMerchants: ImportMerchant[];
  importAutomationConfigs: ImportAutomationConfig[];
  settings: Settings;
  monthlyPlansByMonth: Record<string, MonthlyPlan>;
};
type FinancePersistedCache = {
  state: Partial<FinancePersistedState>;
  updatedAt: string | null;
};

type RemoteSaveStatus = "loading" | "saved" | "saving" | "error";

const initialDraftTransaction: DraftTransaction = {
  title: "",
  type: "expense",
  operationKind: "variable",
  amount: "",
  date: `${initialMonth}-14`,
  categoryId: "cat-market",
  paymentOption: "pix",
  accountId: "acc-main",
  cardId: "card-nubank",
  cardMode: "credit",
  installments: 1,
  description: "",
  linkedPlannedPurchaseId: "",
};

const initialDraftPurchase: DraftPurchase = {
  name: "",
  description: "",
  estimatedValue: "",
  savedAmount: "",
  suggestedPeriodAmount: "",
  priority: "Alta",
  scheduleType: "month",
  specificMonthTarget: false,
  boardColumn: "this_month",
  desiredDate: `${initialMonth}-28`,
  planningMode: "save_over_time",
  paymentOption: "pix",
  cardId: "card-nubank",
  cardMode: "credit",
  installments: 1,
};

const initialDraftCategory: DraftCategory = {
  name: "",
  type: "expense",
  color: "#1d63cf",
  parentId: "",
};

const initialDraftCard: DraftCard = {
  name: "",
  issuer: "Nubank",
  brand: "Mastercard",
  lastDigits: "",
  accentColor: "#7a2cff",
  availableMode: "both",
  closingDay: "7",
  dueDay: "15",
  creditLimit: "0",
  linkedAccountId: "acc-main",
};

const initialDraftBankPreset: DraftBankPreset = {
  issuer: "",
  brand: "Mastercard",
  color: "#1d63cf",
};

const initialDraftBill: DraftBill = {
  title: "",
  amount: "",
  categoryId: "cat-bills",
  dueDate: `${initialMonth}-20`,
  priority: "Alta",
  status: "pending",
  isRecurring: false,
  recurringDay: "20",
  plannedPaymentMethod: "pix",
  plannedCardId: "card-nubank",
  plannedCardMode: "credit",
  installments: "1",
  notes: "",
};

const initialDraftDebt: DraftDebt = {
  name: "",
  description: "",
  totalAmount: "",
  paidAmount: "0",
  installments: "1",
  installmentAmount: "",
  nextDueDate: `${initialMonth}-28`,
  priority: "Alta",
  status: "active",
  plannedPaymentMethod: "pix",
  plannedCardId: "card-nubank",
};

const initialDraftDebtPlan: DraftDebtPlan = {
  debtId: "",
  monthCount: "1",
  installmentAmount: "",
};

const initialDraftCommitment: DraftCommitment = {
  title: "",
  kind: "expense",
  schedule: "once",
  categoryId: "cat-bills",
  totalAmount: "",
  installmentAmount: "",
  installments: "1",
  startDate: `${initialMonth}-20`,
  paymentMethod: "pix",
  cardId: "card-nubank",
  cardMode: "credit",
  notes: "",
  amountByMonth: {},
};

const initialDraftAccount: DraftAccount = {
  name: "",
  type: "Conta corrente",
  initialBalance: "0",
  currentBalance: "0",
};

const hiddenAccountCategoryIds = new Set(["cat-bills", "cat-debt"]);
const hiddenUiCategoryIds = new Set(["cat-bills", "cat-debt", "cat-invest"]);

function isHiddenAccountCategoryId(categoryId?: string) {
  return Boolean(categoryId && hiddenAccountCategoryIds.has(categoryId));
}

function isHiddenUiCategoryId(categoryId?: string) {
  return Boolean(categoryId && hiddenUiCategoryIds.has(categoryId));
}

function normalizeFixedSection(section: FixedFlowSection): FixedFlowSection {
  if (section === "Gastos fixos" || section === "Dividas e repasses") {
    return "Contas";
  }

  if (section === "Compras planejadas" || section === "Planejamento") {
    return "Contas";
  }

  return section;
}

function getTodayMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function getCategoryFullName(category: Category, categoryList: Category[]) {
  if (!category.parentId) {
    return category.name;
  }

  const parent = categoryList.find((item) => item.id === category.parentId);
  return parent ? `${parent.name} > ${category.name}` : category.name;
}

function getCategoryOptionLabel(category: Category) {
  return category.parentId ? `  ${category.name}` : category.name;
}

function getSuggestedCardStatementMonth(card: Card | undefined, baseDateValue?: string, fallbackMonth?: string) {
  if (!card) {
    return fallbackMonth ?? getTodayMonthValue();
  }

  const today = new Date();
  const safeBaseDate = baseDateValue
    ? new Date(`${baseDateValue.length === 7 ? `${baseDateValue}-01` : baseDateValue}T12:00:00`)
    : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const baseDate = Number.isNaN(safeBaseDate.getTime())
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
    : safeBaseDate;
  const statementDate = new Date(baseDate);

  if (baseDate.getDate() >= card.closingDay) {
    statementDate.setMonth(statementDate.getMonth() + 1);
  }

  return `${statementDate.getFullYear()}-${String(statementDate.getMonth() + 1).padStart(2, "0")}`;
}

function getCardStatementMonthForTransaction(card: Card | undefined, transaction: Transaction) {
  if (transaction.sourceBillId) {
    return transaction.date.slice(0, 7);
  }

  return getSuggestedCardStatementMonth(card, transaction.date, transaction.date.slice(0, 7));
}

function getTransactionDateForCardStatementMonth(card: Card, statementMonth: string) {
  if (card.closingDay <= 1) {
    const previousMonthDate = monthValueToDate(getMonthValueOffset(statementMonth, -1));
    const safeDay = Math.min(15, new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth() + 1, 0).getDate());

    return `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, "0")}-${String(
      safeDay,
    ).padStart(2, "0")}`;
  }

  const statementDate = monthValueToDate(statementMonth);
  const safeDay = Math.max(1, card.closingDay - 1);

  return `${statementMonth}-${String(
    Math.min(safeDay, new Date(statementDate.getFullYear(), statementDate.getMonth() + 1, 0).getDate()),
  ).padStart(2, "0")}`;
}

function getCardStatementMonthForBill(_card: Card | undefined, bill: Bill) {
  return bill.dueDate.slice(0, 7);
}

function getStatementWindowMonths(fromMonthValue: string, windowSize = 12) {
  return Array.from({ length: windowSize }, (_, index) => getMonthValueOffset(fromMonthValue, index));
}

const initialDraftFixedEntry: DraftFixedEntry = {
  section: "Ganhos",
  title: "",
  categoryId: "cat-extra",
  paymentMethod: "pix",
  accountId: "acc-main",
  cardId: "card-nubank",
  cardMode: "credit",
  syncCardLimit: false,
  notes: "",
  amountByMonth: {},
};

const initialDraftInvestment: DraftInvestment = {
  name: "",
  type: "Reserva",
  objective: "",
  totalGrossInvested: "0",
  currentManualValue: "0",
  monthlyTarget: "0",
  paymentMethod: "pix",
  accountId: "acc-main",
  cardId: "card-nubank",
  cardMode: "credit",
  notes: "",
};

const initialDraftInvestmentContribution: DraftInvestmentContribution = {
  investmentId: "",
  amount: "",
  contributionDate: `${initialMonth}-12`,
  paymentMethod: "pix",
  accountId: "acc-main",
  cardId: "card-nubank",
  cardMode: "credit",
  notes: "",
};

const planningPriorityOptions: FinancePriority[] = [
  "Urgente",
  "Alta",
  "Media" as FinancePriority,
  "Baixa",
  "Adiavel" as FinancePriority,
];

const fixedSectionOrder: FixedFlowSection[] = [
  "Ganhos",
  "Contas",
];

const fixedSectionStyles: Record<FixedFlowSection, string> = {
  Ganhos: "border-emerald-300 bg-emerald-50/45",
  Contas: "border-rose-300 bg-rose-50/35",
  Planejamento: "border-rose-300 bg-rose-50/35",
  "Gastos fixos": "border-blue-300 bg-blue-50/35",
  "Dividas e repasses": "border-orange-300 bg-orange-50/35",
  "Compras planejadas": "border-violet-300 bg-violet-50/35",
};

const fixedSectionDisplayLabels: Record<FixedFlowSection, string> = {
  Ganhos: "Ganhos",
  Contas: "Gastos",
  Planejamento: "Gastos",
  "Gastos fixos": "Contas fixas",
  "Dividas e repasses": "Dividas e acordos",
  "Compras planejadas": "Compras planejadas",
};

type ContasSubType = "Contas fixas" | "Dividas e acordos" | "Compras planejadas" | "Faturas";

const contasSubTypeOrder: ContasSubType[] = [
  "Contas fixas",
  "Dividas e acordos",
  "Compras planejadas",
  "Faturas",
];

function getContasSubType(row: MonthlyGridRow): ContasSubType {
  if (row.sourceType === "card_auto_bill") {
    return "Faturas";
  }

  if (row.sourceType === "planned_purchase") {
    return "Compras planejadas";
  }

  if (row.linkedDebtId) {
    return "Dividas e acordos";
  }

  return "Contas fixas";
}

function formatMoneyInputValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return Number(value.toFixed(2)).toString();
}

function normalizeImportedDescription(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ã‡ÃƒO/g, "CAO")
    .replace(/Ã‰/g, "E")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function decodeImportedText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseImportDate(value: string) {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const brMatch = trimmed.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  const ofxMatch = trimmed.match(/(\d{4})(\d{2})(\d{2})/);
  if (ofxMatch) {
    return `${ofxMatch[1]}-${ofxMatch[2]}-${ofxMatch[3]}`;
  }

  return "";
}

function parseImportAmount(value: string) {
  const cleaned = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  return Number(cleaned) || 0;
}

function detectImportPaymentMethod(description: string, sourceKind: ImportedStatementBatch["sourceKind"]): ImportedStatementItem["paymentMethod"] {
  if (sourceKind === "credit_card") {
    return "credit_card";
  }

  if (description.includes("PIX")) {
    return "pix";
  }

  if (description.includes("DEBIT") || description.includes("DEBITO") || description.includes("COMPRA")) {
    return "debit_card";
  }

  if (description.includes("BOLETO") || description.includes("TRANSFERENCIA") || description.includes("PAGAMENTO")) {
    return "bank_transfer";
  }

  return "unknown";
}

function isCreditCardStatementCredit(description: string) {
  return (
    description.includes("ESTORNO") ||
    description.includes("DEVOLUCAO") ||
    description.includes("DEVOLUÇÃO") ||
    description.includes("CREDITO") ||
    description.includes("CRÉDITO") ||
    description.includes("PAGAMENTO")
  );
}

function getCreditCardTransactionSignedAmount(transaction: Transaction) {
  if (transaction.type === "income") {
    return -transaction.amount;
  }

  return transaction.amount;
}

function buildImportFingerprint(
  date: string,
  amount: number,
  normalizedDescription: string,
  sourceId: string,
  externalItemId?: string,
) {
  if (externalItemId) {
    return [sourceId, "external", externalItemId].join(":");
  }

  return [date, amount.toFixed(2), normalizedDescription, sourceId].join(":");
}

function getImportPattern(normalizedDescription: string) {
  const tokens = normalizedDescription
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(" ")
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token));

  return tokens.slice(0, 3).join(" ") || normalizedDescription.slice(0, 28);
}

function getImportMerchantAlias(normalizedDescription: string) {
  const cleaned = normalizedDescription
    .replace(/\b(COMPRA|PIX|TRANSFERENCIA|PAGAMENTO|ENVIADA|RECEBIDA|EFETUADO|DEBITO|CREDITO)\b/g, " ")
    .replace(/\b(CNPJ|CPF|LTDA|SA|S A|ME|EPP)\b/g, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return getImportPattern(cleaned || normalizedDescription);
}

function getImportSimilarity(left: string, right: string) {
  const leftTokens = new Set(getImportPattern(left).split(" ").filter(Boolean));
  const rightTokens = new Set(getImportPattern(right).split(" ").filter(Boolean));

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  const shared = Array.from(leftTokens).filter((token) => rightTokens.has(token)).length;
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function isAmountClose(left: number, right: number, tolerance = 0.08) {
  if (left <= 0 || right <= 0) {
    return false;
  }

  const difference = Math.abs(left - right);
  return difference <= 2 || difference / Math.max(left, right) <= tolerance;
}

interface ParsedInstallment {
  totalAmount: number;
  installmentAmount: number;
  installmentNumber?: number;
  totalInstallments?: number;
}

function parseInstallmentFromDescription(description: string): ParsedInstallment | null {
  const normalized = description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, ".")
    .trim();

  const pattern1 = /(\d+[\d.]*)\s*\/\s*(\d+[\d.]*)/;
  const match1 = normalized.match(pattern1);
  if (match1) {
    const a = parseFloat(match1[1]);
    const b = parseFloat(match1[2]);
    if (a > b && b > 0) {
      return { totalAmount: a, installmentAmount: b, totalInstallments: Math.round(a / b) };
    }
  }

  const pattern2 = /(\d+[\d.]*)\s*\/\s*(\d{1,2})$/;
  const match2 = normalized.match(pattern2);
  if (match2) {
    const total = parseFloat(match2[1]);
    const qty = parseInt(match2[2], 10);
    if (qty >= 2 && qty <= 48 && total > 0) {
      return { totalAmount: total, installmentAmount: total / qty, totalInstallments: qty };
    }
  }

  const pattern3 = /(?:parcela\s*)?(\d{1,2})\s*\/\s*(\d{1,2})/i;
  const match3 = normalized.match(pattern3);
  if (match3) {
    const current = parseInt(match3[1], 10);
    const total = parseInt(match3[2], 10);
    if (current <= total && total >= 2 && total <= 48) {
      return { totalAmount: 0, installmentAmount: 0, installmentNumber: current, totalInstallments: total };
    }
  }

  const pattern4 = /(\d+[\d.]*)\s*[xX]\s*(\d{1,2})|(\d{1,2})\s*[xX]\s*(\d+[\d.]*)/;
  const match4 = normalized.match(pattern4);
  if (match4) {
    const val = parseFloat(match4[1] || match4[4]);
    const qty = parseInt(match4[2] || match4[3], 10);
    if (qty >= 2 && qty <= 48 && val > 0) {
      return { totalAmount: val * qty, installmentAmount: val, totalInstallments: qty };
    }
  }

  return null;
}

function isInstallmentMatch(
  transactionAmount: number,
  plannedTotal: number,
  plannedInstallments: number,
  tolerance = 0.10,
): boolean {
  if (plannedInstallments <= 1 || plannedTotal <= 0) return false;
  const expectedInstallment = plannedTotal / plannedInstallments;
  const difference = Math.abs(transactionAmount - expectedInstallment);
  const maxVal = Math.max(transactionAmount, expectedInstallment);
  return difference <= 2 || difference / maxVal <= tolerance;
}

function splitAutomationList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Erro desconhecido");
  }

  return "Erro desconhecido";
}

const shortMonthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function buildRelativeMonths(referenceDate: Date) {
  const months: { monthValue: string; label: string; fullLabel: string }[] = [];

  for (let offset = -1; offset <= 6; offset++) {
    const date = new Date(referenceDate);
    date.setMonth(date.getMonth() + offset);

    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    months.push({
      monthValue: `${year}-${String(month).padStart(2, "0")}`,
      label: shortMonthFormatter.format(date).replace(".", "").toUpperCase(),
      fullLabel: formatMonthLabel(date),
    });
  }

  return months;
}

function createFixedEntryAmountDraft(referenceDate: Date, entry?: FixedFlowEntry) {
  return Object.fromEntries(
    buildRelativeMonths(referenceDate).map((monthItem) => [
      monthItem.monthValue,
      String(entry?.amountByMonth[monthItem.monthValue] ?? ""),
    ]),
  );
}

function getFixedEntryKind(section: FixedFlowSection) {
  return section === "Ganhos" ? "income" : "expense";
}

function cloneMonthlyPlan(plan: MonthlyPlan): MonthlyPlan {
  return {
    ...plan,
    categoryBudgets: plan.categoryBudgets.map((budget) => ({ ...budget })),
    reserveGoals: plan.reserveGoals.map((goal) => ({ ...goal })),
  };
}

function createMonthlyPlanForMonth(monthValue: string): MonthlyPlan {
  const seededPlan = seedMonthlyPlansByMonth[monthValue];

  if (seededPlan) {
    return {
      ...cloneMonthlyPlan(seededPlan),
      monthLabel: formatMonthLabel(monthValueToDate(monthValue)),
    };
  }

  return {
    ...cloneMonthlyPlan(seedMonthlyPlan),
    monthLabel: formatMonthLabel(monthValueToDate(monthValue)),
  };
}

function getPlannedPaymentDetails(
  method?: PaymentPlanMethod,
  cardId?: string,
  cardMode: CardMode = "credit",
  cardList: Card[] = seedCards,
) {
  if (method === "card") {
    const card = cardId ? cardList.find((item) => item.id === cardId) : undefined;
    const modeLabel = cardMode === "debit" ? "debito" : "credito";
    return {
      label: card ? `Cartao ${modeLabel} - ${card.name}` : `Cartao ${modeLabel}`,
      transactionMethod: (cardMode === "debit" ? "debit_card" : "credit_card") as PaymentMethod,
      cardId,
      cardMode,
    };
  }

  return {
    label: method ? paymentPlanLabels[method] : "Nao definido",
    transactionMethod: (method ?? "pix") as Exclude<PaymentPlanMethod, "card">,
    cardId: undefined,
    cardMode: undefined,
  };
}

function addMonthsToDateValue(dateValue: string, monthsToAdd: number) {
  const baseDate = new Date(`${dateValue}T12:00:00`);
  const originalDay = baseDate.getDate();
  baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
  const lastDayOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
  baseDate.setDate(Math.min(originalDay, lastDayOfMonth));

  return `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}-${String(
    baseDate.getDate(),
  ).padStart(2, "0")}`;
}

function alignDateToDay(dateValue: string, desiredDay: number) {
  const baseDate = new Date(`${dateValue}T12:00:00`);
  const safeDay = Math.max(1, Math.min(31, desiredDay));
  const lastDayOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
  baseDate.setDate(Math.min(safeDay, lastDayOfMonth));

  return `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}-${String(
    baseDate.getDate(),
  ).padStart(2, "0")}`;
}

function isCreditLinkedBill(bill: Bill) {
  return bill.plannedPaymentMethod === "card" && (bill.plannedCardMode ?? "credit") === "credit";
}

function mapBillToFixedPaymentMethod(bill: Bill): PaymentMethod {
  if (bill.plannedPaymentMethod === "card") {
    return (bill.plannedCardMode ?? "credit") === "debit" ? "debit_card" : "credit_card";
  }

  return bill.plannedPaymentMethod ?? "pix";
}

function mapFixedPaymentMethodToBillPlan(
  paymentMethod: PaymentMethod,
  cardId?: string,
  cardMode?: CardMode,
) {
  if (paymentMethod === "credit_card" || paymentMethod === "debit_card") {
    return {
      plannedPaymentMethod: "card" as const,
      plannedCardId: cardId,
      plannedCardMode: paymentMethod === "debit_card" ? "debit" : (cardMode ?? "credit"),
    };
  }

  return {
    plannedPaymentMethod: paymentMethod as Exclude<PaymentPlanMethod, "card">,
    plannedCardId: undefined,
    plannedCardMode: undefined,
  };
}

function buildDebtPlanSchedule(
  startMonthValue: string,
  totalAmount: number,
  monthCount: number,
  installmentAmount?: number,
) {
  const safeMonthCount = Math.max(1, monthCount);
  const baseAmount = Number(
    (
      installmentAmount && installmentAmount > 0
        ? installmentAmount
        : totalAmount / safeMonthCount
    ).toFixed(2),
  );
  let remaining = Number(totalAmount.toFixed(2));
  const schedule = Array.from({ length: safeMonthCount }, (_, index) => {
    const monthValue = getMonthValueOffset(startMonthValue, index);
    const amount =
      index === safeMonthCount - 1 ? remaining : Math.min(baseAmount, remaining);
    remaining = Number((remaining - amount).toFixed(2));

    return {
      monthValue,
      amount: Number(Math.max(0, amount).toFixed(2)),
    };
  });

  return {
    schedule,
    baseAmount,
  };
}

export function FinanceApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView: ViewId =
    pathname === "/transacoes"
      ? "transactions"
      : pathname === "/historico" || pathname === "/relatorios"
        ? "history"
        : pathname === "/conciliacao"
          ? "reconciliation"
          : pathname === "/configuracoes"
            ? "settings"
            : "home";
  const [homeTab, setHomeTab] = useState<HomeTab>("grid");
  const [planningScreen, setPlanningScreen] = useState<PlanningScreen>("purchases");
  const [planningBoardView, setPlanningBoardView] = useState<PlanningBoardView>("default");
  const [accountsSection, setAccountsSection] = useState<AccountsSection>("overview");
  const [reportsSection, setReportsSection] = useState<ReportsSection>("cashflow");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("main");
  const [selectedCardDetailId, setSelectedCardDetailId] = useState<string | null>(null);
  const [selectedCardStatementMonth, setSelectedCardStatementMonth] = useState(initialMonth);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [accounts, setAccounts] = useState(seedAccounts);
  const [cards, setCards] = useState(seedCards);
  const [transactions, setTransactions] = useState(seedTransactions);
  const [transactionGroups, setTransactionGroups] = useState<TransactionGroup[]>([]);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [selectedBillGroupIds, setSelectedBillGroupIds] = useState<string[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [draftGroupName, setDraftGroupName] = useState("");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [bills, setBills] = useState(seedBills);
  const [categories, setCategories] = useState(seedCategories);
  const [debts, setDebts] = useState(seedDebts);
  const [fixedEntries, setFixedEntries] = useState(seedFixedFlowEntries);
  const [plannedPurchases, setPlannedPurchases] = useState(seedPlannedPurchases);
  const [investments, setInvestments] = useState(seedInvestments);
  const [settings, setSettings] = useState(seedSettings);
  const [monthlyPlansByMonth, setMonthlyPlansByMonth] = useState<Record<string, MonthlyPlan>>(() =>
    Object.fromEntries(
      Object.entries(seedMonthlyPlansByMonth).map(([monthValue, plan]) => [
        monthValue,
        cloneMonthlyPlan(plan),
      ]),
    ),
  );
  const [draftTransaction, setDraftTransaction] = useState(initialDraftTransaction);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingTransactionScope, setEditingTransactionScope] = useState<"single" | "group">("single");
  const [draftTransactionError, setDraftTransactionError] = useState<string | null>(null);
  const [draftCategory, setDraftCategory] = useState(initialDraftCategory);
  const [draftCard, setDraftCard] = useState(initialDraftCard);
  const [draftBankPreset, setDraftBankPreset] = useState(initialDraftBankPreset);
  const [draftBill, setDraftBill] = useState(initialDraftBill);
  const [draftBillError, setDraftBillError] = useState<string | null>(null);
  const [draftDebt, setDraftDebt] = useState(initialDraftDebt);
  const [draftDebtPlan, setDraftDebtPlan] = useState(initialDraftDebtPlan);
  const [draftCommitment, setDraftCommitment] = useState(initialDraftCommitment);
  const [editingCommitmentTarget, setEditingCommitmentTarget] = useState<CommitmentEditTarget | null>(null);
  const [pendingCommitmentConversion, setPendingCommitmentConversion] = useState<{
    target: CommitmentEditTarget;
    activeMonths: string[];
  } | null>(null);
  const [draftAccount, setDraftAccount] = useState(initialDraftAccount);
  const [draftFixedEntry, setDraftFixedEntry] = useState<DraftFixedEntry>(() => ({
    ...initialDraftFixedEntry,
    amountByMonth: createFixedEntryAmountDraft(monthValueToDate(initialMonth)),
  }));
  const [draftInvestment, setDraftInvestment] = useState(initialDraftInvestment);
  const [draftInvestmentContribution, setDraftInvestmentContribution] = useState(
    initialDraftInvestmentContribution,
  );
  const [newAccountKind, setNewAccountKind] = useState<AccountEntryKind>("bill");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingBankIssuer, setEditingBankIssuer] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingFixedEntryId, setEditingFixedEntryId] = useState<string | null>(null);
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isDebtPlanModalOpen, setIsDebtPlanModalOpen] = useState(false);
  const [isCommitmentModalOpen, setIsCommitmentModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isFixedEntryModalOpen, setIsFixedEntryModalOpen] = useState(false);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [isInvestmentContributionModalOpen, setIsInvestmentContributionModalOpen] =
    useState(false);
  const [draftSalaryMonth, setDraftSalaryMonth] = useState<DraftSalaryMonth>({
    monthValue: initialMonth,
    fixedIncomePlanned: String(createMonthlyPlanForMonth(initialMonth).fixedIncomePlanned),
  });
  const [isSalaryMonthModalOpen, setIsSalaryMonthModalOpen] = useState(false);
  const [importBrowseModalOpen, setImportBrowseModalOpen] = useState(false);
  const [importBrowseItem, setImportBrowseItem] = useState<ImportedStatementItem | null>(null);
  const [importBrowseFilter, setImportBrowseFilter] = useState<"all" | "planned_purchase" | "bill" | "fixed_entry" | "card_bill">("all");
  const [importBrowseSearch, setImportBrowseSearch] = useState("");
  const [pendingImportCreationItemId, setPendingImportCreationItemId] = useState<string | null>(null);
  const [pendingCategoryImportItemId, setPendingCategoryImportItemId] = useState<string | null>(null);
  const [pendingCategoryMerchantId, setPendingCategoryMerchantId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<"all" | "income" | "expense">(
    "all",
  );
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentMethod>("all");
  const [draggedPurchaseId, setDraggedPurchaseId] = useState<string | null>(null);
  const [draggedGridCell, setDraggedGridCell] = useState<{
    rowId: string;
    monthValue: string;
  } | null>(null);
  const [cardBillEstimates, setCardBillEstimates] = useState<Record<string, CardBillEstimate>>({});
  const [importedStatementBatches, setImportedStatementBatches] = useState<ImportedStatementBatch[]>([]);
  const [importedStatementItems, setImportedStatementItems] = useState<ImportedStatementItem[]>([]);
  const [importLearningRules, setImportLearningRules] = useState<ImportLearningRule[]>([]);
  const [importMerchants, setImportMerchants] = useState<ImportMerchant[]>([]);
  const [importAutomationConfigs, setImportAutomationConfigs] = useState<ImportAutomationConfig[]>(
    initialImportAutomationConfigs,
  );
  const [importSourceKind, setImportSourceKind] = useState<ImportedStatementBatch["sourceKind"]>("bank_account");
  const [importAccountId, setImportAccountId] = useState(settings.defaultAccountId);
  const [importCardId, setImportCardId] = useState(settings.defaultCardId);
  const [importError, setImportError] = useState<string | null>(null);
  const [pluggyConnectToken, setPluggyConnectToken] = useState("");
  const [pluggyConnectStatus, setPluggyConnectStatus] = useState<"idle" | "loading" | "ready" | "connected" | "error">("idle");
  const [pluggyConnectError, setPluggyConnectError] = useState<string | null>(null);
  const [selectedCardBillComparison, setSelectedCardBillComparison] = useState<{
    cardId: string;
    monthValue: string;
  } | null>(null);
  const [pendingMonthlyGridDelete, setPendingMonthlyGridDelete] = useState<MonthlyGridDeleteTarget | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionScopePrompt, setTransactionScopePrompt] = useState<{
    action: "edit" | "delete";
    transactionId: string;
  } | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [draftPurchase, setDraftPurchase] = useState(initialDraftPurchase);
  const [isCardBalanceModalOpen, setIsCardBalanceModalOpen] = useState(false);
  const [draftCardBalanceUsed, setDraftCardBalanceUsed] = useState("");
  const [isAlertsPanelOpen, setIsAlertsPanelOpen] = useState(false);
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState(false);
  const [hasHydratedRemoteState, setHasHydratedRemoteState] = useState(false);
  const [remoteSaveStatus, setRemoteSaveStatus] = useState<RemoteSaveStatus>("loading");
  const [remoteSaveError, setRemoteSaveError] = useState<string | null>(null);
  const [lastRemoteSavedAt, setLastRemoteSavedAt] = useState<string | null>(null);
  const [collapsedFixedSections, setCollapsedFixedSections] = useState<Record<FixedFlowSection, boolean>>({
    Ganhos: false,
    Contas: false,
    Planejamento: false,
    "Gastos fixos": false,
    "Dividas e repasses": false,
    "Compras planejadas": false,
  });
  const [expandedCardBillRows, setExpandedCardBillRows] = useState<Record<string, boolean>>({});
  const remoteSaveInFlightRef = useRef(false);
  const pendingRemoteSnapshotRef = useRef<FinancePersistedState | null>(null);
  const remoteRetryTimeoutRef = useRef<number | null>(null);
  const remoteRetryCountRef = useRef(0);
  const monthlyGridClickSuppressedUntilRef = useRef(0);
  const referenceMonthDate = monthValueToDate(selectedMonth);
  const deferredSearch = useDeferredValue(search);
  const currentMonthlyPlan =
    monthlyPlansByMonth[selectedMonth] ?? createMonthlyPlanForMonth(selectedMonth);
  const bankPresets = settings.bankPresets?.length ? settings.bankPresets : seedBankPresets;

  function getBankPreset(issuer: string) {
    return bankPresets.find((preset) => preset.issuer === issuer) ?? bankPresets[0];
  }

  function getSelectableCategories(type: Transaction["type"], options?: { includeHidden?: boolean }) {
    const includeHidden = options?.includeHidden ?? false;
    return categories
      .filter(
        (category) =>
          category.type === type &&
          (includeHidden || !isHiddenUiCategoryId(category.id)) &&
          (!category.parentId || categories.some((parent) => parent.id === category.parentId)),
      )
      .sort((left, right) => {
        const leftParent = left.parentId ? categories.find((item) => item.id === left.parentId)?.name ?? "" : left.name;
        const rightParent = right.parentId ? categories.find((item) => item.id === right.parentId)?.name ?? "" : right.name;
        return `${leftParent}-${left.parentId ? left.name : ""}`.localeCompare(
          `${rightParent}-${right.parentId ? right.name : ""}`,
        );
      });
  }

  function getCategorySelectOptions(type: Transaction["type"], options?: { includeHidden?: boolean }) {
    return getSelectableCategories(type, options).map((category) => ({
      value: category.id,
      label: getCategoryOptionLabel(category),
    }));
  }

  function getAllCategorySelectOptions() {
    return categories
      .filter((category) => !category.parentId || categories.some((parent) => parent.id === category.parentId))
      .sort((left, right) => {
        const leftParent = left.parentId ? categories.find((item) => item.id === left.parentId)?.name ?? "" : left.name;
        const rightParent = right.parentId ? categories.find((item) => item.id === right.parentId)?.name ?? "" : right.name;
        return `${leftParent}-${left.parentId ? left.name : ""}`.localeCompare(
          `${rightParent}-${right.parentId ? right.name : ""}`,
        );
      })
      .map((category) => ({
        value: category.id,
        label: getCategoryOptionLabel(category),
      }));
  }

  function getSuggestedImportCategoryId(normalizedDescription: string, type: Transaction["type"]) {
    const lowerDescription = normalizedDescription.toLowerCase();
    const directCategory = categories.find((category) =>
      lowerDescription.includes(category.name.toLowerCase()),
    );

    if (directCategory) {
      return directCategory.id;
    }

    if (lowerDescription.includes("ifood") || lowerDescription.includes("mercado") || lowerDescription.includes("restaurante")) {
      return categories.find((category) => category.name.toLowerCase().includes("aliment"))?.id;
    }

    if (lowerDescription.includes("uber") || lowerDescription.includes("99 ")) {
      return categories.find((category) => category.name.toLowerCase().includes("transporte"))?.id;
    }

    if (lowerDescription.includes("spotify") || lowerDescription.includes("netflix")) {
      return categories.find((category) => category.name.toLowerCase().includes("assin"))?.id;
    }

    if (type === "expense" && lowerDescription.includes("aplicacao")) {
      return categories.find((category) => category.id === "cat-invest")?.id;
    }

    if (
      type === "income" &&
      (lowerDescription.includes("reembolso") ||
        lowerDescription.includes("estorno") ||
        lowerDescription.includes("resgate") ||
        lowerDescription.includes("rendimento"))
    ) {
      return categories.find((category) => category.id === "cat-extra")?.id;
    }

    return categories.find((category) => category.type === type && !isHiddenUiCategoryId(category.id))?.id ?? categories[0]?.id;
  }

  function getImportMatchValue(match?: ImportedStatementItem["suggestedMatch"]) {
    return match ? `${match.kind}:${match.targetId}` : "none";
  }

  function parseImportMatchValue(value: string): ImportedStatementItem["suggestedMatch"] | undefined {
    if (value === "none") {
      return undefined;
    }

    const [kind, ...targetParts] = value.split(":");
    const targetId = targetParts.join(":");
    if (!targetId) {
      return undefined;
    }

    return {
      kind: kind as NonNullable<ImportedStatementItem["suggestedMatch"]>["kind"],
      targetId,
      targetLabel: getImportMatchLabel(kind, targetId),
      confidence: 0.86,
      reason: "Vinculo escolhido manualmente na revisao.",
    };
  }

  function getImportMatchLabel(kind: string, targetId: string) {
    if (kind === "planned_purchase") {
      return plannedPurchases.find((purchase) => purchase.id === targetId)?.name ?? "Compra planejada";
    }

    if (kind === "bill") {
      return bills.find((bill) => bill.id === targetId)?.title ?? "Conta";
    }

    if (kind === "fixed_entry") {
      return fixedEntries.find((entry) => entry.id === targetId)?.title ?? "Item fixo";
    }

    if (kind === "card_bill_payment") {
      const [cardId, monthValue] = targetId.split("|");
      const card = cards.find((current) => current.id === cardId);
      return `Fatura ${card?.name ?? "cartao"} - ${formatMonthLabel(monthValueToDate(monthValue))}`;
    }

    return "Transacao existente";
  }

  function getImportMatchOptions(item: ImportedStatementItem) {
    const itemMonth = item.date.slice(0, 7);
    const parsed = parseInstallmentFromDescription(item.rawDescription);
    const options = [{ value: "none", label: "Sem vinculo (so historico)" }];

    activePlannedPurchases
      .filter((purchase) => {
        const plannedAmount = getPlannedPurchaseAmountByMonth(purchase)[itemMonth] ?? purchase.estimatedValue;
        if (item.direction !== "outflow") return false;
        if (isAmountClose(item.amount, plannedAmount, 0.18)) return true;
        if (parsed) {
          if (parsed.totalAmount > 0 && isAmountClose(parsed.totalAmount, plannedAmount, 0.04)) return true;
          if (parsed.installmentAmount > 0 && isAmountClose(parsed.installmentAmount, plannedAmount, 0.04)) return true;
        }
        if (purchase.plannedInstallments && purchase.plannedInstallments > 1) {
          return isInstallmentMatch(item.amount, plannedAmount, purchase.plannedInstallments);
        }
        return false;
      })
      .slice(0, 8)
      .forEach((purchase) => {
        const plannedAmount = getPlannedPurchaseAmountByMonth(purchase)[itemMonth] ?? purchase.estimatedValue;
        let label: string;
        if (parsed && parsed.totalAmount > 0 && isAmountClose(parsed.totalAmount, plannedAmount, 0.04)) {
          const num = parsed.installmentNumber ?? Math.round(parsed.installmentAmount / parsed.installmentAmount);
          label = `Compra planejada: ${purchase.name} — ${num}/${parsed.totalInstallments} de ${formatCurrency(parsed.installmentAmount)} (${formatCurrency(parsed.totalAmount)} total)`;
        } else if (parsed && parsed.installmentAmount > 0 && isAmountClose(item.amount, parsed.installmentAmount, 0.04)) {
          label = `Compra planejada: ${purchase.name} — parcela de ${formatCurrency(item.amount)} (total ${formatCurrency(plannedAmount)})`;
        } else if (!isAmountClose(item.amount, plannedAmount, 0.18) && purchase.plannedInstallments && purchase.plannedInstallments > 1) {
          const estInstallment = plannedAmount / purchase.plannedInstallments;
          label = `Compra planejada: ${purchase.name} — parcela de ${formatCurrency(estInstallment)} (${formatCurrency(plannedAmount)} / ${purchase.plannedInstallments}x)`;
        } else {
          label = `Compra planejada: ${purchase.name} — ${formatCurrency(plannedAmount)}`;
        }
        options.push({ value: `planned_purchase:${purchase.id}`, label });
      });

    activeBills
      .filter((bill) => bill.status !== "paid" && bill.dueDate.slice(0, 7) === itemMonth && isAmountClose(item.amount, bill.amount, 0.12))
      .slice(0, 8)
      .forEach((bill) => {
        options.push({ value: `bill:${bill.id}`, label: `Conta: ${bill.title} — ${formatCurrency(bill.amount)}` });
      });

    activeFixedEntries
      .filter((entry) => (entry.amountByMonth[itemMonth] ?? 0) > 0 && isAmountClose(item.amount, entry.amountByMonth[itemMonth] ?? 0, 0.12))
      .slice(0, 8)
      .forEach((entry) => {
        options.push({ value: `fixed_entry:${entry.id}`, label: `Planejamento: ${entry.title} — ${formatCurrency(entry.amountByMonth[itemMonth] ?? 0)}` });
      });

    cards.forEach((card) => {
      const cardBillAmount = getCardBillRealAmount(card.id, itemMonth);
      const key = getCardBillEstimateKey(card.id, itemMonth);
      if (
        item.sourceKind !== "credit_card" &&
        item.direction === "outflow" &&
        cardBillAmount > 0 &&
        cardBillEstimates[key]?.status !== "paid" &&
        isAmountClose(item.amount, cardBillAmount, 0.04)
      ) {
        options.push({ value: `card_bill_payment:${card.id}|${itemMonth}`, label: `Pagamento de fatura: ${card.name} — ${formatCurrency(cardBillAmount)}` });
      }
    });

    options.push(
      { value: "browse_all", label: "Ver todas as contas..." },
      { value: "create_new", label: "+ Criar nova conta..." },
    );

    return options;
  }

  function getSuggestedImportMatch(
    normalizedDescription: string,
    amount: number,
    date: string,
    direction: ImportedStatementItem["direction"],
    sourceKind: ImportedStatementBatch["sourceKind"],
  ): ImportedStatementItem["suggestedMatch"] {
    const monthValue = date.slice(0, 7);
    const candidates: NonNullable<ImportedStatementItem["suggestedMatch"]>[] = [];

    if (direction === "outflow") {
      const parsed = parseInstallmentFromDescription(normalizedDescription);

      activePlannedPurchases.forEach((purchase) => {
        const plannedAmount = getPlannedPurchaseAmountByMonth(purchase)[monthValue] ?? purchase.estimatedValue;
        const similarity = getImportSimilarity(normalizedDescription, normalizeImportedDescription(purchase.name));

        if (parsed && parsed.totalAmount > 0 && isAmountClose(parsed.totalAmount, plannedAmount, 0.04)) {
          const num = parsed.installmentNumber ?? "?";
          candidates.push({
            kind: "planned_purchase",
            targetId: purchase.id,
            targetLabel: `${purchase.name} — parcela ${num}/${parsed.totalInstallments} (${formatCurrency(plannedAmount)})`,
            confidence: Math.min(0.95, 0.70 + similarity * 0.20),
            reason: `Descricao indica parcela ${num}/${parsed.totalInstallments} de ${formatCurrency(parsed.totalAmount)}. Valor bate com ${purchase.name}.`,
          });
        } else if (isAmountClose(amount, plannedAmount, 0.18) && similarity >= 0.25) {
          candidates.push({
            kind: "planned_purchase",
            targetId: purchase.id,
            targetLabel: `${purchase.name} — ${formatCurrency(plannedAmount)}`,
            confidence: Math.min(0.92, 0.45 + similarity * 0.35 + (isAmountClose(amount, plannedAmount, 0.04) ? 0.12 : 0)),
            reason: "Descricao, valor e mes batem com uma compra planejada.",
          });
        }
      });

      activeBills.forEach((bill) => {
        const similarity = getImportSimilarity(normalizedDescription, normalizeImportedDescription(bill.title));
        if (bill.status !== "paid" && bill.dueDate.slice(0, 7) === monthValue && isAmountClose(amount, bill.amount, 0.12)) {
          candidates.push({
            kind: "bill",
            targetId: bill.id,
            targetLabel: `${bill.title} — ${formatCurrency(bill.amount)}`,
            confidence: Math.min(0.9, 0.5 + similarity * 0.3 + (isAmountClose(amount, bill.amount, 0.04) ? 0.1 : 0)),
            reason: "Valor e vencimento batem com uma conta pendente.",
          });
        }
      });

      activeFixedEntries.forEach((entry) => {
        const plannedAmount = entry.amountByMonth[monthValue] ?? 0;
        const similarity = getImportSimilarity(normalizedDescription, normalizeImportedDescription(entry.title));
        if (plannedAmount > 0 && isAmountClose(amount, plannedAmount, 0.12) && similarity >= 0.2) {
          candidates.push({
            kind: "fixed_entry",
            targetId: entry.id,
            targetLabel: `${entry.title} — ${formatCurrency(plannedAmount)}`,
            confidence: Math.min(0.88, 0.44 + similarity * 0.3 + (isAmountClose(amount, plannedAmount, 0.04) ? 0.1 : 0)),
            reason: "Lancamento parece ser a realizacao de um item da planilha.",
          });
        }
      });

      if (sourceKind !== "credit_card") {
        cards.forEach((card) => {
          const cardBillAmount = getCardBillRealAmount(card.id, monthValue);
          const key = getCardBillEstimateKey(card.id, monthValue);
          if (
            cardBillAmount > 0 &&
            cardBillEstimates[key]?.status !== "paid" &&
            isAmountClose(amount, cardBillAmount, 0.04) &&
            (normalizedDescription.includes("FATURA") ||
              normalizedDescription.includes("CARTAO") ||
              normalizedDescription.includes(card.issuer.toUpperCase()))
          ) {
            candidates.push({
              kind: "card_bill_payment",
              targetId: `${card.id}|${monthValue}`,
              targetLabel: `Fatura ${card.name} — ${formatCurrency(cardBillAmount)}`,
              confidence: 0.94,
              reason: "Valor e descricao parecem pagamento de fatura.",
            });
          }
        });
      }
    }

    return candidates.sort((left, right) => right.confidence - left.confidence)[0];
  }

  function getApprovedImportLearningRule(
    normalizedDescription: string,
    sourceKind: ImportedStatementBatch["sourceKind"],
  ) {
    return importLearningRules
      .filter((rule) => rule.status === "approved" && rule.sourceKind === sourceKind)
      .filter((rule) => normalizedDescription.includes(rule.pattern))
      .sort((left, right) => right.supportCount - left.supportCount)[0];
  }

  function getDetectedImportMerchant(normalizedDescription: string) {
    return importMerchants
      .filter((merchant) => merchant.status !== "disabled")
      .map((merchant) => {
        const bestAliasScore = Math.max(
          0,
          ...merchant.aliases.map((alias) => {
            const normalizedAlias = normalizeImportedDescription(alias);
            if (!normalizedAlias) {
              return 0;
            }

            if (normalizedDescription.includes(normalizedAlias)) {
              return 1;
            }

            return getImportSimilarity(normalizedDescription, normalizedAlias);
          }),
        );

        return { merchant, score: bestAliasScore };
      })
      .filter(({ score }) => score >= 0.34)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return right.merchant.supportCount - left.merchant.supportCount;
      })[0];
  }

  function getImportMerchantLabel(merchantId?: string) {
    return importMerchants.find((merchant) => merchant.id === merchantId)?.name ?? "Lugar nao identificado";
  }

  function getImportedStatementInstitution(text: string, fileName: string) {
    const ofxOrg = decodeImportedText(text.match(/<ORG>([^\r\n<]+)/i)?.[1] ?? "").trim();
    if (ofxOrg) {
      return ofxOrg;
    }

    if (fileName.toLowerCase().startsWith("nu_")) {
      return "Nubank";
    }

    return undefined;
  }

  async function readImportedStatementFile(file: File) {
    const buffer = await file.arrayBuffer();
    const decoders: Array<[string, TextDecoderOptions?]> = [
      ["utf-8", { fatal: true }],
      ["windows-1252"],
      ["iso-8859-1"],
    ];

    for (const [encoding, options] of decoders) {
      try {
        return new TextDecoder(encoding, options).decode(buffer);
      } catch {
        // Try the next common bank statement encoding.
      }
    }

    return file.text();
  }

  function buildImportedItem(
    batchId: string,
    rawDescription: string,
    date: string,
    signedAmount: number,
    sourceKind: ImportedStatementBatch["sourceKind"],
    options?: {
      transport?: ImportTransport;
      accountId?: string;
      cardId?: string;
      externalItemId?: string;
      originLabel?: string;
    },
  ): ImportedStatementItem | null {
    if (!date || !rawDescription || signedAmount === 0) {
      return null;
    }

    const normalizedDescription = normalizeImportedDescription(rawDescription);
    const isCardCredit = sourceKind === "credit_card" && isCreditCardStatementCredit(normalizedDescription);
    const direction =
      sourceKind === "credit_card"
        ? isCardCredit
          ? "inflow"
          : "outflow"
        : signedAmount >= 0
          ? "inflow"
          : "outflow";
    const amount = Math.abs(Number(signedAmount.toFixed(2)));
    const transactionType: Transaction["type"] = direction === "inflow" ? "income" : "expense";
    const paymentMethod = detectImportPaymentMethod(normalizedDescription, sourceKind);
    const accountId = sourceKind === "credit_card" ? undefined : options?.accountId ?? importAccountId;
    const cardId = sourceKind === "credit_card" ? options?.cardId ?? importCardId : undefined;
    const importCard = cardId ? cards.find((card) => card.id === cardId) : undefined;
    const statementMonth =
      sourceKind === "credit_card" ? getSuggestedCardStatementMonth(importCard, date, date.slice(0, 7)) : undefined;
    const detectedMerchant = getDetectedImportMerchant(normalizedDescription)?.merchant;
    const learningRule = getApprovedImportLearningRule(normalizedDescription, sourceKind);
    const suggestedMatch =
      detectedMerchant?.suggestedMatch ??
      learningRule?.suggestedMatch ??
      getSuggestedImportMatch(normalizedDescription, amount, date, direction, sourceKind);
    const sourceId = accountId ?? cardId ?? sourceKind;
    const naturalFingerprint = buildImportFingerprint(date, amount, normalizedDescription, sourceId);
    const fingerprint = buildImportFingerprint(date, amount, normalizedDescription, sourceId, options?.externalItemId);
    const hasExistingTransaction = transactions.some(
      (transaction) =>
        buildImportFingerprint(
          transaction.date,
          transaction.amount,
          normalizeImportedDescription(transaction.title || transaction.description || ""),
          transaction.accountId ?? transaction.cardId ?? "unknown",
        ) === naturalFingerprint,
    );
    const hasExistingImport = importedStatementItems.some((item) => {
      const itemNaturalFingerprint = buildImportFingerprint(
        item.date,
        item.amount,
        item.normalizedDescription,
        item.accountId ?? item.cardId ?? item.sourceKind,
      );
      return item.fingerprint === fingerprint || itemNaturalFingerprint === naturalFingerprint;
    });

    return {
      id: crypto.randomUUID(),
      batchId,
      rawDescription,
      reviewTitle: detectedMerchant?.name ?? rawDescription,
      normalizedDescription,
      date,
      amount,
      direction,
      sourceKind,
      transport: options?.transport ?? "manual_upload",
      paymentMethod: learningRule?.paymentMethod ?? paymentMethod,
      accountId,
      cardId,
      externalItemId: options?.externalItemId,
      originLabel: options?.originLabel,
      suggestedCategoryId:
        detectedMerchant?.suggestedCategoryId ??
        learningRule?.suggestedCategoryId ??
        getSuggestedImportCategoryId(normalizedDescription, transactionType),
      suggestedTransactionType: detectedMerchant?.suggestedTransactionType ?? learningRule?.suggestedTransactionType ?? transactionType,
      statementMonth,
      appliedLearningRuleId: learningRule?.id,
      detectedMerchantId: detectedMerchant?.id,
      confidence: hasExistingTransaction || hasExistingImport ? 0.98 : detectedMerchant ? 0.9 : learningRule ? 0.86 : suggestedMatch?.confidence ?? 0.62,
      status: hasExistingTransaction || hasExistingImport ? "duplicate" : "pending",
      fingerprint,
      suggestedMatch: hasExistingTransaction
        ? {
            kind: "existing_transaction",
            targetId: "existing",
            confidence: 0.98,
            reason: "Data, valor, descricao e origem ja existem no historico.",
          }
        : suggestedMatch,
    };
  }

  function parseImportedStatement(
    text: string,
    batchId: string,
    fileName: string,
    sourceKind: ImportedStatementBatch["sourceKind"],
    options?: {
      transport?: ImportTransport;
      originLabel?: string;
      externalSourceId?: string;
      accountId?: string;
      cardId?: string;
    },
  ) {
    const lowerFileName = fileName.toLowerCase();
    if (lowerFileName.endsWith(".ofx") || text.includes("<OFX")) {
      return Array.from(text.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CREDITCARDMSGSRSV1>)/gi))
        .map((match) => {
          const block = match[1];
          const date = parseImportDate(block.match(/<DTPOSTED>([^\r\n<]+)/i)?.[1] ?? "");
          const amount = parseImportAmount(block.match(/<TRNAMT>([^\r\n<]+)/i)?.[1] ?? "");
          const fitId = decodeImportedText(block.match(/<FITID>([^\r\n<]+)/i)?.[1] ?? "").trim();
          const description =
            decodeImportedText(
              block.match(/<MEMO>([^\r\n<]+)/i)?.[1] ??
                block.match(/<NAME>([^\r\n<]+)/i)?.[1] ??
                "",
            ) ||
            "Lancamento OFX";
          return buildImportedItem(batchId, description, date, amount, sourceKind, {
            transport: options?.transport,
            accountId: options?.accountId,
            cardId: options?.cardId,
            externalItemId: fitId || (options?.externalSourceId ? `${options.externalSourceId}:${date}:${amount}:${description}` : undefined),
            originLabel: options?.originLabel,
          });
        })
        .filter((item): item is ImportedStatementItem => Boolean(item));
    }

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
      return [];
    }

    const firstColumns = splitCsvLine(lines[0]).map((column) => normalizeImportedDescription(column));
    const hasHeader = firstColumns.some((column) => ["DATA", "DATE", "DESCRICAO", "DESCRIPTION", "HISTORICO", "VALOR", "AMOUNT"].includes(column));
    const header = hasHeader ? firstColumns : [];
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const findIndex = (candidates: string[]) => header.findIndex((column) => candidates.includes(column));
    const dateIndex = hasHeader ? findIndex(["DATA", "DATE", "DTPOSTED"]) : -1;
    const descriptionIndex = hasHeader ? findIndex(["DESCRICAO", "DESCRIPTION", "HISTORICO", "MEMO", "NAME"]) : -1;
    const amountIndex = hasHeader ? findIndex(["VALOR", "AMOUNT", "TRNAMT"]) : -1;
    const identifierIndex = hasHeader ? findIndex(["IDENTIFICADOR", "IDENTIFIER", "ID", "FITID", "CODIGO"]) : -1;

    return dataLines
      .map((line) => {
        const columns = splitCsvLine(line);
        const inferredDateIndex = dateIndex >= 0 ? dateIndex : columns.findIndex((column) => Boolean(parseImportDate(column)));
        const inferredAmountIndex = amountIndex >= 0 ? amountIndex : columns.findLastIndex((column) => parseImportAmount(column) !== 0);
        const inferredDescriptionIndex =
          descriptionIndex >= 0
            ? descriptionIndex
            : columns.findIndex((_, index) => index !== inferredDateIndex && index !== inferredAmountIndex);

        return buildImportedItem(
          batchId,
          decodeImportedText(columns[inferredDescriptionIndex] ?? "Lancamento importado"),
          parseImportDate(columns[inferredDateIndex] ?? ""),
          parseImportAmount(columns[inferredAmountIndex] ?? ""),
          sourceKind,
          {
            transport: options?.transport,
            accountId: options?.accountId,
            cardId: options?.cardId,
            externalItemId:
              identifierIndex >= 0 && columns[identifierIndex]
                ? decodeImportedText(columns[identifierIndex]).trim()
                : options?.externalSourceId
                  ? `${options.externalSourceId}:${line}`
                  : undefined,
            originLabel: options?.originLabel,
          },
        );
      })
      .filter((item): item is ImportedStatementItem => Boolean(item));
  }

  function updateImportedBatchCounts(batchId: string, nextItems: ImportedStatementItem[]) {
    setImportedStatementBatches((current) =>
      current.map((batch) => {
        if (batch.id !== batchId) {
          return batch;
        }

        const batchItems = nextItems.filter((item) => item.batchId === batchId);
        const confirmedCount = batchItems.filter((item) => item.status === "confirmed").length;
        const ignoredCount = batchItems.filter((item) => item.status === "ignored").length;
        const duplicateCount = batchItems.filter((item) => item.status === "duplicate").length;
        const reviewedCount = confirmedCount + ignoredCount + duplicateCount;

        return {
          ...batch,
          confirmedCount,
          ignoredCount,
          duplicateCount,
          status:
            reviewedCount >= batchItems.length
              ? "confirmed"
              : reviewedCount > 0
                ? "partially_confirmed"
                : "pending_review",
        };
      }),
    );
  }

  function createImportedStatementBatchFromText({
    text,
    fileName,
    sourceKind,
    accountId,
    cardId,
    transport,
    externalSourceId,
    sourceLabel,
  }: {
    text: string;
    fileName: string;
    sourceKind: ImportedStatementBatch["sourceKind"];
    accountId?: string;
    cardId?: string;
    transport: ImportTransport;
    externalSourceId?: string;
    sourceLabel?: string;
  }) {
    if (externalSourceId && importedStatementBatches.some((batch) => batch.externalSourceId === externalSourceId)) {
      setImportError("Essa origem externa ja foi processada e foi bloqueada para evitar duplicidade.");
      return;
    }

    const batchId = crypto.randomUUID();
    const parsedItems = parseImportedStatement(text, batchId, fileName, sourceKind, {
      transport,
      externalSourceId,
      originLabel: sourceLabel,
      accountId,
      cardId,
    }).map((item) => ({
      ...item,
      accountId: sourceKind === "credit_card" ? undefined : accountId,
      cardId: sourceKind === "credit_card" ? cardId : undefined,
      originLabel: sourceLabel,
    }));

    if (!parsedItems.length) {
      setImportError("Nao foi possivel encontrar lancamentos nessa origem.");
      return;
    }

    const sourceInstitution = getImportedStatementInstitution(text, fileName);
    const dates = parsedItems.map((item) => item.date).sort((left, right) => left.localeCompare(right));
    const batch: ImportedStatementBatch = {
      id: batchId,
      fileName,
      fileType: fileName.toLowerCase().endsWith(".ofx") ? "ofx" : "csv",
      sourceKind,
      transport,
      sourceInstitution,
      accountId: sourceKind === "credit_card" ? undefined : accountId,
      cardId: sourceKind === "credit_card" ? cardId : undefined,
      externalSourceId,
      sourceLabel,
      importedAt: new Date().toISOString(),
      periodStart: dates[0],
      periodEnd: dates.at(-1),
      status: parsedItems.every((item) => item.status === "duplicate") ? "confirmed" : "pending_review",
      itemCount: parsedItems.length,
      confirmedCount: 0,
      ignoredCount: 0,
      duplicateCount: parsedItems.filter((item) => item.status === "duplicate").length,
    };

    setImportedStatementBatches((current) => [batch, ...current]);
    setImportedStatementItems((current) => [...parsedItems, ...current]);

    if (externalSourceId && transport !== "manual_upload") {
      setImportAutomationConfigs((current) =>
        current.map((config) =>
          config.transport === transport
            ? {
                ...config,
                processedExternalIds: Array.from(new Set([...config.processedExternalIds, externalSourceId])),
                lastSyncAt: new Date().toISOString(),
              }
            : config,
        ),
      );
    }
  }

  async function handleImportStatementFile(file: File | null) {
    if (!file) {
      return;
    }

    setImportError(null);

    try {
      const text = await readImportedStatementFile(file);
      createImportedStatementBatchFromText({
        text,
        fileName: file.name,
        sourceKind: importSourceKind,
        accountId: importSourceKind === "credit_card" ? undefined : importAccountId,
        cardId: importSourceKind === "credit_card" ? importCardId : undefined,
        transport: "manual_upload",
        sourceLabel: "Upload manual",
      });
    } catch {
      setImportError("Nao foi possivel ler o arquivo selecionado.");
    }
  }

  function registerImportLearningChoice(
    item: ImportedStatementItem,
    nextTransaction: Transaction,
    match?: ImportedStatementItem["suggestedMatch"],
  ) {
    const pattern = getImportPattern(item.normalizedDescription);
    if (!pattern) {
      return;
    }

    const now = new Date().toISOString();

    setImportLearningRules((current) => {
      const existing = current.find((rule) => rule.pattern === pattern && rule.sourceKind === item.sourceKind);
      if (!existing) {
        return [
          {
            id: crypto.randomUUID(),
            pattern,
            sourceKind: item.sourceKind,
            suggestedCategoryId: nextTransaction.categoryId,
            suggestedTransactionType: nextTransaction.type,
            suggestedMatch: match,
            supportCount: 1,
            mistakeCount: 0,
            status: "suggested",
            createdAt: now,
            updatedAt: now,
          },
          ...current,
        ];
      }

      return current.map((rule) =>
        rule.id === existing.id
          ? (() => {
              const isCorrection =
                item.appliedLearningRuleId === rule.id &&
                (rule.suggestedCategoryId !== nextTransaction.categoryId ||
                  rule.suggestedTransactionType !== nextTransaction.type ||
                  rule.paymentMethod !== nextTransaction.paymentMethod ||
                  getImportMatchValue(rule.suggestedMatch) !== getImportMatchValue(match));
              const nextMistakeCount = isCorrection ? rule.mistakeCount + 1 : rule.mistakeCount;

              return {
              ...rule,
              suggestedCategoryId: nextTransaction.categoryId,
              suggestedTransactionType: nextTransaction.type,
              paymentMethod: nextTransaction.paymentMethod,
              suggestedMatch: match,
              supportCount: rule.supportCount + 1,
                mistakeCount: nextMistakeCount,
                status: nextMistakeCount >= 3 ? "disabled" : rule.status,
              updatedAt: now,
                lastAppliedAt: item.appliedLearningRuleId === rule.id ? now : rule.lastAppliedAt,
              };
            })()
          : rule,
      );
    });
  }

  function registerImportMerchantChoice(
    item: ImportedStatementItem,
    nextTransaction: Transaction,
    match?: ImportedStatementItem["suggestedMatch"],
  ) {
    const alias = getImportMerchantAlias(item.normalizedDescription);
    const merchantName = nextTransaction.title.trim();
    if (!alias || !merchantName) {
      return;
    }

    const now = new Date().toISOString();
    setImportMerchants((current) => {
      const existing =
        (item.detectedMerchantId ? current.find((merchant) => merchant.id === item.detectedMerchantId) : undefined) ??
        current.find(
          (merchant) =>
            merchant.name.toLowerCase() === merchantName.toLowerCase() ||
            merchant.aliases.some((currentAlias) => normalizeImportedDescription(currentAlias) === alias),
        );

      if (!existing) {
        return [
          {
            id: crypto.randomUUID(),
            name: merchantName,
            aliases: [alias],
            sourceKind: item.sourceKind,
            suggestedCategoryId: nextTransaction.categoryId,
            suggestedTransactionType: nextTransaction.type,
            suggestedMatch: match,
            supportCount: 1,
            mistakeCount: 0,
            status: "suggested",
            createdAt: now,
            updatedAt: now,
          },
          ...current,
        ];
      }

      return current.map((merchant) => {
        if (merchant.id !== existing.id) {
          return merchant;
        }

        const isCorrection =
          item.detectedMerchantId === merchant.id &&
          (merchant.name !== merchantName ||
            merchant.suggestedCategoryId !== nextTransaction.categoryId ||
            merchant.suggestedTransactionType !== nextTransaction.type ||
            getImportMatchValue(merchant.suggestedMatch) !== getImportMatchValue(match));
        const nextMistakeCount = isCorrection ? merchant.mistakeCount + 1 : merchant.mistakeCount;
        const nextSupportCount = merchant.supportCount + 1;

        return {
          ...merchant,
          name: merchantName,
          aliases: Array.from(new Set([...merchant.aliases, alias])),
          suggestedCategoryId: nextTransaction.categoryId,
          suggestedTransactionType: nextTransaction.type,
          suggestedMatch: match,
          supportCount: nextSupportCount,
          mistakeCount: nextMistakeCount,
          status:
            nextMistakeCount >= 3
              ? "disabled"
              : merchant.status === "approved" || nextSupportCount >= 2
                ? "approved"
                : "suggested",
          updatedAt: now,
          lastAppliedAt: item.detectedMerchantId === merchant.id ? now : merchant.lastAppliedAt,
        };
      });
    });
  }

  function applyImportedItemMatch(item: ImportedStatementItem, nextTransaction: Transaction) {
    const match = item.suggestedMatch;
    if (!match) {
      return;
    }

    const itemMonth = item.date.slice(0, 7);

    if (match.kind === "planned_purchase") {
      setPlannedPurchases((current) =>
        current.map((purchase) =>
          purchase.id === match.targetId
            ? {
                ...purchase,
                status: "bought",
                boardColumn: "bought",
                savedAmount: Math.max(purchase.savedAmount, nextTransaction.amount),
                notes: purchase.notes
                  ? `${purchase.notes}\nRealizado via importacao em ${formatShortDate(item.date)}.`
                  : `Realizado via importacao em ${formatShortDate(item.date)}.`,
              }
            : purchase,
        ),
      );
      return;
    }

    if (match.kind === "bill") {
      setBills((current) =>
        current.map((bill) =>
          bill.id === match.targetId
            ? { ...bill, amount: nextTransaction.amount, dueDate: item.date, status: "paid" }
            : bill,
        ),
      );
      return;
    }

    if (match.kind === "fixed_entry") {
      const fixedEntry = fixedEntries.find((entry) => entry.id === match.targetId);
      setFixedEntries((current) =>
        current.map((entry) =>
          entry.id === match.targetId
            ? {
                ...entry,
                amountByMonth: { ...entry.amountByMonth, [itemMonth]: nextTransaction.amount },
                completedMonths: Array.from(new Set([...entry.completedMonths, itemMonth])),
              }
            : entry,
        ),
      );

      if (fixedEntry?.linkedBillGroupId) {
        setBills((current) =>
          current.map((bill) =>
            (bill.recurringGroupId ?? bill.id) === fixedEntry.linkedBillGroupId && bill.dueDate.slice(0, 7) === itemMonth
              ? { ...bill, amount: nextTransaction.amount, dueDate: item.date, status: "paid" }
              : bill,
          ),
        );
      }
      return;
    }

    if (match.kind === "card_bill_payment") {
      const [cardId, monthValue] = match.targetId.split("|");
      const key = getCardBillEstimateKey(cardId, monthValue);
      setCardBillEstimates((current) => ({
        ...current,
        [key]: {
          cardId,
          monthValue,
          estimatedAmount: current[key]?.estimatedAmount ?? getCardBillGridAmount(cardId, monthValue),
          isAutoEstimate: current[key]?.isAutoEstimate ?? true,
          status: "paid",
          paidTransactionId: nextTransaction.id,
        },
      }));
    }
  }

  function handleApproveImportLearningRule(ruleId: string) {
    const now = new Date().toISOString();
    setImportLearningRules((current) =>
      current.map((rule) =>
        rule.id === ruleId ? { ...rule, status: "approved", mistakeCount: 0, updatedAt: now } : rule,
      ),
    );
  }

  function handleDisableImportLearningRule(ruleId: string) {
    const now = new Date().toISOString();
    setImportLearningRules((current) =>
      current.map((rule) => (rule.id === ruleId ? { ...rule, status: "disabled", updatedAt: now } : rule)),
    );
  }

  function handleEnableImportLearningRule(ruleId: string) {
    const now = new Date().toISOString();
    setImportLearningRules((current) =>
      current.map((rule) => (rule.id === ruleId ? { ...rule, status: "suggested", updatedAt: now } : rule)),
    );
  }

  function handleUpdateImportMerchant(merchantId: string, patch: Partial<ImportMerchant>) {
    const now = new Date().toISOString();
    setImportMerchants((current) =>
      current.map((merchant) =>
        merchant.id === merchantId
          ? {
              ...merchant,
              ...patch,
              updatedAt: now,
            }
          : merchant,
      ),
    );
  }

  function handleApplyImportMerchantToItem(itemId: string, merchantId: string) {
    const merchant = importMerchants.find((current) => current.id === merchantId);
    if (!merchant) {
      return;
    }

    setImportedStatementItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              detectedMerchantId: merchant.id,
              reviewTitle: merchant.name,
              suggestedCategoryId: merchant.suggestedCategoryId ?? item.suggestedCategoryId,
              suggestedTransactionType: merchant.suggestedTransactionType ?? item.suggestedTransactionType,
              suggestedMatch: merchant.suggestedMatch ?? item.suggestedMatch,
              confidence: Math.max(item.confidence, merchant.status === "approved" ? 0.9 : 0.78),
            }
          : item,
      ),
    );
  }

  function handleUpdateImportAutomationConfig(
    configId: string,
    patch: Partial<ImportAutomationConfig>,
  ) {
    setImportAutomationConfigs((current) =>
      current.map((config) =>
        config.id === configId
          ? {
              ...config,
              ...patch,
              status:
                patch.isEnabled === true && !config.authorizedAt
                  ? "needs_authorization"
                  : patch.status ?? config.status,
            }
          : config,
      ),
    );
  }

  async function handleOpenPluggyConnect() {
    setPluggyConnectStatus("loading");
    setPluggyConnectError(null);

    try {
      const response = await fetch("/api/connect-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientUserId: "monex-local-user",
        }),
      });

      const payload = (await response.json()) as { accessToken?: string; error?: string; details?: string };

      if (!response.ok || !payload.accessToken) {
        throw new Error(payload.details || payload.error || "Nao foi possivel criar o token da Pluggy.");
      }

      setPluggyConnectToken(payload.accessToken);
      setPluggyConnectStatus("ready");
    } catch (error) {
      setPluggyConnectStatus("error");
      setPluggyConnectError(getErrorMessage(error));
    }
  }

  function handlePluggyConnectSuccess(itemData: unknown) {
    const item = itemData && typeof itemData === "object" && "item" in itemData
      ? (itemData as { item?: { id?: string; connector?: { name?: string }; connectorId?: number } }).item
      : undefined;
    const itemId = item?.id;
    const providerName = item?.connector?.name ?? "Pluggy";

    handleUpdateImportAutomationConfig("open-finance", {
      isEnabled: true,
      status: "active",
      provider: providerName,
      externalConnectionId: itemId,
      authorizedAt: new Date().toISOString(),
      notes: itemId
        ? `Conexao Pluggy autorizada. Item ID: ${itemId}.`
        : "Conexao Pluggy autorizada. Item ID deve ser salvo via webhook ou callback quando disponivel.",
    });
    setPluggyConnectStatus("connected");
    setPluggyConnectToken("");
    setPluggyConnectError(null);
  }

  function handlePluggyConnectError(error: unknown) {
    setPluggyConnectStatus("error");
    setPluggyConnectError(getErrorMessage(error));
    setPluggyConnectToken("");
  }

  function handleConfirmImportedItem(itemId: string) {
    const item = importedStatementItems.find((current) => current.id === itemId);
    if (!item || item.status !== "pending") {
      return;
    }

    const category =
      categories.find((current) => current.id === item.suggestedCategoryId) ??
      categories.find((current) => current.type === item.suggestedTransactionType) ??
      categories[0];

    if (!category) {
      return;
    }

    const paymentMethod: PaymentMethod =
      item.paymentMethod === "unknown"
        ? item.sourceKind === "credit_card"
          ? "credit_card"
          : "pix"
        : item.paymentMethod;
    const matchedFixedEntry =
      item.suggestedMatch?.kind === "fixed_entry"
        ? fixedEntries.find((entry) => entry.id === item.suggestedMatch?.targetId)
        : undefined;
    const matchedFixedBill =
      matchedFixedEntry?.linkedBillGroupId
        ? bills.find(
            (bill) =>
              (bill.recurringGroupId ?? bill.id) === matchedFixedEntry.linkedBillGroupId &&
              bill.dueDate.slice(0, 7) === item.date.slice(0, 7),
          )
        : undefined;
    const sourceBillId =
      item.suggestedMatch?.kind === "bill"
        ? item.suggestedMatch.targetId
        : matchedFixedBill?.id;
    const linkedPlannedPurchaseId =
      item.suggestedMatch?.kind === "planned_purchase" ? item.suggestedMatch.targetId : undefined;
    const isCardBillPayment = item.suggestedMatch?.kind === "card_bill_payment";
    const transactionTitle = item.reviewTitle?.trim() || item.rawDescription;
    const nextTransaction: Transaction = {
      id: crypto.randomUUID(),
      title: transactionTitle,
      type: item.suggestedTransactionType ?? (item.direction === "inflow" ? "income" : "expense"),
      amount: item.amount,
      date: item.date,
      categoryId: category.id,
      categoryName: category.name,
      paymentMethod,
      status: item.direction === "inflow" ? "received" : "paid",
      incomeKind: item.direction === "inflow" ? "variable" : undefined,
      expenseKind:
        item.direction === "outflow"
          ? linkedPlannedPurchaseId
            ? "planned_purchase"
            : sourceBillId || isCardBillPayment
              ? "basic_bill"
              : "variable"
          : undefined,
      accountId: item.accountId ?? settings.defaultAccountId,
      cardId: !isCardBillPayment && (paymentMethod === "credit_card" || paymentMethod === "debit_card") ? item.cardId : undefined,
      cardMode: !isCardBillPayment && paymentMethod === "credit_card" ? "credit" : !isCardBillPayment && paymentMethod === "debit_card" ? "debit" : undefined,
      sourceBillId,
      linkedPlannedPurchaseId,
      description: `IMPORT:${item.batchId}:${item.id}${item.suggestedMatch ? `;MATCH:${item.suggestedMatch.kind}:${item.suggestedMatch.targetId}` : ";HISTORY_ONLY"};RAW:${item.rawDescription}`,
    };

    setTransactions((current) => [nextTransaction, ...current].sort((left, right) => right.date.localeCompare(left.date)));
    applyImportedItemMatch(item, nextTransaction);
    registerImportLearningChoice(item, nextTransaction, item.suggestedMatch);
    registerImportMerchantChoice(item, nextTransaction, item.suggestedMatch);
    setImportedStatementItems((current) => {
      const nextItems = current.map((currentItem) =>
        currentItem.id === itemId
          ? { ...currentItem, status: "confirmed" as const, confirmedTransactionId: nextTransaction.id }
          : currentItem,
      );
      updateImportedBatchCounts(item.batchId, nextItems);
      return nextItems;
    });
  }

  function handleIgnoreImportedItem(itemId: string) {
    const item = importedStatementItems.find((current) => current.id === itemId);
    if (!item) {
      return;
    }

    setImportedStatementItems((current) => {
      const nextItems = current.map((currentItem) =>
        currentItem.id === itemId
          ? { ...currentItem, status: "ignored" as const, ignoredReason: "Ignorado manualmente" }
          : currentItem,
      );
      updateImportedBatchCounts(item.batchId, nextItems);
      return nextItems;
    });
  }

  const buildPersistedState = useCallback(
    (): FinancePersistedState => ({
      selectedMonth,
      accounts,
      cards,
      transactions,
      transactionGroups,
      bills,
      categories,
      debts,
      fixedEntries,
      plannedPurchases,
      investments,
      cardBillEstimates,
      importedStatementBatches,
      importedStatementItems,
      importLearningRules,
      importMerchants,
      importAutomationConfigs,
      settings,
      monthlyPlansByMonth,
    }),
    [
      selectedMonth,
      accounts,
      cards,
      transactions,
      transactionGroups,
      bills,
      categories,
      debts,
      fixedEntries,
      plannedPurchases,
      investments,
      cardBillEstimates,
      importedStatementBatches,
      importedStatementItems,
      importLearningRules,
      importMerchants,
      importAutomationConfigs,
      settings,
      monthlyPlansByMonth,
    ],
  );

  const writeLocalPersistedCache = useCallback(
    (state: Partial<FinancePersistedState>, updatedAt: string | null = new Date().toISOString()) => {
      const nextValue = JSON.stringify({
        state,
        updatedAt,
      } satisfies FinancePersistedCache);
      const currentValue = window.localStorage.getItem(FINANCE_STORAGE_KEY);

      if (currentValue && currentValue !== nextValue) {
        window.localStorage.setItem(
          FINANCE_STORAGE_BACKUP_KEY,
          JSON.stringify({
            backupAt: new Date().toISOString(),
            value: currentValue,
          }),
        );
      }

      window.localStorage.setItem(FINANCE_STORAGE_KEY, nextValue);
    },
    [],
  );

  const clearLocalPersistedCache = useCallback(() => {
    window.localStorage.removeItem(FINANCE_STORAGE_KEY);
    window.localStorage.removeItem(FINANCE_STORAGE_BACKUP_KEY);
  }, []);

  const parseLocalPersistedCache = useCallback((): FinancePersistedCache | null => {
    try {
      const raw = window.localStorage.getItem(FINANCE_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as
        | FinancePersistedCache
        | Partial<FinancePersistedState>
        | null;

      if (!parsed || typeof parsed !== "object") {
        window.localStorage.removeItem(FINANCE_STORAGE_KEY);
        return null;
      }

      if ("state" in parsed && parsed.state && typeof parsed.state === "object") {
        return {
          state: parsed.state as Partial<FinancePersistedState>,
          updatedAt:
            "updatedAt" in parsed && typeof parsed.updatedAt === "string"
              ? parsed.updatedAt
              : null,
        };
      }

      return {
        state: parsed as Partial<FinancePersistedState>,
        updatedAt: null,
      };
    } catch {
      window.localStorage.removeItem(FINANCE_STORAGE_KEY);
      return null;
    }
  }, []);

  const applyPersistedState = useCallback((persisted: Partial<FinancePersistedState>) => {
    setSelectedMonth(getTodayMonthValue());
    if (persisted.accounts) setAccounts(persisted.accounts);
    if (persisted.cards) setCards(persisted.cards);
    if (persisted.transactions) setTransactions(persisted.transactions);
    if (persisted.transactionGroups) setTransactionGroups(persisted.transactionGroups);

    const migratedBills: Bill[] = persisted.bills ? [...persisted.bills] : [];
    let migratedPlannedPurchases = persisted.plannedPurchases ?? [];

    const purchasesToConvert = migratedPlannedPurchases.filter(
      (purchase) =>
        purchase.planningMode === "card_parcelado" &&
        purchase.plannedCardId &&
        purchase.estimatedValue > 0 &&
        purchase.status !== "cancelled",
    );

    if (purchasesToConvert.length > 0) {
      for (const purchase of purchasesToConvert) {
        const billGroupId = `migrated-${purchase.id}`;
        const targetMonth = purchase.targetMonth ?? purchase.desiredDate?.slice(0, 7) ?? getTodayMonthValue();
        const installments = Math.max(1, purchase.plannedInstallments ?? 1);
        const installmentValue = Number((purchase.estimatedValue / installments).toFixed(2));

        for (let i = 0; i < installments; i++) {
          const installmentMonth = getMonthValueOffset(targetMonth, i);
          const isLast = i === installments - 1;
          const accumulated = installmentValue * i;
          migratedBills.push({
            id: `bill-migrated-${crypto.randomUUID()}`,
            title: purchase.name,
            amount: isLast
              ? Number((purchase.estimatedValue - accumulated).toFixed(2))
              : installmentValue,
            categoryId: "cat-bills",
            categoryName: "Compras",
            dueDate: `${installmentMonth}-28`,
            priority: purchase.priority ?? "Alta",
            isRecurring: false,
            status: "pending",
            plannedPaymentMethod: "card",
            plannedCardId: purchase.plannedCardId,
            plannedCardMode: purchase.plannedCardMode ?? "credit",
            installments,
            recurringGroupId: billGroupId,
            notes: purchase.description,
          });
        }
      }

      migratedPlannedPurchases = migratedPlannedPurchases.filter(
        (p) => !purchasesToConvert.some((c) => c.id === p.id),
      );
    }

    if (persisted.bills || migratedBills.length > 0) setBills(migratedBills);
    if (persisted.categories) setCategories(persisted.categories);
    if (persisted.debts) setDebts(persisted.debts);
    if (persisted.fixedEntries) setFixedEntries(persisted.fixedEntries);
    if (persisted.plannedPurchases) setPlannedPurchases(migratedPlannedPurchases);
    if (persisted.investments) setInvestments(persisted.investments);
    if (persisted.cardBillEstimates) setCardBillEstimates(persisted.cardBillEstimates);
    if (persisted.importedStatementBatches) setImportedStatementBatches(persisted.importedStatementBatches);
    if (persisted.importedStatementItems) setImportedStatementItems(persisted.importedStatementItems);
    if (persisted.importLearningRules) setImportLearningRules(persisted.importLearningRules);
    if (persisted.importMerchants) setImportMerchants(persisted.importMerchants);
    if (persisted.importAutomationConfigs) {
      setImportAutomationConfigs([
        ...persisted.importAutomationConfigs,
        ...initialImportAutomationConfigs.filter(
          (config) => !persisted.importAutomationConfigs?.some((saved) => saved.id === config.id),
        ),
      ]);
    }
    if (persisted.settings) setSettings({
      ...seedSettings,
      ...persisted.settings,
      defaultBillPaymentMethod: persisted.settings.defaultBillPaymentMethod ?? seedSettings.defaultBillPaymentMethod,
    });
    if (persisted.monthlyPlansByMonth) setMonthlyPlansByMonth(persisted.monthlyPlansByMonth);
  }, []);

  const saveStateToSupabase = useCallback(
    async (snapshot: FinancePersistedState) => {
      if (remoteSaveInFlightRef.current) {
        pendingRemoteSnapshotRef.current = snapshot;
        setRemoteSaveStatus("saving");
        return;
      }

      if (remoteRetryTimeoutRef.current) {
        window.clearTimeout(remoteRetryTimeoutRef.current);
        remoteRetryTimeoutRef.current = null;
      }

      remoteSaveInFlightRef.current = true;
      setRemoteSaveStatus("saving");
      setRemoteSaveError(null);
      let didSave = false;

      try {
        const response = await fetch("/api/app-state", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ state: snapshot }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(errorText || `Supabase respondeu ${response.status}`);
        }

        const payload = (await response.json()) as { updatedAt?: string | null };
        const savedAt = payload.updatedAt ?? new Date().toISOString();
        writeLocalPersistedCache(snapshot, savedAt);
        setLastRemoteSavedAt(savedAt);
        setRemoteSaveStatus("saved");
        setRemoteSaveError(null);
        remoteRetryCountRef.current = 0;
        didSave = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Nao foi possivel salvar no Supabase.";
        pendingRemoteSnapshotRef.current = pendingRemoteSnapshotRef.current ?? snapshot;
        setRemoteSaveStatus("error");
        setRemoteSaveError(message);

        const retryDelay = Math.min(30000, 2000 * 2 ** remoteRetryCountRef.current);
        remoteRetryCountRef.current += 1;
        remoteRetryTimeoutRef.current = window.setTimeout(() => {
          const pendingSnapshot = pendingRemoteSnapshotRef.current;
          if (pendingSnapshot) {
            pendingRemoteSnapshotRef.current = null;
            void saveStateToSupabase(pendingSnapshot);
          }
        }, retryDelay);
      } finally {
        remoteSaveInFlightRef.current = false;

        const pendingSnapshot = pendingRemoteSnapshotRef.current;
        if (didSave && pendingSnapshot) {
          pendingRemoteSnapshotRef.current = null;
          window.setTimeout(() => {
            void saveStateToSupabase(pendingSnapshot);
          }, 0);
        }
      }
    },
    [writeLocalPersistedCache],
  );

  useEffect(() => {
    if (activeView !== "home") {
      return;
    }

    const homeTabParam = searchParams.get("tab");
    const planningParam = searchParams.get("planning");
    const accountsParam = searchParams.get("accounts");
    const nextHomeTab: HomeTab = isHomeTab(homeTabParam) ? homeTabParam : "grid";
    const nextPlanningScreen: Exclude<PlanningScreen, "board"> = isPlanningScreen(planningParam)
      ? planningParam
      : "purchases";
    const nextAccountsSection: AccountsSection = isAccountsSection(accountsParam)
      ? accountsParam
      : "overview";
    const nextSelectedCardId = searchParams.get("card");
    const nextStatementMonth = searchParams.get("statementMonth");

    setHomeTab(nextHomeTab);
    setPlanningScreen(nextPlanningScreen);
    setAccountsSection(nextAccountsSection);
    setSelectedCardDetailId(nextSelectedCardId);
    if (nextStatementMonth) {
      setSelectedCardStatementMonth(nextStatementMonth);
    }
  }, [activeView, searchParams]);

  useEffect(() => {
    let isCancelled = false;

    async function hydratePersistedState() {
      const localCache = parseLocalPersistedCache();
      const localState = localCache?.state ?? null;
      setRemoteSaveStatus("loading");
      setRemoteSaveError(null);
      setHasHydratedRemoteState(false);

      try {
        const response = await fetch("/api/app-state", {
          method: "GET",
          cache: "no-store",
        });

        if (isCancelled) {
          return;
        }

        if (response.ok) {
          const payload = (await response.json()) as {
            state?: Partial<FinancePersistedState> | null;
            updatedAt?: string | null;
          };

          if (payload.state) {
            const remoteUpdatedAt = payload.updatedAt ?? null;
            pendingRemoteSnapshotRef.current = null;
            applyPersistedState(payload.state);
            clearLocalPersistedCache();
            writeLocalPersistedCache(payload.state, remoteUpdatedAt);
            setLastRemoteSavedAt(remoteUpdatedAt);
            setRemoteSaveStatus("saved");
            setHasHydratedRemoteState(true);
            return;
          }

          pendingRemoteSnapshotRef.current = null;
          clearLocalPersistedCache();
          setLastRemoteSavedAt(payload.updatedAt ?? null);
          setRemoteSaveStatus("saved");
          setHasHydratedRemoteState(true);
          return;
        }

        if (localState) {
          applyPersistedState(localState);
          pendingRemoteSnapshotRef.current = null;
          setRemoteSaveStatus("error");
          setRemoteSaveError("Supabase indisponivel. Cache local usado apenas como leitura temporaria.");
        } else {
          setRemoteSaveStatus("error");
          setRemoteSaveError(`Supabase respondeu ${response.status}. Nenhum cache local foi aplicado.`);
        }
      } catch (error) {
        if (localState) {
          applyPersistedState(localState);
        }
        pendingRemoteSnapshotRef.current = null;
        setRemoteSaveStatus("error");
        setRemoteSaveError(
          error instanceof Error
            ? `${error.message}. Cache local usado apenas como leitura temporaria.`
            : "Nao foi possivel carregar dados do Supabase.",
        );
      } finally {
        if (!isCancelled) {
          setHasLoadedPersistedState(true);
        }
      }
    }

    hydratePersistedState();

    return () => {
      isCancelled = true;
    };
  }, [applyPersistedState, clearLocalPersistedCache, parseLocalPersistedCache, writeLocalPersistedCache]);

  useEffect(() => {
    if (!hasLoadedPersistedState) {
      return;
    }

    const snapshot = buildPersistedState();
    writeLocalPersistedCache(snapshot);

    if (!hasHydratedRemoteState) {
      return;
    }

    void saveStateToSupabase(snapshot);
  }, [
    buildPersistedState,
    hasHydratedRemoteState,
    hasLoadedPersistedState,
    saveStateToSupabase,
    writeLocalPersistedCache,
  ]);

  useEffect(() => {
    if (!hasLoadedPersistedState || !hasHydratedRemoteState) {
      return;
    }

    function flushCurrentState() {
      const snapshot = buildPersistedState();
      writeLocalPersistedCache(snapshot);
      void fetch("/api/app-state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state: snapshot }),
        keepalive: true,
      }).catch(() => undefined);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushCurrentState();
      }
    }

    window.addEventListener("pagehide", flushCurrentState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushCurrentState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    buildPersistedState,
    hasHydratedRemoteState,
    hasLoadedPersistedState,
    writeLocalPersistedCache,
  ]);

  const autoCardBills = cards
    .filter((card) => card.availableMode !== "debit")
    .flatMap((card) => {
      const transactionMonths = transactions
        .filter((transaction) => transaction.cardId === card.id && transaction.cardMode === "credit")
        .map((transaction) => getCardStatementMonthForTransaction(card, transaction));
      const billMonths = bills
        .filter(
          (bill) =>
            isCreditLinkedBill(bill) &&
            bill.plannedCardId === card.id,
        )
        .map((bill) => getCardStatementMonthForBill(card, bill));
      const plannedPurchaseMonths = plannedPurchases
        .filter(
          (purchase) =>
            purchase.planningMode === "card_parcelado" &&
            purchase.plannedCardId === card.id &&
            purchase.status !== "cancelled" &&
            purchase.status !== "bought" &&
            purchase.estimatedValue > 0,
        )
        .flatMap((purchase) =>
          Object.entries(getPlannedPurchaseAmountByMonth(purchase))
            .filter(([, amount]) => amount > 0)
            .map(([monthValue]) => monthValue),
        );
      const groupedByMonth = Object.fromEntries(
        Array.from(new Set([...transactionMonths, ...billMonths, ...plannedPurchaseMonths])).map((monthValue) => [
          monthValue,
          getCardBillAutoEstimatedAmount(card.id, monthValue),
        ]),
      );

      return Object.entries(groupedByMonth)
        .filter(([, amount]) => amount > 0)
        .map(([statementMonth, amount]) => {
          const cardBillEstimate = cardBillEstimates[getCardBillEstimateKey(card.id, statementMonth)];
          const dueDate = monthValueToDate(statementMonth);
          dueDate.setDate(Math.min(card.dueDay, 28));

          const dueDateValue = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(
            dueDate.getDate(),
          ).padStart(2, "0")}`;
          const today = new Date(`${referenceDate}T12:00:00`);
          const status: Bill["status"] =
            cardBillEstimate?.status === "paid" ? "paid" : dueDate < today ? "overdue" : "pending";

          return {
            source: "card_auto" as const,
            cardId: card.id,
            statementMonth,
            bill: {
              id: `auto-card-bill-${card.id}-${statementMonth}`,
              title: `Fatura ${card.name}`,
              amount: Number(amount.toFixed(2)),
              categoryId: "cat-bills",
              categoryName: "Fatura do cartao",
              dueDate: dueDateValue,
              priority: "Alta",
              isRecurring: true,
              status,
              plannedPaymentMethod: settings.defaultBillPaymentMethod,
              archivedAt: cardBillEstimate?.archivedAt,
              notes: `Gerada automaticamente a partir dos lancamentos de credito de ${formatMonthLabel(
                monthValueToDate(statementMonth),
              )}.`,
            } satisfies Bill,
          };
        });
    })
    .sort((left, right) => left.bill.dueDate.localeCompare(right.bill.dueDate));

  function getCardBillEstimateKey(cardId: string, monthValue: string) {
    return `${cardId}:${monthValue}`;
  }

  function getCardBillRealAmount(cardId: string, monthValue: string) {
    const bill = autoCardBills.find((item) => item.cardId === cardId && item.statementMonth === monthValue);
    return bill?.bill.archivedAt ? 0 : bill?.bill.amount ?? 0;
  }

  function getCreditLinkedBillsForStatement(cardId: string, monthValue: string) {
    const card = cards.find((item) => item.id === cardId);
    if (!card) {
      return [];
    }

    const transactionBillIds = new Set(
      transactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.cardId === cardId &&
            transaction.cardMode === "credit" &&
            transaction.sourceBillId &&
            getCardStatementMonthForTransaction(card, transaction) === monthValue,
        )
        .map((transaction) => transaction.sourceBillId),
    );

    return bills.filter(
      (bill) =>
        isCreditLinkedBill(bill) &&
        bill.plannedCardId === cardId &&
        !transactionBillIds.has(bill.id) &&
        getCardStatementMonthForBill(card, bill) === monthValue,
    );
  }

  function getCardBillAutoEstimatedAmount(cardId: string, monthValue: string) {
    return Number(
      getCardStatementGridItems(cardId, monthValue)
        .reduce((sum, item) => sum + item.amount, 0)
        .toFixed(2),
    );
  }

  function getCardBillGridAmount(cardId: string, monthValue: string) {
    const estimate = cardBillEstimates[getCardBillEstimateKey(cardId, monthValue)];
    if (estimate?.archivedAt) {
      return 0;
    }

    if (estimate && !estimate.isAutoEstimate) {
      return estimate.estimatedAmount;
    }

    return getCardBillAutoEstimatedAmount(cardId, monthValue);
  }

  function openCardBillComparison(cardId: string, monthValue: string) {
    setSelectedCardBillComparison({ cardId, monthValue });
  }

  function closeCardBillComparison() {
    setSelectedCardBillComparison(null);
  }

  function handleUpdateCardBillEstimate(cardId: string, monthValue: string, rawValue: string) {
    const parsedValue = Number(rawValue.replace(",", ".")) || 0;
    const estimatedAmount = Math.max(0, Number(parsedValue.toFixed(2)));
    const key = getCardBillEstimateKey(cardId, monthValue);

    setCardBillEstimates((current) => ({
      ...current,
      [key]: {
        cardId,
        monthValue,
        estimatedAmount,
        isAutoEstimate: false,
        status: current[key]?.status ?? "pending",
        paidTransactionId: current[key]?.paidTransactionId,
      },
    }));
  }

  function handleUseAutoCardBillEstimate(cardId: string, monthValue: string) {
    const key = getCardBillEstimateKey(cardId, monthValue);
    const autoAmount = getCardBillAutoEstimatedAmount(cardId, monthValue);

    setCardBillEstimates((current) => ({
      ...current,
      [key]: {
        cardId,
        monthValue,
        estimatedAmount: autoAmount,
        isAutoEstimate: true,
        status: current[key]?.status ?? "pending",
        paidTransactionId: current[key]?.paidTransactionId,
      },
    }));
  }

  const activeBills = bills.filter((bill) => !bill.archivedAt);
  const archivedBills = bills.filter((bill) => bill.archivedAt);
  const activeAutoCardBills = autoCardBills.filter((item) => !item.bill.archivedAt);
  const archivedAutoCardBills = autoCardBills.filter((item) => item.bill.archivedAt);
  const activeDebts = debts.filter((debt) => !debt.archivedAt);
  const archivedDebts = debts.filter((debt) => debt.archivedAt);
  const activeFixedEntries = fixedEntries.filter((entry) => {
    if (entry.archivedAt) {
      return false;
    }

    if (entry.linkedDebtId) {
      return activeDebts.some((debt) => debt.id === entry.linkedDebtId);
    }

    if (entry.linkedBillGroupId) {
      return activeBills.some((bill) => (bill.recurringGroupId ?? bill.id) === entry.linkedBillGroupId);
    }

    return true;
  });
  const archivedFixedEntries = fixedEntries.filter((entry) => entry.archivedAt);
  const allBills = [
    ...activeBills.filter((bill) => !isCreditLinkedBill(bill)),
    ...activeAutoCardBills.map((item) => item.bill),
  ];
  const manualBillsForDisplay: BillDisplayItem[] = Array.from(
    activeBills.reduce((groups, bill) => {
      const groupKey = bill.isRecurring ? bill.recurringGroupId ?? bill.id : bill.id;
      const currentGroup = groups.get(groupKey) ?? [];
      currentGroup.push(bill);
      groups.set(groupKey, currentGroup);
      return groups;
    }, new Map<string, Bill[]>()),
  ).map(([, groupBills]) => {
    const sortedBills = [...groupBills].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
    const preferredBill =
      sortedBills.find((bill) => bill.dueDate.slice(0, 7) === selectedMonth) ??
      sortedBills.find((bill) => bill.dueDate.slice(0, 7) >= selectedMonth) ??
      sortedBills[0];

    return { source: "manual" as const, bill: preferredBill };
  });
  const billsForDisplay: BillDisplayItem[] = manualBillsForDisplay.sort((left, right) =>
    left.bill.dueDate.localeCompare(right.bill.dueDate),
  );

  useEffect(() => {
    if (!hasLoadedPersistedState) {
      return;
    }

    const now = new Date().toISOString();

    setBills((current) => {
      let changed = false;
      const nextBills = current.map((bill) => {
        if (bill.status === "paid" && !bill.archivedAt) {
          changed = true;
          return { ...bill, archivedAt: now };
        }

        return bill;
      });

      return changed ? nextBills : current;
    });

    setDebts((current) => {
      let changed = false;
      const nextDebts = current.map((debt) => {
        if (debt.status === "settled" && !debt.archivedAt) {
          changed = true;
          return { ...debt, archivedAt: now };
        }

        return debt;
      });

      return changed ? nextDebts : current;
    });

    setCardBillEstimates((current) => {
      let changed = false;
      const nextEstimates = Object.fromEntries(
        Object.entries(current).map(([key, estimate]) => {
          if (estimate.status === "paid" && !estimate.archivedAt) {
            changed = true;
            return [key, { ...estimate, archivedAt: now }];
          }

          return [key, estimate];
        }),
      ) as Record<string, CardBillEstimate>;

      return changed ? nextEstimates : current;
    });
  }, [hasLoadedPersistedState, bills, debts, cardBillEstimates]);

  const selectableBillCategories = getSelectableCategories("expense");
  const defaultBillCategoryId =
    selectableBillCategories[0]?.id ??
    categories.find((category) => category.type === "expense")?.id ??
    initialDraftBill.categoryId;
  const availableAnalysisMonths = Array.from(
    new Set([selectedMonth, ...getAvailableMonths(transactions, allBills)]),
  )
    .sort()
    .reverse();
  const activeViewLabel = navItems.find((item) => item.id === activeView)?.label ?? "Planilha";
  const activeViewSubtitle =
    activeView === "home"
      ? "Planejamento mensal"
      : activeView === "transactions"
        ? "Lancamentos e revisao do mes"
        : activeView === "history"
          ? "Graficos e analises"
          : activeView === "reconciliation"
            ? "Real vs planejado"
            : "Preferencias do sistema";
  const remoteSaveLabel =
    remoteSaveStatus === "loading"
      ? "Conectando Supabase"
      : remoteSaveStatus === "saving"
        ? "Salvando no Supabase"
        : remoteSaveStatus === "error"
          ? "Erro ao salvar"
          : "Salvo no Supabase";
  const remoteSaveTone =
    remoteSaveStatus === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : remoteSaveStatus === "saving" || remoteSaveStatus === "loading"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const remoteSaveDot =
    remoteSaveStatus === "error"
      ? "bg-red-500"
      : remoteSaveStatus === "saving" || remoteSaveStatus === "loading"
        ? "bg-amber-500"
        : "bg-emerald-500";
  const lastRemoteSavedLabel = lastRemoteSavedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(lastRemoteSavedAt))
    : null;

  const monthSummary = getMonthlySummary(
    transactions,
    allBills,
    investments,
    { ...settings, fixedSalaryExpected: currentMonthlyPlan.fixedIncomePlanned },
    referenceMonthDate,
  );
  const weeklySummary = getWeeklySummary(
    transactions,
    allBills,
    plannedPurchases,
    new Date(`${referenceDate}T12:00:00`),
    settings.weekStartDay,
  );
  const alerts = getAlerts(
    allBills,
    debts,
    plannedPurchases,
    monthSummary,
    new Date(`${referenceDate}T12:00:00`),
  );
  const categoryBreakdown = getCategoryBreakdown(transactions, referenceMonthDate);
  const monthlyTrend = getMonthlyTrend(transactions);
  const getOpenCardStatementTotal = (
    cardId: string,
    fromMonthValue = selectedMonth,
    sourceTransactions: Transaction[] = transactions,
    windowSize = 12,
  ) => {
    const card = cards.find((item) => item.id === cardId);
    const months = new Set(getStatementWindowMonths(fromMonthValue, windowSize));

    return sourceTransactions
      .filter(
        (transaction) => {
          if (transaction.cardId !== cardId || transaction.cardMode !== "credit") {
            return false;
          }

          const statementMonth = getCardStatementMonthForTransaction(card, transaction);
          const billEstimate = cardBillEstimates[getCardBillEstimateKey(cardId, statementMonth)];

          return months.has(statementMonth) && billEstimate?.status !== "paid";
        },
      )
      .reduce((sum, transaction) => sum + getCreditCardTransactionSignedAmount(transaction), 0);
  };
  const getCardAvailableLimit = (
    cardId: string,
    fromMonthValue = selectedMonth,
    sourceTransactions: Transaction[] = transactions,
  ) => {
    const card = cards.find((item) => item.id === cardId);
    if (!card || card.availableMode === "debit") {
      return { committed: 0, available: 0, limit: 0 };
    }

    const committed = Math.max(0, getOpenCardStatementTotal(cardId, fromMonthValue, sourceTransactions, 18));
    return {
      committed,
      available: Number(Math.min(card.creditLimit, card.creditLimit - committed).toFixed(2)),
      limit: card.creditLimit,
    };
  };
  const getCreditLimitErrorForTransactions = (
    candidateTransactions: Transaction[],
    baseTransactions: Transaction[] = transactions,
    fromMonthValue = selectedMonth,
  ) => {
    const affectedCardIds = [
      ...new Set(
        candidateTransactions
          .filter((transaction) => transaction.cardId && transaction.cardMode === "credit")
          .map((transaction) => transaction.cardId as string),
      ),
    ];
    const nextTransactions = [...candidateTransactions, ...baseTransactions];

    for (const cardId of affectedCardIds) {
      const card = cards.find((item) => item.id === cardId);
      if (!card || card.availableMode === "debit") {
        continue;
      }

      const { committed, limit } = getCardAvailableLimit(cardId, fromMonthValue, nextTransactions);
      if (committed > limit + 0.009) {
        return `O limite de ${card.name} seria ultrapassado. Faturas abertas: ${formatCurrency(
          committed,
        )} de ${formatCurrency(limit)}.`;
      }
    }

    return null;
  };
  const cardSummaries = getCardSummaries(cards, transactions, referenceMonthDate).map((card) => {
    const limitSnapshot = getCardAvailableLimit(card.id, selectedMonth);

    return {
      ...card,
      creditUsed: limitSnapshot.committed,
      availableLimit: Math.max(0, limitSnapshot.available),
    };
  });
  const upcomingInstallments = getUpcomingInstallments(
    transactions,
    new Date(`${referenceDate}T12:00:00`),
  );
  const boardColumns = getBoardColumns();
  const planningBoardColumns = boardColumns.filter((column) => column.id !== "bought");
  const planningMonthColumns = Array.from({ length: 4 }, (_, index) => {
    const monthValue = getMonthValueOffset(selectedMonth, index);
    return {
      id: monthValue,
      label: formatMonthLabel(monthValueToDate(monthValue)),
    };
  });
  const planningWeekColumns = Array.from({ length: getWeeksInMonth(selectedMonth) }, (_, index) => ({
    id: `Semana ${index + 1}`,
    label: `Semana ${index + 1}`,
  }));
  const accountsSnapshot = getAccountsSnapshot(transactions, accounts);
  const investmentSnapshot = getInvestmentSnapshot(investments);
  const monthTransactions = getMonthTransactions(transactions, referenceMonthDate);
  const selectedDraftCard = cards.find((card) => card.id === draftTransaction.cardId) ?? cards[0];
  const realizedPlannedPurchaseIds = new Set(
    transactions
      .map((transaction) => transaction.linkedPlannedPurchaseId)
      .filter((value): value is string => Boolean(value)),
  );
  function isPlannedPurchaseRealized(purchase: PlannedPurchase) {
    return purchase.status === "bought" || realizedPlannedPurchaseIds.has(purchase.id);
  }
  const activePlannedPurchases = plannedPurchases.filter(
    (purchase) =>
      purchase.status !== "cancelled" &&
      !isPlannedPurchaseRealized(purchase),
  );
  const reservePurchases = activePlannedPurchases.filter(
    (purchase) => purchase.planningMode === "save_over_time",
  );
  const totalPlannedPurchaseValue = activePlannedPurchases.reduce(
    (sum, purchase) => sum + purchase.estimatedValue,
    0,
  );
  const totalSavedPurchaseValue = activePlannedPurchases.reduce(
    (sum, purchase) => sum + purchase.savedAmount,
    0,
  );
  const totalReserveGap = activePlannedPurchases.reduce(
    (sum, purchase) => sum + Math.max(0, purchase.estimatedValue - purchase.savedAmount),
    0,
  );
  const totalReserveTarget = reservePurchases.reduce((sum, purchase) => sum + purchase.estimatedValue, 0);
  const totalReserveSaved = reservePurchases.reduce((sum, purchase) => sum + purchase.savedAmount, 0);
  const totalReserveRemaining = reservePurchases.reduce(
    (sum, purchase) => sum + Math.max(0, purchase.estimatedValue - purchase.savedAmount),
    0,
  );
  const selectedMonthInvestmentPlan = investments.reduce(
    (sum, investment) => sum + getInvestmentPlannedAmount(investment.id, selectedMonth),
    0,
  );
  const investmentContributionsHistory = investments
    .flatMap((investment) =>
      investment.contributions.map((contribution) => ({
        ...contribution,
        investmentId: investment.id,
        investmentName: investment.name,
      })),
    )
    .sort((left, right) => right.contributionDate.localeCompare(left.contributionDate));
  const planningBoardDisplayColumns =
    planningBoardView === "months"
      ? [
          ...planningMonthColumns.map((column) => ({
            id: column.id,
            label: column.label,
            toneClass: ["border-sky-200 bg-sky-50/70", "border-violet-200 bg-violet-50/70", "border-cyan-200 bg-cyan-50/70", "border-indigo-200 bg-indigo-50/70"][planningMonthColumns.findIndex((item) => item.id === column.id)],
          })),
          { id: "later", label: "Depois", toneClass: "border-slate-200 bg-slate-50/70" },
        ]
      : planningBoardView === "weeks"
        ? [
            ...planningWeekColumns.map((column, index) => ({
              id: column.id,
              label: column.label,
              toneClass: ["border-red-200 bg-red-50/70", "border-orange-200 bg-orange-50/70", "border-amber-200 bg-amber-50/70", "border-yellow-200 bg-yellow-50/70", "border-lime-200 bg-lime-50/70"][index],
            })),
            { id: "later", label: "Depois", toneClass: "border-slate-200 bg-slate-50/70" },
          ]
        : planningBoardColumns.map((column) => ({
            id: column.id,
            label: column.label,
            toneClass: boardColumnClasses[column.id],
          }));
  const planningBoardBuckets = planningBoardDisplayColumns.reduce<Record<string, PlannedPurchase[]>>(
    (accumulator, column) => {
      accumulator[column.id] = [];
      return accumulator;
    },
    {},
  );

  activePlannedPurchases.forEach((purchase) => {
    const scheduleType = getPurchaseScheduleType(purchase);

    if (planningBoardView === "months") {
      if (scheduleType !== "month") {
        return;
      }

      if (purchase.boardColumn === "later" && !purchase.specificMonthTarget) {
        planningBoardBuckets.later.push(purchase);
        return;
      }

      const targetMonth = purchase.targetMonth ?? purchase.desiredDate?.slice(0, 7);
      const bucketId =
        targetMonth && planningBoardDisplayColumns.some((column) => column.id === targetMonth)
          ? targetMonth
          : "later";
      planningBoardBuckets[bucketId].push(purchase);
      return;
    }

    if (planningBoardView === "weeks") {
      if (scheduleType !== "week") {
        return;
      }

      if (purchase.boardColumn === "later") {
        planningBoardBuckets.later.push(purchase);
        return;
      }

      const targetWeek = purchase.targetWeek ?? getWeekOfMonthLabel(purchase.desiredDate);
      const bucketId =
        purchase.targetMonth === selectedMonth &&
        targetWeek &&
        planningBoardDisplayColumns.some((column) => column.id === targetWeek)
          ? targetWeek
          : "later";
      planningBoardBuckets[bucketId].push(purchase);
      return;
    }

    planningBoardBuckets[getDefaultBoardColumnForPurchase(purchase)].push(purchase);
  });

  const paymentMethodData = monthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce<Record<string, number>>((accumulator, transaction) => {
      accumulator[paymentLabels[transaction.paymentMethod]] =
        (accumulator[paymentLabels[transaction.paymentMethod]] ?? 0) + transaction.amount;
      return accumulator;
    }, {});

  const paymentMethodItems = Object.entries(paymentMethodData).map(([label, value], index) => ({
    label,
    value,
    color: ["#1d63cf", "#58a6ff", "#ff8a65", "#22c55e", "#7c3aed"][index % 5],
  }));

  const salaryCalendarMonths = buildRelativeMonths(referenceMonthDate);
  const monthlyGridRows = createMonthlyGridRows();
  const fixedMonthEntries = monthlyGridRows.filter((entry) => (entry.amountByMonth[selectedMonth] ?? 0) > 0);
  const fixedMonthCompletedCount = fixedMonthEntries.filter((entry) =>
    entry.completedMonths.includes(selectedMonth),
  ).length;
  const fixedMonthPlannedIncome = fixedMonthEntries
    .filter((entry) => {
      if (entry.sourceType === "planned_purchase") {
        return false;
      }

       if (entry.sourceType === "card_auto_bill") {
        return false;
      }

      return (fixedEntries.find((item) => item.id === entry.sourceId)?.kind ?? "expense") === "income";
    })
    .reduce((sum, entry) => sum + (entry.amountByMonth[selectedMonth] ?? 0), 0);
  const fixedMonthPlannedExpense = fixedMonthEntries
    .filter((entry) => {
      if (entry.sourceType === "card_auto_bill") {
        return true;
      }

      if (entry.sourceType === "planned_purchase") {
        return true;
      }

      return (fixedEntries.find((item) => item.id === entry.sourceId)?.kind ?? "expense") === "expense";
    })
    .reduce((sum, entry) => sum + (entry.amountByMonth[selectedMonth] ?? 0), 0);

  const selectedCardDetail = cards.find((card) => card.id === selectedCardDetailId) ?? null;
  const selectedCardStatementMonths = selectedCardDetail
    ? Array.from(
        new Set(
          [
            getMonthValueOffset(selectedCardStatementMonth, -1),
            selectedCardStatementMonth,
            getMonthValueOffset(selectedCardStatementMonth, 1),
            getMonthValueOffset(selectedCardStatementMonth, 2),
            getMonthValueOffset(selectedCardStatementMonth, 3),
            ...transactions
              .filter(
                (transaction) =>
                  transaction.cardId === selectedCardDetail.id && transaction.cardMode === "credit",
              )
              .map((transaction) =>
                getCardStatementMonthForTransaction(selectedCardDetail, transaction),
              ),
            ...bills
              .filter(
                (bill) =>
                  isCreditLinkedBill(bill) &&
                  bill.plannedCardId === selectedCardDetail.id,
              )
              .map((bill) => getCardStatementMonthForBill(selectedCardDetail, bill)),
          ],
        ),
      ).sort((left, right) => left.localeCompare(right))
    : [];
  const selectedCardStatementTransactions = selectedCardDetail
    ? transactions
        .filter(
          (transaction) =>
            transaction.cardId === selectedCardDetail.id &&
            transaction.cardMode === "credit" &&
            getCardStatementMonthForTransaction(selectedCardDetail, transaction) === selectedCardStatementMonth,
        )
        .sort((left, right) => left.date.localeCompare(right.date))
    : [];
  const selectedCardStatementItems = selectedCardDetail
    ? getCardStatementGridItems(selectedCardDetail.id, selectedCardStatementMonth)
    : [];
  const selectedCardStatementBillItems = selectedCardStatementItems.filter((item) => item.sourceType === "bill");
  const selectedCardStatementInstallments = selectedCardStatementTransactions.filter(
    (transaction) => (transaction.installmentTotal ?? 1) > 1,
  );
  const selectedCardStatementTotal = selectedCardStatementItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const selectedCardLimitSnapshot = selectedCardDetail
    ? getCardAvailableLimit(selectedCardDetail.id, selectedCardStatementMonth)
    : { committed: 0, available: 0, limit: 0 };
  const selectedCardAvailableLimit = selectedCardDetail
    ? Math.max(0, selectedCardLimitSnapshot.available)
    : 0;
  const selectedCardStatementAutoBill = selectedCardDetail
    ? activeAutoCardBills.find(
        (item) =>
          item.cardId === selectedCardDetail.id &&
          item.statementMonth === selectedCardStatementMonth,
      )
    : undefined;
  const selectedCardFixedItems = selectedCardDetail
    ? activeFixedEntries.filter(
        (entry) =>
          entry.paymentMethod === "credit_card" &&
          entry.cardId === selectedCardDetail.id &&
          (entry.amountByMonth[selectedCardStatementMonth] ?? 0) > 0,
      )
    : [];
  const selectedCardStatementDueLabel = selectedCardStatementAutoBill
    ? formatShortDate(selectedCardStatementAutoBill.bill.dueDate)
    : null;
  const headerFocusItems = [
    ...alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      detail: alert.detail,
      tone: alert.tone,
    })),
    {
      id: "weekly-balance",
      title: "Saldo da semana",
      detail: formatCurrency(weeklySummary.balance),
      tone: weeklySummary.balance >= 0 ? "info" : "danger",
    },
    {
      id: "weekly-commitments",
      title: "Compromissos da semana",
      detail: formatCurrency(weeklySummary.commitments),
      tone: "warn",
    },
  ].slice(0, 6);

  const filteredTransactions = getMonthTransactions(transactions, referenceMonthDate)
    .filter((transaction) =>
      transaction.title.toLowerCase().includes(deferredSearch.toLowerCase().trim()),
    )
    .filter((transaction) =>
      transactionTypeFilter === "all" ? true : transaction.type === transactionTypeFilter,
    )
    .filter((transaction) =>
      paymentFilter === "all" ? true : transaction.paymentMethod === paymentFilter,
    )
    .sort((left, right) => right.date.localeCompare(left.date));

  const buildFixedEntryFromBillGroup = useCallback((groupBills: Bill[], existingEntry?: FixedFlowEntry): FixedFlowEntry => {
    const sortedBills = [...groupBills].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
    const primaryBill = sortedBills[0];
    const amountByMonth = existingEntry
      ? { ...existingEntry.amountByMonth }
      : Object.fromEntries(salaryCalendarMonths.map((monthItem) => [monthItem.monthValue, 0]));

    sortedBills.forEach((bill) => {
      amountByMonth[bill.dueDate.slice(0, 7)] = bill.amount;
    });

    return {
      id: existingEntry?.id ?? `fixed-bill-group-${primaryBill.recurringGroupId ?? primaryBill.id}`,
      section: "Contas",
      title: primaryBill.title,
      kind: "expense",
      categoryId: primaryBill.categoryId,
      categoryName: primaryBill.categoryName,
      amountByMonth,
      completedMonths: sortedBills
        .filter((bill) => bill.status === "paid")
        .map((bill) => bill.dueDate.slice(0, 7)),
      paymentMethod: mapBillToFixedPaymentMethod(primaryBill),
      accountId: existingEntry?.accountId ?? settings.defaultAccountId,
      cardId: primaryBill.plannedCardId,
      cardMode: primaryBill.plannedCardMode,
      linkedBillGroupId: primaryBill.recurringGroupId ?? primaryBill.id,
      notes: primaryBill.notes,
    };
  }, [salaryCalendarMonths, settings.defaultAccountId]);

  const reconcileFixedEntriesWithBills = useCallback((currentEntries: FixedFlowEntry[]) => {
    const recurringGroups = Array.from(
      bills.reduce((groups, bill) => {
        if (bill.archivedAt || !bill.isRecurring || !bill.recurringGroupId) {
          return groups;
        }

        const currentGroup = groups.get(bill.recurringGroupId) ?? [];
        currentGroup.push(bill);
        groups.set(bill.recurringGroupId, currentGroup);
        return groups;
      }, new Map<string, Bill[]>()),
    );

    if (!recurringGroups.length) {
      return currentEntries;
    }

    const nextEntries = [...currentEntries];

    recurringGroups.forEach(([groupId, groupBills]) => {
      const primaryBill = groupBills[0];
      const existingIndex = nextEntries.findIndex(
        (entry) =>
          entry.linkedBillGroupId === groupId ||
          (normalizeFixedSection(entry.section) === "Contas" &&
            entry.title === primaryBill.title &&
            entry.categoryId === primaryBill.categoryId),
      );
      const existingEntry = existingIndex >= 0 ? nextEntries[existingIndex] : undefined;
      const syncedEntry = buildFixedEntryFromBillGroup(groupBills, existingEntry);

      if (existingIndex >= 0) {
        nextEntries[existingIndex] = syncedEntry;
      } else {
        nextEntries.unshift(syncedEntry);
      }
    });

    return JSON.stringify(nextEntries) === JSON.stringify(currentEntries) ? currentEntries : nextEntries;
  }, [bills, buildFixedEntryFromBillGroup]);

  useEffect(() => {
    if (!hasLoadedPersistedState) {
      return;
    }

    setFixedEntries((current) => reconcileFixedEntriesWithBills(current));
  }, [hasLoadedPersistedState, reconcileFixedEntriesWithBills]);

  useEffect(() => {
    if (!hasLoadedPersistedState) {
      return;
    }

    setFixedEntries((currentEntries) => {
      const category =
        categories.find((item) => item.id === "cat-invest") ??
        categories.find((item) => item.name === "Investimentos") ??
        categories.find((item) => item.type === "expense") ??
        categories[0];
      const nextEntries = [...currentEntries];

      investments.forEach((investment) => {
        const existingIndex = nextEntries.findIndex(
          (entry) =>
            entry.linkedInvestmentId === investment.id ||
            (entry.categoryId === (category?.id ?? "cat-invest") &&
              entry.title === `Aporte ${investment.name}`),
        );
        const existingEntry = existingIndex >= 0 ? nextEntries[existingIndex] : undefined;
        const previousAmounts =
          existingEntry?.amountByMonth ??
          Object.fromEntries(salaryCalendarMonths.map((monthItem) => [monthItem.monthValue, 0]));
        const nextAmountByMonth = { ...previousAmounts };
        const hasExplicitMonthlyPlan = Boolean(
          investment.plannedAmountByMonth && Object.keys(investment.plannedAmountByMonth).length,
        );

        salaryCalendarMonths.forEach((monthItem) => {
          const isManualOverride = existingEntry?.manualAmountMonths?.includes(monthItem.monthValue);
          nextAmountByMonth[monthItem.monthValue] = hasExplicitMonthlyPlan
            ? investment.plannedAmountByMonth?.[monthItem.monthValue] ?? 0
            : isManualOverride
              ? previousAmounts[monthItem.monthValue] ?? 0
              : investment.monthlyTarget;
        });

        const contributionByMonth = investment.contributions.reduce<Record<string, number>>(
          (accumulator, contribution) => {
            const contributionMonth = contribution.monthValue ?? contribution.contributionDate.slice(0, 7);
            accumulator[contributionMonth] = (accumulator[contributionMonth] ?? 0) + contribution.amount;
            return accumulator;
          },
          {},
        );

        const completedMonths = Object.entries(contributionByMonth)
          .filter(([monthValue, total]) => total >= (nextAmountByMonth[monthValue] ?? 0) && total > 0)
          .map(([monthValue]) => monthValue);

        const syncedEntry: FixedFlowEntry = {
          id: existingEntry?.id ?? `fixed-investment-${investment.id}`,
          section: "Contas",
          title: `Aporte ${investment.name}`,
          kind: "expense",
          categoryId: category?.id ?? "cat-invest",
          categoryName: category?.name ?? "Investimentos",
          amountByMonth: nextAmountByMonth,
          completedMonths,
          paymentMethod: investment.paymentMethod ?? existingEntry?.paymentMethod ?? "pix",
          accountId: investment.accountId ?? existingEntry?.accountId ?? settings.defaultAccountId,
          cardId: investment.cardId ?? existingEntry?.cardId,
          cardMode: investment.cardMode ?? existingEntry?.cardMode,
          linkedBillGroupId: undefined,
          linkedInvestmentId: investment.id,
          syncCardLimit: false,
          manualAmountMonths: [
            ...new Set([
              ...(existingEntry?.manualAmountMonths ?? []),
              ...Object.keys(investment.plannedAmountByMonth ?? {}),
            ]),
          ],
          notes: investment.notes || investment.objective || undefined,
        };

        if (existingIndex >= 0) {
          nextEntries[existingIndex] = syncedEntry;
        } else {
          nextEntries.push(syncedEntry);
        }
      });

      const investmentIds = new Set(investments.map((investment) => investment.id));
      const filteredEntries = nextEntries.filter(
        (entry) => !entry.linkedInvestmentId || investmentIds.has(entry.linkedInvestmentId),
      );

      return JSON.stringify(filteredEntries) === JSON.stringify(currentEntries)
        ? currentEntries
        : filteredEntries;
    });
  }, [hasLoadedPersistedState, investments, categories, salaryCalendarMonths, settings.defaultAccountId]);

  const buildFixedEntryFromDebt = useCallback((debt: Debt, existingEntry?: FixedFlowEntry): FixedFlowEntry | null => {
    const fallbackDebtCategory =
      categories.find((item) => item.id === defaultBillCategoryId) ??
      categories.find((item) => item.type === "expense") ??
      categories[0];
    const debtCategory =
      categories.find((item) => item.id === existingEntry?.categoryId) ??
      fallbackDebtCategory;

    if (!debtCategory || debt.remainingAmount <= 0 || debt.status === "settled") {
      return null;
    }

    const startMonth = debt.nextDueDate.slice(0, 7) || selectedMonth;
    const installmentAmount = Math.max(0.01, debt.installmentAmount || debt.remainingAmount);
    const monthCount = Math.max(
      1,
      (debt.totalInstallments || 0) - (debt.paidInstallments || 0) ||
        Math.ceil(debt.remainingAmount / installmentAmount),
    );
    const { schedule } = buildDebtPlanSchedule(
      startMonth,
      debt.remainingAmount,
      monthCount,
      installmentAmount,
    );
    const manualMonths = new Set(existingEntry?.manualAmountMonths ?? []);
    const knownMonths = new Set([
      ...salaryCalendarMonths.map((monthItem) => monthItem.monthValue),
      ...Object.keys(existingEntry?.amountByMonth ?? {}),
      ...schedule.map((item) => item.monthValue),
    ]);
    const amountByMonth = Object.fromEntries(
      [...knownMonths].map((monthValue) => [monthValue, 0]),
    ) as Record<string, number>;

    schedule.forEach((item) => {
      amountByMonth[item.monthValue] = item.amount;
    });
    manualMonths.forEach((monthValue) => {
      if (Object.prototype.hasOwnProperty.call(existingEntry?.amountByMonth ?? {}, monthValue)) {
        amountByMonth[monthValue] = existingEntry?.amountByMonth[monthValue] ?? 0;
      }
    });

    const paymentDetails = getPlannedPaymentDetails(
      debt.plannedPaymentMethod,
      debt.plannedCardId,
      "credit",
      cards,
    );

    return {
      id: existingEntry?.id ?? `fixed-debt-${debt.id}`,
      section: "Contas",
      title: debt.name,
      kind: "expense",
      categoryId: debtCategory.id,
      categoryName: debtCategory.name,
      amountByMonth,
      completedMonths: (existingEntry?.completedMonths ?? []).filter(
        (monthValue) => (amountByMonth[monthValue] ?? 0) > 0,
      ),
      paymentMethod: paymentDetails.transactionMethod,
      accountId: existingEntry?.accountId ?? settings.defaultAccountId,
      cardId: paymentDetails.cardId,
      cardMode: paymentDetails.cardMode,
      linkedBillGroupId: undefined,
      linkedDebtId: debt.id,
      linkedInvestmentId: undefined,
      syncCardLimit: false,
      manualAmountMonths: existingEntry?.manualAmountMonths ?? [],
      notes: existingEntry?.notes ?? debt.description,
    };
  }, [cards, categories, defaultBillCategoryId, salaryCalendarMonths, selectedMonth, settings.defaultAccountId]);

  useEffect(() => {
    if (!hasLoadedPersistedState) {
      return;
    }

    setFixedEntries((currentEntries) => {
      const nextEntries = currentEntries.map((entry) => {
        if (!entry.linkedDebtId) {
          return entry;
        }

        const linkedDebt = debts.find((debt) => debt.id === entry.linkedDebtId);
        if (!linkedDebt) {
          return entry;
        }

        const syncedEntry = buildFixedEntryFromDebt(linkedDebt, entry);

        return syncedEntry ?? entry;
      });

      const debtIds = new Set(debts.filter((debt) => !debt.archivedAt).map((debt) => debt.id));
      const filteredEntries = nextEntries.filter(
        (entry) => !entry.linkedDebtId || debtIds.has(entry.linkedDebtId),
      );
      const existingDebtEntryIds = new Set(
        filteredEntries
          .map((entry) => entry.linkedDebtId)
          .filter((value): value is string => Boolean(value)),
      );
      const missingDebtEntries = debts
        .filter(
          (debt) =>
            !debt.archivedAt &&
            debt.status !== "settled" &&
            debt.remainingAmount > 0 &&
            !existingDebtEntryIds.has(debt.id),
        )
        .map((debt) => buildFixedEntryFromDebt(debt))
        .filter((entry): entry is FixedFlowEntry => Boolean(entry));
      const syncedEntries = [...missingDebtEntries, ...filteredEntries];

      return JSON.stringify(syncedEntries) === JSON.stringify(currentEntries)
        ? currentEntries
        : syncedEntries;
    });
  }, [hasLoadedPersistedState, debts, buildFixedEntryFromDebt]);

  function rebuildTransactionsForBills(currentTransactions: Transaction[], nextBillsGroup: Bill[]) {
    const billIds = new Set(nextBillsGroup.map((bill) => bill.id));
    const cleanedTransactions = currentTransactions.filter(
      (transaction) => !transaction.sourceBillId || !billIds.has(transaction.sourceBillId),
    );
    const regeneratedTransactions = nextBillsGroup.flatMap((bill) => {
      if (isCreditLinkedBill(bill)) {
        return buildLinkedTransactionsFromBill(bill);
      }

      return bill.status === "paid" ? buildSettlementTransactionsFromBill(bill) : [];
    });

    return [...regeneratedTransactions, ...cleanedTransactions].sort((left, right) =>
      right.date.localeCompare(left.date),
    );
  }

  function buildPurchaseDraft(purchase?: PlannedPurchase): DraftPurchase {
    if (!purchase) {
      return {
        ...initialDraftPurchase,
        desiredDate: `${selectedMonth}-28`,
      };
    }

    return {
      name: purchase.name,
      description: purchase.description ?? "",
      estimatedValue: String(purchase.estimatedValue),
      savedAmount: String(purchase.savedAmount),
      suggestedPeriodAmount: String(purchase.suggestedPeriodAmount),
      priority: purchase.priority,
      scheduleType: getPurchaseScheduleType(purchase),
      specificMonthTarget: purchase.specificMonthTarget ?? false,
      boardColumn: purchase.boardColumn === "bought" ? "this_month" : purchase.boardColumn,
      desiredDate: purchase.desiredDate ?? `${selectedMonth}-28`,
      planningMode: purchase.planningMode ?? "save_over_time",
      paymentOption: purchase.plannedPaymentMethod ?? "pix",
      cardId: purchase.plannedCardId ?? "card-nubank",
      cardMode: purchase.plannedCardMode ?? "credit",
      installments: purchase.plannedInstallments ?? 1,
    };
  }

  function getInvestmentCategory() {
    return (
      categories.find((category) => category.id === "cat-invest") ??
      categories.find((category) => category.name === "Investimentos") ??
      categories.find((category) => category.type === "expense") ??
      categories[0]
    );
  }

  function buildInvestmentDraft(investment?: Investment): DraftInvestment {
    if (!investment) {
      return {
        ...initialDraftInvestment,
        monthlyTarget: String(settings.monthlyInvestmentTarget || 0),
        accountId: settings.defaultAccountId,
        cardId: settings.defaultCardId,
      };
    }

    return {
      name: investment.name,
      type: investment.type,
      objective: investment.objective ?? "",
      totalGrossInvested: String(investment.totalGrossInvested),
      currentManualValue: String(investment.currentManualValue ?? investment.totalGrossInvested),
      monthlyTarget: String(investment.monthlyTarget),
      paymentMethod: investment.paymentMethod ?? "pix",
      accountId: investment.accountId ?? settings.defaultAccountId,
      cardId: investment.cardId ?? settings.defaultCardId,
      cardMode: investment.cardMode ?? "credit",
      notes: investment.notes ?? "",
    };
  }

  function buildInvestmentContributionDraft(investment?: Investment): DraftInvestmentContribution {
    return {
      ...initialDraftInvestmentContribution,
      investmentId: investment?.id ?? investments[0]?.id ?? "",
      contributionDate: `${selectedMonth}-12`,
      paymentMethod: investment?.paymentMethod ?? "pix",
      accountId: investment?.accountId ?? settings.defaultAccountId,
      cardId: investment?.cardId ?? settings.defaultCardId,
      cardMode: investment?.cardMode ?? "credit",
    };
  }

  function getLinkedInvestmentEntry(investmentId: string) {
    return fixedEntries.find((entry) => entry.linkedInvestmentId === investmentId);
  }

  function getInvestmentPlannedAmount(investmentId: string, monthValue: string) {
    return getLinkedInvestmentEntry(investmentId)?.amountByMonth[monthValue] ?? 0;
  }

  function updateHomeLocation(
    nextTab: HomeTab,
    options?: {
      planning?: Exclude<PlanningScreen, "board">;
      accounts?: AccountsSection;
      cardId?: string | null;
      statementMonth?: string | null;
    },
  ) {
    const params = new URLSearchParams();
    params.set("tab", nextTab);

    if (nextTab === "planning") {
      params.set("planning", options?.planning ?? (planningScreen === "board" ? "purchases" : planningScreen));
    }

    if (nextTab === "accounts") {
      params.set("accounts", options?.accounts ?? accountsSection);
    }

    if (nextTab === "cards") {
      if (options?.cardId) {
        params.set("card", options.cardId);
      }
      if (options?.statementMonth) {
        params.set("statementMonth", options.statementMonth);
      }
    }

    const nextUrl = params.toString() ? `/?${params.toString()}` : "/";

    setHomeTab(nextTab);
    if (nextTab === "planning") {
      setPlanningScreen(options?.planning ?? (planningScreen === "board" ? "purchases" : planningScreen));
    }
    if (nextTab === "accounts") {
      setAccountsSection(options?.accounts ?? accountsSection);
    }
    if (nextTab === "cards") {
      setSelectedCardDetailId(options?.cardId ?? null);
      if (options?.statementMonth) {
        setSelectedCardStatementMonth(options.statementMonth);
      }
    } else {
      setSelectedCardDetailId(null);
    }

    if (pathname === "/" && nextUrl === `/${searchParams.toString() ? `?${searchParams.toString()}` : ""}`) {
      return;
    }

    router.push(nextUrl);
  }

  function handleNavigate(viewId: ViewId) {
    setIsAlertsPanelOpen(false);
    if (viewId === "home") {
      updateHomeLocation("grid");
      return;
    }

    setSelectedCardDetailId(null);
    if (viewId !== "settings") {
      setPlanningScreen("purchases");
      setAccountsSection("overview");
    }
    router.push(viewPathMap[viewId]);
  }

  function handleMonthChange(value: string) {
    setSelectedMonth(value);
    setIsAlertsPanelOpen(false);
    setMonthlyPlansByMonth((current) => ({
      ...current,
      [value]: current[value] ?? createMonthlyPlanForMonth(value),
    }));
    setDraftTransaction((current) => ({
      ...current,
      date: `${value}-14`,
    }));
  }

  function getOperationDefaultCategoryId(operationKind: DraftTransaction["operationKind"], type: Transaction["type"]) {
    if (type === "income") {
      return categories.find((category) => category.type === "income")?.id ?? "cat-salary";
    }

    if (operationKind === "investment") {
      return categories.find((category) => category.id === "cat-invest")?.id ?? "cat-invest";
    }

    if (operationKind === "debt_payment") {
      return (
        categories.find((category) => category.type === "expense" && !isHiddenUiCategoryId(category.id))?.id ??
        defaultBillCategoryId
      );
    }

    return (
      categories.find((category) => category.type === "expense" && !isHiddenUiCategoryId(category.id))?.id ??
      "cat-market"
    );
  }

  function handleAddTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDraftTransactionError(null);

    const amount = Number(draftTransaction.amount.replace(",", "."));
    if (!amount || !draftTransaction.title.trim()) {
      return;
    }

    const category = categories.find((item) => item.id === draftTransaction.categoryId);
    if (!category) {
      return;
    }

    const editingTransaction = editingTransactionId
      ? transactions.find((transaction) => transaction.id === editingTransactionId)
      : undefined;
    const nextTransactions: Transaction[] = createTransactionsFromDraft(draftTransaction, amount, category.name).map(
      (transaction) => ({
        ...transaction,
        sourceBillId:
          editingTransaction?.sourceBillId ??
          (transaction as Partial<Transaction>).sourceBillId,
      }),
    );
    const editingGroupId =
      editingTransactionScope === "group" ? editingTransaction?.installmentGroupId : undefined;
    const baseTransactions = editingTransactionId
      ? transactions.filter((transaction) =>
          editingGroupId
            ? transaction.installmentGroupId !== editingGroupId
            : transaction.id !== editingTransactionId,
        )
      : transactions;
    const creditLimitError = getCreditLimitErrorForTransactions(nextTransactions, baseTransactions, selectedMonth);

    if (creditLimitError) {
      setDraftTransactionError(creditLimitError);
      return;
    }

    setTransactions(() =>
      [...nextTransactions, ...baseTransactions].sort((left, right) => right.date.localeCompare(left.date)),
    );

    if (!editingTransactionId && draftTransaction.type === "expense") {
      const firstTransaction = nextTransactions[0];
      const paymentDetails = {
        paymentMethod: firstTransaction.paymentMethod,
        accountId: firstTransaction.accountId,
        cardId: firstTransaction.cardId,
        cardMode: firstTransaction.cardMode,
      };

      if (draftTransaction.operationKind === "basic_bill" || draftTransaction.operationKind === "recurring_bill") {
        const isRecurring = draftTransaction.operationKind === "recurring_bill";
        const billId = crypto.randomUUID();
        const recurringGroupId = isRecurring ? `recurring-${billId}` : undefined;
        const baseBill: Bill = {
          id: billId,
          title: draftTransaction.title.trim(),
          amount,
          categoryId: category.id,
          categoryName: category.name,
          dueDate: draftTransaction.date,
          priority: "Alta",
          status: "paid",
          isRecurring,
          recurringDay: isRecurring ? Number(draftTransaction.date.slice(8, 10)) : undefined,
          recurringGroupId,
          ...mapFixedPaymentMethodToBillPlan(
            paymentDetails.paymentMethod,
            paymentDetails.cardId,
            paymentDetails.cardMode,
          ),
          installments:
            paymentDetails.paymentMethod === "credit_card" && draftTransaction.installments > 1
              ? draftTransaction.installments
              : undefined,
          notes: draftTransaction.description.trim() || undefined,
        };
        const billsToAdd = isRecurring
          ? salaryCalendarMonths.map((monthItem) => ({
              ...baseBill,
              id:
                monthItem.monthValue === draftTransaction.date.slice(0, 7)
                  ? baseBill.id
                  : `${baseBill.id}-${monthItem.monthValue}`,
              dueDate: alignDateToDay(
                `${monthItem.monthValue}-01`,
                Number(draftTransaction.date.slice(8, 10)),
              ),
              status:
                monthItem.monthValue === draftTransaction.date.slice(0, 7)
                  ? ("paid" as const)
                  : ("pending" as const),
            }))
          : [baseBill];
        setBills((current) => [...billsToAdd, ...current].sort((left, right) => left.dueDate.localeCompare(right.dueDate)));
      }

      if (draftTransaction.operationKind === "investment") {
        const investmentId = crypto.randomUUID();
        setInvestments((current) => [
          {
            id: investmentId,
            name: draftTransaction.title.trim(),
            type: "Investimento",
            objective: draftTransaction.description.trim() || undefined,
            totalGrossInvested: amount,
            currentManualValue: amount,
            monthlyTarget: amount,
            paymentMethod: paymentDetails.paymentMethod,
            accountId: paymentDetails.accountId,
            cardId: paymentDetails.cardId,
            cardMode: paymentDetails.cardMode,
            plannedAmountByMonth: { [draftTransaction.date.slice(0, 7)]: amount },
            contributions: [
              {
                id: crypto.randomUUID(),
                contributionDate: draftTransaction.date,
                monthValue: draftTransaction.date.slice(0, 7),
                amount,
                source: "manual",
                linkedTransactionId: firstTransaction.id,
                paymentMethod: paymentDetails.paymentMethod,
                accountId: paymentDetails.accountId,
                cardId: paymentDetails.cardId,
                cardMode: paymentDetails.cardMode,
                notes: draftTransaction.description.trim() || undefined,
              },
            ],
          },
          ...current,
        ]);
      }

      if (draftTransaction.operationKind === "debt_payment") {
        setDebts((current) => {
          const existingDebt = current.find(
            (debt) => debt.name.trim().toLowerCase() === draftTransaction.title.trim().toLowerCase(),
          );

          if (existingDebt) {
            const paidAmount = Number((existingDebt.paidAmount + amount).toFixed(2));
            const remainingAmount = Math.max(0, Number((existingDebt.totalAmount - paidAmount).toFixed(2)));
            return current.map((debt) =>
              debt.id === existingDebt.id
                ? {
                    ...debt,
                    paidAmount,
                    remainingAmount,
                    paidInstallments: Math.min(debt.totalInstallments, debt.paidInstallments + 1),
                    status: remainingAmount <= 0 ? "settled" : debt.status,
                    nextDueDate: addMonthsToDateValue(draftTransaction.date, 1),
                  }
                : debt,
            );
          }

          const debtId = crypto.randomUUID();
          return [
            {
              id: debtId,
              name: draftTransaction.title.trim(),
              description: draftTransaction.description.trim() || undefined,
              totalAmount: amount,
              paidAmount: amount,
              remainingAmount: 0,
              totalInstallments: 1,
              paidInstallments: 1,
              installmentAmount: amount,
              nextDueDate: draftTransaction.date,
              priority: "Alta",
              status: "settled",
              plannedPaymentMethod:
                paymentDetails.paymentMethod === "credit_card" || paymentDetails.paymentMethod === "debit_card"
                  ? "card"
                  : (paymentDetails.paymentMethod as Exclude<PaymentPlanMethod, "card">),
              plannedCardId: paymentDetails.cardId,
              notes: "Criada automaticamente a partir de Transacoes.",
            },
            ...current,
          ];
        });
      }
    }

    setDraftTransaction((current) => ({
      ...current,
      title: "",
      operationKind: current.type === "income" ? "income" : "variable",
      amount: "",
      description: "",
      installments: 1,
      linkedPlannedPurchaseId: "",
    }));
    setEditingTransactionId(null);
    setEditingTransactionScope("single");
    setIsTransactionModalOpen(false);
  }

  function handlePayBill(billId: string) {
    const bill = bills.find((item) => item.id === billId);
    if (!bill) {
      return;
    }

    setBills((current) =>
      current.map((item) => (item.id === billId ? { ...item, status: "paid" } : item)),
    );

    if (isCreditLinkedBill(bill)) {
      setTransactions((current) => {
        const hasLinkedTransactions = current.some((transaction) => transaction.sourceBillId === billId);

        if (!hasLinkedTransactions) {
          return [...buildSettlementTransactionsFromBill(bill), ...current].sort(
            (left, right) => right.date.localeCompare(left.date),
          );
        }

        return current.map((transaction) =>
          transaction.sourceBillId === billId ? { ...transaction, status: "paid" } : transaction,
        );
      });
      return;
    }

    setTransactions((current) => [
      ...buildSettlementTransactionsFromBill(bill),
      ...current,
    ]);
  }

  function handleMovePurchase(purchaseId: string, bucketId: string) {
    setPlannedPurchases((current) =>
      current.map((purchase) =>
        purchase.id === purchaseId
          ? (() => {
              const scheduleType = getPurchaseScheduleType(purchase);

              return {
                ...purchase,
                boardColumn:
                  planningBoardView === "default"
                    ? getPurchaseScheduleType(purchase) === "week"
                      ? bucketId === "this_week" || bucketId === "next_week"
                        ? (bucketId as BoardColumn)
                        : "later"
                      : bucketId === "this_month" || bucketId === "next_month"
                        ? (bucketId as BoardColumn)
                        : "later"
                    : planningBoardView === "months"
                      ? bucketId === "later"
                        ? "later"
                        : bucketId === selectedMonth
                          ? "this_month"
                          : bucketId === getMonthValueOffset(selectedMonth, 1)
                            ? "next_month"
                            : "later"
                      : bucketId === "later"
                        ? "later"
                        : bucketId === "Semana 1"
                          ? "this_week"
                        : bucketId === "Semana 2"
                            ? "next_week"
                            : "later",
                specificMonthTarget:
                  planningBoardView === "months"
                    ? bucketId !== "later"
                    : planningBoardView === "default"
                      ? false
                      : purchase.specificMonthTarget,
                targetMonth:
                  planningBoardView === "months"
                    ? bucketId === "later"
                      ? purchase.targetMonth
                      : bucketId
                    : planningBoardView === "weeks"
                      ? bucketId === "later"
                        ? purchase.targetMonth
                        : selectedMonth
                      : scheduleType === "month" && bucketId !== "later"
                        ? bucketId === "this_month"
                          ? selectedMonth
                          : bucketId === "next_month"
                            ? getMonthValueOffset(selectedMonth, 1)
                            : purchase.targetMonth
                        : scheduleType === "week" && bucketId !== "later"
                          ? selectedMonth
                          : purchase.targetMonth,
                targetWeek:
                  planningBoardView === "weeks"
                    ? bucketId === "later"
                      ? purchase.targetWeek
                      : bucketId
                    : planningBoardView === "months"
                      ? undefined
                      : scheduleType === "week" && bucketId !== "later"
                        ? bucketId === "this_week"
                          ? "Semana 1"
                          : bucketId === "next_week"
                            ? "Semana 2"
                            : purchase.targetWeek
                        : scheduleType === "month"
                          ? undefined
                          : purchase.targetWeek,
              };
            })()
          : purchase,
      ),
    );
  }

  function getPurchasePlanningLabel(purchase: PlannedPurchase) {
    if (purchase.planningMode === "card_parcelado") {
      const cardName = cards.find((card) => card.id === purchase.plannedCardId)?.name ?? "Cartao";
      const installments = Math.max(2, purchase.plannedInstallments ?? 2);
      return `${cardName} parcelado em ${installments}x`;
    }

    if (purchase.planningMode === "buy_in_target_period") {
      return purchase.desiredDate
        ? `Compra a vista para ${formatShortDate(purchase.desiredDate)}`
        : "Compra a vista planejada";
    }

    return purchase.suggestedPeriodAmount
      ? `Guardar ${formatCurrency(purchase.suggestedPeriodAmount)}/periodo`
      : "Guardar por periodo";
  }

  function getPurchasePlacementLabel(purchase: PlannedPurchase) {
    if (purchase.boardColumn === "later" && !purchase.specificMonthTarget) {
      return "Depois";
    }

    if (purchase.targetWeek) {
      return purchase.targetMonth
        ? `${purchase.targetWeek} de ${formatMonthLabel(monthValueToDate(purchase.targetMonth))}`
        : purchase.targetWeek;
    }

    if (purchase.targetMonth) {
      return formatMonthLabel(monthValueToDate(purchase.targetMonth));
    }

    return planningBoardColumns.find((column) => column.id === purchase.boardColumn)?.label ?? "Planejamento";
  }

  function openPurchaseModal(purchase?: PlannedPurchase, options?: PurchaseModalOptions) {
    setEditingPurchaseId(purchase?.id ?? null);
    setDraftPurchase({
      ...buildPurchaseDraft(purchase),
      ...(options?.planningMode ? { planningMode: options.planningMode } : {}),
      ...(options?.paymentOption ? { paymentOption: options.paymentOption } : {}),
      ...(options?.planningMode === "card_parcelado"
        ? {
            planningMode: "card_parcelado",
            paymentOption: "card",
            cardId: settings.defaultCardId,
            cardMode: "credit",
            installments: 2,
          }
        : {}),
    });
    setIsPurchaseModalOpen(true);
  }

  function closePurchaseModal() {
    setIsPurchaseModalOpen(false);
    setEditingPurchaseId(null);
    setDraftPurchase(buildPurchaseDraft());
  }

  function handleSavePurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const estimatedValue = Number(draftPurchase.estimatedValue.replace(",", "."));
    const savedAmount = Number(draftPurchase.savedAmount.replace(",", "."));
    const suggestedPeriodAmount = Number(draftPurchase.suggestedPeriodAmount.replace(",", "."));

    if (!draftPurchase.name.trim()) {
      return;
    }

    const currentPurchase = editingPurchaseId
      ? plannedPurchases.find((purchase) => purchase.id === editingPurchaseId)
      : undefined;
    const isCardPlanning = draftPurchase.planningMode === "card_parcelado";

    const nextPurchase: PlannedPurchase = {
      id: editingPurchaseId ?? crypto.randomUUID(),
      name: draftPurchase.name.trim(),
      description: draftPurchase.description.trim() || undefined,
      estimatedValue: Math.max(0, estimatedValue || 0),
      priority: draftPurchase.priority,
      desiredDate: draftPurchase.desiredDate || undefined,
      targetMonth: draftPurchase.desiredDate ? draftPurchase.desiredDate.slice(0, 7) : undefined,
      targetWeek:
        draftPurchase.scheduleType === "week" ? getWeekOfMonthLabel(draftPurchase.desiredDate) : undefined,
      scheduleType: draftPurchase.scheduleType,
      specificMonthTarget:
        draftPurchase.scheduleType === "month" ? draftPurchase.specificMonthTarget : false,
      boardColumn: draftPurchase.boardColumn,
      savedAmount: Math.max(0, savedAmount),
      suggestedPeriodAmount:
        draftPurchase.planningMode === "save_over_time" ? Math.max(0, suggestedPeriodAmount) : 0,
      plannedAmountByMonth: currentPurchase?.plannedAmountByMonth,
      status: "planned",
      planningMode: draftPurchase.planningMode,
      plannedPaymentMethod: isCardPlanning ? "card" : draftPurchase.paymentOption,
      plannedCardId: isCardPlanning ? draftPurchase.cardId : undefined,
      plannedCardMode: isCardPlanning ? "credit" : undefined,
      plannedInstallments: isCardPlanning ? Math.max(1, draftPurchase.installments) : undefined,
      notes: undefined,
    };

    setPlannedPurchases((current) => {
      if (editingPurchaseId) {
        return current.map((purchase) =>
          purchase.id === editingPurchaseId ? { ...purchase, ...nextPurchase } : purchase,
        );
      }

      return [...current, nextPurchase];
    });

    closePurchaseModal();
  }

  function handleDeletePurchase(purchaseId: string) {
    setPlannedPurchases((current) => current.filter((purchase) => purchase.id !== purchaseId));
    if (editingPurchaseId === purchaseId) {
      closePurchaseModal();
    }
  }

  function openCategoryModal(category?: Category, defaults?: Partial<DraftCategory>) {
    setEditingCategoryId(category?.id ?? null);
    setDraftCategory(
      category
        ? {
            name: category.name,
            type: category.type,
            color: category.color,
            parentId: category.parentId ?? "",
          }
        : {
            ...initialDraftCategory,
            ...defaults,
          },
    );
    setIsCategoryModalOpen(true);
  }

  function closeCategoryModal() {
    setEditingCategoryId(null);
    setDraftCategory(initialDraftCategory);
    setIsCategoryModalOpen(false);
    setPendingCategoryImportItemId(null);
    setPendingCategoryMerchantId(null);
  }

  function handleSaveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftCategory.name.trim()) {
      return;
    }

    const nextCategory: Category = {
      id:
        editingCategoryId ??
        `cat-${draftCategory.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")}-${crypto.randomUUID().slice(0, 4)}`,
      name: draftCategory.name.trim(),
      type: draftCategory.type,
      color: draftCategory.color,
      parentId: draftCategory.parentId || undefined,
    };

    setCategories((current) => {
      if (editingCategoryId) {
        return current.map((category) =>
          category.id === editingCategoryId
            ? nextCategory
            : category.parentId === editingCategoryId && category.type !== nextCategory.type
              ? { ...category, type: nextCategory.type }
              : category,
        );
      }

      return [...current, nextCategory];
    });

    setMonthlyPlansByMonth((current) => {
      const nextEntries = Object.entries(current).map(([month, plan]) => {
        const categoryBudgets =
          draftCategory.type === "expense"
            ? editingCategoryId
              ? plan.categoryBudgets.map((budget) =>
                  budget.name === categories.find((item) => item.id === editingCategoryId)?.name
                    ? { ...budget, name: nextCategory.name }
                    : budget,
                )
              : [
                  ...plan.categoryBudgets,
                  {
                    id: crypto.randomUUID(),
                    name: nextCategory.name,
                    kind: "expense",
                    planned: 0,
                  },
                ]
            : plan.categoryBudgets;

        return [month, { ...plan, categoryBudgets }];
      });

      return Object.fromEntries(nextEntries);
    });

    closeCategoryModal();

    if (pendingCategoryImportItemId) {
      setImportedStatementItems((current) =>
        current.map((currentItem) =>
          currentItem.id === pendingCategoryImportItemId
            ? { ...currentItem, suggestedCategoryId: nextCategory.id }
            : currentItem,
        ),
      );
      setPendingCategoryImportItemId(null);
    }

    if (pendingCategoryMerchantId) {
      setImportMerchants((current) =>
        current.map((merchant) =>
          merchant.id === pendingCategoryMerchantId
            ? { ...merchant, suggestedCategoryId: nextCategory.id, updatedAt: new Date().toISOString() }
            : merchant,
        ),
      );
      setPendingCategoryMerchantId(null);
    }
  }

  function handleDeleteCategory(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) {
      return;
    }

    const fallbackCategory = categories.find(
      (item) => item.type === category.type && item.id !== categoryId,
    );

    if (!fallbackCategory) {
      return;
    }

    setCategories((current) =>
      current
        .filter((item) => item.id !== categoryId)
        .map((item) => (item.parentId === categoryId ? { ...item, parentId: undefined } : item)),
    );

    setTransactions((current) =>
      current.map((transaction) =>
        transaction.categoryId === categoryId
          ? {
              ...transaction,
              categoryId: fallbackCategory.id,
              categoryName: fallbackCategory.name,
            }
          : transaction,
      ),
    );

    setBills((current) =>
      current.map((bill) =>
        bill.categoryId === categoryId
          ? {
              ...bill,
              categoryId: fallbackCategory.id,
              categoryName: fallbackCategory.name,
            }
          : bill,
      ),
    );

    setMonthlyPlansByMonth((current) =>
      Object.fromEntries(
        Object.entries(current).map(([month, plan]) => [
          month,
          {
            ...plan,
            categoryBudgets: plan.categoryBudgets.filter((budget) => budget.name !== category.name),
          },
        ]),
      ),
    );

    if (draftTransaction.categoryId === categoryId) {
      setDraftTransaction((current) => ({ ...current, categoryId: fallbackCategory.id }));
    }
  }

  function createCardDraft(card?: Card): DraftCard {
    if (!card) {
      return initialDraftCard;
    }

    return {
      name: card.name,
      issuer: card.issuer,
      brand: card.brand,
      lastDigits: card.lastDigits,
      accentColor: card.accentColor,
      availableMode: card.availableMode,
      closingDay: String(card.closingDay),
      dueDay: String(card.dueDay),
      creditLimit: String(card.creditLimit),
      linkedAccountId: card.linkedAccountId ?? settings.defaultAccountId,
    };
  }

  function createBillDraft(bill?: Bill): DraftBill {
    const normalizedDefaultCategoryId = defaultBillCategoryId;

    if (!bill) {
      return {
        ...initialDraftBill,
        categoryId: normalizedDefaultCategoryId,
      };
    }

    const normalizedCategoryId = isHiddenAccountCategoryId(bill.categoryId)
      ? normalizedDefaultCategoryId
      : bill.categoryId;

    return {
      title: bill.title,
      amount: String(bill.amount),
      categoryId: normalizedCategoryId,
      dueDate: bill.dueDate,
      priority: bill.priority,
      status: bill.status,
      isRecurring: bill.isRecurring,
      recurringDay: String(bill.recurringDay ?? Number(bill.dueDate.slice(8, 10))),
      plannedPaymentMethod: bill.plannedPaymentMethod ?? "pix",
      plannedCardId: bill.plannedCardId ?? settings.defaultCardId,
      plannedCardMode: bill.plannedCardMode ?? "credit",
      installments: String(bill.installments ?? 1),
      notes: bill.notes ?? "",
    };
  }

  function getBillCategoryDisplayName(bill: Bill) {
    if (bill.categoryId === "cat-bills") {
      return bill.isRecurring ? "Conta recorrente" : "Vencimento";
    }

    if (bill.categoryId === "cat-debt") {
      return "Divida";
    }

    return bill.categoryName;
  }

  function getDisplayCategoryName(categoryId: string | undefined, categoryName: string | undefined) {
    const category = categories.find((item) => item.id === categoryId);
    if (category) {
      return getCategoryFullName(category, categories);
    }

    if (categoryId === "cat-bills" || categoryName === "Fatura") {
      return "Fatura do cartao";
    }

    if (categoryId === "cat-debt" || categoryName === "Dividas") {
      return "Divida";
    }

    return categoryName ?? "Sem categoria";
  }

  function getDraftBillCardModes() {
    const selectedCard = cards.find((card) => card.id === draftBill.plannedCardId);

    if (!selectedCard) {
      return ["credit"] as CardMode[];
    }

    if (selectedCard.availableMode === "both") {
      return ["credit", "debit"] as CardMode[];
    }

    return [selectedCard.availableMode];
  }

  function shouldShowDraftBillInstallments() {
    return (
      draftBill.plannedPaymentMethod === "card" &&
      draftBill.plannedCardMode === "credit" &&
      !draftBill.isRecurring
    );
  }

  function updateDraftBillRecurring(nextRecurring: boolean) {
    setDraftBill((current) => {
      const nextRecurringDay = Math.max(
        1,
        Math.min(31, Number(current.recurringDay.replace(",", ".")) || Number(current.dueDate.slice(8, 10)) || 1),
      );

      return {
        ...current,
        isRecurring: nextRecurring,
        recurringDay: String(nextRecurringDay),
        dueDate: nextRecurring ? alignDateToDay(current.dueDate, nextRecurringDay) : current.dueDate,
        installments: nextRecurring ? "1" : current.installments,
      };
    });
  }

  function updateDraftBillRecurringDay(nextRecurringDay: string) {
    setDraftBill((current) => {
      const safeDay = Math.max(
        1,
        Math.min(31, Number(nextRecurringDay.replace(",", ".")) || Number(current.dueDate.slice(8, 10)) || 1),
      );

      return {
        ...current,
        recurringDay: nextRecurringDay,
        dueDate: current.isRecurring ? alignDateToDay(current.dueDate, safeDay) : current.dueDate,
      };
    });
  }

  function updateDraftBillPaymentMethod(nextMethod: PaymentPlanMethod) {
    setDraftBill((current) => ({
      ...current,
      plannedPaymentMethod: nextMethod,
      installments:
        nextMethod === "card" && current.plannedCardMode === "credit" && !current.isRecurring
          ? current.installments
          : "1",
    }));
  }

  function updateDraftBillCardSelection(nextCardId: string) {
    setDraftBill((current) => {
      const nextCard = cards.find((card) => card.id === nextCardId);
      const nextMode =
        nextCard?.availableMode === "both"
          ? current.plannedCardMode
          : nextCard?.availableMode ?? "credit";

      return {
        ...current,
        plannedCardId: nextCardId,
        plannedCardMode: nextMode,
        installments: nextMode === "credit" && !current.isRecurring ? current.installments : "1",
      };
    });
  }

  function updateDraftBillCardMode(nextMode: CardMode) {
    setDraftBill((current) => ({
      ...current,
      plannedCardMode: nextMode,
      installments: nextMode === "credit" && !current.isRecurring ? current.installments : "1",
    }));
  }

  function buildLinkedTransactionsFromBill(bill: Bill) {
    if (!isCreditLinkedBill(bill) || !bill.plannedCardId) {
      return [] as Transaction[];
    }

    const installments = Math.max(1, bill.installments ?? 1);
    const installmentAmount = Number((bill.amount / installments).toFixed(2));
    const installmentGroupId = installments > 1 ? crypto.randomUUID() : undefined;
    const status = bill.status === "paid" ? "paid" : "planned";
    const linkedCard = cards.find((card) => card.id === bill.plannedCardId);

    return Array.from({ length: installments }, (_, index) => {
      const transactionDate = addMonthsToDateValue(bill.dueDate, index);

      return {
        id: crypto.randomUUID(),
        title: bill.title,
        type: "expense",
        amount: installmentAmount,
        date: transactionDate,
        categoryId: bill.categoryId,
        categoryName: bill.categoryName,
        paymentMethod: "credit_card",
        status,
        expenseKind: "basic_bill",
        accountId: linkedCard?.linkedAccountId ?? settings.defaultAccountId,
        cardId: bill.plannedCardId,
        cardMode: "credit",
        installmentGroupId,
        installmentNumber: installments > 1 ? index + 1 : undefined,
        installmentTotal: installments > 1 ? installments : undefined,
        sourceBillId: bill.id,
        description: `Conta vinculada ao cartao: ${bill.title}`,
      } satisfies Transaction;
    });
  }

  function buildSettlementTransactionsFromBill(bill: Bill) {
    if (isCreditLinkedBill(bill)) {
      return buildLinkedTransactionsFromBill({ ...bill, status: "paid" });
    }

    const paymentDetails = getPlannedPaymentDetails(
      bill.plannedPaymentMethod,
      bill.plannedCardId,
      bill.plannedCardMode ?? "credit",
      cards,
    );

    return [
      {
        id: crypto.randomUUID(),
        title: `Pagamento ${bill.title}`,
        type: "expense",
        amount: bill.amount,
        date: `${bill.dueDate.slice(0, 7)}-14`,
        categoryId: bill.categoryId,
        categoryName: bill.categoryName,
        paymentMethod: paymentDetails.transactionMethod,
        status: "paid",
        expenseKind: "basic_bill",
        accountId: settings.defaultAccountId,
        cardId: paymentDetails.cardId,
        cardMode: paymentDetails.cardMode,
        sourceBillId: bill.id,
        description: `Gerado automaticamente ao marcar a conta como paga - ${paymentDetails.label}`,
      } satisfies Transaction,
    ];
  }

  function createDebtDraft(debt?: Debt): DraftDebt {
    if (!debt) {
      return initialDraftDebt;
    }

    const linkedEntry = getLinkedDebtEntry(debt.id);
    const scheduledRemainingInstallments = linkedEntry
      ? Object.entries(linkedEntry.amountByMonth).filter(
          ([monthValue, amount]) =>
            monthValue >= selectedMonth &&
            amount > 0 &&
            !linkedEntry.completedMonths.includes(monthValue),
        ).length
      : 0;
    const remainingInstallments = Math.max(
      1,
      scheduledRemainingInstallments ||
        (debt.totalInstallments || 0) - (debt.paidInstallments || 0) ||
        1,
    );

    return {
      name: debt.name,
      description: debt.description ?? "",
      totalAmount: String(debt.totalAmount),
      paidAmount: String(debt.paidAmount),
      installments: String(remainingInstallments),
      installmentAmount: String(debt.installmentAmount),
      nextDueDate: debt.nextDueDate,
      priority: debt.priority,
      status: debt.status,
      plannedPaymentMethod: debt.plannedPaymentMethod ?? "pix",
      plannedCardId: debt.plannedCardId ?? settings.defaultCardId,
    };
  }

  function getLinkedDebtEntry(debtId: string) {
    return fixedEntries.find((entry) => entry.linkedDebtId === debtId);
  }

  function buildDebtPlanDraft(debt: Debt): DraftDebtPlan {
    const linkedEntry = getLinkedDebtEntry(debt.id);
    const unpaidMonths = linkedEntry
      ? Object.entries(linkedEntry.amountByMonth)
          .filter(
            ([monthValue, amount]) =>
              monthValue >= selectedMonth &&
              amount > 0 &&
              !linkedEntry.completedMonths.includes(monthValue),
          )
          .sort(([left], [right]) => left.localeCompare(right))
      : [];

    if (unpaidMonths.length) {
      const values = unpaidMonths.map(([, amount]) => amount);
      const installmentAmount = Number(Math.max(...values).toFixed(2));

      return {
        debtId: debt.id,
        monthCount: String(unpaidMonths.length),
        installmentAmount: String(installmentAmount),
      };
    }

    const safeMonths = Math.max(
      1,
      (debt.totalInstallments || 0) - (debt.paidInstallments || 0) || 1,
    );
    const configuredCap =
      debt.installmentAmount > 0
        ? debt.installmentAmount
        : settings.monthlyDebtPaymentCap > 0
          ? settings.monthlyDebtPaymentCap
          : Number((Math.max(0, debt.remainingAmount) / safeMonths).toFixed(2));
    const safeAmount = Number(Math.max(0.01, configuredCap).toFixed(2));

    return {
      debtId: debt.id,
      monthCount: String(safeMonths),
      installmentAmount: String(safeAmount),
    };
  }

  function applyDebtPlanFromMonthCount(debtId: string, rawMonthCount: string) {
    const debt = debts.find((item) => item.id === debtId);
    if (!debt) {
      return;
    }

    const remainingAmount = Math.max(0, debt.remainingAmount);
    const monthCount = Math.max(1, Number(rawMonthCount.replace(",", ".")) || 1);
    const normalizedAmount = Number((remainingAmount / monthCount).toFixed(2));

    setDraftDebtPlan({
      debtId,
      monthCount: String(monthCount),
      installmentAmount: String(normalizedAmount),
    });
  }

  function applyDebtPlanFromInstallment(debtId: string, rawInstallmentAmount: string) {
    const debt = debts.find((item) => item.id === debtId);
    if (!debt) {
      return;
    }

    const remainingAmount = Math.max(0, debt.remainingAmount);
    const installmentAmount = Math.max(0.01, Number(rawInstallmentAmount.replace(",", ".")) || 0.01);
    const nextMonthCount = Math.max(1, Math.ceil(remainingAmount / installmentAmount));
    const normalizedAmount = Number(installmentAmount.toFixed(2));

    setDraftDebtPlan({
      debtId,
      monthCount: String(nextMonthCount),
      installmentAmount: String(normalizedAmount),
    });
  }

  function createAccountDraft(account?: Account): DraftAccount {
    if (!account) {
      return initialDraftAccount;
    }

    return {
      name: account.name,
      type: account.type,
      initialBalance: String(account.initialBalance),
      currentBalance: String(account.currentBalance),
    };
  }

  function openCardModal(card?: Card) {
    setEditingCardId(card?.id ?? null);
    setDraftCard(createCardDraft(card));
    setIsCardModalOpen(true);
  }

  function closeCardModal() {
    setEditingCardId(null);
    setDraftCard(initialDraftCard);
    setIsCardModalOpen(false);
  }

  function handleIssuerChange(issuer: string) {
    const preset = getBankPreset(issuer);
    setDraftCard((current) => ({
      ...current,
      issuer,
      accentColor: preset.color,
      brand: current.brand || preset.brand,
    }));
  }

  function openBankPresetEditor(preset?: BankPreset) {
    setEditingBankIssuer(preset?.issuer ?? null);
    setDraftBankPreset(
      preset
        ? { issuer: preset.issuer, brand: preset.brand, color: preset.color }
        : initialDraftBankPreset,
    );
  }

  function closeBankPresetEditor() {
    setEditingBankIssuer(null);
    setDraftBankPreset(initialDraftBankPreset);
  }

  function handleSaveBankPreset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftBankPreset.issuer.trim()) {
      return;
    }

    const nextPreset: BankPreset = {
      issuer: draftBankPreset.issuer.trim(),
      brand: draftBankPreset.brand.trim() || "Mastercard",
      color: draftBankPreset.color,
    };

    setSettings((current) => {
      const currentPresets = current.bankPresets?.length ? current.bankPresets : seedBankPresets;
      const exists = editingBankIssuer
        ? currentPresets.some((preset) => preset.issuer === editingBankIssuer)
        : currentPresets.some((preset) => preset.issuer === nextPreset.issuer);
      const nextPresets = exists
        ? currentPresets.map((preset) =>
            preset.issuer === (editingBankIssuer ?? nextPreset.issuer) ? nextPreset : preset,
          )
        : [...currentPresets, nextPreset];

      return {
        ...current,
        bankPresets: nextPresets,
      };
    });

    closeBankPresetEditor();
  }

  function handleSaveCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftCard.name.trim() || !draftCard.lastDigits.trim()) {
      return;
    }

    const nextCard: Card = {
      id:
        editingCardId ??
        `card-${draftCard.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")}`,
      name: draftCard.name.trim(),
      issuer: draftCard.issuer,
      brand: draftCard.brand,
      lastDigits: draftCard.lastDigits.trim(),
      accentColor: draftCard.accentColor,
      availableMode: draftCard.availableMode,
      closingDay: Number(draftCard.closingDay) || 1,
      dueDay: Number(draftCard.dueDay) || 1,
      creditLimit: draftCard.availableMode === "debit" ? 0 : Number(draftCard.creditLimit.replace(",", ".")) || 0,
      linkedAccountId: draftCard.linkedAccountId,
      isActive: true,
    };

    setCards((current) => {
      if (editingCardId) {
        return current.map((card) => (card.id === editingCardId ? nextCard : card));
      }

      return [nextCard, ...current];
    });

    setFixedEntries((current) =>
      current.map((entry) => {
        if (!entry.syncCardLimit || entry.cardId !== nextCard.id) {
          return entry;
        }

        const manualMonths = entry.manualAmountMonths ?? [];
        const nextAmountByMonth = { ...entry.amountByMonth };

        salaryCalendarMonths.forEach((monthItem) => {
          if (manualMonths.includes(monthItem.monthValue)) {
            return;
          }

          nextAmountByMonth[monthItem.monthValue] = nextCard.creditLimit;
        });

        return {
          ...entry,
          amountByMonth: nextAmountByMonth,
        };
      }),
    );

    if (!editingCardId) {
      setSettings((current) => ({ ...current, defaultCardId: nextCard.id }));
    }

    closeCardModal();
  }

  function openCardDetails(cardId: string, statementMonth?: string) {
    const card = cards.find((item) => item.id === cardId);
    const cardTransactions = transactions
      .filter((transaction) => transaction.cardId === cardId && transaction.cardMode === "credit")
      .map((transaction) => getCardStatementMonthForTransaction(card, transaction))
      .sort((left, right) => left.localeCompare(right));

    updateHomeLocation("cards", {
      cardId,
      statementMonth:
        statementMonth ??
        cardTransactions.at(-1) ??
        getSuggestedCardStatementMonth(card, selectedMonth ? `${selectedMonth}-01` : undefined, selectedMonth),
    });
  }

  function closeCardDetails() {
    setSelectedCardDetailId(null);
    setIsCardBalanceModalOpen(false);
    setDraftCardBalanceUsed("");
  }

  function openCardBalanceModal() {
    setDraftCardBalanceUsed(selectedCardStatementTotal ? String(selectedCardStatementTotal) : "");
    setIsCardBalanceModalOpen(true);
  }

  function closeCardBalanceModal() {
    setIsCardBalanceModalOpen(false);
    setDraftCardBalanceUsed("");
    setDraftTransactionError(null);
  }

  function handleDeleteCard(cardId: string) {
    if (!window.confirm("Tem certeza que deseja excluir este cartao? Transacoes vinculadas serao desvinculadas.")) {
      return;
    }

    setCards((current) => current.filter((card) => card.id !== cardId));

    setTransactions((current) =>
      current.map((transaction) =>
        transaction.cardId === cardId ? { ...transaction, cardId: undefined, cardMode: undefined } : transaction,
      ),
    );

    setFixedEntries((current) =>
      current.map((entry) => (entry.cardId === cardId ? { ...entry, cardId: undefined } : entry)),
    );

    if (settings.defaultCardId === cardId) {
      setSettings((current) => ({ ...current, defaultCardId: "" }));
    }

    if (selectedCardDetailId === cardId) {
      closeCardDetails();
    }

    closeCardModal();
  }

  // ============================================================
  // Transaction Groups
  // ============================================================

  function getSelectedGroupableTransactionIds() {
    const transactionIds = new Set(transactions.map((transaction) => transaction.id));
    return selectedTransactionIds.filter((id) => transactionIds.has(id));
  }

  function getSelectedGroupableBillGroupIds() {
    const billGroupIds = new Set(
      bills
        .filter((bill) => isCreditLinkedBill(bill))
        .map((bill) => getBillStatementGroupId(bill)),
    );
    return selectedBillGroupIds.filter((id) => billGroupIds.has(id));
  }

  function getBillByStatementGroupId(groupId: string) {
    return bills.find((bill) => getBillStatementGroupId(bill) === groupId);
  }

  function isSelectableBillStatementItem(item: CardStatementGridItem) {
    return item.sourceType === "bill" && Boolean(getBillByStatementGroupId(item.sourceId));
  }

  function getCardStatementItemGroupId(item: CardStatementGridItem) {
    if (item.sourceType === "transaction") {
      return transactions.find((transaction) => transaction.id === item.sourceId)?.groupId;
    }

    return getBillByStatementGroupId(item.sourceId)?.groupId;
  }

  function getCardStatementItemGroup(item: CardStatementGridItem) {
    const groupId = getCardStatementItemGroupId(item);
    return groupId ? transactionGroups.find((group) => group.id === groupId) : undefined;
  }

  function handleCreateGroup() {
    const groupableTransactionIds = getSelectedGroupableTransactionIds();
    const groupableBillGroupIds = getSelectedGroupableBillGroupIds();

    if (!draftGroupName.trim() || groupableTransactionIds.length + groupableBillGroupIds.length < 2) {
      return;
    }

    const { group, updatedTransactions } = createTransactionGroup(
      draftGroupName,
      groupableTransactionIds,
      transactions,
      transactionGroups,
    );

    setTransactionGroups((current) => [...current, group]);
    setTransactions(updatedTransactions);
    setBills((current) =>
      current.map((bill) =>
        groupableBillGroupIds.includes(getBillStatementGroupId(bill)) ? { ...bill, groupId: group.id } : bill,
      ),
    );
    setSelectedTransactionIds([]);
    setSelectedBillGroupIds([]);
    setDraftGroupName("");
    setIsGroupModalOpen(false);
  }

  function handleDeleteGroup(groupId: string) {
    if (!window.confirm("Tem certeza que deseja excluir este grupo? As transacoes serao mantidas individualmente.")) {
      return;
    }

    const { updatedTransactions, updatedGroups } = deleteTransactionGroup(
      groupId,
      transactions,
      transactionGroups,
    );

    setTransactions(updatedTransactions);
    setBills((current) => current.map((bill) => (bill.groupId === groupId ? { ...bill, groupId: undefined } : bill)));
    setTransactionGroups(updatedGroups);

    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
    }
  }

  function handleRenameGroup() {
    if (!editingGroupId || !draftGroupName.trim()) {
      return;
    }

    setTransactionGroups(renameTransactionGroup(editingGroupId, draftGroupName, transactionGroups));
    setEditingGroupId(null);
    setDraftGroupName("");
  }

  function handleAddToGroup(groupId: string, transactionIds: string[]) {
    setTransactions(addToGroup(groupId, transactionIds, transactions));
  }

  function handleRemoveFromGroup(transactionIds: string[]) {
    setTransactions(removeFromGroup(transactionIds, transactions));
  }

  function openGroupModal() {
    const groupableTransactionIds = getSelectedGroupableTransactionIds();
    const groupableBillGroupIds = getSelectedGroupableBillGroupIds();

    if (groupableTransactionIds.length + groupableBillGroupIds.length < 2) {
      return;
    }

    const firstTransaction = transactions.find((t) => t.id === groupableTransactionIds[0]);
    const firstBill = bills.find((bill) => getBillStatementGroupId(bill) === groupableBillGroupIds[0]);
    setDraftGroupName(firstTransaction?.title ?? firstBill?.title ?? "");
    setIsGroupModalOpen(true);
  }

  function closeGroupModal() {
    setIsGroupModalOpen(false);
    setEditingGroupId(null);
    setDraftGroupName("");
  }

  function toggleTransactionSelection(transactionId: string) {
    setSelectedTransactionIds((current) =>
      current.includes(transactionId)
        ? current.filter((id) => id !== transactionId)
        : [...current, transactionId],
    );
  }

  function toggleBillGroupSelection(billGroupId: string) {
    setSelectedBillGroupIds((current) =>
      current.includes(billGroupId)
        ? current.filter((id) => id !== billGroupId)
        : [...current, billGroupId],
    );
  }

  function clearTransactionSelection() {
    setSelectedTransactionIds([]);
    setSelectedBillGroupIds([]);
  }

  const enrichedGroups = getTransactionGroups(transactionGroups, transactions);
  const selectedGroupableTransactionIds = getSelectedGroupableTransactionIds();
  const selectedGroupableBillGroupIds = getSelectedGroupableBillGroupIds();
  const selectedGroupableCount = selectedGroupableTransactionIds.length + selectedGroupableBillGroupIds.length;

  function handleSaveCardBalance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDraftTransactionError(null);

    if (!selectedCardDetail) {
      return;
    }

    const actualUsed = Number(draftCardBalanceUsed.replace(",", ".")) || 0;
    const difference = Number((actualUsed - selectedCardStatementTotal).toFixed(2));

    if (difference <= 0) {
      closeCardBalanceModal();
      return;
    }

    const adjustmentDay = Math.min(28, selectedCardDetail.closingDay || 28);
    const adjustmentDate = `${selectedCardStatementMonth}-${String(adjustmentDay).padStart(2, "0")}`;

    const adjustmentTransaction: Transaction = {
      id: crypto.randomUUID(),
      title: `Balanco manual ${selectedCardDetail.name}`,
      type: "expense",
      amount: difference,
      date: adjustmentDate,
      categoryId: "cat-bills",
      categoryName: "Fatura do cartao",
      paymentMethod: "credit_card",
      status: "paid",
      expenseKind: "adjustment",
      accountId: selectedCardDetail.linkedAccountId ?? settings.defaultAccountId,
      cardId: selectedCardDetail.id,
      cardMode: "credit",
      description: `Ajuste manual para fechar a fatura de ${formatMonthLabel(
        monthValueToDate(selectedCardStatementMonth),
      )}.`,
    };
    const creditLimitError = getCreditLimitErrorForTransactions(
      [adjustmentTransaction],
      transactions,
      selectedCardStatementMonth,
    );

    if (creditLimitError) {
      setDraftTransactionError(creditLimitError);
      return;
    }

    setTransactions((current) => [adjustmentTransaction, ...current]);

    closeCardBalanceModal();
  }

  function openBillModal(bill?: Bill) {
    setEditingBillId(bill?.id ?? null);
    setDraftBill(createBillDraft(bill));
    setDraftBillError(null);
    setIsBillModalOpen(true);
  }

  function closeNewAccountModal() {
    setIsNewAccountModalOpen(false);
    setNewAccountKind("bill");
    setDraftBill(createBillDraft());
    setDraftBillError(null);
    setDraftDebt(initialDraftDebt);
  }

  function openCommitmentModal(overrides: Partial<DraftCommitment> = {}) {
    const nextKind = overrides.kind ?? initialDraftCommitment.kind;
    const fallbackCategory =
      categories.find((category) => category.type === nextKind && !isHiddenUiCategoryId(category.id)) ??
      categories.find((category) => category.type === nextKind) ??
      categories[0];

    setDraftCommitment({
      ...initialDraftCommitment,
      categoryId: fallbackCategory?.id ?? initialDraftCommitment.categoryId,
      cardId: settings.defaultCardId,
      ...overrides,
    });
    setIsCommitmentModalOpen(true);
  }

  function openCommitmentEditorFromGrid(row: MonthlyGridRow, monthValue = selectedMonth) {
    const amount = row.amountByMonth[monthValue] ?? 0;
    const amountByMonth = Object.fromEntries(
      salaryCalendarMonths.map((monthItem) => [
        monthItem.monthValue,
        row.amountByMonth[monthItem.monthValue] ? String(row.amountByMonth[monthItem.monthValue]) : "",
      ]),
    );
    const baseDraft: DraftCommitment = {
      ...initialDraftCommitment,
      title: row.title,
      kind: row.section === "Ganhos" ? "income" : "expense",
      schedule: "once",
      categoryId: row.categoryId,
      totalAmount: formatMoneyInputValue(amount),
      installmentAmount: formatMoneyInputValue(amount),
      installments: "1",
      startDate: `${monthValue}-01`,
      paymentMethod:
        row.paymentMethod === "credit_card" || row.paymentMethod === "debit_card"
          ? "card"
          : row.paymentMethod === "bank_transfer" || row.paymentMethod === "cash"
            ? row.paymentMethod
            : "pix",
      cardId: row.cardId ?? settings.defaultCardId,
      cardMode: row.cardMode ?? (row.paymentMethod === "debit_card" ? "debit" : "credit"),
      notes: row.notes ?? "",
      amountByMonth,
    };

    if (row.sourceType === "card_auto_bill") {
      const card = cards.find((item) => item.id === row.sourceId);
      setEditingCommitmentTarget({ sourceType: "card_auto_bill", sourceId: row.sourceId, monthValue });
      setDraftCommitment({
        ...baseDraft,
        title: `Fatura ${card?.name ?? "cartao"}`,
        kind: "expense",
        schedule: "once",
        categoryId: defaultBillCategoryId,
        startDate: getCardBillDueDate(row.sourceId, monthValue),
        paymentMethod: "bank_transfer",
        cardId: row.sourceId,
        cardMode: "credit",
        notes: "Estimativa manual da fatura. O valor real sera conciliado pela importacao.",
      });
      setIsCommitmentModalOpen(true);
      return;
    }

    if (row.linkedDebtId) {
      const debt = debts.find((item) => item.id === row.linkedDebtId);
      if (debt) {
        const remainingInstallments = Math.max(
          1,
          Object.entries(row.amountByMonth).filter(
            ([entryMonthValue, entryAmount]) =>
              entryMonthValue >= selectedMonth &&
              entryAmount > 0 &&
              !row.completedMonths.includes(entryMonthValue),
          ).length ||
            (debt.totalInstallments || 0) - (debt.paidInstallments || 0) ||
            1,
        );
        setEditingCommitmentTarget({ sourceType: "debt", sourceId: debt.id, monthValue });
        setDraftCommitment({
          ...baseDraft,
          title: debt.name,
          kind: "expense",
          schedule: "installments",
          categoryId: row.categoryId,
          totalAmount: String(debt.totalAmount),
          installmentAmount: String(debt.installmentAmount),
          installments: String(remainingInstallments),
          startDate: debt.nextDueDate,
          paymentMethod: debt.plannedPaymentMethod ?? "pix",
          cardId: debt.plannedCardId ?? settings.defaultCardId,
          cardMode: "credit",
          notes: debt.description ?? "",
        });
        setIsCommitmentModalOpen(true);
        return;
      }
    }

    if (row.sourceType === "planned_purchase") {
      const purchase = plannedPurchases.find((item) => item.id === row.sourceId);
      if (purchase) {
        openPurchaseModal(purchase);
        return;
      }
    }

    const fixedEntry = fixedEntries.find((item) => item.id === row.sourceId);
    if (fixedEntry) {
      setEditingCommitmentTarget({ sourceType: "fixed", sourceId: fixedEntry.id, monthValue });
      setDraftCommitment({
        ...baseDraft,
        kind: fixedEntry.kind,
        schedule: "recurring",
        categoryId: fixedEntry.categoryId,
        startDate: `${monthValue}-01`,
        notes: fixedEntry.notes ?? "",
      });
      setIsCommitmentModalOpen(true);
      return;
    }

    const bill = bills.find((item) => item.id === row.sourceId);
    if (bill) {
      setEditingCommitmentTarget({ sourceType: "bill", sourceId: bill.id, monthValue });
      setDraftCommitment({
        ...baseDraft,
        title: bill.title,
        kind: "expense",
        schedule: bill.isRecurring ? "recurring" : "once",
        categoryId: bill.categoryId,
        totalAmount: String(bill.amount),
        installmentAmount: String(bill.amount),
        installments: String(bill.installments ?? 1),
        startDate: bill.dueDate,
        paymentMethod: bill.plannedPaymentMethod ?? "pix",
        cardId: bill.plannedCardId ?? settings.defaultCardId,
        cardMode: bill.plannedCardMode ?? "credit",
        notes: bill.notes ?? "",
      });
      setIsCommitmentModalOpen(true);
    }
  }

  function closeCommitmentModal() {
    setDraftCommitment(initialDraftCommitment);
    setEditingCommitmentTarget(null);
    setPendingCommitmentConversion(null);
    setIsCommitmentModalOpen(false);
  }

  function getCardBillDueDate(cardId: string, monthValue: string) {
    const card = cards.find((item) => item.id === cardId);
    const dueDate = monthValueToDate(monthValue);
    dueDate.setDate(Math.min(card?.dueDay ?? 10, 28));
    return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(
      dueDate.getDate(),
    ).padStart(2, "0")}`;
  }

  function getDraftCommitmentMonthlyAmounts() {
    return Object.fromEntries(
      salaryCalendarMonths.map((monthItem) => {
        const parsedAmount = Number(draftCommitment.amountByMonth[monthItem.monthValue]?.replace(",", ".") || 0);
        return [monthItem.monthValue, Math.max(0, Number((parsedAmount || 0).toFixed(2)))];
      }),
    ) as Record<string, number>;
  }

  function getActiveDraftCommitmentMonths() {
    const amounts = getDraftCommitmentMonthlyAmounts();
    return salaryCalendarMonths
      .map((monthItem) => monthItem.monthValue)
      .filter((monthValue) => (amounts[monthValue] ?? 0) > 0);
  }

  function closeBillModal() {
    setEditingBillId(null);
    setDraftBill(createBillDraft());
    setDraftBillError(null);
    setIsBillModalOpen(false);
    setPendingImportCreationItemId(null);
  }

  function persistBillDraft(targetBillId: string | null = editingBillId) {
    setDraftBillError(null);
    const normalizedCategoryId = isHiddenAccountCategoryId(draftBill.categoryId)
      ? defaultBillCategoryId
      : draftBill.categoryId;
    const category = categories.find((item) => item.id === normalizedCategoryId);
    const amount = Number(draftBill.amount.replace(",", ".")) || 0;
    const installments = Math.max(1, Number(draftBill.installments.replace(",", ".")) || 1);
    const recurringDay = Math.max(1, Math.min(31, Number(draftBill.recurringDay.replace(",", ".")) || 1));
    const normalizedDueDate = draftBill.isRecurring
      ? alignDateToDay(draftBill.dueDate, recurringDay)
      : draftBill.dueDate;
    const existingBill = targetBillId ? bills.find((item) => item.id === targetBillId) : undefined;
    const existingGroupId =
      existingBill?.recurringGroupId ?? (existingBill?.isRecurring ? existingBill.id : undefined);
    const existingGroupBills = existingGroupId
      ? bills
          .filter((bill) => (bill.recurringGroupId ?? bill.id) === existingGroupId)
          .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
      : [];

    if (!draftBill.title.trim() || !category || amount <= 0) {
      return null;
    }

    const nextBillBase: Bill = {
      id: targetBillId ?? `bill-${crypto.randomUUID()}`,
      title: draftBill.title.trim(),
      amount,
      categoryId: category.id,
      categoryName: category.name,
      dueDate: normalizedDueDate,
      priority: draftBill.priority,
      isRecurring: draftBill.isRecurring,
      recurringDay: draftBill.isRecurring ? recurringDay : undefined,
      status: draftBill.status,
      plannedPaymentMethod: draftBill.plannedPaymentMethod,
      plannedCardId: draftBill.plannedPaymentMethod === "card" ? draftBill.plannedCardId : undefined,
      plannedCardMode: draftBill.plannedPaymentMethod === "card" ? draftBill.plannedCardMode : undefined,
      installments:
        draftBill.plannedPaymentMethod === "card" &&
        draftBill.plannedCardMode === "credit" &&
        !draftBill.isRecurring
          ? installments
          : 1,
      recurringGroupId: existingGroupId,
      notes: draftBill.notes.trim() || undefined,
    };

    const nextBills = draftBill.isRecurring
      ? (existingGroupBills.length
          ? existingGroupBills.map((bill) => bill.dueDate.slice(0, 7))
          : salaryCalendarMonths.map((monthItem) => monthItem.monthValue)
        ).map((monthValue, index) => ({
          ...nextBillBase,
          id: existingGroupBills[index]?.id ?? (index === 0 ? nextBillBase.id : `bill-${crypto.randomUUID()}`),
          dueDate: alignDateToDay(`${monthValue}-01`, recurringDay),
          status: existingGroupBills[index]?.status ?? nextBillBase.status,
          recurringGroupId: nextBillBase.recurringGroupId ?? nextBillBase.id,
        }))
      : [
          {
            ...nextBillBase,
            recurringGroupId: undefined,
          },
        ];
    const nextLinkedTransactions = nextBills.flatMap((bill) => {
      if (isCreditLinkedBill(bill)) {
        return buildLinkedTransactionsFromBill(bill);
      }

      return bill.status === "paid" ? buildSettlementTransactionsFromBill(bill) : [];
    });
    const nextTransactionBase =
      targetBillId && existingGroupId && existingBill?.isRecurring
        ? (() => {
            const previousBillIds = new Set(existingGroupBills.map((bill) => bill.id));
            return transactions.filter(
              (transaction) => !transaction.sourceBillId || !previousBillIds.has(transaction.sourceBillId),
            );
          })()
        : targetBillId
          ? transactions.filter((transaction) => transaction.sourceBillId !== targetBillId)
          : transactions;
    const creditLimitError = getCreditLimitErrorForTransactions(
      nextLinkedTransactions,
      nextTransactionBase,
      selectedMonth,
    );

    if (creditLimitError) {
      setDraftBillError(creditLimitError);
      return null;
    }

    setBills((current) => {
      if (targetBillId && existingGroupId && existingBill?.isRecurring) {
        return [
          ...nextBills,
          ...current.filter((bill) => (bill.recurringGroupId ?? bill.id) !== existingGroupId),
        ].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
      }

      if (targetBillId) {
        return current.map((bill) => (bill.id === targetBillId ? nextBills[0] : bill));
      }

      return [...nextBills, ...current];
    });

    setTransactions((current) => {
      if (targetBillId && existingGroupId && existingBill?.isRecurring) {
        const previousBillIds = new Set(existingGroupBills.map((bill) => bill.id));
        const cleanedTransactions = current.filter(
          (transaction) => !transaction.sourceBillId || !previousBillIds.has(transaction.sourceBillId),
        );
        const regeneratedTransactions = nextBills.flatMap((bill) => {
          if (isCreditLinkedBill(bill)) {
            return buildLinkedTransactionsFromBill(bill);
          }

          return bill.status === "paid" ? buildSettlementTransactionsFromBill(bill) : [];
        });

        return [...regeneratedTransactions, ...cleanedTransactions].sort((left, right) =>
          right.date.localeCompare(left.date),
        );
      }

      const cleanedTransactions = targetBillId
        ? current.filter((transaction) => transaction.sourceBillId !== targetBillId)
        : current;
      const linkedTransactions = nextLinkedTransactions;

      return [...linkedTransactions, ...cleanedTransactions].sort((left, right) =>
        right.date.localeCompare(left.date),
      );
    });

    return nextBillBase.id;
  }

  function handleSaveBill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const createdBillId = persistBillDraft(editingBillId);
    if (createdBillId) {
      if (pendingImportCreationItemId) {
        setImportedStatementItems((current) =>
          current.map((currentItem) =>
            currentItem.id === pendingImportCreationItemId
              ? { ...currentItem, suggestedMatch: { kind: "bill", targetId: createdBillId, targetLabel: undefined, confidence: 0.9, reason: "Conta criada durante importacao." } }
              : currentItem,
          ),
        );
        setPendingImportCreationItemId(null);
      }
      closeBillModal();
    }
  }

  function openDebtModal(debt?: Debt) {
    setEditingDebtId(debt?.id ?? null);
    setDraftDebt(createDebtDraft(debt));
    setIsDebtModalOpen(true);
  }

  function closeDebtModal() {
    setEditingDebtId(null);
    setDraftDebt(initialDraftDebt);
    setIsDebtModalOpen(false);
  }

  function openDebtPlanModal(debt: Debt) {
    setDraftDebtPlan(buildDebtPlanDraft(debt));
    setIsDebtPlanModalOpen(true);
  }

  function closeDebtPlanModal() {
    setDraftDebtPlan(initialDraftDebtPlan);
    setIsDebtPlanModalOpen(false);
  }

  function persistDebtDraft(targetDebtId: string | null = editingDebtId) {
    const totalAmount = Number(draftDebt.totalAmount.replace(",", ".")) || 0;
    const paidAmount = Number(draftDebt.paidAmount.replace(",", ".")) || 0;
    const rawInstallmentAmount = Number(draftDebt.installmentAmount.replace(",", ".")) || 0;
    const remainingInstallments = Math.max(1, Number(draftDebt.installments.replace(",", ".")) || 1);

    if (!draftDebt.name.trim() || !totalAmount) {
      return false;
    }

    const existingDebt = debts.find((debt) => debt.id === targetDebtId);
    const safePaid = Math.max(0, Math.min(totalAmount, paidAmount));
    const baseRemainingAmount = Math.max(0, totalAmount - safePaid);
    const installmentAmount = Number(
      Math.max(0.01, rawInstallmentAmount || baseRemainingAmount / remainingInstallments || totalAmount).toFixed(2),
    );
    const remainingAmount = Number(
      Math.max(
        0,
        rawInstallmentAmount > 0 ? installmentAmount * remainingInstallments : baseRemainingAmount,
      ).toFixed(2),
    );
    const normalizedTotalAmount = Number(Math.max(totalAmount, safePaid + remainingAmount).toFixed(2));
    const fallbackPaidInstallments = Math.max(
      0,
      Math.floor(safePaid / Math.max(installmentAmount, 1)),
    );
    const paidInstallments = Math.max(
      0,
      Math.min(
        existingDebt?.paidInstallments ?? fallbackPaidInstallments,
        existingDebt?.totalInstallments ?? fallbackPaidInstallments,
      ),
    );
    const totalInstallments = paidInstallments + remainingInstallments;

    const nextDebt: Debt = {
      id: targetDebtId ?? `debt-${crypto.randomUUID()}`,
      name: draftDebt.name.trim(),
      description: draftDebt.description.trim() || undefined,
      totalAmount: normalizedTotalAmount,
      paidAmount: safePaid,
      remainingAmount,
      totalInstallments,
      paidInstallments,
      installmentAmount,
      nextDueDate: draftDebt.nextDueDate,
      priority: draftDebt.priority,
      status: draftDebt.status,
      plannedPaymentMethod: draftDebt.plannedPaymentMethod,
      plannedCardId: draftDebt.plannedPaymentMethod === "card" ? draftDebt.plannedCardId : undefined,
      notes: undefined,
    };

    setDebts((current) => {
      if (targetDebtId) {
        return current.map((debt) => (debt.id === targetDebtId ? nextDebt : debt));
      }

      return [nextDebt, ...current];
    });

    return true;
  }

  function handleSaveDebt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (persistDebtDraft(editingDebtId)) {
      closeDebtModal();
    }
  }

  function persistEditedCommitment(target: CommitmentEditTarget) {
    const title = draftCommitment.title.trim();
    const totalAmount = Number(draftCommitment.totalAmount.replace(",", ".")) || 0;
    const rawInstallments = Math.max(1, Number(draftCommitment.installments.replace(",", ".")) || 1);
    const installmentAmount =
      Number(draftCommitment.installmentAmount.replace(",", ".")) ||
      (rawInstallments > 0 ? Number((totalAmount / rawInstallments).toFixed(2)) : totalAmount);
    const category =
      categories.find((item) => item.id === draftCommitment.categoryId) ??
      categories.find((item) => item.type === draftCommitment.kind && !isHiddenUiCategoryId(item.id)) ??
      categories[0];
    const monthValue = draftCommitment.startDate.slice(0, 7) || target.monthValue;
    const monthlyAmounts = getDraftCommitmentMonthlyAmounts();
    const activeMonths = getActiveDraftCommitmentMonths();
    const monthlyTotal = activeMonths.reduce((sum, activeMonth) => sum + (monthlyAmounts[activeMonth] ?? 0), 0);
    const hasMonthlyAmounts = Object.keys(draftCommitment.amountByMonth).length > 0;
    const primaryAmount = hasMonthlyAmounts ? monthlyAmounts[monthValue] || monthlyAmounts[target.monthValue] || totalAmount : totalAmount;

    if (!title || !category || Math.max(totalAmount, primaryAmount, monthlyTotal) <= 0) {
      return false;
    }

    const removeEditedSource = () => {
      if (target.sourceType === "bill") {
        const sourceBill = bills.find((bill) => bill.id === target.sourceId);
        const sourceGroupId = sourceBill?.recurringGroupId ?? (sourceBill?.isRecurring ? sourceBill.id : undefined);
        setBills((current) =>
          sourceGroupId
            ? current.filter((bill) => (bill.recurringGroupId ?? bill.id) !== sourceGroupId)
            : current.filter((bill) => bill.id !== target.sourceId),
        );
        setTransactions((current) =>
          sourceGroupId
            ? current.filter((transaction) => {
                const bill = bills.find((currentBill) => currentBill.id === transaction.sourceBillId);
                return !bill || (bill.recurringGroupId ?? bill.id) !== sourceGroupId;
              })
            : current.filter((transaction) => transaction.sourceBillId !== target.sourceId),
        );
        return;
      }

      if (target.sourceType === "fixed") {
        const sourceEntry = fixedEntries.find((entry) => entry.id === target.sourceId);
        setFixedEntries((current) => current.filter((entry) => entry.id !== target.sourceId));
        if (sourceEntry?.linkedBillGroupId) {
          setBills((current) =>
            current.filter((bill) => (bill.recurringGroupId ?? bill.id) !== sourceEntry.linkedBillGroupId),
          );
          setTransactions((current) =>
            current.filter((transaction) => {
              const bill = bills.find((currentBill) => currentBill.id === transaction.sourceBillId);
              return !bill || (bill.recurringGroupId ?? bill.id) !== sourceEntry.linkedBillGroupId;
            }),
          );
        }
      }
    };

    if (
      (target.sourceType === "bill" || target.sourceType === "fixed") &&
      draftCommitment.schedule === "installments"
    ) {
      const shouldBecomeCardInstallment =
        draftCommitment.paymentMethod === "card" && draftCommitment.cardMode === "credit";
      const conversionMonths = activeMonths.length
        ? activeMonths
        : Array.from({ length: rawInstallments }, (_, index) => getMonthValueOffset(monthValue, index));
      const amountByMonth = Object.fromEntries(
        salaryCalendarMonths.map((monthItem) => {
          const explicitAmount = monthlyAmounts[monthItem.monthValue] ?? 0;
          return [
            monthItem.monthValue,
            explicitAmount > 0
              ? explicitAmount
              : conversionMonths.includes(monthItem.monthValue)
                ? installmentAmount
                : 0,
          ];
        }),
      ) as Record<string, number>;
      const convertedTotalAmount =
        totalAmount ||
        conversionMonths.reduce((sum, currentMonth) => sum + (amountByMonth[currentMonth] ?? 0), 0) ||
        installmentAmount * rawInstallments;

      removeEditedSource();

      if (shouldBecomeCardInstallment) {
        const cardBillGroupId = `card-bill-${crypto.randomUUID()}`;
        const commitmentCategory = categories.find((cat) => cat.id === draftCommitment.categoryId);
        const newBills: Bill[] = conversionMonths.map((installmentMonth, installmentIndex) => {
          const isLast = installmentIndex === conversionMonths.length - 1;
          const accumulated = installmentAmount * installmentIndex;
          const billAmount = isLast
            ? Number((convertedTotalAmount - accumulated).toFixed(2))
            : installmentAmount;
          return {
            id: `bill-${crypto.randomUUID()}`,
            title,
            amount: billAmount,
            categoryId: draftCommitment.categoryId,
            categoryName: commitmentCategory?.name ?? "Compras",
            dueDate: `${installmentMonth}-28`,
            priority: "Alta" as FinancePriority,
            isRecurring: false,
            status: "pending" as const,
            plannedPaymentMethod: "card" as PaymentPlanMethod,
            plannedCardId: draftCommitment.cardId,
            plannedCardMode: "credit" as CardMode,
            installments: rawInstallments,
            recurringGroupId: cardBillGroupId,
            notes: draftCommitment.notes.trim() || undefined,
          };
        });

        setBills((current) => [...newBills, ...current]);
        closeCommitmentModal();
        return true;
      }

      const nextDebt: Debt = {
        id: `debt-${crypto.randomUUID()}`,
        name: title,
        description: draftCommitment.notes.trim() || undefined,
        totalAmount: convertedTotalAmount,
        paidAmount: 0,
        remainingAmount: convertedTotalAmount,
        totalInstallments: Math.max(1, rawInstallments, conversionMonths.length),
        paidInstallments: 0,
        installmentAmount: installmentAmount || primaryAmount,
        nextDueDate: draftCommitment.startDate,
        priority: "Alta",
        status: "active",
        plannedPaymentMethod: draftCommitment.paymentMethod,
        plannedCardId: draftCommitment.paymentMethod === "card" ? draftCommitment.cardId : undefined,
      };
      const linkedEntry = buildFixedEntryFromDebt(nextDebt);

      setDebts((current) => [nextDebt, ...current]);
      if (linkedEntry) {
        setFixedEntries((current) => [
          {
            ...linkedEntry,
            amountByMonth,
          },
          ...current,
        ]);
      }
      closeCommitmentModal();
      return true;
    }

    if (target.sourceType === "card_auto_bill") {
      salaryCalendarMonths.forEach((monthItem) => {
        if (Object.prototype.hasOwnProperty.call(draftCommitment.amountByMonth, monthItem.monthValue)) {
          handleUpdateCardBillEstimate(target.sourceId, monthItem.monthValue, String(monthlyAmounts[monthItem.monthValue] ?? 0));
        }
      });
      closeCommitmentModal();
      return true;
    }

    if (target.sourceType === "planned_purchase") {
      const plannedAmountByMonth = hasMonthlyAmounts
        ? monthlyAmounts
        : Object.fromEntries(
            Array.from({ length: draftCommitment.schedule === "installments" ? rawInstallments : 1 }, (_, index) => [
              getMonthValueOffset(monthValue, index),
              draftCommitment.schedule === "installments" ? installmentAmount : installmentAmount || totalAmount,
            ]),
          ) as Record<string, number>;

      setPlannedPurchases((current) =>
        current.map((purchase) =>
          purchase.id === target.sourceId
            ? {
                ...purchase,
                name: title,
                description: draftCommitment.notes.trim() || undefined,
                estimatedValue: totalAmount,
                desiredDate: draftCommitment.startDate,
                targetMonth: monthValue,
                scheduleType: "month",
                specificMonthTarget: true,
                suggestedPeriodAmount: installmentAmount || totalAmount,
                plannedAmountByMonth,
                planningMode:
                  draftCommitment.schedule === "installments" &&
                  draftCommitment.paymentMethod === "card" &&
                  draftCommitment.cardMode === "credit"
                    ? "card_parcelado"
                    : "save_over_time",
                plannedPaymentMethod: draftCommitment.paymentMethod,
                plannedCardId: draftCommitment.paymentMethod === "card" ? draftCommitment.cardId : undefined,
                plannedCardMode: draftCommitment.paymentMethod === "card" ? draftCommitment.cardMode : undefined,
                plannedInstallments: draftCommitment.schedule === "installments" ? rawInstallments : undefined,
                notes: draftCommitment.notes.trim() || undefined,
              }
            : purchase,
        ),
      );
      closeCommitmentModal();
      return true;
    }

    if (target.sourceType === "debt") {
      const existingDebt = debts.find((debt) => debt.id === target.sourceId);
      const existingDebtEntry = getLinkedDebtEntry(target.sourceId);
      const safePaid = Math.max(0, Math.min(totalAmount, existingDebt?.paidAmount ?? 0));
      const paidInstallments = Math.max(0, existingDebt?.paidInstallments ?? 0);
      const hasManualMonthlyAmounts =
        hasMonthlyAmounts &&
        Boolean(existingDebtEntry) &&
        salaryCalendarMonths.some((monthItem) => {
          const monthValueKey = monthItem.monthValue;
          return (monthlyAmounts[monthValueKey] ?? 0) !== (existingDebtEntry?.amountByMonth[monthValueKey] ?? 0);
        });
      const plannedRemainingAmount = Number(
        Math.max(
          0,
          hasManualMonthlyAmounts
            ? monthlyTotal
            : installmentAmount * rawInstallments,
        ).toFixed(2),
      );
      const nextDebtTotalAmount = Number(Math.max(totalAmount, safePaid + plannedRemainingAmount).toFixed(2));
      const nextDebt: Debt = {
        ...(existingDebt ?? {
          id: target.sourceId,
          paidAmount: 0,
          paidInstallments: 0,
          priority: "Alta",
          status: "active",
        } as Debt),
        name: title,
        description: draftCommitment.notes.trim() || undefined,
        totalAmount: nextDebtTotalAmount,
        paidAmount: safePaid,
        remainingAmount: plannedRemainingAmount,
        totalInstallments: paidInstallments + rawInstallments,
        paidInstallments,
        installmentAmount,
        nextDueDate: draftCommitment.startDate,
        plannedPaymentMethod: draftCommitment.paymentMethod,
        plannedCardId: draftCommitment.paymentMethod === "card" ? draftCommitment.cardId : undefined,
      };
      const linkedEntry = buildFixedEntryFromDebt(nextDebt, existingDebtEntry);
      const activeManualMonths =
        hasManualMonthlyAmounts && linkedEntry
          ? salaryCalendarMonths
              .map((monthItem) => monthItem.monthValue)
              .filter(
                (activeMonth) =>
                  (existingDebtEntry?.manualAmountMonths ?? []).includes(activeMonth) ||
                  (monthlyAmounts[activeMonth] ?? 0) !== (linkedEntry.amountByMonth[activeMonth] ?? 0),
              )
          : [];
      const nextLinkedEntry = linkedEntry
        ? {
            ...linkedEntry,
            categoryId: category.id,
            categoryName: category.name,
            amountByMonth: hasManualMonthlyAmounts
              ? {
                  ...linkedEntry.amountByMonth,
                  ...monthlyAmounts,
                }
              : linkedEntry.amountByMonth,
            manualAmountMonths: hasManualMonthlyAmounts
              ? [...new Set([...(linkedEntry.manualAmountMonths ?? []), ...activeManualMonths])]
              : linkedEntry.manualAmountMonths,
          }
        : null;

      setDebts((current) => current.map((debt) => (debt.id === target.sourceId ? nextDebt : debt)));
      if (nextLinkedEntry) {
        setFixedEntries((current) =>
          current.map((entry) => (entry.linkedDebtId === target.sourceId ? { ...nextLinkedEntry, id: entry.id } : entry)),
        );
      }
      closeCommitmentModal();
      return true;
    }

    if (target.sourceType === "fixed") {
      const paymentDetails = getPlannedPaymentDetails(
        draftCommitment.paymentMethod,
        draftCommitment.cardId,
        draftCommitment.cardMode,
        cards,
      );
      const amountByMonth = hasMonthlyAmounts
        ? monthlyAmounts
        : Object.fromEntries(
            salaryCalendarMonths.map((monthItem) => [
              monthItem.monthValue,
              monthItem.monthValue >= monthValue ? totalAmount : 0,
            ]),
          ) as Record<string, number>;
      const nextEntry = fixedEntries.find((entry) => entry.id === target.sourceId);
      const fixedManualAmountMonths =
        nextEntry?.syncCardLimit && nextEntry.cardId
          ? (() => {
              const linkedCard = cards.find((card) => card.id === nextEntry.cardId);
              if (!linkedCard) {
                return nextEntry.manualAmountMonths ?? [];
              }

              return salaryCalendarMonths
                .map((monthItem) => monthItem.monthValue)
                .filter((activeMonth) => amountByMonth[activeMonth] !== linkedCard.creditLimit);
            })()
          : nextEntry?.linkedInvestmentId
            ? (() => {
                const linkedInvestment = investments.find(
                  (investment) => investment.id === nextEntry.linkedInvestmentId,
                );
                if (!linkedInvestment) {
                  return nextEntry.manualAmountMonths ?? [];
                }

                return salaryCalendarMonths
                  .map((monthItem) => monthItem.monthValue)
                  .filter((activeMonth) => amountByMonth[activeMonth] !== linkedInvestment.monthlyTarget);
              })()
            : nextEntry?.manualAmountMonths ?? [];

      setFixedEntries((current) =>
        current.map((entry) =>
          entry.id === target.sourceId
            ? {
                ...entry,
                title,
                kind: draftCommitment.kind,
                section: draftCommitment.kind === "income" ? "Ganhos" : "Contas",
                categoryId: category.id,
                categoryName: category.name,
                amountByMonth,
                completedMonths: entry.completedMonths.filter(
                  (completedMonth) => (amountByMonth[completedMonth] ?? 0) > 0,
                ),
                paymentMethod: paymentDetails.transactionMethod,
                cardId: paymentDetails.cardId,
                cardMode: paymentDetails.cardMode,
                manualAmountMonths: fixedManualAmountMonths,
                notes: draftCommitment.notes.trim() || undefined,
              }
            : entry,
        ),
      );

      if (nextEntry?.linkedBillGroupId) {
        setBills((current) =>
          current.map((bill) =>
            (bill.recurringGroupId ?? bill.id) === nextEntry.linkedBillGroupId
              ? {
                  ...bill,
                  title,
                  amount: amountByMonth[bill.dueDate.slice(0, 7)] ?? totalAmount,
                  categoryId: category.id,
                  categoryName: category.name,
                  plannedPaymentMethod: draftCommitment.paymentMethod,
                  plannedCardId: draftCommitment.paymentMethod === "card" ? draftCommitment.cardId : undefined,
                  plannedCardMode: draftCommitment.paymentMethod === "card" ? draftCommitment.cardMode : undefined,
                  notes: draftCommitment.notes.trim() || undefined,
                }
              : bill,
          ),
        );
      }

      if (nextEntry?.linkedInvestmentId) {
        setInvestments((current) =>
          current.map((investment) =>
            investment.id === nextEntry.linkedInvestmentId
              ? {
                  ...investment,
                  plannedAmountByMonth: amountByMonth,
                }
              : investment,
          ),
        );
      }
      closeCommitmentModal();
      return true;
    }

    if (target.sourceType === "bill" && activeMonths.length > 1 && !pendingCommitmentConversion) {
      setPendingCommitmentConversion({ target, activeMonths });
      return false;
    }

    setBills((current) =>
      current.map((bill) =>
        bill.id === target.sourceId
          ? {
              ...bill,
              title,
              amount: primaryAmount,
              categoryId: category.id,
              categoryName: category.name,
              dueDate: `${activeMonths[0] ?? monthValue}-${draftCommitment.startDate.slice(8, 10) || "01"}`,
              isRecurring: draftCommitment.schedule === "recurring",
              plannedPaymentMethod: draftCommitment.paymentMethod,
              plannedCardId: draftCommitment.paymentMethod === "card" ? draftCommitment.cardId : undefined,
              plannedCardMode: draftCommitment.paymentMethod === "card" ? draftCommitment.cardMode : undefined,
              installments: draftCommitment.schedule === "installments" ? rawInstallments : 1,
              notes: draftCommitment.notes.trim() || undefined,
            }
          : bill,
      ),
    );
    closeCommitmentModal();
    return true;
  }

  function handleConfirmCommitmentConversion(kind: CommitmentConversionKind) {
    if (!pendingCommitmentConversion) {
      return;
    }

    const { target, activeMonths } = pendingCommitmentConversion;
    const title = draftCommitment.title.trim();
    const monthlyAmounts = getDraftCommitmentMonthlyAmounts();
    const totalAmount =
      Number(draftCommitment.totalAmount.replace(",", ".")) ||
      activeMonths.reduce((sum, monthValue) => sum + (monthlyAmounts[monthValue] ?? 0), 0);
    const category =
      categories.find((item) => item.id === draftCommitment.categoryId) ??
      categories.find((item) => item.type === draftCommitment.kind && !isHiddenUiCategoryId(item.id)) ??
      categories[0];
    const firstMonth = activeMonths[0] ?? draftCommitment.startDate.slice(0, 7) ?? selectedMonth;
    const day = draftCommitment.startDate.slice(8, 10) || "01";
    const firstAmount = monthlyAmounts[firstMonth] || Number((totalAmount / Math.max(activeMonths.length, 1)).toFixed(2));

    if (!title || !category || totalAmount <= 0) {
      return;
    }

    setBills((current) => current.filter((bill) => bill.id !== target.sourceId));

    if (kind === "recurring") {
      const paymentDetails = getPlannedPaymentDetails(
        draftCommitment.paymentMethod,
        draftCommitment.cardId,
        draftCommitment.cardMode,
        cards,
      );
      const nextEntry: FixedFlowEntry = {
        id: `fixed-${crypto.randomUUID()}`,
        section: draftCommitment.kind === "income" ? "Ganhos" : "Contas",
        title,
        kind: draftCommitment.kind,
        categoryId: category.id,
        categoryName: category.name,
        amountByMonth: monthlyAmounts,
        completedMonths: [],
        paymentMethod: paymentDetails.transactionMethod,
        accountId: settings.defaultAccountId,
        cardId: paymentDetails.cardId,
        cardMode: paymentDetails.cardMode,
        notes: draftCommitment.notes.trim() || undefined,
      };

      setFixedEntries((current) => [nextEntry, ...current]);
      closeCommitmentModal();
      return;
    }

    if (
      kind === "installment" &&
      draftCommitment.paymentMethod === "card" &&
      draftCommitment.cardMode === "credit"
    ) {
      const nextPurchase: PlannedPurchase = {
        id: `purchase-${crypto.randomUUID()}`,
        name: title,
        description: draftCommitment.notes.trim() || undefined,
        estimatedValue: totalAmount,
        priority: "Alta",
        desiredDate: `${firstMonth}-${day}`,
        targetMonth: firstMonth,
        scheduleType: "month",
        specificMonthTarget: true,
        boardColumn: firstMonth === selectedMonth ? "this_month" : "later",
        savedAmount: 0,
        suggestedPeriodAmount: firstAmount,
        plannedAmountByMonth: monthlyAmounts,
        status: "planned",
        planningMode: "card_parcelado",
        plannedPaymentMethod: "card",
        plannedCardId: draftCommitment.cardId,
        plannedCardMode: "credit",
        plannedInstallments: activeMonths.length,
        notes: draftCommitment.notes.trim() || undefined,
      };

      setPlannedPurchases((current) => [nextPurchase, ...current]);
      closeCommitmentModal();
      return;
    }

    const nextDebt: Debt = {
      id: `debt-${crypto.randomUUID()}`,
      name: title,
      description: draftCommitment.notes.trim() || undefined,
      totalAmount,
      paidAmount: 0,
      remainingAmount: totalAmount,
      totalInstallments: Math.max(1, activeMonths.length),
      paidInstallments: 0,
      installmentAmount: firstAmount,
      nextDueDate: `${firstMonth}-${day}`,
      priority: "Alta",
      status: "active",
      plannedPaymentMethod: draftCommitment.paymentMethod,
      plannedCardId: draftCommitment.paymentMethod === "card" ? draftCommitment.cardId : undefined,
    };
    const linkedEntry = buildFixedEntryFromDebt(nextDebt);

    setDebts((current) => [nextDebt, ...current]);
    if (linkedEntry) {
      setFixedEntries((current) => [
        {
          ...linkedEntry,
          amountByMonth: monthlyAmounts,
        },
        ...current,
      ]);
    }
    closeCommitmentModal();
  }

  function handleSaveCommitment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingCommitmentTarget) {
      persistEditedCommitment(editingCommitmentTarget);
      return;
    }

    const title = draftCommitment.title.trim();
    const totalAmount = Number(draftCommitment.totalAmount.replace(",", ".")) || 0;
    const rawInstallments = Math.max(1, Number(draftCommitment.installments.replace(",", ".")) || 1);
    const installmentAmount =
      Number(draftCommitment.installmentAmount.replace(",", ".")) ||
      (rawInstallments > 0 ? Number((totalAmount / rawInstallments).toFixed(2)) : totalAmount);
    const category =
      categories.find((item) => item.id === draftCommitment.categoryId) ??
      categories.find((item) => item.type === draftCommitment.kind && !isHiddenUiCategoryId(item.id)) ??
      categories[0];
    const monthValue = draftCommitment.startDate.slice(0, 7) || selectedMonth;

    if (!title || !category || totalAmount <= 0) {
      return;
    }

    if (draftCommitment.schedule === "saving_goal") {
      const nextPurchase: PlannedPurchase = {
        id: `purchase-${crypto.randomUUID()}`,
        name: title,
        description: draftCommitment.notes.trim() || undefined,
        estimatedValue: totalAmount,
        priority: "Alta",
        desiredDate: draftCommitment.startDate,
        targetMonth: monthValue,
        scheduleType: "month",
        specificMonthTarget: true,
        boardColumn: monthValue === selectedMonth ? "this_month" : "later",
        savedAmount: 0,
        suggestedPeriodAmount: installmentAmount || totalAmount,
        plannedAmountByMonth: { [monthValue]: installmentAmount || totalAmount },
        status: "planned",
        planningMode: "save_over_time",
        plannedPaymentMethod: draftCommitment.paymentMethod,
        plannedCardId: draftCommitment.paymentMethod === "card" ? draftCommitment.cardId : undefined,
        plannedCardMode: draftCommitment.paymentMethod === "card" ? draftCommitment.cardMode : undefined,
        notes: draftCommitment.notes.trim() || undefined,
      };

      setPlannedPurchases((current) => [nextPurchase, ...current]);
      closeCommitmentModal();
      return;
    }

    if (draftCommitment.schedule === "installments") {
      if (draftCommitment.paymentMethod === "card" && draftCommitment.cardMode === "credit") {
        const installmentValue = Number((totalAmount / rawInstallments).toFixed(2));
        const plannedAmountByMonth = Object.fromEntries(
          Array.from({ length: rawInstallments }, (_, index) => [
            getMonthValueOffset(monthValue, index),
            installmentValue,
          ]),
        ) as Record<string, number>;
        const nextPurchase: PlannedPurchase = {
          id: `purchase-${crypto.randomUUID()}`,
          name: title,
          description: draftCommitment.notes.trim() || undefined,
          estimatedValue: totalAmount,
          priority: "Alta",
          desiredDate: draftCommitment.startDate,
          targetMonth: monthValue,
          scheduleType: "month",
          specificMonthTarget: true,
          boardColumn: monthValue === selectedMonth ? "this_month" : "later",
          savedAmount: 0,
          suggestedPeriodAmount: installmentValue,
          plannedAmountByMonth,
          status: "planned",
          planningMode: "card_parcelado",
          plannedPaymentMethod: "card",
          plannedCardId: draftCommitment.cardId,
          plannedCardMode: "credit",
          plannedInstallments: rawInstallments,
          notes: draftCommitment.notes.trim() || undefined,
        };

        setPlannedPurchases((current) => [nextPurchase, ...current]);
        closeCommitmentModal();
        return;
      }

      const nextDebt: Debt = {
        id: `debt-${crypto.randomUUID()}`,
        name: title,
        description: draftCommitment.notes.trim() || undefined,
        totalAmount,
        paidAmount: 0,
        remainingAmount: totalAmount,
        totalInstallments: rawInstallments,
        paidInstallments: 0,
        installmentAmount,
        nextDueDate: draftCommitment.startDate,
        priority: "Alta",
        status: "active",
        plannedPaymentMethod: draftCommitment.paymentMethod,
        plannedCardId: draftCommitment.paymentMethod === "card" ? draftCommitment.cardId : undefined,
      };
      const linkedEntry = buildFixedEntryFromDebt(nextDebt);

      setDebts((current) => [nextDebt, ...current]);
      if (linkedEntry) {
        setFixedEntries((current) => [linkedEntry, ...current]);
      }
      closeCommitmentModal();
      return;
    }

    if (draftCommitment.kind === "income") {
      const amountByMonth =
        draftCommitment.schedule === "recurring"
          ? Object.fromEntries(
              salaryCalendarMonths.map((monthItem) => [
                monthItem.monthValue,
                monthItem.monthValue >= monthValue ? totalAmount : 0,
              ]),
            )
          : { [monthValue]: totalAmount };
      const nextEntry: FixedFlowEntry = {
        id: `fixed-${crypto.randomUUID()}`,
        section: "Ganhos",
        title,
        kind: "income",
        categoryId: category.id,
        categoryName: category.name,
        amountByMonth: amountByMonth as Record<string, number>,
        completedMonths: [],
        paymentMethod: draftCommitment.paymentMethod === "card" ? "pix" : draftCommitment.paymentMethod,
        accountId: settings.defaultAccountId,
        notes: draftCommitment.notes.trim() || undefined,
      };

      setFixedEntries((current) => [nextEntry, ...current]);
      closeCommitmentModal();
      return;
    }

    if (draftCommitment.schedule === "recurring") {
      const paymentDetails = getPlannedPaymentDetails(
        draftCommitment.paymentMethod,
        draftCommitment.cardId,
        draftCommitment.cardMode,
        cards,
      );
      const amountByMonth = Object.fromEntries(
        salaryCalendarMonths.map((monthItem) => [
          monthItem.monthValue,
          monthItem.monthValue >= monthValue ? totalAmount : 0,
        ]),
      ) as Record<string, number>;
      const nextEntry: FixedFlowEntry = {
        id: `fixed-${crypto.randomUUID()}`,
        section: "Contas",
        title,
        kind: "expense",
        categoryId: category.id,
        categoryName: category.name,
        amountByMonth,
        completedMonths: [],
        paymentMethod: paymentDetails.transactionMethod,
        accountId: settings.defaultAccountId,
        cardId: paymentDetails.cardId,
        cardMode: paymentDetails.cardMode,
        notes: draftCommitment.notes.trim() || undefined,
      };

      setFixedEntries((current) => [nextEntry, ...current]);
      closeCommitmentModal();
      return;
    }

    const paymentConfig = mapFixedPaymentMethodToBillPlan(
      draftCommitment.paymentMethod === "card"
        ? draftCommitment.cardMode === "debit"
          ? "debit_card"
          : "credit_card"
        : draftCommitment.paymentMethod,
      draftCommitment.cardId,
      draftCommitment.cardMode,
    );
    const nextBill: Bill = {
      id: `bill-${crypto.randomUUID()}`,
      title,
      amount: totalAmount,
      categoryId: category.id,
      categoryName: category.name,
      dueDate: draftCommitment.startDate,
      priority: "Alta",
      isRecurring: false,
      status: "pending",
      plannedPaymentMethod: paymentConfig.plannedPaymentMethod,
      plannedCardId: paymentConfig.plannedCardId,
      plannedCardMode: paymentConfig.plannedCardMode,
      installments: 1,
      notes: draftCommitment.notes.trim() || undefined,
    };

    setBills((current) => [nextBill, ...current]);
    closeCommitmentModal();
  }

  function handleDeleteDebt(debtId: string) {
    setDebts((current) => current.filter((debt) => debt.id !== debtId));
    setFixedEntries((current) => current.filter((entry) => entry.linkedDebtId !== debtId));
    setIsDebtPlanModalOpen(false);

    if (editingDebtId === debtId) {
      closeDebtModal();
    }
  }

  function handleRestoreArchivedBill(billId: string) {
    setBills((current) =>
      current.map((bill) =>
        bill.id === billId
          ? {
              ...bill,
              status: bill.status === "paid" ? "pending" : bill.status,
              archivedAt: undefined,
            }
          : bill,
      ),
    );
  }

  function handleRestoreArchivedDebt(debtId: string) {
    setDebts((current) =>
      current.map((debt) =>
        debt.id === debtId
          ? {
              ...debt,
              status: debt.status === "settled" ? "active" : debt.status,
              archivedAt: undefined,
            }
          : debt,
      ),
    );
  }

  function handleRestoreArchivedFixedEntry(entryId: string) {
    setFixedEntries((current) =>
      current.map((entry) => (entry.id === entryId ? { ...entry, archivedAt: undefined } : entry)),
    );
  }

  function handleRestoreArchivedCardBill(cardId: string, monthValue: string) {
    const key = getCardBillEstimateKey(cardId, monthValue);

    setCardBillEstimates((current) => ({
      ...current,
      [key]: {
        cardId,
        monthValue,
        estimatedAmount: current[key]?.estimatedAmount ?? getCardBillAutoEstimatedAmount(cardId, monthValue),
        isAutoEstimate: current[key]?.isAutoEstimate ?? true,
        status: "pending",
        paidTransactionId: undefined,
        archivedAt: undefined,
      },
    }));
  }

  function handleToggleCardBillPaid(cardId: string, monthValue: string) {
    const key = getCardBillEstimateKey(cardId, monthValue);
    const estimate = cardBillEstimates[key];
    const currentStatus = estimate?.status ?? "pending";
    const realAmount = getCardBillRealAmount(cardId, monthValue);
    const paymentAmount = realAmount > 0 ? realAmount : (estimate?.estimatedAmount ?? 0);

    if (currentStatus === "paid") {
      const existingTxId = estimate?.paidTransactionId;
      if (existingTxId) {
        setTransactions((current) => current.filter((tx) => tx.id !== existingTxId));
      }
      setCardBillEstimates((current) => ({
        ...current,
        [key]: {
          cardId,
          monthValue,
          estimatedAmount: estimate?.estimatedAmount ?? 0,
          isAutoEstimate: estimate?.isAutoEstimate ?? true,
          status: "pending",
          paidTransactionId: undefined,
        },
      }));
      return;
    }

    const existingTxId = estimate?.paidTransactionId;
    const existingTx = existingTxId ? transactions.find((tx) => tx.id === existingTxId) : undefined;

    if (existingTx) {
      setTransactions((current) =>
        current.map((tx) => (tx.id === existingTx.id ? { ...tx, amount: paymentAmount, status: "paid" } : tx)),
      );
      setCardBillEstimates((current) => ({
        ...current,
        [key]: {
          cardId,
          monthValue,
          estimatedAmount: estimate?.estimatedAmount ?? 0,
          isAutoEstimate: estimate?.isAutoEstimate ?? true,
          status: "paid",
          paidTransactionId: existingTx.id,
        },
      }));
      return;
    }

    const card = cards.find((c) => c.id === cardId);
    const paymentDate = `${monthValue}-${String(new Date().getDate()).padStart(2, "0")}`;
    const marker = `CARD_BILL_PAYMENT:${cardId}:${monthValue}`;
    const duplicateMarker = transactions.find((tx) => tx.description?.includes(marker));

    if (duplicateMarker) {
      setTransactions((current) =>
        current.map((tx) => (tx.id === duplicateMarker.id ? { ...tx, amount: paymentAmount, status: "paid" } : tx)),
      );
      setCardBillEstimates((current) => ({
        ...current,
        [key]: {
          cardId,
          monthValue,
          estimatedAmount: estimate?.estimatedAmount ?? 0,
          isAutoEstimate: estimate?.isAutoEstimate ?? true,
          status: "paid",
          paidTransactionId: duplicateMarker.id,
        },
      }));
      return;
    }

    const newPayment: Transaction = {
      id: `tx-${crypto.randomUUID()}`,
      title: `Pagamento fatura ${card?.name ?? "cartao"}`,
      description: marker,
      amount: paymentAmount,
      type: "expense",
      status: "paid",
      date: paymentDate,
      categoryId: "cat-bills",
      categoryName: "Faturas",
      paymentMethod: "bank_transfer",
      accountId: settings.defaultAccountId,
    };

    setTransactions((current) => [newPayment, ...current]);
    setCardBillEstimates((current) => ({
      ...current,
      [key]: {
        cardId,
        monthValue,
        estimatedAmount: estimate?.estimatedAmount ?? 0,
        isAutoEstimate: estimate?.isAutoEstimate ?? true,
        status: "paid",
        paidTransactionId: newPayment.id,
      },
    }));
  }

  function canDeleteMonthlyGridRow(row: MonthlyGridRow) {
    return row.sourceType !== "card_auto_bill";
  }

  function getMonthlyGridDeleteDescription(target: MonthlyGridDeleteTarget) {
    if (target.linkedDebtId) {
      return "Isso remove a divida e o planejamento dela da planilha.";
    }

    if (target.linkedBillGroupId) {
      return "Isso remove a conta sincronizada e os lancamentos vinculados a ela.";
    }

    if (target.sourceType === "planned_purchase") {
      return "Isso remove essa compra planejada da planilha e do planejamento.";
    }

    return "Isso remove essa linha da planilha.";
  }

  function deleteMonthlyGridTarget(target: MonthlyGridDeleteTarget | CommitmentEditTarget) {
    if (target.sourceType === "card_auto_bill") {
      return false;
    }

    if (target.sourceType === "planned_purchase") {
      handleDeletePurchase(target.sourceId);
      closeCommitmentModal();
      setPendingMonthlyGridDelete(null);
      return true;
    }

    if (target.sourceType === "debt") {
      handleDeleteDebt(target.sourceId);
      closeCommitmentModal();
      setPendingMonthlyGridDelete(null);
      return true;
    }

    if (target.sourceType === "fixed") {
      const sourceEntry = fixedEntries.find((entry) => entry.id === target.sourceId);

      if (sourceEntry?.linkedDebtId) {
        handleDeleteDebt(sourceEntry.linkedDebtId);
      } else {
        const linkedBillGroupId = sourceEntry?.linkedBillGroupId;
        const linkedBillIds = linkedBillGroupId
          ? bills
              .filter((bill) => (bill.recurringGroupId ?? bill.id) === linkedBillGroupId)
              .map((bill) => bill.id)
          : [];

        setFixedEntries((current) => current.filter((entry) => entry.id !== target.sourceId));

        if (linkedBillGroupId) {
          setBills((current) => current.filter((bill) => (bill.recurringGroupId ?? bill.id) !== linkedBillGroupId));
          setTransactions((current) =>
            current.filter(
              (transaction) => !transaction.sourceBillId || !linkedBillIds.includes(transaction.sourceBillId),
            ),
          );
        }
      }

      closeCommitmentModal();
      setPendingMonthlyGridDelete(null);
      return true;
    }

    if (target.sourceType === "bill") {
      const sourceBill = bills.find((bill) => bill.id === target.sourceId);
      const sourceGroupId = sourceBill?.recurringGroupId ?? (sourceBill?.isRecurring ? sourceBill.id : undefined);
      const sourceBillIds = sourceGroupId
        ? bills.filter((bill) => (bill.recurringGroupId ?? bill.id) === sourceGroupId).map((bill) => bill.id)
        : [target.sourceId];

      setBills((current) =>
        sourceGroupId
          ? current.filter((bill) => (bill.recurringGroupId ?? bill.id) !== sourceGroupId)
          : current.filter((bill) => bill.id !== target.sourceId),
      );
      setTransactions((current) =>
        current.filter((transaction) => !transaction.sourceBillId || !sourceBillIds.includes(transaction.sourceBillId)),
      );
      closeCommitmentModal();
      setPendingMonthlyGridDelete(null);
      return true;
    }

    return false;
  }

  function requestMonthlyGridDelete(row: MonthlyGridRow) {
    if (!canDeleteMonthlyGridRow(row)) {
      return;
    }

    setPendingMonthlyGridDelete({
      rowId: row.id,
      sourceId: row.sourceId,
      sourceType: row.sourceType,
      title: row.title,
      linkedBillGroupId: row.linkedBillGroupId,
      linkedDebtId: row.linkedDebtId,
    });
  }

  function handleApplyDebtPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const debt = debts.find((item) => item.id === draftDebtPlan.debtId);
    if (!debt) {
      return;
    }

    const remainingAmount = Math.max(0, debt.remainingAmount);
    if (remainingAmount <= 0) {
      closeDebtPlanModal();
      return;
    }

    const monthCount = Math.max(1, Number(draftDebtPlan.monthCount.replace(",", ".")) || 1);
    const installmentAmount = Math.max(
      0.01,
      Number(draftDebtPlan.installmentAmount.replace(",", ".")) || debt.installmentAmount || 0.01,
    );
    const fallbackDebtCategory =
      categories.find((item) => item.id === defaultBillCategoryId) ??
      categories.find((item) => item.type === "expense") ??
      categories[0];
    const linkedEntry = getLinkedDebtEntry(debt.id);
    const debtCategory =
      categories.find((item) => item.id === linkedEntry?.categoryId) ??
      fallbackDebtCategory;
    if (!debtCategory) {
      return;
    }

    const paymentDetails = getPlannedPaymentDetails(
      debt.plannedPaymentMethod,
      debt.plannedCardId,
      "credit",
      cards,
    );
    const scheduleStartMonth = selectedMonth || debt.nextDueDate.slice(0, 7);
    const { schedule } = buildDebtPlanSchedule(
      scheduleStartMonth,
      remainingAmount,
      monthCount,
      installmentAmount,
    );
    const knownMonths = new Set([
      ...salaryCalendarMonths.map((monthItem) => monthItem.monthValue),
      ...Object.keys(linkedEntry?.amountByMonth ?? {}),
      ...schedule.map((item) => item.monthValue),
    ]);
    const nextAmountByMonth = Object.fromEntries(
      [...knownMonths].map((monthValue) => [monthValue, 0]),
    ) as Record<string, number>;

    schedule.forEach((item) => {
      nextAmountByMonth[item.monthValue] = item.amount;
    });

    const nextCompletedMonths = (linkedEntry?.completedMonths ?? []).filter(
      (monthValue) => (nextAmountByMonth[monthValue] ?? 0) > 0,
    );
    const nextEntry: FixedFlowEntry = {
      id: linkedEntry?.id ?? `fixed-debt-${debt.id}`,
      section: "Contas",
      title: debt.name,
      kind: "expense",
      categoryId: debtCategory.id,
      categoryName: debtCategory.name,
      amountByMonth: nextAmountByMonth,
      completedMonths: nextCompletedMonths,
      paymentMethod: paymentDetails.transactionMethod,
      accountId: linkedEntry?.accountId ?? settings.defaultAccountId,
      cardId: paymentDetails.cardId,
      cardMode: paymentDetails.cardMode,
      linkedBillGroupId: undefined,
      linkedDebtId: debt.id,
      linkedInvestmentId: undefined,
      syncCardLimit: false,
      manualAmountMonths: [],
      notes: linkedEntry?.notes ?? debt.description,
    };

    setFixedEntries((current) => {
      const existingIndex = current.findIndex((entry) => entry.linkedDebtId === debt.id);
      if (existingIndex >= 0) {
        return current.map((entry, index) => (index === existingIndex ? nextEntry : entry));
      }

      return [nextEntry, ...current];
    });

    const nextDueDate = alignDateToDay(
      `${scheduleStartMonth}-01`,
      Number(debt.nextDueDate.slice(8, 10)) || 1,
    );

    setDebts((current) =>
      current.map((item) =>
        item.id === debt.id
          ? {
              ...item,
              installmentAmount,
              totalInstallments: (item.paidInstallments || 0) + monthCount,
              nextDueDate,
            }
          : item,
      ),
    );

    closeDebtPlanModal();
  }

  function handleSaveNewAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const saved =
      newAccountKind === "bill" ? persistBillDraft(null) : persistDebtDraft(null);

    if (saved) {
      closeNewAccountModal();
    }
  }

  function openAccountModal(account?: Account) {
    setEditingAccountId(account?.id ?? null);
    setDraftAccount(createAccountDraft(account));
    setIsAccountModalOpen(true);
  }

  function closeAccountModal() {
    setEditingAccountId(null);
    setDraftAccount(initialDraftAccount);
    setIsAccountModalOpen(false);
  }

  function handleSaveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftAccount.name.trim()) {
      return;
    }

    const nextAccount: Account = {
      id: editingAccountId ?? `acc-${crypto.randomUUID()}`,
      name: draftAccount.name.trim(),
      type: draftAccount.type.trim() || "Conta corrente",
      initialBalance: Number(draftAccount.initialBalance.replace(",", ".")) || 0,
      currentBalance: Number(draftAccount.currentBalance.replace(",", ".")) || 0,
      isActive: true,
    };

    setAccounts((current) => {
      if (editingAccountId) {
        return current.map((account) => (account.id === editingAccountId ? nextAccount : account));
      }

      return [nextAccount, ...current];
    });

    closeAccountModal();
  }
  function openSalaryMonthModal(monthValue: string) {
    const plan = monthlyPlansByMonth[monthValue] ?? createMonthlyPlanForMonth(monthValue);
    setDraftSalaryMonth({
      monthValue,
      fixedIncomePlanned: String(plan.fixedIncomePlanned),
    });
    setIsSalaryMonthModalOpen(true);
  }

  function closeSalaryMonthModal() {
    setIsSalaryMonthModalOpen(false);
  }

  function handleSaveSalaryMonth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextValue = Number(draftSalaryMonth.fixedIncomePlanned.replace(",", ".")) || 0;

    setMonthlyPlansByMonth((current) => {
      const existing = current[draftSalaryMonth.monthValue] ?? createMonthlyPlanForMonth(draftSalaryMonth.monthValue);
      return {
        ...current,
        [draftSalaryMonth.monthValue]: {
          ...existing,
          monthLabel: formatMonthLabel(monthValueToDate(draftSalaryMonth.monthValue)),
          fixedIncomePlanned: nextValue,
        },
      };
    });

    closeSalaryMonthModal();
  }

  function handleApplyAverageSalaryToMonths() {
    const averageSalary = settings.fixedSalaryExpected;

    setMonthlyPlansByMonth((current) => {
      const nextEntries = salaryCalendarMonths.map((monthItem) => {
        const existing = current[monthItem.monthValue] ?? createMonthlyPlanForMonth(monthItem.monthValue);
        return [
          monthItem.monthValue,
          {
            ...existing,
            monthLabel: formatMonthLabel(monthValueToDate(monthItem.monthValue)),
            fixedIncomePlanned: averageSalary,
          },
        ] as const;
      });

      return {
        ...current,
        ...Object.fromEntries(nextEntries),
      };
    });
  }

  function getDefaultCategoryIdForFixedSection(section: FixedFlowSection) {
    if (section === "Ganhos") {
      return (
        categories.find((category) => category.type === "income")?.id ??
        categories[0]?.id ??
        initialDraftFixedEntry.categoryId
      );
    }

    if (normalizeFixedSection(section) === "Contas") {
      return (
        categories.find((category) => category.type === "expense" && !isHiddenUiCategoryId(category.id))?.id ??
        categories.find((category) => category.type === "expense")?.id ??
        initialDraftBill.categoryId
      );
    }

    return (
      categories.find((category) => category.type === "expense" && !isHiddenUiCategoryId(category.id))?.id ??
      categories.find((category) => category.type === "expense")?.id ??
      initialDraftBill.categoryId
    );
  }

  function getPlannedPurchaseCategory(purchase: PlannedPurchase) {
    const lowerName = purchase.name.toLowerCase();
    const fallbackExpenseCategory =
      categories.find((category) => category.type === "expense") ?? categories[0];

    if (lowerName.includes("roupa")) {
      return categories.find((category) => category.id === "cat-clothes") ?? fallbackExpenseCategory;
    }

    if (lowerName.includes("vapo")) {
      return categories.find((category) => category.id === "cat-volei") ?? fallbackExpenseCategory;
    }

    if (lowerName.includes("mercado")) {
      return categories.find((category) => category.id === "cat-market") ?? fallbackExpenseCategory;
    }

    if (lowerName.includes("gasolina")) {
      return categories.find((category) => category.id === "cat-fuel") ?? fallbackExpenseCategory;
    }

    return categories.find((category) => category.id === "cat-moto") ?? fallbackExpenseCategory;
  }

  function getPlannedPurchaseAmountByMonth(purchase: PlannedPurchase) {
    const yearMonths = salaryCalendarMonths.map((monthItem) => monthItem.monthValue);
    const targetMonth =
      purchase.targetMonth ?? purchase.desiredDate?.slice(0, 7) ?? selectedMonth;
    const nextAmounts = Object.fromEntries(yearMonths.map((monthValue) => [monthValue, 0])) as Record<string, number>;

    if (purchase.planningMode === "card_parcelado") {
      if (purchase.plannedAmountByMonth) {
        return { ...nextAmounts, ...purchase.plannedAmountByMonth };
      }

      const installments = Math.max(1, purchase.plannedInstallments ?? 1);
      const installmentValue = Number((purchase.estimatedValue / installments).toFixed(2));

      Array.from({ length: installments }, (_, index) => getMonthValueOffset(targetMonth, index)).forEach(
        (monthValue, index, array) => {
          if (!(monthValue in nextAmounts)) {
            return;
          }

          const isLast = index === array.length - 1;
          const accumulated = installmentValue * index;
          nextAmounts[monthValue] = isLast
            ? Number((purchase.estimatedValue - accumulated).toFixed(2))
            : installmentValue;
        },
      );

      return nextAmounts;
    }

    if (purchase.planningMode === "buy_in_target_period") {
      if (purchase.plannedAmountByMonth) {
        return { ...nextAmounts, ...purchase.plannedAmountByMonth };
      }

      if (targetMonth in nextAmounts) {
        nextAmounts[targetMonth] = purchase.estimatedValue;
      }
      return nextAmounts;
    }

    if (purchase.plannedAmountByMonth) {
      return { ...nextAmounts, ...purchase.plannedAmountByMonth };
    }

    const startMonth = selectedMonth;
    const monthSeries: string[] = [];
    let cursor = startMonth;

    while (cursor <= targetMonth) {
      monthSeries.push(cursor);
      cursor = getMonthValueOffset(cursor, 1);
      if (monthSeries.length > 24) {
        break;
      }
    }

    const contribution = Math.max(0, purchase.suggestedPeriodAmount || 0);
    const remainingToSave = Math.max(0, purchase.estimatedValue - purchase.savedAmount);

    if (!monthSeries.length || contribution <= 0 || remainingToSave <= 0) {
      if (targetMonth in nextAmounts) {
        nextAmounts[targetMonth] = remainingToSave;
      }
      return nextAmounts;
    }

    let remaining = remainingToSave;
    monthSeries.forEach((monthValue, index) => {
      if (!(monthValue in nextAmounts)) {
        return;
      }

      const allocation =
        index === monthSeries.length - 1 ? remaining : Math.min(contribution, remaining);
      nextAmounts[monthValue] = Number(allocation.toFixed(2));
      remaining = Number((remaining - allocation).toFixed(2));
    });

    return nextAmounts;
  }

  function getReserveMonthlyPlan(purchase: PlannedPurchase) {
    const remaining = Math.max(0, purchase.estimatedValue - purchase.savedAmount);
    const targetMonth = purchase.targetMonth ?? purchase.desiredDate?.slice(0, 7) ?? selectedMonth;
    const months: string[] = [];
    let cursor = selectedMonth;

    while (cursor <= targetMonth) {
      months.push(cursor);
      cursor = getMonthValueOffset(cursor, 1);
      if (months.length > 24) {
        break;
      }
    }

    const monthCount = Math.max(1, months.length);
    const suggestedMonthlyAmount =
      purchase.suggestedPeriodAmount > 0
        ? purchase.suggestedPeriodAmount
        : Number((remaining / monthCount).toFixed(2));

    return {
      remaining,
      monthCount,
      suggestedMonthlyAmount,
      targetMonth,
    };
  }

  type CardStatementGridItem = {
    id: string;
    title: string;
    amount: number;
    support: string;
    sortKey: string;
    sourceType: "transaction" | "bill";
    sourceId: string;
    installmentGroupId?: string;
    installmentTotal?: number;
  };

  function getBillStatementGroupId(bill: Bill) {
    return bill.recurringGroupId ?? (bill.isRecurring ? bill.id : bill.id);
  }

  function getBillStatementSupportLabel(bill: Bill) {
    if ((bill.installments ?? 1) > 1) {
      return `Conta - Parcelado ${bill.installments}x`;
    }

    return bill.isRecurring ? "Conta recorrente" : "Conta";
  }

  function getCardStatementGridItems(cardId: string, statementMonth: string): CardStatementGridItem[] {
    const card = cards.find((item) => item.id === cardId);
    if (!card) {
      return [];
    }

    const getSourceBillGroupId = (bill: Bill | undefined) =>
      bill ? bill.recurringGroupId ?? (bill.isRecurring ? bill.id : undefined) : undefined;

    const transactionItems = transactions
      .filter(
        (transaction) =>
          transaction.cardId === cardId &&
          transaction.cardMode === "credit" &&
          getCardStatementMonthForTransaction(card, transaction) === statementMonth,
      )
      .map((transaction, index) => {
        const sourceBill = transaction.sourceBillId
          ? bills.find((bill) => bill.id === transaction.sourceBillId)
          : undefined;
        const baseSourceLabel = sourceBill?.isRecurring
          ? "Conta recorrente"
          : sourceBill
            ? "Conta"
            : "Transacao";
        const sourceBillGroupId = getSourceBillGroupId(sourceBill);
        const sourceBillGroupKey = sourceBillGroupId ? `source-bill-${sourceBillGroupId}` : undefined;
        const installmentKey =
          transaction.installmentGroupId ??
          sourceBillGroupKey ??
          (transaction.installmentTotal
            ? `${transaction.title}-${transaction.installmentTotal}-${transaction.cardId ?? cardId}`
            : undefined);
        const sourceLabel = transaction.installmentTotal
          ? `${baseSourceLabel} - Parcelado ${transaction.installmentTotal}x`
          : baseSourceLabel;

        return {
          id: sourceBillGroupId
            ? `bill-${sourceBillGroupId}`
            : installmentKey
              ? `installment-${installmentKey}`
              : `transaction-${transaction.id}`,
          title: transaction.title,
          amount: getCreditCardTransactionSignedAmount(transaction),
          support: transaction.type === "income" ? `${sourceLabel} - Credito/estorno` : sourceLabel,
          sortKey: `${transaction.date}-${String(index).padStart(4, "0")}`,
          sourceType: "transaction" as const,
          sourceId: transaction.id,
          installmentGroupId: transaction.installmentGroupId ?? sourceBillGroupKey ?? installmentKey,
          installmentTotal: transaction.installmentTotal,
        };
      });

    const billItems = getCreditLinkedBillsForStatement(cardId, statementMonth)
      .map((bill, index) => ({
        id: `bill-${getBillStatementGroupId(bill)}`,
        title: bill.title,
        amount: bill.amount,
        support: getBillStatementSupportLabel(bill),
        sortKey: `${bill.dueDate}-${String(index).padStart(4, "0")}`,
        sourceType: "bill" as const,
        sourceId: getBillStatementGroupId(bill),
      }));

    const plannedPurchaseItems = plannedPurchases
      .filter(
        (purchase) =>
          purchase.planningMode === "card_parcelado" &&
          purchase.plannedCardId === cardId &&
          purchase.status !== "cancelled" &&
          purchase.status !== "bought" &&
          purchase.estimatedValue > 0,
      )
      .map((purchase, index) => {
        const purchaseAmountByMonth = getPlannedPurchaseAmountByMonth(purchase);
        const monthAmount = purchaseAmountByMonth[statementMonth] ?? 0;
        return {
          id: `purchase-${purchase.id}`,
          title: purchase.name,
          amount: monthAmount,
          support: purchase.plannedInstallments
            ? `Parcelado ${purchase.plannedInstallments}x`
            : "Compra no cartao",
          sortKey: `${purchase.desiredDate ?? "9999"}-${String(index).padStart(4, "0")}`,
          sourceType: "bill" as const,
          sourceId: purchase.id,
        };
      })
      .filter((item) => item.amount > 0);

    return [...transactionItems, ...billItems, ...plannedPurchaseItems].sort((left, right) => left.sortKey.localeCompare(right.sortKey));
  }

  function updateCreditLinkedBillGroupMonth(
    cardId: string,
    groupId: string,
    statementMonth: string,
    nextAmount: number,
  ) {
    const card = cards.find((current) => current.id === cardId);
    if (!card) {
      return;
    }

    setBills((current) => {
      const groupBills = current
        .filter((bill) => getBillStatementGroupId(bill) === groupId)
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
      const baseBill = groupBills[0];
      if (!baseBill || !isCreditLinkedBill(baseBill)) {
        return current;
      }

      const targetBill = groupBills.find(
        (bill) => isCreditLinkedBill(bill) && getCardStatementMonthForBill(card, bill) === statementMonth,
      );

      if (targetBill) {
        return current.map((bill) => (bill.id === targetBill.id ? { ...bill, amount: nextAmount } : bill));
      }

      if (nextAmount <= 0) {
        return current;
      }

      const dueDay = (baseBill.recurringDay ?? Number(baseBill.dueDate.slice(8, 10))) || card.dueDay || 1;
      const nextBill: Bill = {
        ...baseBill,
        id: `bill-${crypto.randomUUID()}`,
        amount: nextAmount,
        dueDate: alignDateToDay(`${statementMonth}-01`, dueDay),
        status: "pending",
        recurringGroupId: groupId,
        plannedPaymentMethod: "card",
        plannedCardId: cardId,
        plannedCardMode: "credit",
      };

      return [...current, nextBill].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
    });
  }

  function updateCreditLinkedBillGroupTransactionsMonth(
    cardId: string,
    groupId: string,
    statementMonth: string,
    nextAmount: number,
  ) {
    const card = cards.find((current) => current.id === cardId);
    if (!card) {
      return;
    }

    setTransactions((current) =>
      current.map((transaction) => {
        const sourceBill = transaction.sourceBillId
          ? bills.find((bill) => bill.id === transaction.sourceBillId)
          : undefined;
        const sourceBillGroupId = sourceBill ? getBillStatementGroupId(sourceBill) : undefined;
        const transactionStatementMonth =
          transaction.cardId === cardId && transaction.cardMode === "credit"
            ? getCardStatementMonthForTransaction(card, transaction)
            : "";

        return sourceBillGroupId === groupId && transactionStatementMonth === statementMonth
          ? { ...transaction, amount: nextAmount }
          : transaction;
      }),
    );
  }

  function handleCardStatementGridItemAmountChange(
    cardId: string,
    item: CardStatementGridItem,
    statementMonth: string,
    rawValue: string,
  ) {
    const card = cards.find((current) => current.id === cardId);
    if (!card) {
      return;
    }

    const parsedValue = Number(rawValue.replace(",", ".")) || 0;
    const nextAmount = Math.max(0, Number(parsedValue.toFixed(2)));

    if (item.sourceType === "transaction") {
      const sourceBillGroupPrefix = "source-bill-";
      if (item.installmentGroupId?.startsWith(sourceBillGroupPrefix)) {
        const groupId = item.installmentGroupId.slice(sourceBillGroupPrefix.length);
        updateCreditLinkedBillGroupMonth(
          cardId,
          groupId,
          statementMonth,
          nextAmount,
        );
        updateCreditLinkedBillGroupTransactionsMonth(cardId, groupId, statementMonth, nextAmount);
        return;
      }

      setTransactions((current) => {
        const getTransactionInstallmentKey = (transaction: Transaction) => {
          const sourceBill = transaction.sourceBillId
            ? bills.find((bill) => bill.id === transaction.sourceBillId)
            : undefined;
          const sourceBillGroupId = sourceBill?.recurringGroupId ?? (sourceBill?.isRecurring ? sourceBill.id : undefined);

          return (
            transaction.installmentGroupId ??
            (sourceBillGroupId ? `source-bill-${sourceBillGroupId}` : undefined) ??
            (transaction.installmentTotal
              ? `${transaction.title}-${transaction.installmentTotal}-${transaction.cardId ?? cardId}`
              : undefined)
          );
        };

        if (item.installmentGroupId) {
          const groupTransactions = current.filter(
            (transaction) =>
              transaction.cardId === cardId &&
              transaction.cardMode === "credit" &&
              getTransactionInstallmentKey(transaction) === item.installmentGroupId,
          );
          const baseTransaction = groupTransactions.find((transaction) => transaction.id === item.sourceId) ?? groupTransactions[0];
          const hasTargetMonth = groupTransactions.some(
            (transaction) => getCardStatementMonthForTransaction(card, transaction) === statementMonth,
          );
          const createdTransaction =
            !hasTargetMonth && baseTransaction && nextAmount > 0
              ? ({
                  ...baseTransaction,
                  id: crypto.randomUUID(),
                  amount: nextAmount,
                  date: getTransactionDateForCardStatementMonth(card, statementMonth),
                  status: "planned",
                  sourceBillId: undefined,
                  installmentGroupId: item.installmentGroupId,
                } satisfies Transaction)
              : null;
          const nextTransactions = current.map((transaction) => {
            const transactionInstallmentKey = getTransactionInstallmentKey(transaction);

            if (transactionInstallmentKey !== item.installmentGroupId) {
              return transaction;
            }

            const transactionStatementMonth = getCardStatementMonthForTransaction(card, transaction);

            return {
              ...transaction,
              amount: transactionStatementMonth === statementMonth ? nextAmount : transaction.amount,
              installmentGroupId: item.installmentGroupId,
            };
          });
          const nextWithCreated = createdTransaction ? [...nextTransactions, createdTransaction] : nextTransactions;
          const normalizedGroup = nextWithCreated
            .filter(
              (transaction) =>
                transaction.cardId === cardId &&
                transaction.cardMode === "credit" &&
                getTransactionInstallmentKey(transaction) === item.installmentGroupId,
            )
            .sort((left, right) => {
              const leftMonth = getCardStatementMonthForTransaction(card, left);
              const rightMonth = getCardStatementMonthForTransaction(card, right);
              return `${leftMonth}-${left.date}`.localeCompare(`${rightMonth}-${right.date}`);
            });
          const installmentTotal = normalizedGroup.length;
          const installmentNumbersById = new Map(
            normalizedGroup.map((transaction, index) => [transaction.id, index + 1]),
          );

          return nextWithCreated.map((transaction) => {
            const installmentNumber = installmentNumbersById.get(transaction.id);

            return installmentNumber
              ? {
                  ...transaction,
                  installmentGroupId: item.installmentGroupId,
                  installmentNumber,
                  installmentTotal,
                }
              : transaction;
          });
        }

        return current.map((transaction) => {
          const transactionStatementMonth =
            transaction.cardId === cardId && transaction.cardMode === "credit"
              ? getCardStatementMonthForTransaction(card, transaction)
              : "";

          return transaction.id === item.sourceId && transactionStatementMonth === statementMonth
            ? { ...transaction, amount: nextAmount }
            : transaction;
        });
      });
      return;
    }

    updateCreditLinkedBillGroupMonth(cardId, item.sourceId, statementMonth, nextAmount);
  }

  function createMonthlyGridRows(): MonthlyGridRow[] {
    const hasPendingAmountFromSelectedMonth = (entry: FixedFlowEntry) =>
      salaryCalendarMonths.some((monthItem) => {
        const amount = entry.amountByMonth[monthItem.monthValue] ?? 0;
        return (
          monthItem.monthValue >= selectedMonth &&
          amount > 0 &&
          !entry.completedMonths.includes(monthItem.monthValue)
        );
      });
    const fixedRows: MonthlyGridRow[] = activeFixedEntries
      .filter((entry) => !(entry.linkedBillGroupId && entry.paymentMethod === "credit_card" && entry.cardId))
      .filter((entry) => {
        if (entry.section === "Ganhos") {
          return true;
        }

        const hasAnyScheduledAmount = Object.values(entry.amountByMonth).some((amount) => amount > 0);
        return !hasAnyScheduledAmount || hasPendingAmountFromSelectedMonth(entry);
      })
      .map((entry) => ({
        id: `fixed-grid-${entry.id}`,
        section: normalizeFixedSection(entry.section),
        sourceType: "fixed",
        sourceId: entry.id,
        title: entry.title,
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        paymentMethod: entry.paymentMethod,
        accountId: entry.accountId,
        cardId: entry.cardId,
        cardMode: entry.cardMode,
        linkedBillGroupId: entry.linkedBillGroupId,
        linkedDebtId: entry.linkedDebtId,
        linkedInvestmentId: entry.linkedInvestmentId,
        syncCardLimit: entry.syncCardLimit,
        notes: entry.notes,
        amountByMonth: entry.amountByMonth,
        completedMonths: entry.completedMonths,
      }));
    const linkedBillEntryIds = new Set(
      activeFixedEntries
        .map((entry) => entry.linkedBillGroupId)
        .filter((value): value is string => Boolean(value)),
    );
    const standaloneBillRows: MonthlyGridRow[] = activeBills
      .filter((bill) => !bill.isRecurring && !isCreditLinkedBill(bill))
      .filter((bill) => !linkedBillEntryIds.has(bill.id))
      .map((bill) => {
        const amountByMonth = Object.fromEntries(
          salaryCalendarMonths.map((monthItem) => [
            monthItem.monthValue,
            monthItem.monthValue === bill.dueDate.slice(0, 7) ? bill.amount : 0,
          ]),
        ) as Record<string, number>;
        const paymentDetails = getPlannedPaymentDetails(
          bill.plannedPaymentMethod,
          bill.plannedCardId,
          bill.plannedCardMode ?? "credit",
          cards,
        );

        return {
          id: `bill-grid-${bill.id}`,
          section: "Contas" as FixedFlowSection,
          sourceType: "fixed" as const,
          sourceId: bill.id,
          title: bill.title,
          categoryId: bill.categoryId,
          categoryName: bill.categoryName,
          paymentMethod: paymentDetails.transactionMethod,
          accountId: settings.defaultAccountId,
          cardId: paymentDetails.cardId,
          cardMode: paymentDetails.cardMode,
          linkedBillGroupId: bill.id,
          linkedDebtId: undefined,
          linkedInvestmentId: undefined,
          syncCardLimit: false,
          notes: bill.notes,
          amountByMonth,
          completedMonths: bill.status === "paid" ? [bill.dueDate.slice(0, 7)] : [],
        };
      });
    const cardAutoRows: MonthlyGridRow[] = cards
      .filter((card) => card.availableMode !== "debit")
      .map((card) => {
        const amountByMonth = Object.fromEntries(
          salaryCalendarMonths.map((monthItem) => [
            monthItem.monthValue,
            getCardBillGridAmount(card.id, monthItem.monthValue),
          ]),
        ) as Record<string, number>;

        return {
          id: `card-auto-grid-${card.id}`,
          section: "Contas" as FixedFlowSection,
          sourceType: "card_auto_bill" as const,
          sourceId: card.id,
          title: `Fatura ${card.name}`,
          categoryId: "cat-bills",
          categoryName: "Fatura do cartao",
          paymentMethod: "pix" as PaymentMethod,
          accountId: card.linkedAccountId ?? settings.defaultAccountId,
          cardId: card.id,
          cardMode: "credit" as CardMode,
          linkedDebtId: undefined,
          notes: "Fatura automatica gerada a partir dos lancamentos de credito do cartao.",
          amountByMonth,
          completedMonths: [],
        };
      })
      .filter((row) =>
        salaryCalendarMonths.some(
          (monthItem) =>
            (row.amountByMonth[monthItem.monthValue] ?? 0) > 0 ||
            getCardBillRealAmount(row.sourceId, monthItem.monthValue) > 0,
        ),
      );

    const purchaseRows: MonthlyGridRow[] = plannedPurchases
      .filter(
        (purchase) =>
          purchase.status !== "cancelled" &&
          purchase.status !== "bought" &&
          !realizedPlannedPurchaseIds.has(purchase.id) &&
          // Exclui compras card_parcelado COM cartão e valor — elas já aparecem na fatura do cartão
          !(purchase.planningMode === "card_parcelado" && purchase.plannedCardId && purchase.estimatedValue > 0),
      )
      .map((purchase) => {
        const category = getPlannedPurchaseCategory(purchase);
        const paymentDetails = getPlannedPaymentDetails(
          purchase.plannedPaymentMethod,
          purchase.plannedCardId,
          purchase.plannedCardMode ?? "credit",
          cards,
        );

        return {
          id: `purchase-grid-${purchase.id}`,
          section: "Planejamento",
          sourceType: "planned_purchase",
          sourceId: purchase.id,
          title: purchase.name,
          categoryId: category?.id ?? "cat-moto",
          categoryName: category?.name ?? "Compras",
          paymentMethod: paymentDetails.transactionMethod,
          accountId: settings.defaultAccountId,
          cardId: purchase.plannedCardId,
          cardMode: purchase.plannedCardMode,
          linkedBillGroupId: undefined,
          linkedDebtId: undefined,
          notes: purchase.description,
          amountByMonth: getPlannedPurchaseAmountByMonth(purchase),
          completedMonths: [],
        };
      });

    return [...fixedRows, ...standaloneBillRows, ...cardAutoRows, ...purchaseRows];
  }

  function closeFixedEntryModal() {
    setEditingFixedEntryId(null);
    setDraftFixedEntry({
      ...initialDraftFixedEntry,
      cardId: settings.defaultCardId,
      amountByMonth: createFixedEntryAmountDraft(referenceMonthDate),
    });
    setIsFixedEntryModalOpen(false);
  }

  function openInvestmentModal(investment?: Investment) {
    setEditingInvestmentId(investment?.id ?? null);
    setDraftInvestment(buildInvestmentDraft(investment));
    setIsInvestmentModalOpen(true);
  }

  function closeInvestmentModal() {
    setEditingInvestmentId(null);
    setDraftInvestment(buildInvestmentDraft());
    setIsInvestmentModalOpen(false);
  }

  function openInvestmentContributionModal(investment?: Investment) {
    setDraftInvestmentContribution(buildInvestmentContributionDraft(investment));
    setIsInvestmentContributionModalOpen(true);
  }

  function closeInvestmentContributionModal() {
    setDraftInvestmentContribution(buildInvestmentContributionDraft());
    setIsInvestmentContributionModalOpen(false);
  }

  function buildInvestmentTransaction(
    investment: Investment,
    amount: number,
    contributionDate: string,
    paymentMethod: PaymentMethod,
    accountId?: string,
    cardId?: string,
    cardMode?: CardMode,
    description?: string,
  ) {
    const category = getInvestmentCategory();

    return {
      id: crypto.randomUUID(),
      title: `Aporte ${investment.name}`,
      type: "expense" as const,
      amount,
      date: contributionDate,
      categoryId: category?.id ?? "cat-invest",
      categoryName: category?.name ?? "Investimentos",
      paymentMethod,
      status: "paid" as const,
      expenseKind: "investment" as const,
      accountId: accountId ?? settings.defaultAccountId,
      cardId:
        paymentMethod === "credit_card" || paymentMethod === "debit_card" ? cardId : undefined,
      cardMode:
        paymentMethod === "credit_card" || paymentMethod === "debit_card" ? cardMode : undefined,
      description,
    } satisfies Transaction;
  }

  function handleSaveInvestment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftInvestment.name.trim()) {
      return;
    }

    const totalGrossInvested = Number(draftInvestment.totalGrossInvested.replace(",", ".")) || 0;
    const currentManualValue =
      Number(draftInvestment.currentManualValue.replace(",", ".")) || totalGrossInvested;
    const monthlyTarget = Number(draftInvestment.monthlyTarget.replace(",", ".")) || 0;
    const existingInvestment = investments.find((investment) => investment.id === editingInvestmentId);

    const nextInvestment: Investment = {
      id: editingInvestmentId ?? crypto.randomUUID(),
      name: draftInvestment.name.trim(),
      type: draftInvestment.type.trim() || "Reserva",
      objective: draftInvestment.objective.trim() || undefined,
      totalGrossInvested,
      currentManualValue,
      monthlyTarget,
      paymentMethod: draftInvestment.paymentMethod,
      accountId: draftInvestment.accountId,
      cardId:
        draftInvestment.paymentMethod === "credit_card" || draftInvestment.paymentMethod === "debit_card"
          ? draftInvestment.cardId
          : undefined,
      cardMode:
        draftInvestment.paymentMethod === "credit_card" || draftInvestment.paymentMethod === "debit_card"
          ? draftInvestment.cardMode
          : undefined,
      plannedAmountByMonth: existingInvestment?.plannedAmountByMonth,
      notes: draftInvestment.notes.trim() || undefined,
      contributions: existingInvestment?.contributions ?? [],
    };

    setInvestments((current) => {
      if (editingInvestmentId) {
        return current.map((investment) =>
          investment.id === editingInvestmentId ? nextInvestment : investment,
        );
      }

      return [nextInvestment, ...current];
    });

    closeInvestmentModal();
  }

  function handleSaveInvestmentContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(draftInvestmentContribution.amount.replace(",", ".")) || 0;
    if (!draftInvestmentContribution.investmentId || amount <= 0) {
      return;
    }

    const investment = investments.find((item) => item.id === draftInvestmentContribution.investmentId);
    if (!investment) {
      return;
    }

    const contributionDate = draftInvestmentContribution.contributionDate || `${selectedMonth}-12`;
    const monthValue = contributionDate.slice(0, 7);
    const description = `Monex investimento:${investment.id}:${monthValue}:${crypto.randomUUID()}`;
    const transaction = buildInvestmentTransaction(
      investment,
      amount,
      contributionDate,
      draftInvestmentContribution.paymentMethod,
      draftInvestmentContribution.accountId,
      draftInvestmentContribution.cardId,
      draftInvestmentContribution.cardMode,
      description,
    );

    const nextContribution = {
      id: crypto.randomUUID(),
      contributionDate,
      amount,
      monthValue,
      source: "manual" as const,
      linkedTransactionId: transaction.id,
      paymentMethod: draftInvestmentContribution.paymentMethod,
      accountId: draftInvestmentContribution.accountId,
      cardId:
        draftInvestmentContribution.paymentMethod === "credit_card" ||
        draftInvestmentContribution.paymentMethod === "debit_card"
          ? draftInvestmentContribution.cardId
          : undefined,
      cardMode:
        draftInvestmentContribution.paymentMethod === "credit_card" ||
        draftInvestmentContribution.paymentMethod === "debit_card"
          ? draftInvestmentContribution.cardMode
          : undefined,
      notes: draftInvestmentContribution.notes.trim() || undefined,
    };

    setTransactions((current) =>
      [transaction, ...current].sort((left, right) => right.date.localeCompare(left.date)),
    );
    setInvestments((current) =>
      current.map((item) =>
        item.id === investment.id
          ? {
              ...item,
              totalGrossInvested: Number((item.totalGrossInvested + amount).toFixed(2)),
              currentManualValue: Number(
                ((item.currentManualValue ?? item.totalGrossInvested) + amount).toFixed(2),
              ),
              paymentMethod: draftInvestmentContribution.paymentMethod,
              accountId: draftInvestmentContribution.accountId,
              cardId:
                draftInvestmentContribution.paymentMethod === "credit_card" ||
                draftInvestmentContribution.paymentMethod === "debit_card"
                  ? draftInvestmentContribution.cardId
                  : undefined,
              cardMode:
                draftInvestmentContribution.paymentMethod === "credit_card" ||
                draftInvestmentContribution.paymentMethod === "debit_card"
                  ? draftInvestmentContribution.cardMode
                  : undefined,
              plannedAmountByMonth: {
                ...(item.plannedAmountByMonth ?? {}),
                [monthValue]: amount,
              },
              contributions: [...item.contributions, nextContribution].sort((left, right) =>
                left.contributionDate.localeCompare(right.contributionDate),
              ),
            }
          : item,
      ),
    );

    closeInvestmentContributionModal();
  }

  function handleSaveFixedEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftFixedEntry.title.trim()) {
      return;
    }

    const category =
      categories.find((item) => item.id === draftFixedEntry.categoryId) ??
      categories.find((item) => item.type === getFixedEntryKind(draftFixedEntry.section)) ??
      categories[0];

    if (!category) {
      return;
    }

    const existingEntry = fixedEntries.find((entry) => entry.id === editingFixedEntryId);
    const matchedRecurringBill = bills.find(
      (bill) =>
        bill.isRecurring &&
        bill.title === draftFixedEntry.title.trim() &&
        bill.categoryId === category.id &&
        bill.recurringGroupId,
    );
    const linkedBillGroupId = existingEntry?.linkedBillGroupId ?? matchedRecurringBill?.recurringGroupId;
    const linkedCard = cards.find((card) => card.id === draftFixedEntry.cardId);
    const isCardSynced =
      draftFixedEntry.syncCardLimit &&
      draftFixedEntry.paymentMethod === "credit_card" &&
      !!linkedCard;
    const normalizedAmountByMonth = Object.fromEntries(
      salaryCalendarMonths.map((monthItem) => {
        const parsedAmount = Number(draftFixedEntry.amountByMonth[monthItem.monthValue]?.replace(",", ".") || 0);
        return [monthItem.monthValue, Number(parsedAmount.toFixed(2))];
      }),
    ) as Record<string, number>;
    const manualAmountMonths =
      isCardSynced && linkedCard
        ? salaryCalendarMonths
            .map((monthItem) => monthItem.monthValue)
            .filter((monthValue) => normalizedAmountByMonth[monthValue] !== linkedCard.creditLimit)
        : existingEntry?.linkedInvestmentId
          ? salaryCalendarMonths
              .map((monthItem) => monthItem.monthValue)
              .filter(
                (monthValue) =>
                  normalizedAmountByMonth[monthValue] !==
                  investments.find((investment) => investment.id === existingEntry.linkedInvestmentId)
                    ?.monthlyTarget,
              )
          : existingEntry?.linkedDebtId
            ? salaryCalendarMonths
                .map((monthItem) => monthItem.monthValue)
                .filter(
                  (monthValue) =>
                    (existingEntry.manualAmountMonths ?? []).includes(monthValue) ||
                    normalizedAmountByMonth[monthValue] !== (existingEntry.amountByMonth[monthValue] ?? 0),
                )
          : [];

    const nextEntry: FixedFlowEntry = {
      id:
        editingFixedEntryId ??
        `fixed-${draftFixedEntry.section
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")}-${draftFixedEntry.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")}`,
      section: normalizeFixedSection(draftFixedEntry.section),
      title: draftFixedEntry.title.trim(),
      kind: getFixedEntryKind(draftFixedEntry.section),
      categoryId: category.id,
      categoryName: category.name,
      amountByMonth: normalizedAmountByMonth,
      completedMonths:
        fixedEntries.find((entry) => entry.id === editingFixedEntryId)?.completedMonths ?? [],
      paymentMethod: draftFixedEntry.paymentMethod,
      accountId: draftFixedEntry.accountId,
      cardId: draftFixedEntry.paymentMethod === "credit_card" || draftFixedEntry.paymentMethod === "debit_card"
        ? draftFixedEntry.cardId
        : undefined,
      cardMode:
        draftFixedEntry.paymentMethod === "credit_card"
          ? "credit"
          : draftFixedEntry.paymentMethod === "debit_card"
            ? "debit"
          : undefined,
      linkedBillGroupId,
      linkedDebtId: existingEntry?.linkedDebtId,
      linkedInvestmentId: existingEntry?.linkedInvestmentId,
      syncCardLimit: isCardSynced,
      manualAmountMonths,
      notes: draftFixedEntry.notes.trim() || undefined,
    };

    setFixedEntries((current) => {
      if (editingFixedEntryId) {
        return current.map((entry) => (entry.id === editingFixedEntryId ? nextEntry : entry));
      }

      return [...current, nextEntry];
    });

    if (linkedBillGroupId) {
      setBills((current) =>
        current.map((bill) => {
          if ((bill.recurringGroupId ?? bill.id) !== linkedBillGroupId) {
            return bill;
          }

          const monthValue = bill.dueDate.slice(0, 7);
          const paymentConfig = mapFixedPaymentMethodToBillPlan(
            nextEntry.paymentMethod,
            nextEntry.cardId,
            nextEntry.cardMode,
          );

          return {
            ...bill,
            title: nextEntry.title,
            amount: nextEntry.amountByMonth[monthValue] ?? 0,
            categoryId: nextEntry.categoryId,
            categoryName: nextEntry.categoryName,
            status: (nextEntry.completedMonths.includes(monthValue) ? "paid" : "pending") as Bill["status"],
            plannedPaymentMethod: paymentConfig.plannedPaymentMethod,
            plannedCardId: paymentConfig.plannedCardId,
            plannedCardMode: paymentConfig.plannedCardMode,
            notes: nextEntry.notes,
          };
        }),
      );

      const nextBillsGroup: Bill[] = bills
        .filter((bill) => (bill.recurringGroupId ?? bill.id) === linkedBillGroupId)
        .map((bill) => {
          const monthValue = bill.dueDate.slice(0, 7);
          const paymentConfig = mapFixedPaymentMethodToBillPlan(
            nextEntry.paymentMethod,
            nextEntry.cardId,
            nextEntry.cardMode,
          );

          return {
            ...bill,
            title: nextEntry.title,
            amount: nextEntry.amountByMonth[monthValue] ?? 0,
            categoryId: nextEntry.categoryId,
            categoryName: nextEntry.categoryName,
            status: (nextEntry.completedMonths.includes(monthValue) ? "paid" : "pending") as Bill["status"],
            plannedPaymentMethod: paymentConfig.plannedPaymentMethod,
            plannedCardId: paymentConfig.plannedCardId,
            plannedCardMode: paymentConfig.plannedCardMode,
            notes: nextEntry.notes,
          };
        });

      setTransactions((current) => rebuildTransactionsForBills(current, nextBillsGroup));
    }

    if (nextEntry.linkedInvestmentId) {
      setInvestments((current) =>
        current.map((investment) =>
          investment.id === nextEntry.linkedInvestmentId
            ? {
                ...investment,
                plannedAmountByMonth: nextEntry.amountByMonth,
              }
            : investment,
        ),
      );
    }

    closeFixedEntryModal();
  }

  function getFixedEntryMarker(entryId: string, monthValue: string) {
    return `Monex fixo:${entryId}:${monthValue}`;
  }

  function handleToggleFixedEntryMonth(entryId: string, monthValue: string) {
    const entry = fixedEntries.find((item) => item.id === entryId);
    const standaloneBill = !entry ? bills.find((bill) => bill.id === entryId) : undefined;

    if (!entry && !standaloneBill) return;

    if (standaloneBill) {
      const isPaid = standaloneBill.status === "paid";
      setBills((current) =>
        current.map((bill) =>
          bill.id === standaloneBill.id
            ? { ...bill, status: isPaid ? "pending" : ("paid" as Bill["status"]) }
            : bill,
        ),
      );

      if (!isPaid) {
        setTransactions((current) => [...buildSettlementTransactionsFromBill(standaloneBill), ...current]);
      } else {
        setTransactions((current) => current.filter((tx) => tx.sourceBillId !== standaloneBill.id));
      }
      return;
    }

    const isCompleted = entry!.completedMonths.includes(monthValue);
    const marker = getFixedEntryMarker(entryId, monthValue);

    const nextCompletedMonths = isCompleted
      ? entry!.completedMonths.filter((value) => value !== monthValue)
      : [...entry!.completedMonths, monthValue];

    setFixedEntries((current) =>
      current.map((item) => (item.id === entryId ? { ...item, completedMonths: nextCompletedMonths } : item)),
    );

    if (entry!.linkedBillGroupId) {
      const nextBillsGroup: Bill[] = bills
        .filter((bill) => (bill.recurringGroupId ?? bill.id) === entry!.linkedBillGroupId)
        .map((bill) => {
          const billMonthValue = bill.dueDate.slice(0, 7);
          return {
            ...bill,
            status: (nextCompletedMonths.includes(billMonthValue) ? "paid" : "pending") as Bill["status"],
          };
        });

      setBills((current) =>
        current.map((bill) => {
          const syncedBill = nextBillsGroup.find((item) => item.id === bill.id);
          return syncedBill ?? bill;
        }),
      );

      if (!isCompleted) {
        setTransactions((current) => [...rebuildTransactionsForBills(current, nextBillsGroup)]);
      } else {
        setTransactions((current) => rebuildTransactionsForBills(current, nextBillsGroup));
      }
      return;
    }

    const matchingBill = bills.find(
      (bill) =>
        bill.title === entry!.title &&
        bill.categoryId === entry!.categoryId &&
        bill.dueDate.slice(0, 7) === monthValue,
    );

    if (matchingBill) {
      setBills((current) =>
        current.map((bill) =>
          bill.id === matchingBill.id
            ? { ...bill, status: isCompleted ? "pending" : ("paid" as Bill["status"]) }
            : bill,
        ),
      );
    }

    if (!isCompleted) {
      const amount = entry!.amountByMonth[monthValue] ?? 0;
      if (amount > 0) {
        const existingTx = transactions.find((tx) => tx.description === marker);
        if (!existingTx) {
          const paymentDetails = getPlannedPaymentDetails(
            (entry!.paymentMethod === "credit_card" || entry!.paymentMethod === "debit_card" ? "card" : entry!.paymentMethod) as PaymentPlanMethod,
            entry!.cardId,
            entry!.cardMode ?? "credit",
            cards,
          );
          const newTx: Transaction = {
            id: `tx-${crypto.randomUUID()}`,
            title: `Pagamento ${entry!.title}`,
            type: "expense",
            amount,
            date: `${monthValue}-14`,
            categoryId: entry!.categoryId,
            categoryName: entry!.categoryName,
            paymentMethod: paymentDetails.transactionMethod,
            status: "paid",
            expenseKind: "basic_bill",
            accountId: settings.defaultAccountId,
            cardId: paymentDetails.cardId,
            cardMode: paymentDetails.cardMode,
            sourceBillId: matchingBill?.id,
            description: marker,
          };
          setTransactions((current) => [newTx, ...current]);
        }
      }
    } else {
      setTransactions((current) => current.filter((tx) => tx.description !== marker));
    }
  }

  function buildDebtFixedAmounts(
    entry: FixedFlowEntry,
    monthValue: string,
    nextAmount: number,
  ) {
    return {
      ...entry.amountByMonth,
      [monthValue]: Number(Math.max(0, nextAmount).toFixed(2)),
    };
  }

  function handleFixedEntryAmountChange(entryId: string, monthValue: string, rawValue: string) {
    const entry = fixedEntries.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }

    const parsedValue = Number(rawValue.replace(",", ".")) || 0;
    const nextAmount = Math.max(0, Number(parsedValue.toFixed(2)));
    const marker = getFixedEntryMarker(entryId, monthValue);
    const nextAmounts =
      entry.linkedDebtId
        ? buildDebtFixedAmounts(entry, monthValue, nextAmount)
        : {
            ...entry.amountByMonth,
            [monthValue]: nextAmount,
          };
    const matchingBill = bills.find(
      (bill) =>
        bill.title === entry.title &&
        bill.categoryId === entry.categoryId &&
        bill.dueDate.slice(0, 7) === monthValue,
    );
    const updatedEntry = {
      ...entry,
      amountByMonth: nextAmounts,
      manualAmountMonths:
        entry.syncCardLimit && entry.cardId
          ? (() => {
              const linkedCard = cards.find((card) => card.id === entry.cardId);
              if (!linkedCard) {
                return entry.manualAmountMonths ?? [];
              }

              const nextManualMonths = new Set(entry.manualAmountMonths ?? []);
              if (nextAmounts[monthValue] === linkedCard.creditLimit) {
                nextManualMonths.delete(monthValue);
              } else {
                nextManualMonths.add(monthValue);
              }

              return [...nextManualMonths];
            })()
          : entry.linkedInvestmentId
            ? (() => {
                const linkedInvestment = investments.find(
                  (investment) => investment.id === entry.linkedInvestmentId,
                );
                if (!linkedInvestment) {
                  return entry.manualAmountMonths ?? [];
                }

                const nextManualMonths = new Set(entry.manualAmountMonths ?? []);
                if (nextAmounts[monthValue] === linkedInvestment.monthlyTarget) {
                  nextManualMonths.delete(monthValue);
                } else {
                  nextManualMonths.add(monthValue);
                }

                return [...nextManualMonths];
              })()
            : entry.linkedDebtId
              ? (() => {
                  const nextManualMonths = new Set(entry.manualAmountMonths ?? []);
                  nextManualMonths.add(monthValue);

                  return [...nextManualMonths];
                })()
            : entry.manualAmountMonths,
      completedMonths:
        nextAmount <= 0
          ? entry.completedMonths.filter((value) => value !== monthValue)
          : entry.completedMonths,
    };

    setFixedEntries((current) =>
      current.map((item) => (item.id === entryId ? updatedEntry : item)),
    );

    if (entry.linkedInvestmentId) {
      const contributionMonth = monthValue;
      setInvestments((current) =>
        current.map((investment) => {
          if (investment.id !== entry.linkedInvestmentId) {
            return investment;
          }

          const nextContributions = investment.contributions.map((contribution) =>
            (contribution.monthValue ?? contribution.contributionDate.slice(0, 7)) === contributionMonth
              ? {
                  ...contribution,
                  amount: nextAmount,
                  contributionDate: `${contributionMonth}-${contribution.contributionDate.slice(8, 10) || "12"}`,
                }
              : contribution,
          );

          const totalGrossInvested = Number(
            nextContributions.reduce((sum, contribution) => sum + contribution.amount, 0).toFixed(2),
          );
          const nextPlannedAmountByMonth = {
            ...(investment.plannedAmountByMonth ?? {}),
            [contributionMonth]: nextAmount,
          };

          return {
            ...investment,
            totalGrossInvested,
            plannedAmountByMonth: nextPlannedAmountByMonth,
            contributions: nextContributions,
          };
        }),
      );

      setTransactions((current) =>
        current.map((transaction) =>
          transaction.description === marker
            ? {
                ...transaction,
                amount: nextAmount,
                date: `${monthValue}-${transaction.date.slice(8, 10)}`,
                expenseKind: "investment",
              }
            : transaction,
        ),
      );
    }

    if (entry.linkedBillGroupId) {
      const nextBillsGroup: Bill[] = bills
        .filter((bill) => (bill.recurringGroupId ?? bill.id) === entry.linkedBillGroupId)
        .map((bill) => {
          const billMonthValue = bill.dueDate.slice(0, 7);
          return {
            ...bill,
            amount: nextAmounts[billMonthValue] ?? 0,
            status: (updatedEntry.completedMonths.includes(billMonthValue) ? "paid" : "pending") as Bill["status"],
          };
        });

      setBills((current) =>
        current.map((bill) => {
          const syncedBill = nextBillsGroup.find((item) => item.id === bill.id);
          return syncedBill ?? bill;
        }),
      );
      setTransactions((current) => rebuildTransactionsForBills(current, nextBillsGroup));
      return;
    }

    setBills((current) =>
      current.map((bill) =>
        bill.title === entry.title &&
        bill.categoryId === entry.categoryId &&
        bill.dueDate.slice(0, 7) === monthValue
          ? { ...bill, amount: nextAmount }
          : bill,
      ),
    );

    setTransactions((current) =>
      current
        .map((transaction) => {
          if (
            transaction.description === marker ||
            (matchingBill ? transaction.sourceBillId === matchingBill.id : false)
          ) {
            return { ...transaction, amount: nextAmount };
          }

          return transaction;
        })
        .filter(
          (transaction) =>
            !(
              (transaction.description === marker ||
                (matchingBill ? transaction.sourceBillId === matchingBill.id : false)) &&
              nextAmount <= 0
            ),
        ),
    );
  }

  function handlePlannedPurchaseAmountChange(purchaseId: string, monthValue: string, rawValue: string) {
    const purchase = plannedPurchases.find((item) => item.id === purchaseId);
    if (!purchase) {
      return;
    }

    if (isPlannedPurchaseRealized(purchase)) {
      return;
    }

    const parsedValue = Number(rawValue.replace(",", ".")) || 0;
    const nextAmount = Math.max(0, Number(parsedValue.toFixed(2)));
    const nextAmounts = {
      ...getPlannedPurchaseAmountByMonth(purchase),
      [monthValue]: nextAmount,
    };

    setPlannedPurchases((current) =>
      current.map((item) =>
        item.id === purchaseId
          ? {
              ...item,
              plannedAmountByMonth: nextAmounts,
              scheduleType: "month",
              specificMonthTarget: true,
              targetMonth: monthValue,
              desiredDate: alignDateToDay(
                `${monthValue}-${item.desiredDate?.slice(8, 10) ?? "28"}`,
                Number(item.desiredDate?.slice(8, 10) ?? "28"),
              ),
            }
          : item,
      ),
    );
  }

  function handleMonthlyGridAmountChange(row: MonthlyGridRow, monthValue: string, rawValue: string) {
    if (row.sourceType === "card_auto_bill") {
      handleUpdateCardBillEstimate(row.sourceId, monthValue, rawValue);
      return;
    }

    if (row.sourceType === "planned_purchase") {
      handlePlannedPurchaseAmountChange(row.sourceId, monthValue, rawValue);
      return;
    }

    const entry = fixedEntries.find((item) => item.id === row.sourceId);
    if (entry) {
      handleFixedEntryAmountChange(entry.id, monthValue, rawValue);
      return;
    }

    const bill = bills.find((item) => item.id === row.sourceId);
    if (!bill) {
      return;
    }

    const parsedValue = Number(rawValue.replace(",", ".")) || 0;
    const nextAmount = Math.max(0, Number(parsedValue.toFixed(2)));
    setBills((current) =>
      current.map((item) =>
        item.id === bill.id
          ? {
              ...item,
              amount: nextAmount,
              dueDate: alignDateToDay(`${monthValue}-01`, Number(item.dueDate.slice(8, 10))),
            }
          : item,
      ),
    );
  }

  function handleMoveMonthlyGridRow(row: MonthlyGridRow, sourceMonthValue: string, targetMonthValue: string) {
    if (sourceMonthValue === targetMonthValue) {
      return;
    }

    if (row.sourceType === "card_auto_bill") {
      return;
    }

    if (row.sourceType === "planned_purchase") {
      const purchase = plannedPurchases.find((item) => item.id === row.sourceId);
      if (!purchase) {
        return;
      }

      if (isPlannedPurchaseRealized(purchase)) {
        return;
      }

      const sourceAmount = row.amountByMonth[sourceMonthValue] ?? 0;
      if (sourceAmount <= 0) {
        return;
      }

      const targetAmount = row.amountByMonth[targetMonthValue] ?? 0;
      const nextAmountByMonth = {
        ...getPlannedPurchaseAmountByMonth(purchase),
        [sourceMonthValue]: targetAmount,
        [targetMonthValue]: sourceAmount,
      };
      const currentDay = purchase.desiredDate?.slice(8, 10) ?? "28";
      const nextDesiredDate = alignDateToDay(`${targetMonthValue}-${currentDay}`, Number(currentDay));

      setPlannedPurchases((current) =>
        current.map((item) =>
          item.id === purchase.id
            ? {
                ...item,
                plannedAmountByMonth: nextAmountByMonth,
                scheduleType: "month",
                specificMonthTarget: true,
                targetMonth: targetMonthValue,
                targetWeek: undefined,
                desiredDate: nextDesiredDate,
                boardColumn:
                  targetMonthValue === selectedMonth
                    ? "this_month"
                    : targetMonthValue === getMonthValueOffset(selectedMonth, 1)
                      ? "next_month"
                      : "later",
              }
            : item,
        ),
      );
      return;
    }

    const entry = fixedEntries.find((item) => item.id === row.sourceId);
    if (!entry) {
      const bill = bills.find((item) => item.id === row.sourceId);
      if (bill) {
        const sourceAmount = row.amountByMonth[sourceMonthValue] ?? 0;
        if (sourceAmount <= 0) {
          return;
        }

        setBills((current) =>
          current.map((item) =>
            item.id === bill.id
              ? {
                  ...item,
                  dueDate: alignDateToDay(`${targetMonthValue}-01`, Number(item.dueDate.slice(8, 10))),
                }
              : item,
          ),
        );
      }
      return;
    }

    const sourceAmount = entry.amountByMonth[sourceMonthValue] ?? 0;
    if (sourceAmount <= 0) {
      return;
    }

    const targetAmount = entry.amountByMonth[targetMonthValue] ?? 0;
    const sourceCompleted = entry.completedMonths.includes(sourceMonthValue);
    const targetCompleted = entry.completedMonths.includes(targetMonthValue);
    const nextCompletedMonths = entry.completedMonths.filter(
      (value) => value !== sourceMonthValue && value !== targetMonthValue,
    );

    if (targetAmount > 0 && targetCompleted) {
      nextCompletedMonths.push(sourceMonthValue);
    }

    if (sourceAmount > 0 && sourceCompleted) {
      nextCompletedMonths.push(targetMonthValue);
    }

    const updatedEntry: FixedFlowEntry = {
      ...entry,
      amountByMonth: {
        ...entry.amountByMonth,
        [sourceMonthValue]: targetAmount,
        [targetMonthValue]: sourceAmount,
      },
      manualAmountMonths:
        entry.syncCardLimit && entry.cardId
          ? (() => {
              const linkedCard = cards.find((card) => card.id === entry.cardId);
              if (!linkedCard) {
                return entry.manualAmountMonths ?? [];
              }

              const nextManualMonths = new Set(entry.manualAmountMonths ?? []);
              [sourceMonthValue, targetMonthValue].forEach((monthValue) => {
                const nextValue =
                  monthValue === sourceMonthValue ? targetAmount : sourceAmount;
                if (nextValue === linkedCard.creditLimit) {
                  nextManualMonths.delete(monthValue);
                } else {
                  nextManualMonths.add(monthValue);
                }
              });

              return [...nextManualMonths];
            })()
          : entry.linkedInvestmentId
            ? (() => {
                const linkedInvestment = investments.find(
                  (investment) => investment.id === entry.linkedInvestmentId,
                );
                if (!linkedInvestment) {
                  return entry.manualAmountMonths ?? [];
                }

                const nextManualMonths = new Set(entry.manualAmountMonths ?? []);
                [sourceMonthValue, targetMonthValue].forEach((monthValue) => {
                  const nextValue = monthValue === sourceMonthValue ? targetAmount : sourceAmount;
                  if (nextValue === linkedInvestment.monthlyTarget) {
                    nextManualMonths.delete(monthValue);
                  } else {
                    nextManualMonths.add(monthValue);
                  }
                });

                return [...nextManualMonths];
              })()
            : entry.linkedDebtId
              ? (() => {
                  const nextManualMonths = new Set(entry.manualAmountMonths ?? []);
                  nextManualMonths.add(sourceMonthValue);
                  nextManualMonths.add(targetMonthValue);

                  return [...nextManualMonths];
                })()
          : entry.manualAmountMonths,
      completedMonths: [...new Set(nextCompletedMonths)],
    };

    setFixedEntries((current) =>
      current.map((item) => (item.id === entry.id ? updatedEntry : item)),
    );

    if (entry.linkedInvestmentId) {
      setInvestments((current) =>
        current.map((investment) => {
          if (investment.id !== entry.linkedInvestmentId) {
            return investment;
          }

          const nextContributions = investment.contributions.map((contribution) => {
            const contributionMonth = contribution.monthValue ?? contribution.contributionDate.slice(0, 7);
            if (contributionMonth === sourceMonthValue) {
              return {
                ...contribution,
                monthValue: targetMonthValue,
                amount: sourceAmount,
                contributionDate: `${targetMonthValue}-${contribution.contributionDate.slice(8, 10) || "12"}`,
              };
            }

            if (contributionMonth === targetMonthValue) {
              return {
                ...contribution,
                monthValue: sourceMonthValue,
                amount: targetAmount,
                contributionDate: `${sourceMonthValue}-${contribution.contributionDate.slice(8, 10) || "12"}`,
              };
            }

            return contribution;
          });

          return {
            ...investment,
            plannedAmountByMonth: {
              ...(investment.plannedAmountByMonth ?? {}),
              [sourceMonthValue]: targetAmount,
              [targetMonthValue]: sourceAmount,
            },
            contributions: nextContributions,
          };
        }),
      );

      setTransactions((current) =>
        current.map((transaction) => {
          if (transaction.description === getFixedEntryMarker(entry.id, sourceMonthValue)) {
            return {
              ...transaction,
              amount: sourceAmount,
              date: `${targetMonthValue}-${transaction.date.slice(8, 10)}`,
              description: getFixedEntryMarker(entry.id, targetMonthValue),
            };
          }

          if (transaction.description === getFixedEntryMarker(entry.id, targetMonthValue)) {
            return {
              ...transaction,
              amount: targetAmount,
              date: `${sourceMonthValue}-${transaction.date.slice(8, 10)}`,
              description: getFixedEntryMarker(entry.id, sourceMonthValue),
            };
          }

          return transaction;
        }),
      );
    }

    if (entry.linkedBillGroupId) {
      const nextBillsGroup: Bill[] = bills
        .filter((bill) => (bill.recurringGroupId ?? bill.id) === entry.linkedBillGroupId)
        .map((bill) => {
          const billMonthValue = bill.dueDate.slice(0, 7);
          return {
            ...bill,
            amount: updatedEntry.amountByMonth[billMonthValue] ?? 0,
            status: (updatedEntry.completedMonths.includes(billMonthValue) ? "paid" : "pending") as Bill["status"],
          };
        });

      setBills((current) =>
        current.map((bill) => {
          const syncedBill = nextBillsGroup.find((item) => item.id === bill.id);
          return syncedBill ?? bill;
        }),
      );
      setTransactions((current) => rebuildTransactionsForBills(current, nextBillsGroup));
    }
  }

  function openMonthlyGridRowModal(row: MonthlyGridRow) {
    openCommitmentEditorFromGrid(row, selectedMonth);
  }

  function beginMonthlyGridDrag(rowId: string, monthValue: string) {
    monthlyGridClickSuppressedUntilRef.current = Date.now() + 500;
    setDraggedGridCell({ rowId, monthValue });
  }

  function endMonthlyGridDrag() {
    monthlyGridClickSuppressedUntilRef.current = Date.now() + 250;
    setDraggedGridCell(null);
  }

  function openMonthlyGridCellEditor(row: MonthlyGridRow, monthValue: string) {
    if (Date.now() < monthlyGridClickSuppressedUntilRef.current) {
      return;
    }

    if (row.sourceType === "card_auto_bill") {
      openCardDetails(row.sourceId, monthValue);
      return;
    }

    openCommitmentEditorFromGrid(row, monthValue);
  }

  function handleDebtAdvance(debtId: string) {
    const debt = debts.find((item) => item.id === debtId);
    if (!debt || debt.status !== "active") {
      return;
    }

    const paymentDetails = getPlannedPaymentDetails(
      debt.plannedPaymentMethod,
      debt.plannedCardId,
      "credit",
      cards,
    );
    const paymentAmount = Math.min(debt.installmentAmount, debt.remainingAmount);
    const linkedEntry = getLinkedDebtEntry(debt.id);
    const nextPlannedMonth = linkedEntry
      ? Object.entries(linkedEntry.amountByMonth)
          .filter(
            ([monthValue, amount]) =>
              amount > 0 &&
              !linkedEntry.completedMonths.includes(monthValue) &&
              monthValue >= selectedMonth,
          )
          .sort(([left], [right]) => left.localeCompare(right))[0]?.[0] ??
        Object.entries(linkedEntry.amountByMonth)
          .filter(([monthValue, amount]) => amount > 0 && !linkedEntry.completedMonths.includes(monthValue))
          .sort(([left], [right]) => left.localeCompare(right))[0]?.[0]
      : undefined;

    setDebts((current) =>
      current.map((debt) => {
        if (debt.id !== debtId || debt.status !== "active") {
          return debt;
        }

        const nextPaidAmount = Math.min(debt.totalAmount, debt.paidAmount + paymentAmount);
        const nextInstallments = Math.min(debt.totalInstallments, debt.paidInstallments + 1);
        const remainingAmount = Math.max(0, debt.totalAmount - nextPaidAmount);

        return {
          ...debt,
          paidAmount: nextPaidAmount,
          paidInstallments: nextInstallments,
          remainingAmount,
          status: remainingAmount === 0 ? "settled" : "active",
        };
      }),
    );

    if (linkedEntry && nextPlannedMonth) {
      setFixedEntries((current) =>
        current.map((entry) =>
          entry.id === linkedEntry.id
            ? {
                ...entry,
                completedMonths: entry.completedMonths.includes(nextPlannedMonth)
                  ? entry.completedMonths
                  : [...entry.completedMonths, nextPlannedMonth],
              }
            : entry,
        ),
      );
    }

    setTransactions((current) => [
      {
        id: crypto.randomUUID(),
        title: `Abatimento ${debt.name}`,
        type: "expense",
        amount: paymentAmount,
        date: `${selectedMonth}-14`,
        categoryId: defaultBillCategoryId,
        categoryName: categories.find((category) => category.id === defaultBillCategoryId)?.name ?? "Fatura",
        paymentMethod: paymentDetails.transactionMethod,
        status: "paid",
        expenseKind: "debt_payment",
        accountId: settings.defaultAccountId,
        cardId: paymentDetails.cardId,
        cardMode: paymentDetails.cardMode,
        description: `Abatimento registrado na tela de dividas - ${paymentDetails.label}`,
      },
      ...current,
    ]);
  }

  function createTransactionDraft(transaction?: Transaction, scope: "single" | "group" = "single"): DraftTransaction {
    if (!transaction) {
      return initialDraftTransaction;
    }

    const groupTransactions =
      scope === "group" && transaction.installmentGroupId
        ? transactions
            .filter((item) => item.installmentGroupId === transaction.installmentGroupId)
            .sort((left, right) => (left.installmentNumber ?? 0) - (right.installmentNumber ?? 0))
        : [transaction];
    const firstTransaction = groupTransactions[0] ?? transaction;
    const totalAmount = groupTransactions.reduce((sum, item) => sum + item.amount, 0);
    const paymentOption: DraftTransaction["paymentOption"] =
      firstTransaction.paymentMethod === "credit_card" || firstTransaction.paymentMethod === "debit_card"
        ? "card"
        : firstTransaction.paymentMethod;

    return {
      title: firstTransaction.title,
      type: firstTransaction.type,
      operationKind:
        firstTransaction.type === "income"
          ? "income"
          : firstTransaction.expenseKind === "investment"
            ? "investment"
            : firstTransaction.expenseKind === "debt_payment"
              ? "debt_payment"
              : firstTransaction.expenseKind === "basic_bill"
                ? "basic_bill"
                : firstTransaction.expenseKind === "planned_purchase"
                  ? "planned_purchase"
                  : "variable",
      amount: String(Number(totalAmount.toFixed(2))),
      date: firstTransaction.date,
      categoryId: firstTransaction.categoryId,
      paymentOption,
      cardId: firstTransaction.cardId ?? settings.defaultCardId,
      cardMode: firstTransaction.cardMode ?? "credit",
      installments: scope === "group" ? Math.max(1, groupTransactions.length) : 1,
      accountId: firstTransaction.accountId ?? settings.defaultAccountId,
      description: firstTransaction.description ?? firstTransaction.notes ?? "",
      linkedPlannedPurchaseId: firstTransaction.linkedPlannedPurchaseId ?? "",
    };
  }

  function openTransactionModal(transaction?: Transaction, scope: "single" | "group" = "single") {
    setEditingTransactionId(transaction?.id ?? null);
    setEditingTransactionScope(scope);
    setDraftTransaction(createTransactionDraft(transaction, scope));
    setDraftTransactionError(null);
    setIsTransactionModalOpen(true);
  }

  function closeTransactionModal() {
    setIsTransactionModalOpen(false);
    setEditingTransactionId(null);
    setEditingTransactionScope("single");
    setDraftTransaction(initialDraftTransaction);
    setDraftTransactionError(null);
  }

  function requestTransactionAction(transaction: Transaction, action: "edit" | "delete") {
    if (transaction.installmentGroupId && (transaction.installmentTotal ?? 1) > 1) {
      setTransactionScopePrompt({ action, transactionId: transaction.id });
      return;
    }

    if (action === "edit") {
      openTransactionModal(transaction, "single");
      return;
    }

    setTransactions((current) => current.filter((item) => item.id !== transaction.id));
  }

  function applyTransactionScopeAction(scope: "single" | "group") {
    if (!transactionScopePrompt) {
      return;
    }

    const transaction = transactions.find((item) => item.id === transactionScopePrompt.transactionId);
    if (!transaction) {
      setTransactionScopePrompt(null);
      return;
    }

    if (transactionScopePrompt.action === "edit") {
      openTransactionModal(transaction, scope);
      setTransactionScopePrompt(null);
      return;
    }

    setTransactions((current) =>
      current.filter((item) =>
        scope === "group" && transaction.installmentGroupId
          ? item.installmentGroupId !== transaction.installmentGroupId
          : item.id !== transaction.id,
      ),
    );
    setTransactionScopePrompt(null);
  }

  function getAvailableDraftModes() {
    if (!selectedDraftCard) {
      return ["credit"] as CardMode[];
    }

    if (selectedDraftCard.availableMode === "both") {
      return ["credit", "debit"] as CardMode[];
    }

    return [selectedDraftCard.availableMode];
  }

  function renderImportBrowseModal() {
    if (!importBrowseModalOpen || !importBrowseItem) return null;

    const itemMonth = importBrowseItem.date.slice(0, 7);
    const searchLower = importBrowseSearch.toLowerCase();

    interface BrowseEntry {
      id: string;
      kind: "planned_purchase" | "bill" | "fixed_entry" | "card_bill";
      label: string;
      amount: number;
      matchValue: string;
    }

    const allEntries: BrowseEntry[] = [];

    if (importBrowseFilter === "all" || importBrowseFilter === "planned_purchase") {
      activePlannedPurchases.forEach((purchase) => {
        const plannedAmount = getPlannedPurchaseAmountByMonth(purchase)[itemMonth] ?? purchase.estimatedValue;
        allEntries.push({
          id: purchase.id,
          kind: "planned_purchase",
          label: purchase.name,
          amount: plannedAmount,
          matchValue: `planned_purchase:${purchase.id}`,
        });
      });
    }

    if (importBrowseFilter === "all" || importBrowseFilter === "bill") {
      activeBills
        .filter((bill) => bill.status !== "paid")
        .forEach((bill) => {
          allEntries.push({
            id: bill.id,
            kind: "bill",
            label: bill.title,
            amount: bill.amount,
            matchValue: `bill:${bill.id}`,
          });
        });
    }

    if (importBrowseFilter === "all" || importBrowseFilter === "fixed_entry") {
      activeFixedEntries
        .filter((entry) => (entry.amountByMonth[itemMonth] ?? 0) > 0)
        .forEach((entry) => {
          allEntries.push({
            id: entry.id,
            kind: "fixed_entry",
            label: entry.title,
            amount: entry.amountByMonth[itemMonth] ?? 0,
            matchValue: `fixed_entry:${entry.id}`,
          });
        });
    }

    if (importBrowseFilter === "all" || importBrowseFilter === "card_bill") {
      cards.forEach((card) => {
        const cardBillAmount = getCardBillRealAmount(card.id, itemMonth);
        const key = getCardBillEstimateKey(card.id, itemMonth);
        if (cardBillAmount > 0 && cardBillEstimates[key]?.status !== "paid") {
          allEntries.push({
            id: card.id,
            kind: "card_bill",
            label: `Fatura ${card.name}`,
            amount: cardBillAmount,
            matchValue: `card_bill_payment:${card.id}|${itemMonth}`,
          });
        }
      });
    }

    const filteredEntries = allEntries.filter((entry) => {
      if (!searchLower) return true;
      return entry.label.toLowerCase().includes(searchLower);
    });

    const kindLabels: Record<BrowseEntry["kind"], string> = {
      planned_purchase: "Compra planejada",
      bill: "Conta a pagar",
      fixed_entry: "Fixo recorrente",
      card_bill: "Fatura cartao",
    };

    function handleSelectBrowseEntry(matchValue: string) {
      setImportedStatementItems((current) =>
        current.map((currentItem) =>
          currentItem.id === importBrowseItem!.id
            ? { ...currentItem, suggestedMatch: parseImportMatchValue(matchValue) }
            : currentItem,
        ),
      );
      setImportBrowseModalOpen(false);
      setImportBrowseItem(null);
    }

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-lg overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex max-h-[80vh] flex-col">
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-sky-600">Buscar item para vincular</p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Selecione o item correto</h3>
              </div>
              <button
                type="button"
                onClick={() => { setImportBrowseModalOpen(false); setImportBrowseItem(null); }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 px-6 pt-4">
              <input
                value={importBrowseSearch}
                onChange={(e) => setImportBrowseSearch(e.target.value)}
                placeholder="Buscar por nome..."
                className="field bg-white w-full"
              />
              <div className="flex flex-wrap gap-1.5">
                {([
                  ["all", "Todos"],
                  ["planned_purchase", "Compras"],
                  ["bill", "Contas"],
                  ["fixed_entry", "Fixos"],
                  ["card_bill", "Faturas"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setImportBrowseFilter(key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      importBrowseFilter === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {filteredEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Nenhum item encontrado.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredEntries.map((entry) => (
                    <button
                      key={`${entry.kind}:${entry.id}`}
                      type="button"
                      onClick={() => handleSelectBrowseEntry(entry.matchValue)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{entry.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{kindLabels[entry.kind]}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-700">{formatCurrency(entry.amount)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex shrink-0 justify-end border-t border-slate-200/80 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => { setImportBrowseModalOpen(false); setImportBrowseItem(null); }}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>,
    );
  }

  function renderGlobalModal(content: React.ReactNode) {
    if (typeof document === "undefined") {
      return content;
    }

    return createPortal(content, document.body);
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="flex min-h-screen">
        <NavigationRail
          activeView={activeView}
          onNavigate={handleNavigate}
          activeHomeTab={homeTab}
          onHomeTabNavigate={(tabId) => updateHomeLocation(tabId)}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-4 lg:px-5">
          <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-slate-950">{activeViewLabel}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">{activeViewSubtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[168px]">
                  <CustomSelect
                    id="header-month-select"
                    value={selectedMonth}
                    onChange={handleMonthChange}
                    options={availableAnalysisMonths.map((monthValue) => ({
                      value: monthValue,
                      label: formatMonthLabel(monthValueToDate(monthValue)),
                      icon: Calendar,
                    }))}
                    className="w-full"
                  />
                </div>
                <div
                  className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm ${remoteSaveTone}`}
                  title={
                    remoteSaveError ??
                    (lastRemoteSavedLabel ? `Ultimo salvamento: ${lastRemoteSavedLabel}` : undefined)
                  }
                >
                  <span className={`h-2 w-2 rounded-full ${remoteSaveDot}`} />
                  <div className="text-left">
                    <p className="font-semibold">
                      {remoteSaveLabel}
                    </p>
                  </div>
                  {remoteSaveStatus === "error" ? (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold transition hover:bg-white"
                    >
                      Recarregar
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAlertsPanelOpen((current) => !current)}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-sm text-white">
                      !
                    </span>
                    {headerFocusItems.length} foco
                  </button>
                  {isAlertsPanelOpen ? (
                    <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-[340px] max-w-[90vw] rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                            Alertas e foco da semana
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAlertsPanelOpen(false)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                        >
                          Fechar
                        </button>
                      </div>
                      <div className="space-y-3">
                        {headerFocusItems.map((item) => (
                          <div
                            key={item.id}
                            className={`rounded-2xl border px-4 py-3 ${
                              item.tone === "danger"
                                ? "border-red-200 bg-red-50"
                                : item.tone === "warn"
                                  ? "border-orange-200 bg-orange-50"
                                  : item.tone === "accent"
                                    ? "border-violet-200 bg-violet-50"
                                    : "border-sky-200 bg-sky-50"
                            }`}
                          >
                            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <main className="pb-24 lg:pb-6">
            {activeView === "home" && renderDashboard()}
            {activeView === "transactions" && renderTransactionsWorkspace()}
            {activeView === "history" && renderReports()}
            {activeView === "reconciliation" && renderReconciliationWorkspace()}
            {activeView === "settings" && renderSettingsWorkspace()}
          </main>

          <MobileNavigation activeView={activeView} onNavigate={handleNavigate} />
        </div>
      </div>
    </div>
  );

  function renderDashboard() {
    const homeTabs: Array<{ id: HomeTab; label: string; description: string; icon: React.ElementType }> = [
      {
        id: "grid",
        label: "Resumo",
        description: "Planilha principal",
        icon: Table,
      },
      {
        id: "planning",
        label: "Planejamento",
        description: "Compras e metas",
        icon: Target,
      },
      {
        id: "accounts",
        label: "Contas",
        description: "Obrigacoes",
        icon: Wallet,
      },
      {
        id: "cards",
        label: "Cartoes",
        description: "Faturas",
        icon: CreditCard,
      },
      {
        id: "imports",
        label: "Importar",
        description: "Extratos",
        icon: CheckCircle2,
      },
    ];

    return (
      <div className="space-y-4">
        <div className="lg:hidden">
          <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            {homeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => updateHomeLocation(tab.id)}
                className={`group flex min-w-[132px] items-center gap-2 rounded-xl px-3 py-2 text-left transition duration-200 ${
                  homeTab === tab.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <div>
                  <span className="block text-xs font-semibold">{tab.label}</span>
                  <span
                    className={`mt-0.5 block text-[10px] ${
                      homeTab === tab.id ? "text-white/70" : "text-slate-400"
                    }`}
                  >
                    {tab.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="animate-home-section">
          {homeTab === "grid"
            ? renderTransactionsWorkspace()
            : homeTab === "planning"
              ? renderPlanning()
              : homeTab === "accounts"
                ? renderBills()
                : homeTab === "cards"
                  ? renderCardsHomeTab()
                  : renderImportWorkspace()}
        </div>
      </div>
    );
  }

  function renderImportWorkspace() {
    const reviewItems = importedStatementItems
      .filter((item) => item.status === "pending" || item.status === "duplicate")
      .sort((left, right) => right.date.localeCompare(left.date));
    const confirmedItems = importedStatementItems.filter((item) => item.status === "confirmed");
    const ignoredItems = importedStatementItems.filter((item) => item.status === "ignored");

    return (
      <div className="space-y-4">
        <Panel
          title="Importar extratos"
          description="Arquivos CSV e OFX entram como itens pendentes para revisao antes de virarem transacoes reais."
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr]">
            <FormField label="Origem">
              <CustomSelect
                value={importSourceKind}
                onChange={(value) => setImportSourceKind(value as ImportedStatementBatch["sourceKind"])}
                options={[
                  { value: "bank_account", label: "Conta bancaria", icon: Building2 },
                  { value: "credit_card", label: "Cartao de credito", icon: CreditCard },
                  { value: "unknown", label: "Detectar depois", icon: CheckCircle2 },
                ]}
              />
            </FormField>
            {importSourceKind === "credit_card" ? (
              <FormField label="Cartao">
                <CustomSelect
                  value={importCardId}
                  onChange={setImportCardId}
                  options={cards.map((card) => ({ value: card.id, label: card.name, icon: CreditCard }))}
                />
              </FormField>
            ) : (
              <FormField label="Conta">
                <CustomSelect
                  value={importAccountId}
                  onChange={setImportAccountId}
                  options={accounts.map((account) => ({ value: account.id, label: account.name, icon: Building2 }))}
                />
              </FormField>
            )}
            <FormField label="Arquivo CSV ou OFX">
              <input
                type="file"
                accept=".csv,.ofx,text/csv"
                onChange={(event) => {
                  void handleImportStatementFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
                className="field bg-white"
              />
            </FormField>
          </div>
          {importError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {importError}
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <MetricStack label="Batches" value={String(importedStatementBatches.length)} />
            <MetricStack label="Pendentes" value={String(reviewItems.filter((item) => item.status === "pending").length)} />
            <MetricStack label="Confirmados" value={String(confirmedItems.length)} />
            <MetricStack label="Ignorados" value={String(ignoredItems.length)} />
          </div>
        </Panel>

        <Panel title="Origens automaticas" description="Email e Open Finance ficam configurados para usar o mesmo fluxo de importacao quando houver autorizacao.">
          <div className="grid gap-3 lg:grid-cols-2">
            {importAutomationConfigs.map((config) => (
              <div key={config.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{config.label}</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          config.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : config.status === "disabled"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {importAutomationStatusLabels[config.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {config.processedExternalIds.length} origens processadas
                      {config.lastSyncAt ? ` - ultima sincronizacao ${formatShortDate(config.lastSyncAt.slice(0, 10))}` : ""}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={config.isEnabled}
                      onChange={(event) =>
                        handleUpdateImportAutomationConfig(config.id, {
                          isEnabled: event.target.checked,
                          status: event.target.checked ? "needs_authorization" : "paused",
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    Preparar
                  </label>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <FormField label="Provedor">
                    <input
                      value={config.provider ?? ""}
                      onChange={(event) => handleUpdateImportAutomationConfig(config.id, { provider: event.target.value })}
                      placeholder={config.transport === "email_attachment" ? "Gmail, Outlook..." : "Pluggy, Belvo..."}
                      className="field bg-white"
                    />
                  </FormField>
                  <FormField label="Conexao externa">
                    <input
                      value={config.externalConnectionId ?? ""}
                      onChange={(event) =>
                        handleUpdateImportAutomationConfig(config.id, { externalConnectionId: event.target.value })
                      }
                      placeholder="ID futuro do conector"
                      className="field bg-white"
                    />
                  </FormField>
                </div>

                {config.transport === "email_attachment" ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <FormField label="Remetentes">
                      <input
                        value={(config.allowedSenders ?? []).join(", ")}
                        onChange={(event) =>
                          handleUpdateImportAutomationConfig(config.id, {
                            allowedSenders: splitAutomationList(event.target.value),
                          })
                        }
                        placeholder="banco@email.com"
                        className="field bg-white"
                      />
                    </FormField>
                    <FormField label="Palavras-chave">
                      <input
                        value={(config.keywords ?? []).join(", ")}
                        onChange={(event) =>
                          handleUpdateImportAutomationConfig(config.id, {
                            keywords: splitAutomationList(event.target.value),
                          })
                        }
                        placeholder="extrato, fatura"
                        className="field bg-white"
                      />
                    </FormField>
                  </div>
                ) : null}

                <FormField label="Notas">
                  <textarea
                    value={config.notes ?? ""}
                    onChange={(event) => handleUpdateImportAutomationConfig(config.id, { notes: event.target.value })}
                    rows={3}
                    className="field min-h-20 bg-white"
                  />
                </FormField>

                {config.transport === "open_finance" ? (
                  <div className="mt-3 rounded-[24px] border border-sky-100 bg-sky-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Pluggy Connect</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Abre o fluxo seguro da Pluggy para selecionar banco, autenticar e autorizar o compartilhamento.
                        </p>
                        {pluggyConnectError ? (
                          <p className="mt-2 text-xs font-semibold text-red-600">{pluggyConnectError}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleOpenPluggyConnect()}
                        disabled={pluggyConnectStatus === "loading"}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {pluggyConnectStatus === "loading"
                          ? "Gerando token"
                          : config.externalConnectionId
                            ? "Reconectar"
                            : "Conectar Pluggy"}
                      </button>
                    </div>
                    {config.externalConnectionId ? (
                      <p className="mt-3 rounded-2xl bg-white/80 px-3 py-2 text-xs font-semibold text-sky-700">
                        Item conectado: {config.externalConnectionId}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateImportAutomationConfig(config.id, {
                        status: config.isEnabled ? "needs_authorization" : "planned",
                      })
                    }
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Registrar plano
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateImportAutomationConfig(config.id, { status: "disabled", isEnabled: false })}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Desativar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Revisao dos lancamentos" description="Confirme somente o que deve entrar no historico real.">
          <div className="space-y-3">
            {reviewItems.length ? (
              reviewItems.map((item) => {
                const transactionType = item.suggestedTransactionType ?? (item.direction === "inflow" ? "income" : "expense");
                const importMatchOptions = getImportMatchOptions(item);
                const selectedMatchValue = getImportMatchValue(item.suggestedMatch);
                const merchantOptions = [
                  { value: "none", label: "Sem lugar" },
                  ...importMerchants
                    .filter((merchant) => merchant.status !== "disabled")
                    .map((merchant) => ({ value: merchant.id, label: merchant.name })),
                ];
                const matchOptions = importMatchOptions.some((option) => option.value === selectedMatchValue)
                  ? importMatchOptions
                  : [
                      ...importMatchOptions,
                      {
                        value: selectedMatchValue,
                        label: item.suggestedMatch?.targetLabel ?? item.suggestedMatch?.reason ?? "Vinculo sugerido",
                      },
                    ];

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border px-4 py-4 ${
                      item.status === "duplicate"
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.rawDescription}</p>
                          {item.status === "duplicate" ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                              Duplicado
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatShortDate(item.date)} - {item.direction === "inflow" ? "Entrada" : "Saida"} - confianca {Math.round(item.confidence * 100)}%
                        </p>
                        {item.statementMonth ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
                            Vai para a fatura de {formatMonthLabel(monthValueToDate(item.statementMonth))}
                          </p>
                        ) : null}
                        {item.suggestedMatch ? (
                          <p className="mt-2 text-xs font-medium text-emerald-700">
                            Sugestao: {item.suggestedMatch.targetLabel ?? getImportMatchLabel(item.suggestedMatch.kind, item.suggestedMatch.targetId)} - {item.suggestedMatch.reason}
                          </p>
                        ) : null}
                        {item.appliedLearningRuleId ? (
                          <p className="mt-1 text-xs font-medium text-violet-700">
                            Regra aprendida aplicada.
                          </p>
                        ) : null}
                        {item.detectedMerchantId ? (
                          <p className="mt-1 text-xs font-medium text-sky-700">
                            Lugar detectado: {getImportMerchantLabel(item.detectedMerchantId)}.
                          </p>
                        ) : null}
                      </div>
                      <p className="text-lg font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-5">
                      <FormField label="Titulo no historico">
                        <input
                          value={item.reviewTitle ?? item.rawDescription}
                          onChange={(event) =>
                            setImportedStatementItems((current) =>
                              current.map((currentItem) =>
                                currentItem.id === item.id
                                  ? { ...currentItem, reviewTitle: event.target.value }
                                  : currentItem,
                              ),
                            )
                          }
                          placeholder="Ex: Pix para aluguel"
                          className="field bg-white"
                        />
                      </FormField>
                      <FormField label="Lugar">
                        <CustomSelect
                          value={item.detectedMerchantId ?? "none"}
                          onChange={(value) => {
                            if (value === "none") {
                              setImportedStatementItems((current) =>
                                current.map((currentItem) =>
                                  currentItem.id === item.id ? { ...currentItem, detectedMerchantId: undefined } : currentItem,
                                ),
                              );
                              return;
                            }

                            handleApplyImportMerchantToItem(item.id, value);
                          }}
                          options={merchantOptions}
                        />
                      </FormField>
                      <FormField label="Categoria">
                        <CustomSelect
                          value={item.suggestedCategoryId ?? ""}
                          onChange={(value) => {
                            if (value === "__create_new__") {
                              setPendingCategoryImportItemId(item.id);
                              openCategoryModal(undefined, { type: transactionType });
                              return;
                            }
                            setImportedStatementItems((current) =>
                              current.map((currentItem) =>
                                currentItem.id === item.id ? { ...currentItem, suggestedCategoryId: value || undefined } : currentItem,
                              ),
                            );
                          }}
                          options={[
                            { value: "", label: "Sem categoria", icon: Tag },
                            ...getAllCategorySelectOptions().map((option) => ({ ...option, icon: Tag })),
                            { value: "__create_new__", label: "+ Adicionar categoria", icon: Plus },
                          ]}
                        />
                      </FormField>
                      <FormField label="Metodo">
                        <CustomSelect
                          value={item.paymentMethod}
                          onChange={(value) =>
                            setImportedStatementItems((current) =>
                              current.map((currentItem) =>
                                currentItem.id === item.id
                                  ? { ...currentItem, paymentMethod: value as ImportedStatementItem["paymentMethod"] }
                                  : currentItem,
                              ),
                            )
                          }
                          options={[
                            { value: "pix", label: "Pix" },
                            { value: "bank_transfer", label: "Transferencia" },
                            { value: "debit_card", label: "Debito" },
                            { value: "credit_card", label: "Credito" },
                            { value: "cash", label: "Dinheiro" },
                            { value: "unknown", label: "Nao definido" },
                          ]}
                        />
                      </FormField>
                      <FormField label="Tipo">
                        <CustomSelect
                          value={transactionType}
                          onChange={(value) =>
                            setImportedStatementItems((current) =>
                              current.map((currentItem) =>
                                currentItem.id === item.id
                                  ? { ...currentItem, suggestedTransactionType: value as Transaction["type"] }
                                  : currentItem,
                              ),
                            )
                          }
                          options={[
                            { value: "expense", label: "Despesa" },
                            { value: "income", label: "Receita" },
                          ]}
                        />
                      </FormField>
                      <FormField label="Vinculo">
                        <CustomSelect
                          value={selectedMatchValue}
                          onChange={(value) => {
                            if (value === "browse_all") {
                              setImportBrowseItem(item);
                              setImportBrowseModalOpen(true);
                              setImportBrowseFilter("all");
                              setImportBrowseSearch("");
                              return;
                            }
                            if (value === "create_new") {
                              setPendingImportCreationItemId(item.id);
                              openBillModal();
                              return;
                            }
                            setImportedStatementItems((current) =>
                              current.map((currentItem) =>
                                currentItem.id === item.id
                                  ? { ...currentItem, suggestedMatch: parseImportMatchValue(value) }
                                  : currentItem,
                              ),
                            );
                          }}
                          options={matchOptions}
                        />
                      </FormField>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleIgnoreImportedItem(item.id)}
                        className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Ignorar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmImportedItem(item.id)}
                        disabled={item.status === "duplicate"}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Nenhum item pendente. Importe um arquivo para iniciar a revisao.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Aprendizado de importacao" description="Regras so aplicam automaticamente depois de aprovadas.">
          <div className="space-y-3">
            {importLearningRules.length ? (
              importLearningRules
                .slice()
                .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
                .map((rule) => {
                  const category = categories.find((item) => item.id === rule.suggestedCategoryId);
                  const canApprove = rule.status === "suggested" && rule.supportCount >= 2;

                  return (
                    <div key={rule.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{rule.pattern}</p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                rule.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : rule.status === "disabled"
                                    ? "bg-slate-100 text-slate-500"
                                    : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {rule.status === "approved" ? "Aprovada" : rule.status === "disabled" ? "Desativada" : "Sugerida"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {rule.sourceKind === "credit_card" ? "Cartao" : "Conta"} - {rule.supportCount} confirmacoes - {rule.mistakeCount} correcoes
                          </p>
                          <p className="mt-2 text-xs text-slate-600">
                            Sugere {category?.name ?? "categoria atual"}, {rule.suggestedTransactionType === "income" ? "receita" : "despesa"} e {paymentLabels[rule.paymentMethod ?? "pix"]}.
                            {rule.suggestedMatch ? ` Vinculo: ${rule.suggestedMatch.targetLabel ?? rule.suggestedMatch.reason}.` : ""}
                          </p>
                          {rule.status === "suggested" && !canApprove ? (
                            <p className="mt-2 text-xs font-medium text-amber-700">
                              Precisa de mais uma confirmacao parecida para liberar aprovacao.
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {rule.status === "disabled" ? (
                            <button
                              type="button"
                              onClick={() => handleEnableImportLearningRule(rule.id)}
                              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                            >
                              Ativar
                            </button>
                          ) : null}
                          {rule.status !== "approved" && rule.status !== "disabled" ? (
                            <button
                              type="button"
                              onClick={() => handleApproveImportLearningRule(rule.id)}
                              disabled={!canApprove && rule.supportCount < 2}
                              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              Aprovar
                            </button>
                          ) : null}
                          {rule.status !== "disabled" ? (
                            <button
                              type="button"
                              onClick={() => handleDisableImportLearningRule(rule.id)}
                              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Desativar
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                As regras aparecem aqui depois que voce confirma lancamentos parecidos.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Lugares aprendidos" description="Estabelecimentos, pessoas e destinos que o sistema reconhece nos extratos e faturas.">
          <div className="space-y-3">
            {importMerchants.length ? (
              importMerchants
                .slice()
                .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
                .map((merchant) => {
                  const merchantType = merchant.suggestedTransactionType ?? "expense";
                  const categoryOptions = getAllCategorySelectOptions().map((option) => ({ ...option, icon: Tag }));

                  return (
                    <div key={merchant.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{merchant.name}</p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                merchant.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : merchant.status === "disabled"
                                    ? "bg-slate-100 text-slate-500"
                                    : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {merchant.status === "approved" ? "Aprovado" : merchant.status === "disabled" ? "Desativado" : "Sugerido"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {merchant.sourceKind === "credit_card" ? "Cartao" : "Conta"} - {merchant.supportCount} confirmacoes - {merchant.mistakeCount} correcoes
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {merchant.status !== "approved" ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateImportMerchant(merchant.id, { status: "approved", mistakeCount: 0 })}
                              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                            >
                              Aprovar
                            </button>
                          ) : null}
                          {merchant.status !== "disabled" ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateImportMerchant(merchant.id, { status: "disabled" })}
                              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Desativar
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr_0.9fr]">
                        <FormField label="Nome amigavel">
                          <input
                            value={merchant.name}
                            onChange={(event) => handleUpdateImportMerchant(merchant.id, { name: event.target.value })}
                            className="field bg-white"
                          />
                        </FormField>
                        <FormField label="Apelidos detectados">
                          <input
                            value={merchant.aliases.join(", ")}
                            onChange={(event) =>
                              handleUpdateImportMerchant(merchant.id, {
                                aliases: splitAutomationList(event.target.value).map((alias) =>
                                  normalizeImportedDescription(alias),
                                ),
                              })
                            }
                            className="field bg-white"
                          />
                        </FormField>
                        <FormField label="Categoria">
                          <CustomSelect
                            value={merchant.suggestedCategoryId ?? ""}
                            onChange={(value) => {
                              if (value === "__create_new__") {
                                setPendingCategoryMerchantId(merchant.id);
                                openCategoryModal(undefined, { type: merchantType });
                                return;
                              }

                              handleUpdateImportMerchant(merchant.id, { suggestedCategoryId: value || undefined });
                            }}
                            options={[
                              { value: "", label: "Sem categoria", icon: Tag },
                              ...categoryOptions,
                              { value: "__create_new__", label: "+ Adicionar categoria", icon: Plus },
                            ]}
                          />
                        </FormField>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Lugares aparecem aqui depois que voce confirma lancamentos importados com um titulo amigavel.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Arquivos importados" description="Historico dos batches processados nesta base local.">
          <div className="space-y-3">
            {importedStatementBatches.length ? (
              importedStatementBatches.map((batch) => (
                <div key={batch.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{batch.fileName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {batch.fileType.toUpperCase()} - {batch.itemCount} itens - {batch.status}
                      </p>
                      {(batch.sourceInstitution || batch.periodStart || batch.periodEnd) ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {[batch.sourceInstitution, batch.periodStart && batch.periodEnd ? `${batch.periodStart} ate ${batch.periodEnd}` : undefined]
                            .filter(Boolean)
                            .join(" - ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {batch.confirmedCount} confirmados / {batch.duplicateCount} duplicados
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Nenhum arquivo importado ainda.
              </div>
            )}
          </div>
        </Panel>

        {pluggyConnectToken ? (
          <PluggyConnect
            connectToken={pluggyConnectToken}
            includeSandbox
            language="pt"
            theme="light"
            onSuccess={handlePluggyConnectSuccess}
            onError={handlePluggyConnectError}
            onLoadError={handlePluggyConnectError}
            onClose={() => {
              setPluggyConnectToken("");
              setPluggyConnectStatus((current) => (current === "connected" ? "connected" : "idle"));
            }}
          />
        ) : null}

        {renderImportBrowseModal()}
      </div>
    );
  }

  function renderTransactionsWorkspace() {
    const workspaceMode: "fixed" | "month" = activeView === "home" ? "fixed" : "month";
    const fixedSections = fixedSectionOrder.map((section) => ({
      section,
      rows: monthlyGridRows.filter((row) => normalizeFixedSection(row.section) === section),
    }));
    const fixedMonthlyComparison = salaryCalendarMonths.map((monthItem) => {
      const income = monthlyGridRows
        .filter((entry) => entry.paymentMethod && (entry.amountByMonth[monthItem.monthValue] ?? 0) > 0)
        .filter((entry) => {
          if (entry.sourceType === "planned_purchase") {
            return false;
          }

          if (entry.sourceType === "card_auto_bill") {
            return false;
          }

          return (fixedEntries.find((item) => item.id === entry.sourceId)?.kind ?? "expense") === "income";
        })
        .reduce((sum, entry) => sum + (entry.amountByMonth[monthItem.monthValue] ?? 0), 0);
      const expenses = monthlyGridRows
        .filter((entry) => {
          if (entry.sourceType === "card_auto_bill") {
            return true;
          }

          if (entry.sourceType === "planned_purchase") {
            return true;
          }

          return (fixedEntries.find((item) => item.id === entry.sourceId)?.kind ?? "expense") === "expense";
        })
        .reduce((sum, entry) => sum + (entry.amountByMonth[monthItem.monthValue] ?? 0), 0);

      return {
        monthValue: monthItem.monthValue,
        label: monthItem.label,
        income,
        expenses,
        balance: income - expenses,
      };
    });

    return (
      <div className="space-y-4">
        {workspaceMode === "fixed" ? (
          <div className="grid min-w-0 max-w-full gap-4">
            <Panel
              title=""
              description=""
            >
              <div className="mb-4 rounded-[26px] border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 px-4 py-4 lg:hidden">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">
                  Resumo rapido
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Use os blocos abaixo para acompanhar o mes. A planilha completa continua logo abaixo com rolagem por faixa.
                </p>
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold text-slate-500">Entradas do mes</p>
                  </div>
                  <p className="mt-2 text-xl font-semibold text-emerald-600">
                    {formatCurrency(fixedMonthPlannedIncome)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                      <TrendingDown className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold text-slate-500">Saidas do mes</p>
                  </div>
                  <p className="mt-2 text-xl font-semibold text-rose-600">
                    {formatCurrency(fixedMonthPlannedExpense)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold text-slate-500">Ja marcados</p>
                  </div>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{fixedMonthCompletedCount} itens</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <DollarSign className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold text-slate-500">Saldo previsto</p>
                  </div>
                  <p
                    className={`mt-2 text-xl font-semibold ${
                      fixedMonthPlannedIncome - fixedMonthPlannedExpense >= 0
                        ? "text-blue-600"
                        : "text-rose-600"
                    }`}
                  >
                    {formatCurrency(fixedMonthPlannedIncome - fixedMonthPlannedExpense)}
                  </p>
                </div>
              </div>

              <div className="mt-4 max-w-full overflow-x-auto pb-2">
                <div className="w-full min-w-[820px] rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-2">
                    <p className="text-sm font-semibold text-slate-950">Comparativo mensal</p>
                    <p className="max-w-full text-xs font-medium text-slate-500">
                      Ganhos - Gastos = Saldo previsto
                    </p>
                  </div>
                  <table className="w-full border-separate border-spacing-0 text-[11px]">
                    <thead>
                      <tr className="text-left">
                        <th className="min-w-[96px] rounded-l-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                          Linha
                        </th>
                        {fixedMonthlyComparison.map((monthItem) => (
                          <th
                            key={monthItem.monthValue}
                            className={`min-w-[72px] border border-slate-200 px-2 py-2 text-center text-[10px] uppercase tracking-[0.14em] ${
                              monthItem.monthValue === selectedMonth ? "bg-blue-50 text-blue-700 ring-1 ring-blue-400" : "bg-slate-50 text-slate-500"
                            }`}
                          >
                            {monthItem.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th className="rounded-l-xl border border-slate-200 bg-emerald-50 px-3 py-2.5 text-left text-[10px] uppercase tracking-[0.14em] text-emerald-700">
                          Entradas
                        </th>
                        {fixedMonthlyComparison.map((monthItem) => (
                          <td
                            key={`income-${monthItem.monthValue}`}
                            className={`border border-slate-200 px-2 py-2.5 text-center font-semibold text-emerald-700 ${
                              monthItem.monthValue === selectedMonth ? "bg-blue-50 ring-1 ring-blue-400" : "bg-white"
                            }`}
                          >
                            {monthItem.income > 0 ? formatCurrency(monthItem.income) : "-"}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th className="rounded-l-xl border border-slate-200 bg-rose-50 px-3 py-2.5 text-left text-[10px] uppercase tracking-[0.14em] text-rose-700">
                          Saidas
                        </th>
                        {fixedMonthlyComparison.map((monthItem) => (
                          <td
                            key={`expenses-${monthItem.monthValue}`}
                            className={`border border-slate-200 px-2 py-2.5 text-center font-semibold text-rose-600 ${
                              monthItem.monthValue === selectedMonth ? "bg-blue-50 ring-1 ring-blue-400" : "bg-white"
                            }`}
                          >
                            {monthItem.expenses > 0 ? formatCurrency(monthItem.expenses) : "-"}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th className="rounded-l-xl border border-slate-200 bg-blue-50 px-3 py-2.5 text-left text-[10px] uppercase tracking-[0.14em] text-blue-700">
                          Saldo
                        </th>
                        {fixedMonthlyComparison.map((monthItem) => (
                          <td
                            key={`balance-${monthItem.monthValue}`}
                            className={`border border-slate-200 px-2 py-2.5 text-center font-semibold ${
                              monthItem.balance >= 0 ? "text-emerald-700" : "text-rose-600"
                            } ${monthItem.monthValue === selectedMonth ? "bg-blue-50 ring-1 ring-blue-400" : "bg-white"}`}
                          >
                            {formatCurrency(monthItem.balance)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-5 min-w-0 max-w-full space-y-4">
                {fixedSections.map(({ section, rows }) => {
                  const sectionTotal = rows.reduce(
                    (sum, row) =>
                      sum + salaryCalendarMonths.reduce((rowSum, monthItem) => rowSum + (row.amountByMonth[monthItem.monthValue] ?? 0), 0),
                    0,
                  );
                  const sectionCurrentMonthTotal = rows.reduce(
                    (sum, row) => sum + (row.amountByMonth[selectedMonth] ?? 0),
                    0,
                  );
                  const isCollapsed = collapsedFixedSections[section];
                  const rowGroups =
                    section === "Contas"
                      ? contasSubTypeOrder
                          .map((subType) => ({
                            key: subType,
                            rows: rows.filter((row) => getContasSubType(row) === subType),
                          }))
                      : [{ key: section, rows }];

                  return (
                    <div
                      key={section}
                      className={`min-w-0 overflow-hidden rounded-2xl border px-3 py-3 transition duration-200 ${fixedSectionStyles[section]}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p
                            className={`text-base font-semibold ${
                              section === "Ganhos" ? "text-emerald-800" : "text-rose-700"
                            }`}
                          >
                            {fixedSectionDisplayLabels[section]}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                              {rows.length} itens
                            </span>
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                              Mes atual {formatCurrency(sectionCurrentMonthTotal)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-start gap-2">
                          {section === "Contas" && (selectedTransactionIds.length > 0 || selectedBillGroupIds.length > 0) ? (
                            selectedGroupableCount >= 2 ? (
                              <button
                                type="button"
                                onClick={openGroupModal}
                                className="flex h-9 items-center gap-2 rounded-full bg-violet-600 px-4 text-xs font-semibold text-white transition hover:bg-violet-700"
                              >
                                <Tags className="h-4 w-4" />
                                Agrupar ({selectedGroupableCount})
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={clearTransactionSelection}
                                className="flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Limpar ({selectedTransactionIds.length + selectedBillGroupIds.length})
                              </button>
                            )
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              section === "Planejamento"
                                ? openPurchaseModal()
                                : openCommitmentModal(
                                    section === "Ganhos"
                                      ? { kind: "income", schedule: "recurring", paymentMethod: "pix" }
                                      : { kind: "expense", schedule: "once", paymentMethod: "pix" },
                                  )
                            }
                            aria-label={`Adicionar em ${fixedSectionDisplayLabels[section]}`}
                            title={`Adicionar ${section === "Ganhos" ? "ganho" : section === "Planejamento" ? "compra planejada" : "gasto"}`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedFixedSections((current) => ({
                                ...current,
                                [section]: !current[section],
                              }))
                            }
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            {isCollapsed ? "Expandir" : "Recolher"}
                          </button>
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-right">
                            <p className="text-[11px] font-semibold text-slate-500">Total do ano</p>
                            <p className="mt-2 text-base font-semibold text-slate-900">
                              {formatCurrency(sectionTotal)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {!isCollapsed ? (
                        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white pb-2 shadow-sm snap-x snap-proximity lg:snap-none">
                          <table className="w-full table-fixed border-separate border-spacing-0 text-[11px] lg:min-w-[1120px]">
                            <thead>
                              <tr className="text-left">
                                <th className="snap-start w-[85vw] border-b border-r border-slate-300 bg-slate-200 px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-slate-700 sm:w-[38vw] lg:sticky lg:left-0 lg:z-30 lg:w-[180px]">
                                  Item
                                </th>
                                {salaryCalendarMonths.map((monthItem) => (
                                  <th
                                    key={monthItem.monthValue}
                                    className={`snap-start z-20 w-[85vw] border-b border-r border-slate-300 bg-slate-200 px-1 py-3 text-center text-[10px] uppercase tracking-[0.14em] text-slate-700 sm:w-[38vw] lg:w-[78px] ${
                                      monthItem.monthValue === selectedMonth ? "bg-blue-100 text-blue-900 ring-2 ring-inset ring-blue-600" : ""
                                    }`}
                                  >
                                    {monthItem.label}
                                  </th>
                                ))}
                                <th className="snap-start w-[85vw] border-b border-slate-300 bg-slate-200 px-3 py-3 text-right text-[10px] uppercase tracking-[0.14em] text-slate-700 sm:w-[38vw] lg:w-[84px]">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rowGroups.map((group, groupIndex) => (
                                <Fragment key={group.key}>
                                  {section === "Contas" && groupIndex > 0 ? (
                                    <tr>
                                      <td colSpan={salaryCalendarMonths.length + 2} className="border-0 bg-transparent px-0 py-1">
                                        <div className="border-t border-dashed border-slate-300" />
                                      </td>
                                    </tr>
                                  ) : null}
                                  {section === "Contas" ? (
                                    <tr>
                                      <td colSpan={salaryCalendarMonths.length + 2} className="border-0 bg-transparent px-0 py-1.5">
                                        <div
                                          className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                                            group.key === "Contas fixas"
                                              ? "border-blue-200 bg-blue-50 text-blue-700"
                                              : group.key === "Dividas e acordos"
                                                ? "border-orange-200 bg-orange-50 text-orange-700"
                                                : group.key === "Compras planejadas"
                                                  ? "border-violet-200 bg-violet-50 text-violet-700"
                                                  : "border-sky-200 bg-sky-50 text-sky-700"
                                          }`}
                                        >
                                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                                            {group.key}
                                          </span>
                                          <span className="text-[10px] font-semibold">
                                            {group.rows.length} itens
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                  {group.rows.map((row) => (
                                <Fragment key={row.id}>
                                <tr className="align-top">
                                  <th className="snap-start w-[85vw] border-b border-r border-slate-200 bg-white p-1.5 text-left sm:w-[38vw] lg:sticky lg:left-0 lg:z-20 lg:w-[180px]">
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => openMonthlyGridRowModal(row)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          openMonthlyGridRowModal(row);
                                        }
                                      }}
                                      className="grid min-h-[64px] w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-200"
                                      aria-label={`Editar ${row.title}`}
                                    >
                                      <span className="min-w-0">
                                        <span className="block text-xs font-semibold text-slate-900">
                                          {row.title}
                                        </span>
                                        <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                          {getDisplayCategoryName(row.categoryId, row.categoryName)}
                                        </span>
                                      </span>
                                      <span className="flex flex-col items-end gap-1">
                                        {canDeleteMonthlyGridRow(row) ? (
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              requestMonthlyGridDelete(row);
                                            }}
                                            onKeyDown={(event) => {
                                              event.stopPropagation();
                                            }}
                                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200"
                                            aria-label={`Excluir ${row.title}`}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        ) : null}
                                        {row.sourceType === "card_auto_bill" ? (
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setExpandedCardBillRows((current) => ({
                                                ...current,
                                                [row.sourceId]: !current[row.sourceId],
                                              }));
                                            }}
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                setExpandedCardBillRows((current) => ({
                                                  ...current,
                                                  [row.sourceId]: !current[row.sourceId],
                                                }));
                                              }
                                            }}
                                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700 transition hover:bg-sky-100"
                                            aria-label={expandedCardBillRows[row.sourceId] ? "Recolher fatura" : "Expandir fatura"}
                                          >
                                            {expandedCardBillRows[row.sourceId] ? (
                                              <ChevronUp className="h-4 w-4" />
                                            ) : (
                                              <ChevronDown className="h-4 w-4" />
                                            )}
                                          </button>
                                        ) : null}
                                      </span>
                                    </div>
                                  </th>
                                  {salaryCalendarMonths.map((monthItem) => {
                                    const amount = row.amountByMonth[monthItem.monthValue] ?? 0;
                                    const isCompleted = row.completedMonths.includes(monthItem.monthValue);
                                    const isPurchaseRow = row.sourceType === "planned_purchase";
                                    const isCardAutoBillRow = row.sourceType === "card_auto_bill";
                                    const selectedMonthCellClass =
                                      monthItem.monthValue === selectedMonth ? "ring-2 ring-inset ring-sky-400" : "";
                                    const cardBillEstimate = isCardAutoBillRow
                                      ? cardBillEstimates[getCardBillEstimateKey(row.sourceId, monthItem.monthValue)]
                                      : undefined;

                                    return (
                                      <td
                                        key={monthItem.monthValue}
                                        className={`border-b border-r border-slate-200 bg-white p-1 ${
                                          monthItem.monthValue === selectedMonth ? "bg-sky-50/80 ring-1 ring-inset ring-sky-200" : ""
                                        }`}
                                        onDragOver={(event) => {
                                          if (draggedGridCell?.rowId === row.id && !isCardAutoBillRow) {
                                            event.preventDefault();
                                          }
                                        }}
                                        onDrop={(event) => {
                                          event.preventDefault();
                                          if (draggedGridCell?.rowId !== row.id || isCardAutoBillRow) {
                                            return;
                                          }

                                          handleMoveMonthlyGridRow(
                                            row,
                                            draggedGridCell.monthValue,
                                            monthItem.monthValue,
                                          );
                                          setDraggedGridCell(null);
                                        }}
                                      >
                                        {isPurchaseRow ? (() => {
                                          const isRealPurchase = amount > 0 && row.paymentMethod && row.paymentMethod !== "credit_card";
                                          return (
                                          <div
                                            draggable={amount > 0}
                                            onDragStart={() =>
                                              amount > 0
                                                ? beginMonthlyGridDrag(row.id, monthItem.monthValue)
                                                : undefined
                                            }
                                            onDragEnd={endMonthlyGridDrag}
                                            onClick={() => openMonthlyGridCellEditor(row, monthItem.monthValue)}
                                            className={`flex h-full min-h-[72px] w-full flex-col justify-between rounded-xl border px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition duration-150 ${
                                              amount <= 0
                                                ? "border-slate-100 bg-slate-50/70 text-slate-300 hover:border-slate-200 hover:bg-white"
                                                : isRealPurchase
                                                  ? isCompleted
                                                    ? "cursor-grab border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100 active:cursor-grabbing"
                                                    : "cursor-grab border-emerald-100 bg-white text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 active:cursor-grabbing"
                                                  : isCompleted
                                                    ? "cursor-grab border-violet-200 bg-violet-50 text-violet-800 hover:border-violet-300 hover:bg-violet-100 active:cursor-grabbing"
                                                    : "cursor-grab border-violet-100 bg-white text-violet-700 hover:border-violet-200 hover:bg-violet-50 active:cursor-grabbing"
                                            } ${selectedMonthCellClass}`}
                                          >
                                            <input
                                              value={formatMoneyInputValue(amount)}
                                              onClick={(event) => event.stopPropagation()}
                                              onFocus={(event) => event.stopPropagation()}
                                              onChange={(event) =>
                                                handlePlannedPurchaseAmountChange(
                                                  row.sourceId,
                                                  monthItem.monthValue,
                                                  event.target.value,
                                                )
                                              }
                                              inputMode="decimal"
                                              placeholder="0"
                                              className="w-full bg-transparent text-[11px] font-semibold leading-tight tabular-nums outline-none placeholder:text-current/40"
                                            />
                                            <span className="mt-2 w-fit rounded-md border border-current/10 bg-white/75 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em]">
                                              {amount <= 0 ? "Sem valor" : isRealPurchase ? (row.paymentMethod === "pix" ? "Pix" : row.paymentMethod === "debit_card" ? "Debito" : "Abrir") : "Abrir"}
                                            </span>
                                          </div>
                                          );
                                        })() : isCardAutoBillRow ? (
                                          <div
                                            onClick={() =>
                                              openCardBillComparison(row.sourceId, monthItem.monthValue)
                                            }
                                            className={`flex min-h-[72px] w-full cursor-pointer flex-col justify-between rounded-xl border px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition duration-150 ${
                                              amount <= 0
                                                ? "border-slate-100 bg-slate-50/70 text-slate-300 hover:border-slate-200 hover:bg-white"
                                                : isCompleted
                                                  ? "border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-300 hover:bg-sky-100"
                                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                                            } ${selectedMonthCellClass}`}
                                          >
                                            <input
                                              value={formatMoneyInputValue(amount)}
                                              onClick={(event) => event.stopPropagation()}
                                              onFocus={(event) => event.stopPropagation()}
                                              onChange={(event) =>
                                                handleMonthlyGridAmountChange(row, monthItem.monthValue, event.target.value)
                                              }
                                              inputMode="decimal"
                                              placeholder="0"
                                              className="w-full bg-transparent text-[11px] font-semibold leading-tight tabular-nums outline-none placeholder:text-current/40"
                                            />
                                            {cardBillEstimate && !cardBillEstimate.isAutoEstimate ? (
                                              <div className="mt-2 flex flex-wrap gap-1">
                                                <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-violet-700">
                                                  Manual
                                                </span>
                                                {cardBillEstimate?.status === "paid" ? (
                                                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
                                                    Pago
                                                  </span>
                                                ) : null}
                                              </div>
                                            ) : cardBillEstimate?.status === "paid" ? (
                                              <div className="mt-2 flex flex-wrap gap-1">
                                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
                                                  Pago
                                                </span>
                                              </div>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <div
                                            draggable={amount > 0}
                                            onDragStart={() =>
                                              amount > 0
                                                ? beginMonthlyGridDrag(row.id, monthItem.monthValue)
                                                : undefined
                                            }
                                            onDragEnd={endMonthlyGridDrag}
                                            onClick={() => openMonthlyGridCellEditor(row, monthItem.monthValue)}
                                            className={`flex h-full min-h-[72px] w-full flex-col justify-between rounded-xl border px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition duration-150 ${
                                              amount <= 0
                                                ? "border-slate-100 bg-slate-50/70 text-slate-300 hover:border-slate-200 hover:bg-white"
                                                : isCompleted
                                                  ? row.section === "Ganhos"
                                                    ? "cursor-grab border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100 active:cursor-grabbing"
                                                    : "cursor-grab border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-300 hover:bg-sky-100 active:cursor-grabbing"
                                                  : row.section === "Ganhos"
                                                    ? "cursor-grab border-emerald-100 bg-white text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 active:cursor-grabbing"
                                                    : "cursor-grab border-rose-100 bg-white text-rose-700 hover:border-rose-200 hover:bg-rose-50 active:cursor-grabbing"
                                            } ${selectedMonthCellClass}`}
                                          >
                                            <div className="flex items-start justify-between">
                                              <input
                                                value={formatMoneyInputValue(amount)}
                                                onClick={(event) => event.stopPropagation()}
                                                onFocus={(event) => event.stopPropagation()}
                                                onChange={(event) =>
                                                  handleMonthlyGridAmountChange(row, monthItem.monthValue, event.target.value)
                                                }
                                                inputMode="decimal"
                                                placeholder="0"
                                                className="w-full bg-transparent text-[11px] font-semibold leading-tight tabular-nums outline-none placeholder:text-current/40"
                                              />
                                              {row.sourceType === "fixed" && amount > 0 ? (
                                                <button
                                                  type="button"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleToggleFixedEntryMonth(row.sourceId, monthItem.monthValue);
                                                  }}
                                                  className={`ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${
                                                    isCompleted
                                                      ? "bg-emerald-500 text-white"
                                                      : "bg-white/70 text-slate-400 hover:bg-white hover:text-emerald-500"
                                                  }`}
                                                  aria-label={isCompleted ? "Desmarcar como pago" : "Marcar como pago"}
                                                >
                                                  {isCompleted ? <Check className="h-3 w-3" /> : null}
                                                </button>
                                              ) : null}
                                            </div>
                                            <span className="mt-2 w-fit rounded-md border border-current/10 bg-white/75 px-1.5 py-0.5 text-left text-[8px] font-bold uppercase tracking-[0.12em]">
                                              {amount <= 0 ? "Sem valor" : "Abrir"}
                                            </span>
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="border-b border-slate-200 bg-white px-3 py-2.5 text-right">
                                    <p className="text-[11px] font-semibold tabular-nums text-slate-900">
                                      {formatCurrency(
                                        salaryCalendarMonths.reduce((sum, monthItem) => sum + (row.amountByMonth[monthItem.monthValue] ?? 0), 0),
                                      )}
                                    </p>
                                  </td>
                                </tr>
                                {row.sourceType === "card_auto_bill" && expandedCardBillRows[row.sourceId]
                                  ? (() => {
                                      const allItemsByMonth = salaryCalendarMonths.map((monthItem) => ({
                                        monthValue: monthItem.monthValue,
                                        items: getCardStatementGridItems(row.sourceId, monthItem.monthValue),
                                      }));
                                      const itemIds = Array.from(
                                        new Set(
                                          allItemsByMonth.flatMap(({ items }) => items.map((item) => item.id)),
                                        ),
                                      );
                                      const itemRows = itemIds
                                        .map((itemId) => {
                                          const amountsByMonth = Object.fromEntries(
                                            allItemsByMonth.map(({ monthValue, items }) => [
                                              monthValue,
                                              items
                                                .filter((item) => item.id === itemId)
                                                .reduce((sum, item) => sum + item.amount, 0),
                                            ]),
                                          ) as Record<string, number>;
                                          const firstItem = allItemsByMonth
                                            .flatMap(({ items }) => items)
                                            .find((item) => item.id === itemId);
                                          const total = Object.values(amountsByMonth).reduce((sum, amountValue) => sum + amountValue, 0);

                                          return firstItem && total !== 0
                                            ? {
                                                ...firstItem,
                                                amountsByMonth,
                                                total,
                                              }
                                            : null;
                                        })
                                        .filter((item): item is CardStatementGridItem & { amountsByMonth: Record<string, number>; total: number } => Boolean(item))
                                        .sort((left, right) => left.sortKey.localeCompare(right.sortKey));

                                      if (!itemRows.length) {
                                        return null;
                                      }

                                      const getGroupItems = (itemGroupId: string) =>
                                        itemRows.filter((currentItem) => getCardStatementItemGroup(currentItem)?.id === itemGroupId);

                                      return [
                                        ...itemRows.map((item) => {
                                          const selectableTransactionId =
                                            item.sourceType === "transaction" ? item.sourceId : null;
                                          const selectableBillGroupId = isSelectableBillStatementItem(item) ? item.sourceId : null;
                                          const itemBill = selectableBillGroupId
                                            ? getBillByStatementGroupId(selectableBillGroupId)
                                            : undefined;
                                          const isItemSelected = selectableTransactionId
                                            ? selectedTransactionIds.includes(selectableTransactionId)
                                            : selectableBillGroupId
                                              ? selectedBillGroupIds.includes(selectableBillGroupId)
                                              : false;
                                          const itemTransaction = selectableTransactionId
                                            ? transactions.find((t) => t.id === selectableTransactionId)
                                            : undefined;
                                          const itemGroupId = itemTransaction?.groupId ?? itemBill?.groupId;
                                          const itemGroup = itemGroupId ? transactionGroups.find((g) => g.id === itemGroupId) : null;
                                          const groupItems = itemGroup ? getGroupItems(itemGroup.id) : [];
                                          const isGroupExpanded = itemGroup ? expandedGroupId === itemGroup.id : false;
                                          const isFirstGroupItem = !itemGroup || groupItems[0]?.id === item.id;
                                          const isGroupSummary = Boolean(itemGroup && isFirstGroupItem && !isGroupExpanded);

                                          if (itemGroup && !isFirstGroupItem && !isGroupExpanded) {
                                            return null;
                                          }

                                          const rowAmountsByMonth = isGroupSummary
                                            ? (Object.fromEntries(
                                                salaryCalendarMonths.map((monthItem) => [
                                                  monthItem.monthValue,
                                                  groupItems.reduce(
                                                    (sum, groupItem) => sum + (groupItem.amountsByMonth[monthItem.monthValue] ?? 0),
                                                    0,
                                                  ),
                                                ]),
                                              ) as Record<string, number>)
                                            : item.amountsByMonth;
                                          const rowTotal = isGroupSummary
                                            ? Object.values(rowAmountsByMonth).reduce((sum, amountValue) => sum + amountValue, 0)
                                            : item.total;

                                          return (
                                            <tr key={`${row.id}-${item.id}`} className="align-top">
                                              <th className="w-[85vw] border-b border-r border-slate-200 bg-slate-50/80 px-2 py-2.5 text-left sm:w-[38vw] lg:sticky lg:left-0 lg:z-20 lg:w-[180px]">
                                                <div className={`rounded-xl border px-2 py-2 shadow-sm transition ${
                                                  isItemSelected
                                                    ? "border-violet-200 bg-violet-50"
                                                    : itemGroup
                                                      ? "border-violet-100 bg-white"
                                                      : "border-slate-200 bg-white"
                                                }`}>
                                                  <div className="flex items-start gap-2">
                                                    {selectableTransactionId || selectableBillGroupId ? (
                                                      <input
                                                        type="checkbox"
                                                        checked={isItemSelected}
                                                        onChange={() =>
                                                          selectableTransactionId
                                                            ? toggleTransactionSelection(selectableTransactionId)
                                                            : selectableBillGroupId
                                                              ? toggleBillGroupSelection(selectableBillGroupId)
                                                              : undefined
                                                        }
                                                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                                      />
                                                    ) : (
                                                      <span className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                    )}
                                                    <div>
                                                      {isGroupSummary && itemGroup ? (
                                                        <button
                                                          type="button"
                                                          onClick={() => setExpandedGroupId(itemGroup.id)}
                                                          className="flex w-full items-start justify-between gap-2 text-left"
                                                        >
                                                          <span>
                                                            <span className="block text-xs font-semibold text-slate-900">
                                                              {itemGroup.nome}
                                                            </span>
                                                            <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-violet-500">
                                                              {groupItems.length} {groupItems.length === 1 ? "item" : "itens"}
                                                            </span>
                                                          </span>
                                                          <ChevronDown className="h-4 w-4 shrink-0 text-violet-600" />
                                                        </button>
                                                      ) : (
                                                        <div className="flex w-full items-start justify-between gap-2">
                                                          <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                                                          {itemGroup && isFirstGroupItem ? (
                                                            <button
                                                              type="button"
                                                              onClick={() => setExpandedGroupId(null)}
                                                              className="rounded-lg bg-violet-50 p-1 text-violet-600 transition hover:bg-violet-100"
                                                              aria-label="Recolher grupo"
                                                            >
                                                              <ChevronUp className="h-3.5 w-3.5" />
                                                            </button>
                                                          ) : null}
                                                        </div>
                                                      )}
                                                      {itemGroup && (
                                                        <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">
                                                          {itemGroup.nome}
                                                        </span>
                                                      )}
                                                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                                        {isGroupSummary ? "Grupo de lancamentos" : item.support}
                                                      </p>
                                                    </div>
                                                  </div>
                                                </div>
                                              </th>
                                          {salaryCalendarMonths.map((monthItem) => {
                                            const itemAmount = rowAmountsByMonth[monthItem.monthValue] ?? 0;
                                            return (
                                              <td
                                                key={`${row.id}-${item.id}-${monthItem.monthValue}`}
                                                className={`border-b border-r border-slate-200 bg-white p-1 ${
                                                  monthItem.monthValue === selectedMonth ? "bg-sky-50/80 ring-1 ring-inset ring-sky-200" : ""
                                                }`}
                                              >
                                                <div
                                                  className={`flex min-h-[54px] w-full flex-col justify-between rounded-xl border px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition duration-150 ${
                                                    itemAmount === 0
                                                      ? "cursor-default border-slate-100 bg-slate-50/70 text-slate-300"
                                                      : itemAmount < 0
                                                        ? "border-emerald-100 bg-white text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50"
                                                        : isGroupSummary
                                                          ? "border-violet-100 bg-violet-50 text-violet-700 hover:border-violet-200 hover:bg-violet-100"
                                                          : "border-rose-100 bg-white text-rose-700 hover:border-rose-200 hover:bg-rose-50"
                                                  }`}
                                                >
                                                  {isGroupSummary ? (
                                                    <span className="text-[11px] font-semibold leading-tight tabular-nums">
                                                      {itemAmount > 0 ? formatCurrency(itemAmount) : "0"}
                                                    </span>
                                                  ) : (
                                                    <input
                                                      value={formatMoneyInputValue(itemAmount)}
                                                      onChange={(event) =>
                                                        handleCardStatementGridItemAmountChange(
                                                          row.sourceId,
                                                          item,
                                                          monthItem.monthValue,
                                                          event.target.value,
                                                        )
                                                      }
                                                      inputMode="decimal"
                                                      placeholder="0"
                                                      className="w-full bg-transparent text-[11px] font-semibold leading-tight tabular-nums outline-none placeholder:text-current/40"
                                                    />
                                                  )}
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      isGroupSummary && itemGroup
                                                        ? setExpandedGroupId(itemGroup.id)
                                                        : openCardDetails(row.sourceId, monthItem.monthValue)
                                                    }
                                                    disabled={itemAmount === 0}
                                                    className="mt-1 w-fit rounded-md border border-current/10 bg-white/75 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] transition hover:opacity-75 disabled:cursor-default disabled:opacity-60"
                                                  >
                                                    {itemAmount !== 0 ? (isGroupSummary ? "Expandir" : "Abrir") : "Sem valor"}
                                                  </button>
                                                </div>
                                              </td>
                                            );
                                          })}
                                          <td className="border-b border-slate-200 bg-white px-3 py-2.5 text-right">
                                            <p className="text-[11px] font-semibold tabular-nums text-slate-900">
                                              {formatCurrency(rowTotal)}
                                            </p>
                                          </td>
                                        </tr>
                                          );
                                        }),
                                      ];
                                    })()
                                  : null}
                                </Fragment>
                                  ))}
                                </Fragment>
                              ))}
                              <tr className="align-top">
                                <th className="w-[85vw] border-r border-t border-slate-200 bg-slate-900 px-3 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white sm:w-[38vw] lg:sticky lg:left-0 lg:z-30 lg:w-[180px]">
                                  Soma
                                </th>
                                {salaryCalendarMonths.map((monthItem) => {
                                  const amount = rows.reduce((sum, row) => sum + (row.amountByMonth[monthItem.monthValue] ?? 0), 0);
                                  return (
                                    <td
                                      key={`${section}-total-${monthItem.monthValue}`}
                                      className={`border-r border-t border-slate-200 bg-slate-900 px-1 py-3 text-center text-[10px] font-semibold tabular-nums text-white ${
                                        monthItem.monthValue === selectedMonth ? "bg-sky-200 text-sky-950" : ""
                                      }`}
                                    >
                                      {amount > 0 ? formatCurrency(amount) : "-"}
                                    </td>
                                  );
                                })}
                                <td className="border-t border-slate-200 bg-slate-900 px-3 py-3 text-right text-[10px] font-semibold tabular-nums text-white">
                                  {formatCurrency(sectionTotal)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Panel>

          {renderMonthlyGridDeleteConfirmModal()}
          {renderCardBillComparisonModal()}
          {renderCommitmentModal()}
          {renderFixedEntryModal()}
          {renderPurchaseModal()}
          </div>
        ) : (
          <div className="grid gap-4">
            <Panel
              title="Transacoes do mes"
              description="Busca, filtros e leitura rapida"
              action={
                <button
                  type="button"
                  onClick={() => openTransactionModal()}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-2xl leading-none text-white transition hover:bg-slate-700"
                  aria-label="Nova transacao"
                >
                  +
                </button>
              }
            >
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar transacao..."
                  className="field"
                />
                <CustomSelect
                  value={transactionTypeFilter}
                  onChange={(val) =>
                    setTransactionTypeFilter(val as "all" | "income" | "expense")
                  }
                  options={[
                    { value: "all", label: "Todos os tipos" },
                    { value: "income", label: "Entradas" },
                    { value: "expense", label: "Saidas" },
                  ]}
                />
                <CustomSelect
                  value={paymentFilter}
                  onChange={(val) => setPaymentFilter(val as "all" | PaymentMethod)}
                  options={[
                    { value: "all", label: "Todos os meios" },
                    ...Object.entries(paymentLabels).map(([value, label]) => ({
                      value,
                      label,
                    })),
                  ]}
                />
              </div>

              <div className="mt-5 space-y-3">
                {selectedTransactionIds.length > 0 && (
                  <div className="flex items-center justify-between rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <p className="text-sm font-semibold text-violet-700">
                      {selectedTransactionIds.length} {selectedTransactionIds.length === 1 ? "selecionada" : "selecionadas"}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={clearTransactionSelection}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={openGroupModal}
                        disabled={selectedGroupableCount < 2}
                        className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                      >
                        Agrupar
                      </button>
                    </div>
                  </div>
                )}
                {filteredTransactions.map((transaction) => {
                  const isSelected = selectedTransactionIds.includes(transaction.id);
                  const group = transaction.groupId ? transactionGroups.find((g) => g.id === transaction.groupId) : null;

                  return (
                    <div
                      key={transaction.id}
                      className={`rounded-2xl border bg-white px-4 py-3 shadow-[0_18px_42px_rgba(15,23,42,0.05)] ${
                        isSelected ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTransactionSelection(transaction.id)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{transaction.title}</p>
                              {group && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                                  📦 {group.nome}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                              {getDisplayCategoryName(transaction.categoryId, transaction.categoryName)} - {paymentLabels[transaction.paymentMethod]} -{" "}
                              {formatShortDate(transaction.date)}
                            </p>
                            {transaction.description ? (
                              <p className="mt-2 text-sm text-slate-500">{transaction.description}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-lg font-semibold ${
                              transaction.type === "income" ? "text-emerald-600" : "text-red-500"
                            }`}
                          >
                            {transaction.type === "income" ? "+" : "-"}
                            {formatCurrency(transaction.amount)}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                            {transaction.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        )}

        {isTransactionModalOpen ? renderGlobalModal(
          <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                    {editingTransactionId ? "Editar transacao" : "Nova transacao"}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {editingTransactionId
                      ? editingTransactionScope === "group"
                        ? "Editar parcelamento"
                        : "Editar lancamento"
                      : "Adicionar lancamento"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Se a forma de pagamento for cartao, a modalidade define se existe parcela ou nao.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTransactionModal}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                  aria-label="Fechar modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="mt-6 space-y-4">
                {draftTransactionError ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {draftTransactionError}
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Titulo">
                    <input
                      value={draftTransaction.title}
                      onChange={(event) =>
                        setDraftTransaction((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Ex.: Gasolina da semana"
                      className="field"
                    />
                  </FormField>
                  <FormField label="Tipo">
                    <CustomSelect
                      value={draftTransaction.type}
                      onChange={(val) => {
                        const newType = val as "income" | "expense";
                        setDraftTransaction((current) => ({
                          ...current,
                          type: newType,
                          operationKind: newType === "income" ? "income" : "variable",
                          categoryId: getOperationDefaultCategoryId(
                            newType === "income" ? "income" : "variable",
                            newType,
                          ),
                          paymentOption:
                            newType === "income" ? "bank_transfer" : current.paymentOption,
                          linkedPlannedPurchaseId:
                            newType === "income" ? "" : current.linkedPlannedPurchaseId,
                        }));
                      }}
                      options={[
                        { value: "expense", label: "Saida" },
                        { value: "income", label: "Entrada" },
                      ]}
                    />
                  </FormField>
                </div>

                {draftTransaction.type === "expense" ? (
                  <FormField label="Tipo de lancamento">
                    <CustomSelect
                      value={draftTransaction.operationKind}
                      onChange={(val) => {
                        const operationKind = val as DraftTransaction["operationKind"];
                        setDraftTransaction((current) => ({
                          ...current,
                          operationKind,
                          categoryId: getOperationDefaultCategoryId(operationKind, current.type),
                          linkedPlannedPurchaseId:
                            operationKind === "planned_purchase" ? current.linkedPlannedPurchaseId : "",
                        }));
                      }}
                      options={[
                        { value: "variable", label: "Gasto comum" },
                        { value: "basic_bill", label: "Conta normal" },
                        { value: "recurring_bill", label: "Conta recorrente" },
                        { value: "debt_payment", label: "Divida / abatimento" },
                        { value: "investment", label: "Investimento" },
                        { value: "planned_purchase", label: "Compra planejada vinculada" },
                      ]}
                    />
                  </FormField>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Valor">
                    <input
                      value={draftTransaction.amount}
                      onChange={(event) =>
                        setDraftTransaction((current) => ({ ...current, amount: event.target.value }))
                      }
                      placeholder="0,00"
                      inputMode="decimal"
                      className="field"
                    />
                  </FormField>
                  <FormField label="Data">
                    <input
                      type="date"
                      value={draftTransaction.date}
                      onChange={(event) =>
                        setDraftTransaction((current) => ({ ...current, date: event.target.value }))
                      }
                      className="field"
                    />
                  </FormField>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Categoria">
                    <CustomSelect
                      value={draftTransaction.categoryId}
                      onChange={(val) =>
                        setDraftTransaction((current) => ({
                          ...current,
                          categoryId: val,
                        }))
                      }
                      options={getCategorySelectOptions(draftTransaction.type, {
                        includeHidden:
                          draftTransaction.operationKind === "investment" ||
                          draftTransaction.operationKind === "debt_payment",
                      }).map((opt) => ({ ...opt, icon: Tag }))}
                    />
                  </FormField>
                  <FormField label="Forma de pagamento">
                    <CustomSelect
                      value={draftTransaction.paymentOption}
                      onChange={(val) =>
                        setDraftTransaction((current) => ({
                          ...current,
                          paymentOption: val as DraftTransaction["paymentOption"],
                        }))
                      }
                      options={
                        draftTransaction.type === "income"
                          ? [
                              { value: "bank_transfer", label: "Transferencia" },
                              { value: "pix", label: "Pix" },
                              { value: "cash", label: "Dinheiro" },
                            ]
                          : [
                              { value: "pix", label: "Pix" },
                              { value: "cash", label: "Dinheiro" },
                              { value: "bank_transfer", label: "Transferencia" },
                              { value: "card", label: "Cartao" },
                            ]
                      }
                    />
                  </FormField>
                </div>

                {draftTransaction.type === "expense" && draftTransaction.paymentOption === "card" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Cartao">
                      <CustomSelect
                        value={draftTransaction.cardId}
                        onChange={(val) => {
                          const nextCard = cards.find((card) => card.id === val) ?? cards[0];
                          const nextMode =
                            nextCard.availableMode === "both" ? draftTransaction.cardMode : nextCard.availableMode;
                          setDraftTransaction((current) => ({
                            ...current,
                            cardId: val,
                            cardMode: nextMode,
                            installments: nextMode === "debit" ? 1 : current.installments,
                          }));
                        }}
                        options={cards.map((card) => ({
                          value: card.id,
                          label: card.name,
                          icon: CreditCard,
                        }))}
                      />
                    </FormField>
                    <FormField label="Modalidade">
                      <CustomSelect
                        value={draftTransaction.cardMode}
                        onChange={(val) =>
                          setDraftTransaction((current) => ({
                            ...current,
                            cardMode: val as CardMode,
                            installments: val === "debit" ? 1 : current.installments,
                          }))
                        }
                        options={getAvailableDraftModes().map((mode) => ({
                          value: mode,
                          label: mode === "credit" ? "Credito" : "Debito",
                        }))}
                      />
                  </FormField>
                </div>
                ) : null}

                {draftTransaction.type === "expense" &&
                draftTransaction.paymentOption === "card" &&
                draftTransaction.cardMode === "credit" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Parcelas">
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={draftTransaction.installments}
                        onChange={(event) =>
                          setDraftTransaction((current) => ({
                            ...current,
                            installments: Number(event.target.value || 1),
                          }))
                        }
                        className="field"
                      />
                    </FormField>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-sky-800">
                      Compras em credito com mais de 1 parcela geram lancamentos futuros automaticamente.
                    </div>
                  </div>
                ) : null}

                {draftTransaction.type === "expense" && activePlannedPurchases.length ? (
                  <FormField label="Vincular compra planejada">
                    <CustomSelect
                      value={draftTransaction.linkedPlannedPurchaseId}
                      onChange={(val) => {
                        const purchase = activePlannedPurchases.find((item) => item.id === val);
                        setDraftTransaction((current) => {
                          if (!purchase) {
                            return { ...current, linkedPlannedPurchaseId: "" };
                          }

                          const purchaseCategory = getPlannedPurchaseCategory(purchase);
                          const isCardPurchase = purchase.planningMode === "card_parcelado";
                          const plannedAmount =
                            getPlannedPurchaseAmountByMonth(purchase)[current.date.slice(0, 7)] ??
                            purchase.estimatedValue;

                          return {
                            ...current,
                            linkedPlannedPurchaseId: purchase.id,
                            title: current.title || purchase.name,
                            amount: current.amount
                              ? current.amount
                              : plannedAmount > 0
                                ? String(plannedAmount)
                                : "",
                            categoryId: purchaseCategory.id,
                            paymentOption: isCardPurchase
                              ? "card"
                              : purchase.plannedPaymentMethod === "card"
                                ? "pix"
                                : purchase.plannedPaymentMethod ?? "pix",
                            cardId: isCardPurchase ? purchase.plannedCardId ?? current.cardId : current.cardId,
                            cardMode: isCardPurchase ? "credit" : current.cardMode,
                            installments: isCardPurchase
                              ? Math.max(1, purchase.plannedInstallments ?? current.installments)
                              : current.installments,
                          };
                        });
                      }}
                      placeholder="Nenhuma"
                      options={activePlannedPurchases.map((purchase) => ({
                        value: purchase.id,
                        label: purchase.name,
                      }))}
                    />
                  </FormField>
                ) : null}

                <FormField label="Observacao">
                  <textarea
                    value={draftTransaction.description}
                    onChange={(event) =>
                      setDraftTransaction((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Informacao opcional para o historico"
                    rows={4}
                    className="field resize-none"
                  />
                </FormField>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeTransactionModal}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    {editingTransactionId ? "Salvar alteracao" : "Salvar transacao"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {isGroupModalOpen ? renderGlobalModal(
          <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-violet-600">
                    {editingGroupId ? "Editar grupo" : "Novo grupo"}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {editingGroupId ? "Renomear grupo" : "Agrupar transacoes"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeGroupModal}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                  aria-label="Fechar modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingGroupId) {
                    handleRenameGroup();
                  } else {
                    handleCreateGroup();
                  }
                }}
                className="mt-6 space-y-4"
              >
                <FormField label="Nome do grupo">
                  <input
                    value={draftGroupName}
                    onChange={(event) => setDraftGroupName(event.target.value)}
                    placeholder="Ex.: Compra Amazon, iFood noite"
                    className="field"
                    autoFocus
                  />
                </FormField>

                {!editingGroupId && selectedGroupableCount > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Itens selecionados ({selectedGroupableCount})
                    </p>
                    <div className="mt-2 space-y-1">
                      {[
                        ...selectedGroupableTransactionIds.map((id) => {
                          const transaction = transactions.find((tx) => tx.id === id);
                          return transaction
                            ? { id, title: transaction.title, amount: transaction.amount }
                            : null;
                        }),
                        ...selectedGroupableBillGroupIds.map((id) => {
                          const groupedBills = bills.filter((bill) => getBillStatementGroupId(bill) === id);
                          const firstBill = groupedBills[0];
                          return firstBill
                            ? {
                                id,
                                title: firstBill.title,
                                amount: groupedBills.reduce((sum, bill) => sum + bill.amount, 0),
                              }
                            : null;
                        }),
                      ]
                        .filter((item): item is { id: string; title: string; amount: number } => Boolean(item))
                        .slice(0, 5)
                        .map((item) => (
                          <p key={item.id} className="text-sm text-slate-700">
                            {item.title} - {formatCurrency(item.amount)}
                          </p>
                        ))}
                      {selectedGroupableCount > 5 && (
                        <p className="text-xs text-slate-500">
                          ...e mais {selectedGroupableCount - 5}
                        </p>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Total: {formatCurrency(
                        selectedGroupableTransactionIds.reduce((sum, id) => {
                          const t = transactions.find((tx) => tx.id === id);
                          return sum + (t?.amount ?? 0);
                        }, 0) +
                          selectedGroupableBillGroupIds.reduce((sum, id) => {
                            const groupedBills = bills.filter((bill) => getBillStatementGroupId(bill) === id);
                            return sum + groupedBills.reduce((billSum, bill) => billSum + bill.amount, 0);
                          }, 0),
                      )}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeGroupModal}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!draftGroupName.trim() || (!editingGroupId && selectedGroupableCount < 2)}
                    className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    {editingGroupId ? "Salvar" : "Criar grupo"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {transactionScopePrompt ? renderGlobalModal(
          <div className="fixed inset-0 z-[1010] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                Parcela detectada
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">
                Aplicar em qual parte?
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Esse lancamento faz parte de um parcelamento. Escolha se a acao vale so para esta parcela ou para todas.
              </p>
              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={() => applyTransactionScopeAction("single")}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  So esta parcela
                </button>
                <button
                  type="button"
                  onClick={() => applyTransactionScopeAction("group")}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Todas as parcelas
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionScopePrompt(null)}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  function renderInvestmentModal() {
    if (!isInvestmentModalOpen) {
      return null;
    }

    const usesCard =
      draftInvestment.paymentMethod === "credit_card" || draftInvestment.paymentMethod === "debit_card";

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                {editingInvestmentId ? "Editar investimento" : "Novo investimento"}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Investimentos
              </h3>
            </div>
            <button
              type="button"
              onClick={closeInvestmentModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSaveInvestment} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Nome">
                  <input
                    value={draftInvestment.name}
                    onChange={(event) =>
                      setDraftInvestment((current) => ({ ...current, name: event.target.value }))
                    }
                    className="field"
                    placeholder="Ex.: Reserva Tesouro"
                  />
                </FormField>
                <FormField label="Tipo">
                  <input
                    value={draftInvestment.type}
                    onChange={(event) =>
                      setDraftInvestment((current) => ({ ...current, type: event.target.value }))
                    }
                    className="field"
                    placeholder="Ex.: Renda fixa"
                  />
                </FormField>
              </div>

              <FormField label="Objetivo">
                <input
                  value={draftInvestment.objective}
                  onChange={(event) =>
                    setDraftInvestment((current) => ({ ...current, objective: event.target.value }))
                  }
                  className="field"
                  placeholder="Para que esse investimento existe"
                />
              </FormField>

              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label="Meta mensal">
                  <input
                    value={draftInvestment.monthlyTarget}
                    onChange={(event) =>
                      setDraftInvestment((current) => ({ ...current, monthlyTarget: event.target.value }))
                    }
                    inputMode="decimal"
                    className="field"
                  />
                </FormField>
                <FormField label="Total bruto">
                  <input
                    value={draftInvestment.totalGrossInvested}
                    onChange={(event) =>
                      setDraftInvestment((current) => ({
                        ...current,
                        totalGrossInvested: event.target.value,
                      }))
                    }
                    inputMode="decimal"
                    className="field"
                  />
                </FormField>
                <FormField label="Valor manual atual">
                  <input
                    value={draftInvestment.currentManualValue}
                    onChange={(event) =>
                      setDraftInvestment((current) => ({
                        ...current,
                        currentManualValue: event.target.value,
                      }))
                    }
                    inputMode="decimal"
                    className="field"
                  />
                </FormField>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <FormField label="Pagamento do aporte">
                  <CustomSelect
                    value={draftInvestment.paymentMethod}
                    onChange={(val) =>
                      setDraftInvestment((current) => ({
                        ...current,
                        paymentMethod: val as PaymentMethod,
                      }))
                    }
                    options={Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))}
                  />
                </FormField>
                <FormField label="Conta">
                  <CustomSelect
                    value={draftInvestment.accountId}
                    onChange={(val) =>
                      setDraftInvestment((current) => ({ ...current, accountId: val }))
                    }
                    options={accounts.map((account) => ({ value: account.id, label: account.name, icon: Building2 }))}
                  />
                </FormField>
                {usesCard ? (
                  <>
                    <FormField label="Cartao">
                      <CustomSelect
                        value={draftInvestment.cardId}
                        onChange={(val) =>
                          setDraftInvestment((current) => ({ ...current, cardId: val }))
                        }
                        options={cards.map((card) => ({ value: card.id, label: card.name, icon: CreditCard }))}
                      />
                    </FormField>
                    <FormField label="Modalidade">
                      <CustomSelect
                        value={draftInvestment.cardMode}
                        onChange={(val) =>
                          setDraftInvestment((current) => ({
                            ...current,
                            cardMode: val as CardMode,
                          }))
                        }
                        options={[
                          { value: "credit", label: "Credito" },
                          { value: "debit", label: "Debito" },
                        ]}
                      />
                    </FormField>
                  </>
                ) : null}
              </div>

              <FormField label="Observacoes">
                <textarea
                  value={draftInvestment.notes}
                  onChange={(event) =>
                    setDraftInvestment((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={3}
                  className="field resize-none"
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
              <button
                type="button"
                onClick={closeInvestmentModal}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Salvar investimento
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderInvestmentContributionModal() {
    if (!isInvestmentContributionModalOpen) {
      return null;
    }

    const selectedInvestment =
      investments.find((investment) => investment.id === draftInvestmentContribution.investmentId) ??
      investments[0];
    const usesCard =
      draftInvestmentContribution.paymentMethod === "credit_card" ||
      draftInvestmentContribution.paymentMethod === "debit_card";

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">Registrar aporte</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Investimentos
              </h3>
            </div>
            <button
              type="button"
              onClick={closeInvestmentContributionModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSaveInvestmentContribution} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Investimento">
                  <CustomSelect
                    value={draftInvestmentContribution.investmentId}
                    onChange={(val) => {
                      const nextInvestment = investments.find((item) => item.id === val);
                      setDraftInvestmentContribution((current) => ({
                        ...current,
                        investmentId: val,
                        paymentMethod: nextInvestment?.paymentMethod ?? current.paymentMethod,
                        accountId: nextInvestment?.accountId ?? current.accountId,
                        cardId: nextInvestment?.cardId ?? current.cardId,
                        cardMode: nextInvestment?.cardMode ?? current.cardMode,
                      }));
                    }}
                    options={investments.map((investment) => ({ value: investment.id, label: investment.name }))}
                  />
                </FormField>
                <FormField label="Data">
                  <input
                    type="date"
                    value={draftInvestmentContribution.contributionDate}
                    onChange={(event) =>
                      setDraftInvestmentContribution((current) => ({
                        ...current,
                        contributionDate: event.target.value,
                      }))
                    }
                    className="field"
                  />
                </FormField>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Valor do aporte">
                  <input
                    value={draftInvestmentContribution.amount}
                    onChange={(event) =>
                      setDraftInvestmentContribution((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    inputMode="decimal"
                    className="field"
                  />
                </FormField>
                <FormField label="Forma de pagamento">
                  <CustomSelect
                    value={draftInvestmentContribution.paymentMethod}
                    onChange={(val) =>
                      setDraftInvestmentContribution((current) => ({
                        ...current,
                        paymentMethod: val as PaymentMethod,
                      }))
                    }
                    options={Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))}
                  />
                </FormField>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <FormField label="Conta">
                  <CustomSelect
                    value={draftInvestmentContribution.accountId}
                    onChange={(val) =>
                      setDraftInvestmentContribution((current) => ({
                        ...current,
                        accountId: val,
                      }))
                    }
                    options={accounts.map((account) => ({ value: account.id, label: account.name, icon: Building2 }))}
                  />
                </FormField>
                {usesCard ? (
                  <>
                    <FormField label="Cartao">
                      <CustomSelect
                        value={draftInvestmentContribution.cardId}
                        onChange={(val) =>
                          setDraftInvestmentContribution((current) => ({
                            ...current,
                            cardId: val,
                          }))
                        }
                        options={cards.map((card) => ({ value: card.id, label: card.name, icon: CreditCard }))}
                      />
                    </FormField>
                    <FormField label="Modalidade">
                      <CustomSelect
                        value={draftInvestmentContribution.cardMode}
                        onChange={(val) =>
                          setDraftInvestmentContribution((current) => ({
                            ...current,
                            cardMode: val as CardMode,
                          }))
                        }
                        options={[
                          { value: "credit", label: "Credito" },
                          { value: "debit", label: "Debito" },
                        ]}
                      />
                    </FormField>
                  </>
                ) : null}
              </div>

              {selectedInvestment ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Meta do mes:{" "}
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(getInvestmentPlannedAmount(selectedInvestment.id, selectedMonth))}
                  </span>
                </div>
              ) : null}

              <FormField label="Observacoes">
                <textarea
                  value={draftInvestmentContribution.notes}
                  onChange={(event) =>
                    setDraftInvestmentContribution((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={3}
                  className="field resize-none"
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
              <button
                type="button"
                onClick={closeInvestmentContributionModal}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Registrar aporte
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderCardBillComparisonModal() {
    if (!selectedCardBillComparison) {
      return null;
    }

    const { cardId, monthValue } = selectedCardBillComparison;
    const card = cards.find((item) => item.id === cardId);
    if (!card) {
      return null;
    }

    const key = getCardBillEstimateKey(cardId, monthValue);
    const estimate = cardBillEstimates[key];
    const autoEstimatedAmount = getCardBillAutoEstimatedAmount(cardId, monthValue);
    const estimatedAmount = getCardBillGridAmount(cardId, monthValue);
    const realAmount = getCardBillRealAmount(cardId, monthValue);
    const difference = Number((estimatedAmount - realAmount).toFixed(2));
    const realItems = getCardStatementGridItems(cardId, monthValue);
    const isPaid = estimate?.status === "paid";

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">Estimado vs real</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Fatura {card.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Referencia {formatMonthLabel(monthValueToDate(monthValue))}
              </p>
            </div>
            <button
              type="button"
              onClick={closeCardBillComparison}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">
                  Estimado
                </p>
                <p className="mt-2 text-xl font-semibold text-violet-900">{formatCurrency(estimatedAmount)}</p>
                <p className="mt-1 text-xs text-violet-500">
                  {estimate && !estimate.isAutoEstimate ? "Manual" : "Automatico"}
                </p>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">Real</p>
                <p className="mt-2 text-xl font-semibold text-sky-900">{formatCurrency(realAmount)}</p>
                <p className="mt-1 text-xs text-sky-500">Transacoes de credito</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">
                  Diferenca
                </p>
                <p className="mt-2 text-xl font-semibold text-amber-900">{formatCurrency(Math.abs(difference))}</p>
                <p className="mt-1 text-xs text-amber-600">
                  {difference === 0
                    ? "Dentro do previsto"
                    : difference > 0
                      ? "Real abaixo do previsto"
                      : "Real acima do previsto"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <FormField label="Valor estimado">
                  <input
                    value={formatMoneyInputValue(estimatedAmount)}
                    onChange={(event) => handleUpdateCardBillEstimate(cardId, monthValue, event.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    className="field bg-white"
                  />
                </FormField>
                <button
                  type="button"
                  onClick={() => handleUseAutoCardBillEstimate(cardId, monthValue)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Usar automatico ({formatCurrency(autoEstimatedAmount)})
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Compras reais nesta fatura</p>
                <button
                  type="button"
                  onClick={() => {
                    openCardDetails(cardId, monthValue);
                    closeCardBillComparison();
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Ver no cartao
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {realItems.length ? (
                  realItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="truncate text-xs text-slate-500">{item.support}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    Nenhuma compra real entrou nessa fatura ainda.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-5">
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                  isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {isPaid ? "Pago" : "Pendente"}
              </span>
              <button
                type="button"
                onClick={() => handleToggleCardBillPaid(cardId, monthValue)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  isPaid
                    ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : "bg-emerald-500 text-white hover:bg-emerald-600"
                }`}
              >
                {isPaid ? "Desfazer pagamento" : "Marcar como pago"}
              </button>
            </div>
            <p className="max-w-sm text-right text-xs font-medium text-slate-500">
              {isPaid
                ? "Pagamento registrado. Clique para desfazer."
                : "O pagamento da fatura e confirmado pela importacao do extrato bancario vinculado."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function renderMonthlyGridDeleteConfirmModal() {
    if (!pendingMonthlyGridDelete) {
      return null;
    }

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1010] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.28)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-600">
                Confirmar exclusao
              </p>
              <h4 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                Excluir {pendingMonthlyGridDelete.title}?
              </h4>
              <p className="mt-2 text-sm text-slate-500">
                {getMonthlyGridDeleteDescription(pendingMonthlyGridDelete)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPendingMonthlyGridDelete(null)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar confirmacao"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setPendingMonthlyGridDelete(null)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => deleteMonthlyGridTarget(pendingMonthlyGridDelete)}
              className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
            >
              <Trash2 className="mr-1 inline h-4 w-4" />
              Excluir
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderFixedEntryModal() {
    if (!isFixedEntryModalOpen) {
      return null;
    }

    const fixedEntryKind = getFixedEntryKind(draftFixedEntry.section);
    const fixedCategoryOptions = getSelectableCategories(fixedEntryKind, {
      includeHidden: normalizeFixedSection(draftFixedEntry.section) === "Contas",
    });
    const usesCard =
      draftFixedEntry.paymentMethod === "credit_card" || draftFixedEntry.paymentMethod === "debit_card";
    const selectedFixedCard = cards.find((card) => card.id === draftFixedEntry.cardId) ?? cards[0];
    const canSyncCardLimit =
      normalizeFixedSection(draftFixedEntry.section) === "Contas" &&
      draftFixedEntry.paymentMethod === "credit_card" &&
      selectedFixedCard?.availableMode !== "debit";

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                {editingFixedEntryId ? "Editar valor fixo" : "Novo valor fixo"}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {fixedSectionDisplayLabels[draftFixedEntry.section]}
              </h3>
            </div>
            <button
              type="button"
              onClick={closeFixedEntryModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSaveFixedEntry} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FormField label="Faixa">
                <CustomSelect
                  value={draftFixedEntry.section}
                  onChange={(val) =>
                    setDraftFixedEntry((current) => ({
                      ...current,
                      section: val as FixedFlowSection,
                      categoryId: getDefaultCategoryIdForFixedSection(val as FixedFlowSection),
                    }))
                  }
                  options={fixedSectionOrder.filter((section) => section !== "Planejamento").map((section) => ({ value: section, label: fixedSectionDisplayLabels[section], icon: Wallet }))}
                />
              </FormField>
              <FormField label="Titulo">
                <input
                  value={draftFixedEntry.title}
                  onChange={(event) =>
                    setDraftFixedEntry((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Ex.: Academia, Ajuda da avo, Netflix"
                  className="field"
                />
              </FormField>
              <FormField label="Categoria">
                <CustomSelect
                  value={draftFixedEntry.categoryId}
                  onChange={(val) =>
                    setDraftFixedEntry((current) => ({ ...current, categoryId: val }))
                  }
                  options={fixedCategoryOptions.map((category) => ({ value: category.id, label: getCategoryOptionLabel(category), icon: Tag }))}
                />
              </FormField>
              <FormField label="Forma de pagamento">
                <CustomSelect
                  value={draftFixedEntry.paymentMethod}
                  onChange={(val) =>
                    setDraftFixedEntry((current) => ({
                      ...current,
                      paymentMethod: val as PaymentMethod,
                      syncCardLimit: val === "credit_card" ? current.syncCardLimit : false,
                    }))
                  }
                  options={Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))}
                />
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FormField label="Conta">
                <CustomSelect
                  value={draftFixedEntry.accountId}
                  onChange={(val) =>
                    setDraftFixedEntry((current) => ({ ...current, accountId: val }))
                  }
                  options={accounts.map((account) => ({ value: account.id, label: account.name, icon: Building2 }))}
                />
              </FormField>

              {usesCard ? (
                <>
                  <FormField label="Cartao">
                    <CustomSelect
                      value={draftFixedEntry.cardId}
                      onChange={(val) =>
                        setDraftFixedEntry((current) => ({ ...current, cardId: val }))
                      }
                      options={cards.map((card) => ({ value: card.id, label: card.name, icon: CreditCard }))}
                    />
                  </FormField>
                  <FormField label="Modalidade">
                    <CustomSelect
                      value={draftFixedEntry.cardMode}
                      onChange={(val) =>
                        setDraftFixedEntry((current) => ({
                          ...current,
                          cardMode: val as CardMode,
                          syncCardLimit:
                            val === "credit" ? current.syncCardLimit : false,
                        }))
                      }
                      options={[
                        { value: "credit", label: "Credito" },
                        { value: "debit", label: "Debito" },
                      ]}
                    />
                  </FormField>
                </>
              ) : null}
            </div>

            {canSyncCardLimit ? (
              <div className="rounded-[24px] border border-sky-100 bg-sky-50/70 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Usar o limite do cartao como base mensal</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Ideal para simular gasto fixo mensal do cartao e manter a linha sincronizada quando o limite mudar.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={draftFixedEntry.syncCardLimit}
                      onChange={(event) =>
                        setDraftFixedEntry((current) => ({
                          ...current,
                          syncCardLimit: event.target.checked,
                          cardMode: "credit",
                        }))
                      }
                    />
                    Sincronizar
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setDraftFixedEntry((current) => ({
                        ...current,
                        amountByMonth: Object.fromEntries(
                          salaryCalendarMonths.map((monthItem) => [
                            monthItem.monthValue,
                            String(selectedFixedCard?.creditLimit ?? 0),
                          ]),
                        ),
                        cardMode: "credit",
                      }))
                    }
                    className="rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                  >
                    Preencher meses com o limite
                  </button>
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Limite atual {formatCurrency(selectedFixedCard?.creditLimit ?? 0)}
                  </span>
                </div>
              </div>
            ) : null}

            <FormField label="Observacao">
              <textarea
                value={draftFixedEntry.notes}
                onChange={(event) =>
                  setDraftFixedEntry((current) => ({ ...current, notes: event.target.value }))
                }
                rows={3}
                className="field resize-none"
              />
            </FormField>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Valores por mes</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  {referenceMonthDate.getFullYear()}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {salaryCalendarMonths.map((monthItem) => (
                  <FormField key={monthItem.monthValue} label={monthItem.fullLabel}>
                    <input
                      value={draftFixedEntry.amountByMonth[monthItem.monthValue] ?? ""}
                      onChange={(event) =>
                        setDraftFixedEntry((current) => ({
                          ...current,
                          amountByMonth: {
                            ...current.amountByMonth,
                            [monthItem.monthValue]: event.target.value,
                          },
                        }))
                      }
                      placeholder="0,00"
                      inputMode="decimal"
                      className="field"
                    />
                  </FormField>
                ))}
              </div>
            </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
              <button
                type="button"
                onClick={closeFixedEntryModal}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Salvar valor fixo
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderCommitmentModal() {
    if (!isCommitmentModalOpen) {
      return null;
    }

    const categoryOptions = getSelectableCategories(draftCommitment.kind, {
      includeHidden: draftCommitment.kind === "expense",
    }).map((category) => ({ value: category.id, label: getCategoryOptionLabel(category), icon: Tag }));
    const isInstallment = draftCommitment.schedule === "installments";
    const usesCard = draftCommitment.paymentMethod === "card";
    const isSavingGoal = draftCommitment.schedule === "saving_goal";
    const isEditingDebtCommitment = editingCommitmentTarget?.sourceType === "debt";
    const installments = Math.max(1, Number(draftCommitment.installments.replace(",", ".")) || 1);
    const totalAmount = Number(draftCommitment.totalAmount.replace(",", ".")) || 0;
    const suggestedInstallment = installments > 0 ? Number((totalAmount / installments).toFixed(2)) : totalAmount;
    const monthlyAmounts = getDraftCommitmentMonthlyAmounts();
    const monthlyActiveCount = getActiveDraftCommitmentMonths().length;
    const monthlyTotal = salaryCalendarMonths.reduce(
      (sum, monthItem) => sum + (monthlyAmounts[monthItem.monthValue] ?? 0),
      0,
    );
    const automaticDestination =
      draftCommitment.kind === "income"
        ? "Ganhos"
        : isSavingGoal
          ? "Compras planejadas"
          : isInstallment && usesCard && draftCommitment.cardMode === "credit"
            ? "Faturas"
            : isInstallment
              ? "Dividas e acordos"
              : draftCommitment.schedule === "recurring"
                ? "Contas fixas"
                : "Contas";
    const isEditingCommitment = Boolean(editingCommitmentTarget);

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                {isEditingCommitment ? "Editar compromisso" : "Novo compromisso"}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {isEditingCommitment ? "Ajustar item financeiro" : "Cadastro inteligente"}
              </h3>
            </div>
            <button
              type="button"
              onClick={closeCommitmentModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSaveCommitment} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Nome">
                  <input
                    value={draftCommitment.title}
                    onChange={(event) => setDraftCommitment((current) => ({ ...current, title: event.target.value }))}
                    className="field"
                    autoFocus
                  />
                </FormField>
                <FormField label="Tipo">
                  <CustomSelect
                    value={draftCommitment.kind}
                    onChange={(value) => {
                      const nextKind = value as DraftCommitment["kind"];
                      const nextCategory =
                        categories.find((category) => category.type === nextKind && !isHiddenUiCategoryId(category.id)) ??
                        categories.find((category) => category.type === nextKind);
                      setDraftCommitment((current) => ({
                        ...current,
                        kind: nextKind,
                        schedule: nextKind === "income" && current.schedule === "saving_goal" ? "recurring" : current.schedule,
                        categoryId: nextCategory?.id ?? current.categoryId,
                        paymentMethod: nextKind === "income" && current.paymentMethod === "card" ? "pix" : current.paymentMethod,
                      }));
                    }}
                    options={[
                      { value: "expense", label: "Pagar" },
                      { value: "income", label: "Receber" },
                    ]}
                  />
                </FormField>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Como acontece">
                  <CustomSelect
                    value={draftCommitment.schedule}
                    onChange={(value) =>
                      setDraftCommitment((current) => ({
                        ...current,
                        schedule: value as CommitmentSchedule,
                        kind: value === "saving_goal" ? "expense" : current.kind,
                        installments: value === "installments" ? current.installments : "1",
                      }))
                    }
                    options={[
                      { value: "once", label: "Uma vez" },
                      { value: "recurring", label: "Todo mes" },
                      { value: "installments", label: "Parcelado" },
                      { value: "saving_goal", label: "Guardar para comprar" },
                    ].filter((option) => draftCommitment.kind === "expense" || option.value !== "saving_goal")}
                  />
                </FormField>
                <FormField label="Categoria">
                  <CustomSelect
                    value={draftCommitment.categoryId}
                    onChange={(value) => setDraftCommitment((current) => ({ ...current, categoryId: value }))}
                    options={categoryOptions.length ? categoryOptions : [{ value: draftCommitment.categoryId, label: "Sem categoria", icon: Tag }]}
                  />
                </FormField>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label="Valor total">
                  <input
                    value={draftCommitment.totalAmount}
                    onChange={(event) => setDraftCommitment((current) => ({ ...current, totalAmount: event.target.value }))}
                    inputMode="decimal"
                    className="field"
                  />
                </FormField>
                <FormField label={isInstallment ? "Primeira parcela" : "Data"}>
                  <input
                    type="date"
                    value={draftCommitment.startDate}
                    onChange={(event) => setDraftCommitment((current) => ({ ...current, startDate: event.target.value }))}
                    className="field"
                  />
                </FormField>
                <FormField label="Forma de pagamento">
                  <CustomSelect
                    value={draftCommitment.paymentMethod}
                    onChange={(value) =>
                      setDraftCommitment((current) => ({
                        ...current,
                        paymentMethod: value as PaymentPlanMethod,
                        cardMode: value === "card" ? current.cardMode : "credit",
                      }))
                    }
                    options={[
                      { value: "pix", label: "Pix" },
                      { value: "bank_transfer", label: "Transferencia" },
                      { value: "cash", label: "Dinheiro" },
                      ...(draftCommitment.kind === "expense" ? [{ value: "card", label: "Cartao", icon: CreditCard }] : []),
                    ]}
                  />
                </FormField>
              </div>

              {isEditingCommitment ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Valores por mes
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {monthlyActiveCount} {monthlyActiveCount === 1 ? "mes preenchido" : "meses preenchidos"} - total {formatCurrency(monthlyTotal)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftCommitment((current) => ({
                          ...current,
                          totalAmount: monthlyTotal > 0 ? String(Number(monthlyTotal.toFixed(2))) : current.totalAmount,
                        }))
                      }
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      Usar total
                    </button>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {salaryCalendarMonths.map((monthItem) => (
                      <FormField key={monthItem.monthValue} label={formatMonthLabel(monthValueToDate(monthItem.monthValue))}>
                        <input
                          value={draftCommitment.amountByMonth[monthItem.monthValue] ?? ""}
                          onChange={(event) =>
                            setDraftCommitment((current) => ({
                              ...current,
                              amountByMonth: {
                                ...current.amountByMonth,
                                [monthItem.monthValue]: event.target.value,
                              },
                            }))
                          }
                          inputMode="decimal"
                          placeholder="0"
                          className="field bg-white"
                        />
                      </FormField>
                    ))}
                  </div>
                </div>
              ) : null}

              {isInstallment ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={isEditingDebtCommitment ? "Parcelas restantes" : "Quantidade de parcelas"}>
                    <input
                      value={draftCommitment.installments}
                      onChange={(event) => setDraftCommitment((current) => ({ ...current, installments: event.target.value }))}
                      inputMode="numeric"
                      className="field"
                    />
                  </FormField>
                  <FormField label="Valor por parcela">
                    <input
                      value={draftCommitment.installmentAmount || formatMoneyInputValue(suggestedInstallment)}
                      onChange={(event) =>
                        setDraftCommitment((current) => ({ ...current, installmentAmount: event.target.value }))
                      }
                      inputMode="decimal"
                      className="field"
                    />
                  </FormField>
                </div>
              ) : null}

              {usesCard ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Cartao">
                    <CustomSelect
                      value={draftCommitment.cardId}
                      onChange={(value) => setDraftCommitment((current) => ({ ...current, cardId: value }))}
                      options={cards.map((card) => ({ value: card.id, label: card.name, icon: CreditCard }))}
                    />
                  </FormField>
                  <FormField label="Modalidade">
                    <CustomSelect
                      value={draftCommitment.cardMode}
                      onChange={(value) => setDraftCommitment((current) => ({ ...current, cardMode: value as CardMode }))}
                      options={[
                        { value: "credit", label: "Credito" },
                        { value: "debit", label: "Debito" },
                      ]}
                    />
                  </FormField>
                </div>
              ) : null}

              <FormField label="Observacoes">
                <textarea
                  value={draftCommitment.notes}
                  onChange={(event) => setDraftCommitment((current) => ({ ...current, notes: event.target.value }))}
                  rows={3}
                  className="field min-h-20"
                />
              </FormField>

              <div className="rounded-[24px] border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-sky-800">
                {isEditingCommitment ? "Este item permanece" : "Vai aparecer automaticamente"} em{" "}
                <span className="font-semibold">{automaticDestination}</span>.
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-5">
              {editingCommitmentTarget && editingCommitmentTarget.sourceType !== "card_auto_bill" ? (
                <button
                  type="button"
                  onClick={() => deleteMonthlyGridTarget(editingCommitmentTarget)}
                  className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="mr-1 inline h-4 w-4" />
                  Excluir
                </button>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCommitmentModal}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  {isEditingCommitment ? "Salvar alteracoes" : "Salvar"}
                </button>
              </div>
            </div>
          </form>
          {pendingCommitmentConversion ? (
            <div className="fixed inset-0 z-[1010] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.28)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">
                      Confirmar mudanca
                    </p>
                    <h4 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                      Este item apareceu em mais de um mes
                    </h4>
                    <p className="mt-2 text-sm text-slate-500">
                      Escolha como o sistema deve tratar esse compromisso antes de salvar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingCommitmentConversion(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                    aria-label="Fechar confirmacao"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    onClick={() => handleConfirmCommitmentConversion("agreement")}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100"
                  >
                    <span className="text-sm font-semibold text-amber-900">Combinado / acordo parcelado</span>
                    <span className="mt-1 block text-xs text-amber-700">
                      Vira uma divida/acordo com parcelas por Pix, transferencia ou dinheiro.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmCommitmentConversion("recurring")}
                    className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-left transition hover:bg-sky-100"
                  >
                    <span className="text-sm font-semibold text-sky-900">Recorrente</span>
                    <span className="mt-1 block text-xs text-sky-700">
                      Vira um item fixo da planilha, com valores mensais editaveis.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmCommitmentConversion("installment")}
                    className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-left transition hover:bg-violet-100"
                  >
                    <span className="text-sm font-semibold text-violet-900">Parcelamento</span>
                    <span className="mt-1 block text-xs text-violet-700">
                      Se for credito, vira compra parcelada na fatura; senao vira acordo parcelado.
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderPurchaseModal() {
    if (!isPurchaseModalOpen) {
      return null;
    }

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                {editingPurchaseId ? "Transformar em compra real" : "Novo planejamento"}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {editingPurchaseId ? "Completar dados da compra" : "Adicionar item ao planejamento"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {editingPurchaseId
                  ? "Preencha os dados faltantes para mover esta compra para a secao correta."
                  : "Aqui voce configura a compra futura. Salve so com o nome e complete depois."}
              </p>
            </div>
            <button
              type="button"
              onClick={closePurchaseModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSavePurchase} className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Nome">
                <input
                  value={draftPurchase.name}
                  onChange={(event) =>
                    setDraftPurchase((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ex.: Pneu traseiro"
                  className="field"
                />
              </FormField>
              <FormField label="Prioridade opcional">
                <CustomSelect
                  value={draftPurchase.priority}
                  onChange={(val) =>
                    setDraftPurchase((current) => ({
                      ...current,
                      priority: val as FinancePriority,
                    }))
                  }
                  options={planningPriorityOptions.map((priority) => ({ value: priority, label: priority }))}
                />
              </FormField>
            </div>

            <FormField label="Descricao">
              <input
                value={draftPurchase.description}
                onChange={(event) =>
                  setDraftPurchase((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Contexto curto para lembrar desse item"
                className="field"
              />
            </FormField>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Valor estimado opcional">
                <input
                  value={draftPurchase.estimatedValue}
                  onChange={(event) =>
                    setDraftPurchase((current) => ({
                      ...current,
                      estimatedValue: event.target.value,
                    }))
                  }
                  placeholder="0,00"
                  inputMode="decimal"
                  className="field"
                />
              </FormField>
              <FormField label="Ja reservado">
                <input
                  value={draftPurchase.savedAmount}
                  onChange={(event) =>
                    setDraftPurchase((current) => ({ ...current, savedAmount: event.target.value }))
                  }
                  placeholder="0,00"
                  inputMode="decimal"
                  className="field"
                />
              </FormField>
              {draftPurchase.planningMode === "save_over_time" ? (
                <FormField label="Valor sugerido por mes">
                  <input
                    value={draftPurchase.suggestedPeriodAmount}
                    onChange={(event) =>
                      setDraftPurchase((current) => ({
                        ...current,
                        suggestedPeriodAmount: event.target.value,
                      }))
                    }
                    placeholder="0,00"
                    inputMode="decimal"
                    className="field"
                  />
                </FormField>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                  Ajuste a distribuicao mensal pela planilha quando precisar.
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Etapa do quadro">
                <CustomSelect
                  value={draftPurchase.boardColumn}
                  onChange={(val) =>
                    setDraftPurchase((current) => ({
                      ...current,
                      boardColumn: val as Exclude<BoardColumn, "bought">,
                    }))
                  }
                  options={planningBoardColumns.map((column) => ({ value: column.id, label: column.label }))}
                />
              </FormField>
              <FormField label="Data desejada">
                <input
                  type="date"
                  value={draftPurchase.desiredDate}
                  onChange={(event) =>
                    setDraftPurchase((current) => ({ ...current, desiredDate: event.target.value }))
                  }
                  className="field"
                />
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Modo do planejamento">
                <CustomSelect
                  value={draftPurchase.planningMode}
                  onChange={(val) =>
                    setDraftPurchase((current) => {
                      const nextMode = val as DraftPurchase["planningMode"];
                      return {
                        ...current,
                        planningMode: nextMode,
                        paymentOption: nextMode === "card_parcelado" ? "card" : current.paymentOption === "card" ? "pix" : current.paymentOption,
                        cardMode: nextMode === "card_parcelado" ? "credit" : current.cardMode,
                        installments: nextMode === "card_parcelado" ? Math.max(1, current.installments) : 1,
                      };
                    })
                  }
                  options={[
                    { value: "save_over_time", label: "Guardar dinheiro" },
                    { value: "buy_in_target_period", label: "Comprar a vista" },
                    { value: "card_parcelado", label: "Comprar no cartao" },
                  ]}
                />
              </FormField>
              {draftPurchase.planningMode !== "card_parcelado" ? (
                <FormField label={draftPurchase.planningMode === "save_over_time" ? "Onde guardar" : "Meio previsto"}>
                  <CustomSelect
                    value={draftPurchase.paymentOption === "card" ? "pix" : draftPurchase.paymentOption}
                    onChange={(val) =>
                      setDraftPurchase((current) => ({
                        ...current,
                        paymentOption: val as PaymentPlanMethod,
                      }))
                    }
                    options={[
                      { value: "pix", label: "Pix" },
                      { value: "cash", label: "Dinheiro" },
                      { value: "bank_transfer", label: "Transferencia" },
                    ]}
                  />
                </FormField>
              ) : (
                <FormField label="Cartao planejado">
                  <CustomSelect
                    value={draftPurchase.cardId}
                    onChange={(val) =>
                      setDraftPurchase((current) => ({ ...current, cardId: val }))
                    }
                    options={cards.map((card) => ({ value: card.id, label: card.name, icon: CreditCard }))}
                  />
                </FormField>
              )}
            </div>

            {draftPurchase.planningMode === "card_parcelado" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Parcelas previstas">
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={draftPurchase.installments}
                    onChange={(event) =>
                      setDraftPurchase((current) => ({
                        ...current,
                        installments: Number(event.target.value || 1),
                      }))
                    }
                    className="field"
                  />
                </FormField>
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                  Isto e so previsao. A fatura do cartao so recebe valores quando uma transacao real for vinculada.
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                {editingPurchaseId ? (
                  <button
                    type="button"
                    onClick={() => handleDeletePurchase(editingPurchaseId)}
                    className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="mr-1 inline h-4 w-4" />
                    Excluir
                  </button>
                ) : null}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closePurchaseModal}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Salvar item
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderCategoryModal() {
    if (!isCategoryModalOpen) {
      return null;
    }

    const canDeleteCategory = editingCategoryId
      ? categories.some(
          (category) =>
            category.type === draftCategory.type && category.id !== editingCategoryId,
        )
      : false;

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-xl rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                {editingCategoryId ? "Editar categoria" : "Nova categoria"}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {editingCategoryId ? "Ajustar categoria" : "Criar categoria"}
              </h3>
            </div>
            <button
              type="button"
              onClick={closeCategoryModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSaveCategory} className="mt-6 space-y-4">
            <FormField label="Nome">
              <input
                value={draftCategory.name}
                onChange={(event) =>
                  setDraftCategory((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ex.: Farmacia"
                className="field"
              />
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Tipo">
                <CustomSelect
                  value={draftCategory.type}
                  onChange={(val) =>
                    setDraftCategory((current) => ({
                      ...current,
                      type: val as "income" | "expense",
                      parentId: "",
                    }))
                  }
                  options={[
                    { value: "expense", label: "Despesa" },
                    { value: "income", label: "Receita" },
                  ]}
                />
              </FormField>
              <FormField label="Cor">
                <input
                  type="color"
                  value={draftCategory.color}
                  onChange={(event) =>
                    setDraftCategory((current) => ({ ...current, color: event.target.value }))
                  }
                  className="field h-12"
                />
              </FormField>
            </div>

            <FormField label="Categoria principal">
              <CustomSelect
                value={draftCategory.parentId}
                onChange={(val) =>
                  setDraftCategory((current) => ({
                    ...current,
                    parentId: val,
                    color:
                      categories.find((category) => category.id === val)?.color ??
                      current.color,
                  }))
                }
                placeholder="Nenhuma, e uma categoria principal"
                options={categories
                  .filter(
                    (category) =>
                      category.type === draftCategory.type &&
                      !category.parentId &&
                      category.id !== editingCategoryId &&
                      !isHiddenUiCategoryId(category.id),
                  )
                  .map((category) => ({ value: category.id, label: category.name, icon: Tag }))}
              />
            </FormField>

            <div className="flex flex-wrap justify-between gap-3">
              <div>
                {editingCategoryId ? (
                  <button
                    type="button"
                    disabled={!canDeleteCategory}
                    onClick={() => {
                      if (editingCategoryId) {
                        handleDeleteCategory(editingCategoryId);
                        closeCategoryModal();
                      }
                    }}
                    className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="mr-1 inline h-4 w-4" />
                    Excluir categoria
                  </button>
                ) : null}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeCategoryModal}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Salvar categoria
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderCardModal() {
    if (!isCardModalOpen) {
      return null;
    }

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                {editingCardId ? "Editar cartao" : "Novo cartao"}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {editingCardId ? "Atualizar cartao" : "Adicionar cartao"}
              </h3>
            </div>
            <button
              type="button"
              onClick={closeCardModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSaveCard} className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Nome do cartao">
                <input
                  value={draftCard.name}
                  onChange={(event) => setDraftCard((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: Nubank"
                  className="field"
                />
              </FormField>
              <FormField label="Banco">
                <CustomSelect
                  value={draftCard.issuer}
                  onChange={(val) => handleIssuerChange(val)}
                  options={bankPresets.map((preset) => ({ value: preset.issuer, label: preset.issuer }))}
                />
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Bandeira">
                <CustomSelect
                  value={draftCard.brand}
                  onChange={(val) => setDraftCard((current) => ({ ...current, brand: val }))}
                  options={[
                    { value: "Mastercard", label: "Mastercard" },
                    { value: "Visa", label: "Visa" },
                    { value: "Elo", label: "Elo" },
                  ]}
                />
              </FormField>
              <FormField label="Final do cartao">
                <input
                  value={draftCard.lastDigits}
                  onChange={(event) => setDraftCard((current) => ({ ...current, lastDigits: event.target.value }))}
                  maxLength={4}
                  placeholder="1234"
                  className="field"
                />
              </FormField>
              <FormField label="Cor">
                <input
                  type="color"
                  value={draftCard.accentColor}
                  onChange={(event) => setDraftCard((current) => ({ ...current, accentColor: event.target.value }))}
                  className="field h-12"
                />
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Modalidade">
                <CustomSelect
                  value={draftCard.availableMode}
                  onChange={(val) => setDraftCard((current) => ({ ...current, availableMode: val as DraftCard["availableMode"] }))}
                  options={[
                    { value: "both", label: "Credito e debito" },
                    { value: "credit", label: "Somente credito" },
                    { value: "debit", label: "Somente debito" },
                  ]}
                />
              </FormField>
              <FormField label="Conta vinculada">
                <CustomSelect
                  value={draftCard.linkedAccountId}
                  onChange={(val) => setDraftCard((current) => ({ ...current, linkedAccountId: val }))}
                  options={accounts.map((account) => ({ value: account.id, label: account.name, icon: Building2 }))}
                />
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Fechamento">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={draftCard.closingDay}
                  onChange={(event) => setDraftCard((current) => ({ ...current, closingDay: event.target.value }))}
                  className="field"
                />
              </FormField>
              <FormField label="Vencimento">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={draftCard.dueDay}
                  onChange={(event) => setDraftCard((current) => ({ ...current, dueDay: event.target.value }))}
                  className="field"
                />
              </FormField>
              <FormField label="Limite de credito">
                <input
                  value={draftCard.creditLimit}
                  onChange={(event) => setDraftCard((current) => ({ ...current, creditLimit: event.target.value }))}
                  inputMode="decimal"
                  disabled={draftCard.availableMode === "debit"}
                  className="field"
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3">
              {editingCardId ? (
                <button
                  type="button"
                  onClick={() => handleDeleteCard(editingCardId)}
                  className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Excluir cartao
                </button>
              ) : null}
              <button
                type="button"
                onClick={closeCardModal}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Salvar cartao
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderBillFormFields(mode: "create" | "edit" = "edit") {
    const usesCard = draftBill.plannedPaymentMethod === "card";
    const canShowInstallments = shouldShowDraftBillInstallments();
    const showPriorityAndStatus = mode === "edit";

    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Titulo">
            <input
              value={draftBill.title}
              onChange={(event) => setDraftBill((current) => ({ ...current, title: event.target.value }))}
              className="field"
            />
          </FormField>
          <FormField label="Valor">
            <input
              value={draftBill.amount}
              onChange={(event) => setDraftBill((current) => ({ ...current, amount: event.target.value }))}
              inputMode="decimal"
              className="field"
            />
          </FormField>
        </div>

        <div className={`grid gap-3 ${showPriorityAndStatus ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-2"}`}>
          {showPriorityAndStatus ? (
            <FormField label="Prioridade">
              <CustomSelect
                value={draftBill.priority}
                onChange={(val) =>
                  setDraftBill((current) => ({ ...current, priority: val as FinancePriority }))
                }
                options={planningPriorityOptions.map((priority) => ({ value: priority, label: priority }))}
              />
            </FormField>
          ) : null}
          {showPriorityAndStatus ? (
            <FormField label="Status">
              <CustomSelect
                value={draftBill.status}
                onChange={(val) =>
                  setDraftBill((current) => ({ ...current, status: val as DraftBill["status"] }))
                }
                options={[
                  { value: "pending", label: "Pendente" },
                  { value: "paid", label: "Paga" },
                  { value: "overdue", label: "Atrasada" },
                ]}
              />
            </FormField>
          ) : null}
          <FormField label="Recorrente">
            <label className="flex h-[52px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={draftBill.isRecurring}
                onChange={(event) => updateDraftBillRecurring(event.target.checked)}
              />
              Repetir todo mes
            </label>
          </FormField>
          <FormField label="Categoria">
            <CustomSelect
              value={draftBill.categoryId}
              onChange={(val) => setDraftBill((current) => ({ ...current, categoryId: val }))}
              options={selectableBillCategories.length > 0
                ? selectableBillCategories.map((category) => ({ value: category.id, label: getCategoryOptionLabel(category), icon: Tag }))
                : [{ value: draftBill.categoryId, label: "Sem categoria de despesa", icon: Tag }]}
            />
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {draftBill.isRecurring ? (
            <FormField label="Dia recorrente">
              <input
                value={draftBill.recurringDay}
                onChange={(event) => updateDraftBillRecurringDay(event.target.value)}
                inputMode="numeric"
                className="field"
              />
            </FormField>
          ) : (
            <FormField label="Vencimento">
              <input
                type="date"
                value={draftBill.dueDate}
                onChange={(event) => setDraftBill((current) => ({ ...current, dueDate: event.target.value }))}
                className="field"
              />
            </FormField>
          )}

          <FormField label="Como pagar">
            <CustomSelect
              value={draftBill.plannedPaymentMethod}
              onChange={(val) => updateDraftBillPaymentMethod(val as PaymentPlanMethod)}
              options={[
                { value: "pix", label: "Pix" },
                { value: "cash", label: "Dinheiro" },
                { value: "bank_transfer", label: "Transferencia" },
                { value: "card", label: "Cartao" },
              ]}
            />
          </FormField>
        </div>

        {usesCard ? (
          <div className={`grid gap-3 ${canShowInstallments ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <FormField label="Cartao">
              <CustomSelect
                value={draftBill.plannedCardId}
                onChange={(val) => updateDraftBillCardSelection(val)}
                options={cards.map((card) => ({ value: card.id, label: card.name, icon: CreditCard }))}
              />
            </FormField>
            <FormField label="Modalidade">
              <CustomSelect
                value={draftBill.plannedCardMode}
                onChange={(val) => updateDraftBillCardMode(val as CardMode)}
                options={getDraftBillCardModes().map((mode) => ({ value: mode, label: mode === "credit" ? "Credito" : "Debito" }))}
              />
            </FormField>
            {canShowInstallments ? (
              <FormField label="Parcelas">
                <input
                  value={draftBill.installments}
                  onChange={(event) =>
                    setDraftBill((current) => ({ ...current, installments: event.target.value }))
                  }
                  inputMode="numeric"
                  className="field"
                />
              </FormField>
            ) : null}
          </div>
        ) : null}

        <FormField label="Observacao">
          <textarea
            value={draftBill.notes}
            onChange={(event) => setDraftBill((current) => ({ ...current, notes: event.target.value }))}
            rows={4}
            className="field resize-none"
          />
        </FormField>
      </>
    );
  }

  function renderBillModal() {
    if (!isBillModalOpen) {
      return null;
    }

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex max-h-[88vh] flex-col">
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                  {editingBillId ? "Editar conta" : "Nova conta"}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {editingBillId ? "Atualizar conta" : "Adicionar conta"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeBillModal}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-600 transition hover:bg-slate-200"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {draftBillError ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {draftBillError}
                  </div>
                ) : null}
                {renderBillFormFields("edit")}
              </div>
              <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200/80 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={closeBillModal}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Salvar conta
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  function renderNewAccountModal() {
    if (!isNewAccountModalOpen) {
      return null;
    }

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex max-h-[88vh] flex-col">
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-sky-600">Nova conta</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Adicionar conta ou divida
                </h3>
              </div>
              <button
                type="button"
                onClick={closeNewAccountModal}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-600 transition hover:bg-slate-200"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewAccount} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {draftBillError ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {draftBillError}
                  </div>
                ) : null}
                <FormField label="Tipo">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setNewAccountKind("bill")}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                        newAccountKind === "bill"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      Conta a pagar
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAccountKind("debt")}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                        newAccountKind === "debt"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      Divida
                    </button>
                  </div>
                </FormField>

                {newAccountKind === "bill" ? (
                  renderBillFormFields("create")
                ) : (
                  <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Nome">
                    <input
                      value={draftDebt.name}
                      onChange={(event) => setDraftDebt((current) => ({ ...current, name: event.target.value }))}
                      className="field"
                    />
                  </FormField>
                  <FormField label="Valor total">
                    <input
                      value={draftDebt.totalAmount}
                      onChange={(event) =>
                        setDraftDebt((current) => ({ ...current, totalAmount: event.target.value }))
                      }
                      inputMode="decimal"
                      className="field"
                    />
                  </FormField>
                </div>
                <FormField label="Descricao">
                  <input
                    value={draftDebt.description}
                    onChange={(event) =>
                      setDraftDebt((current) => ({ ...current, description: event.target.value }))
                    }
                    className="field"
                  />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-4">
                  <FormField label="Ja pago">
                    <input
                      value={draftDebt.paidAmount}
                      onChange={(event) =>
                        setDraftDebt((current) => ({ ...current, paidAmount: event.target.value }))
                      }
                      inputMode="decimal"
                      className="field"
                    />
                  </FormField>
                  <FormField label="Parcelas restantes">
                    <input
                      value={draftDebt.installments}
                      onChange={(event) =>
                        setDraftDebt((current) => ({ ...current, installments: event.target.value }))
                      }
                      inputMode="numeric"
                      className="field"
                    />
                  </FormField>
                  <FormField label="Valor da parcela">
                    <input
                      value={draftDebt.installmentAmount}
                      onChange={(event) =>
                        setDraftDebt((current) => ({ ...current, installmentAmount: event.target.value }))
                      }
                      inputMode="decimal"
                      className="field"
                    />
                  </FormField>
                  <FormField label="Proximo vencimento">
                    <input
                      type="date"
                      value={draftDebt.nextDueDate}
                      onChange={(event) =>
                        setDraftDebt((current) => ({ ...current, nextDueDate: event.target.value }))
                      }
                      className="field"
                    />
                  </FormField>
                </div>
                <div className="grid gap-3 sm:grid-cols-1">
                  <FormField label="Como pagar">
                    <CustomSelect
                      value={draftDebt.plannedPaymentMethod}
                      onChange={(val) =>
                        setDraftDebt((current) => ({
                          ...current,
                          plannedPaymentMethod: val as PaymentPlanMethod,
                        }))
                      }
                      options={[
                        { value: "pix", label: "Pix" },
                        { value: "cash", label: "Dinheiro" },
                        { value: "bank_transfer", label: "Transferencia" },
                        { value: "card", label: "Cartao" },
                      ]}
                    />
                  </FormField>
                </div>
                {draftDebt.plannedPaymentMethod === "card" ? (
                  <FormField label="Cartao planejado">
                    <CustomSelect
                      value={draftDebt.plannedCardId}
                      onChange={(val) =>
                        setDraftDebt((current) => ({ ...current, plannedCardId: val }))
                      }
                      options={cards.map((card) => ({ value: card.id, label: card.name, icon: CreditCard }))}
                    />
                  </FormField>
                ) : null}
                  </>
                )}
              </div>

              <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200/80 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={closeNewAccountModal}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Salvar conta
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  function renderDebtModal() {
    if (!isDebtModalOpen) {
      return null;
    }

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                {editingDebtId ? "Editar divida" : "Nova divida"}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {editingDebtId ? "Atualizar divida" : "Adicionar divida"}
              </h3>
            </div>
            <button type="button" onClick={closeDebtModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSaveDebt} className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Nome">
                <input value={draftDebt.name} onChange={(event) => setDraftDebt((current) => ({ ...current, name: event.target.value }))} className="field" />
              </FormField>
              <FormField label="Valor total">
                <input value={draftDebt.totalAmount} onChange={(event) => setDraftDebt((current) => ({ ...current, totalAmount: event.target.value }))} inputMode="decimal" className="field" />
              </FormField>
            </div>
            <FormField label="Descricao">
              <input value={draftDebt.description} onChange={(event) => setDraftDebt((current) => ({ ...current, description: event.target.value }))} className="field" />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-4">
              <FormField label="Ja pago">
                <input value={draftDebt.paidAmount} onChange={(event) => setDraftDebt((current) => ({ ...current, paidAmount: event.target.value }))} inputMode="decimal" className="field" />
              </FormField>
              <FormField label="Parcelas restantes">
                <input value={draftDebt.installments} onChange={(event) => setDraftDebt((current) => ({ ...current, installments: event.target.value }))} inputMode="numeric" className="field" />
              </FormField>
              <FormField label="Valor da parcela">
                <input value={draftDebt.installmentAmount} onChange={(event) => setDraftDebt((current) => ({ ...current, installmentAmount: event.target.value }))} inputMode="decimal" className="field" />
              </FormField>
              <FormField label="Proximo vencimento">
                <input type="date" value={draftDebt.nextDueDate} onChange={(event) => setDraftDebt((current) => ({ ...current, nextDueDate: event.target.value }))} className="field" />
              </FormField>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Prioridade">
                <CustomSelect value={draftDebt.priority} onChange={(val) => setDraftDebt((current) => ({ ...current, priority: val as FinancePriority }))} options={planningPriorityOptions.map((priority) => ({ value: priority, label: priority }))} />
              </FormField>
              <FormField label="Status">
                <CustomSelect value={draftDebt.status} onChange={(val) => setDraftDebt((current) => ({ ...current, status: val as DraftDebt["status"] }))} options={[
                  { value: "active", label: "Ativa" },
                  { value: "paused", label: "Pausada" },
                  { value: "settled", label: "Quitada" },
                ]} />
              </FormField>
              <FormField label="Como pagar">
                <CustomSelect value={draftDebt.plannedPaymentMethod} onChange={(val) => setDraftDebt((current) => ({ ...current, plannedPaymentMethod: val as PaymentPlanMethod }))} options={[
                  { value: "pix", label: "Pix" },
                  { value: "cash", label: "Dinheiro" },
                  { value: "bank_transfer", label: "Transferencia" },
                  { value: "card", label: "Cartao" },
                ]} />
              </FormField>
            </div>
            {draftDebt.plannedPaymentMethod === "card" ? (
              <FormField label="Cartao planejado">
                <CustomSelect value={draftDebt.plannedCardId} onChange={(val) => setDraftDebt((current) => ({ ...current, plannedCardId: val }))} options={cards.map((card) => ({ value: card.id, label: card.name, icon: CreditCard }))} />
              </FormField>
            ) : null}
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                {editingDebtId ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteDebt(editingDebtId)}
                    className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="mr-1 inline h-4 w-4" />
                    Excluir divida
                  </button>
                ) : null}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={closeDebtModal} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">Salvar divida</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderDebtPlanModal() {
    if (!isDebtPlanModalOpen) {
      return null;
    }

    const debt = debts.find((item) => item.id === draftDebtPlan.debtId);
    if (!debt) {
      return null;
    }

    const remainingAmount = Math.max(0, debt.remainingAmount);
    const monthCount = Math.max(1, Number(draftDebtPlan.monthCount.replace(",", ".")) || 1);
    const installmentAmount = Math.max(
      0.01,
      Number(draftDebtPlan.installmentAmount.replace(",", ".")) || debt.installmentAmount || 0.01,
    );
    const configuredMonthlyCap = Math.max(0, settings.monthlyDebtPaymentCap);
    const preview = buildDebtPlanSchedule(
      selectedMonth,
      remainingAmount,
      monthCount,
      installmentAmount,
    );
    const paymentDetails = getPlannedPaymentDetails(
      debt.plannedPaymentMethod,
      debt.plannedCardId,
      "credit",
      cards,
    );
    const plannedCardName = debt.plannedCardId
      ? cards.find((card) => card.id === debt.plannedCardId)?.name
      : undefined;

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">Planejamento da divida</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{debt.name}</h3>
            </div>
            <button
              type="button"
              onClick={closeDebtPlanModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleApplyDebtPlan} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <InfoBlock label="Total da divida" value={formatCurrency(debt.totalAmount)} />
                <InfoBlock label="Ja pago" value={formatCurrency(debt.paidAmount)} />
                <InfoBlock label="Restante" value={formatCurrency(debt.remainingAmount)} />
                <InfoBlock label="Pagamento" value={paymentDetails.label} />
              </div>

              {plannedCardName ? (
                <div className="rounded-[24px] border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-sky-800">
                  Cartao vinculado: <span className="font-semibold">{plannedCardName}</span>
                </div>
              ) : null}

              <div className="rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                  Teto mensal definido nas configuracoes
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {configuredMonthlyCap > 0 ? formatCurrency(configuredMonthlyCap) : "Nao definido"}
                </p>
                <p className="mt-2 text-xs text-amber-800">
                  Esse valor vira a sugestao automatica do plano. Se quiser, voce pode ajustar por meses ou por
                  parcela aqui.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Parcelas restantes">
                  <input
                    value={draftDebtPlan.monthCount}
                    onChange={(event) =>
                      applyDebtPlanFromMonthCount(debt.id, event.target.value)
                    }
                    inputMode="numeric"
                    className="field"
                  />
                </FormField>
                <FormField label="Valor por parcela">
                  <input
                    value={draftDebtPlan.installmentAmount}
                    onChange={(event) =>
                      applyDebtPlanFromInstallment(debt.id, event.target.value)
                    }
                    inputMode="decimal"
                    className="field"
                  />
                </FormField>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Previa do planejamento</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Ao confirmar, essa distribuicao vai direto para Contas na planilha.
                    </p>
                  </div>
                  <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {preview.schedule.length} meses
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {preview.schedule.map((item) => (
                    <div key={item.monthValue} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                        {formatMonthLabel(monthValueToDate(item.monthValue))}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-6 py-5">
              <button
                type="button"
                onClick={closeDebtPlanModal}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Aplicar na planilha
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderAccountModal() {
    if (!isAccountModalOpen) {
      return null;
    }

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-xl rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                {editingAccountId ? "Editar conta" : "Nova conta"}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {editingAccountId ? "Atualizar conta" : "Adicionar conta"}
              </h3>
            </div>
            <button type="button" onClick={closeAccountModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSaveAccount} className="mt-6 space-y-4">
            <FormField label="Nome">
              <input value={draftAccount.name} onChange={(event) => setDraftAccount((current) => ({ ...current, name: event.target.value }))} className="field" />
            </FormField>
            <FormField label="Tipo">
              <input value={draftAccount.type} onChange={(event) => setDraftAccount((current) => ({ ...current, type: event.target.value }))} className="field" />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Saldo inicial">
                <input value={draftAccount.initialBalance} onChange={(event) => setDraftAccount((current) => ({ ...current, initialBalance: event.target.value }))} inputMode="decimal" className="field" />
              </FormField>
              <FormField label="Saldo atual manual">
                <input value={draftAccount.currentBalance} onChange={(event) => setDraftAccount((current) => ({ ...current, currentBalance: event.target.value }))} inputMode="decimal" className="field" />
              </FormField>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeAccountModal} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">Salvar conta</button>
            </div>
          </form>
        </div>
      </div>
    );
  }
  function renderSalaryMonthModal() {
    if (!isSalaryMonthModalOpen) {
      return null;
    }

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-xl rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">Salario fixo do mes</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Editar {formatMonthLabel(monthValueToDate(draftSalaryMonth.monthValue))}
              </h3>
            </div>
            <button
              type="button"
              onClick={closeSalaryMonthModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSaveSalaryMonth} className="mt-6 space-y-4">
            <ConfigField
              label="Salario fixo previsto"
              value={Number(draftSalaryMonth.fixedIncomePlanned || 0)}
              onChange={(value) =>
                setDraftSalaryMonth((current) => ({
                  ...current,
                  fixedIncomePlanned: String(value),
                }))
              }
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeSalaryMonthModal}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Salvar salario do mes
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderPlanning() {
    if (planningScreen === "board") {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPlanningScreen('purchases')}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Voltar ao planejamento
              </button>
              <button
                type="button"
                onClick={() => openPurchaseModal()}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                Novo item
              </button>
              <div className="flex flex-wrap gap-2 rounded-full bg-slate-100 p-1">
                {(["default", "weeks", "months"] as PlanningBoardView[]).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setPlanningBoardView(view)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      planningBoardView === view
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    {planningBoardViewLabels[view]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Panel
            title="Planejamento de compras"
            description="Arraste cada item para a etapa certa. Clique no card para editar o planejamento."
          >
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Visualizacao atual: <span className="font-semibold text-slate-900">{planningBoardViewLabels[planningBoardView]}</span>
            </div>
            <div className="grid gap-4 2xl:grid-cols-5 xl:grid-cols-3 md:grid-cols-2">
              {planningBoardDisplayColumns.map((column) => (
                <div
                  key={column.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedPurchaseId) {
                      handleMovePurchase(draggedPurchaseId, column.id);
                    }
                    setDraggedPurchaseId(null);
                  }}
                  className={`min-h-[420px] rounded-[28px] border p-4 ${column.toneClass}`}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{column.label}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatCurrency(
                          planningBoardBuckets[column.id].reduce(
                            (sum, purchase) => sum + purchase.estimatedValue,
                            0,
                          ),
                        )}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold text-slate-500">
                      {planningBoardBuckets[column.id].length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {planningBoardBuckets[column.id].map((purchase) => {
                      const progress = purchase.estimatedValue
                        ? purchase.savedAmount / purchase.estimatedValue
                        : 0;

                      return (
                        <button
                          key={purchase.id}
                          type="button"
                          draggable
                          onDragStart={() => setDraggedPurchaseId(purchase.id)}
                          onClick={() => openPurchaseModal(purchase)}
                          className="w-full rounded-[24px] border border-white/80 bg-white p-4 text-left shadow-[0_18px_44px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{purchase.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{purchase.description}</p>
                              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">
                                {getPurchasePlacementLabel(purchase)}
                              </p>
                            </div>
                            <PriorityPill priority={purchase.priority} />
                          </div>

                          <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>Reservado</span>
                              <span>{Math.round(progress * 100)}%</span>
                            </div>
                            <div className="mt-2">
                              <ProgressBar value={progress} />
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                              <span className="text-slate-500">{formatCurrency(purchase.savedAmount)}</span>
                              <span className="font-semibold text-slate-900">
                                {formatCurrency(purchase.estimatedValue)}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {renderPurchaseModal()}
        </div>
      );
    }

    const planningSections = (["purchases", "reserves", "investments"] as Exclude<
      PlanningScreen,
      "board"
    >[]).map((section) => ({
      id: section,
      label: planningSectionLabels[section],
    }));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap gap-2 rounded-full bg-slate-100 p-1">
            {planningSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setPlanningScreen(section.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  planningScreen === section.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>

          {planningScreen === "purchases" ? (
            <button
              type="button"
              onClick={() => setPlanningScreen("board")}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Abrir planejamento de compras
            </button>
          ) : planningScreen === "investments" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openInvestmentContributionModal()}
                disabled={!investments.length}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Registrar aporte
              </button>
              <button
                type="button"
                onClick={() => openInvestmentModal()}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Novo investimento
              </button>
            </div>
          ) : null}
        </div>

        {planningScreen === "purchases" ? (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
              <MetricStack
                label="Itens ativos"
                value={String(activePlannedPurchases.length)}
                support="Compras em andamento"
              />
              <MetricStack
                label="Total planejado"
                value={formatCurrency(totalPlannedPurchaseValue)}
                support="Soma dos itens abertos"
              />
              <MetricStack
                label="Ja reservado"
                value={formatCurrency(totalSavedPurchaseValue)}
                support="Valor separado ate agora"
              />
              <MetricStack
                label="Falta reservar"
                value={formatCurrency(totalReserveGap)}
                support="Gap para concluir os objetivos"
              />
            </div>

            <Panel title="Compras ativas" description="">
                <div className="space-y-3">
                  {activePlannedPurchases.length ? (
                    activePlannedPurchases.map((purchase) => {
                      const remaining = Math.max(0, purchase.estimatedValue - purchase.savedAmount);
                      return (
                        <div
                          key={purchase.id}
                          className="rounded-[24px] border border-slate-200 bg-white px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{purchase.name}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {formatCurrency(purchase.savedAmount)} guardados de{" "}
                                {formatCurrency(purchase.estimatedValue)}
                              </p>
                              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
                                {getPurchasePlanningLabel(purchase)}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <PriorityPill priority={purchase.priority} />
                              <button
                                type="button"
                                onClick={() => openPurchaseModal(purchase)}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePurchase(purchase.id)}
                                className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                              >
                                <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                                Excluir
                              </button>
                              <button
                                type="button"
                                onClick={() => setPlanningScreen("board")}
                                className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                              >
                                Abrir quadro
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                            <span>{getPurchasePlacementLabel(purchase)}</span>
                            <span>Faltam {formatCurrency(remaining)}</span>
                          </div>
                          <div className="mt-3">
                            <ProgressBar
                              value={
                                purchase.estimatedValue
                                  ? purchase.savedAmount / purchase.estimatedValue
                                  : 0
                              }
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      Ainda nao existem compras planejadas ativas.
                    </div>
                  )}
                </div>
              </Panel>
          </div>
        ) : null}

        {planningScreen === "reserves" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricStack
                label="Objetivos"
                value={String(reservePurchases.length)}
                support="Reservas ativas"
              />
              <MetricStack
                label="Ja reservado"
                value={formatCurrency(totalReserveSaved)}
                support={`de ${formatCurrency(totalReserveTarget)}`}
              />
              <MetricStack
                label="Falta guardar"
                value={formatCurrency(totalReserveRemaining)}
                support="Para concluir os objetivos"
              />
            </div>

            <Panel
              title="Reservas"
              description=""
              action={
                <button
                  type="button"
                  onClick={() => openPurchaseModal()}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                >
                  Nova reserva
                </button>
              }
            >
              <div className="space-y-3">
                {reservePurchases.length ? (
                  reservePurchases.map((purchase) => {
                    const reservePlan = getReserveMonthlyPlan(purchase);
                    const progress = purchase.estimatedValue
                      ? purchase.savedAmount / purchase.estimatedValue
                      : 0;

                    return (
                      <div
                        key={purchase.id}
                        className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.04)]"
                      >
                        <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr_auto] xl:items-center">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{purchase.name}</p>
                              <PriorityPill priority={purchase.priority} />
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                              {purchase.description || "Reserva planejada para compra futura"}
                            </p>
                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
                              Prazo {purchase.desiredDate ? formatShortDate(purchase.desiredDate) : "sem data"} ·{" "}
                              {reservePlan.monthCount} meses ate {formatMonthLabel(monthValueToDate(reservePlan.targetMonth))}
                            </p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-4">
                            <InfoBlock label="Alvo" value={formatCurrency(purchase.estimatedValue)} />
                            <InfoBlock label="Reservado" value={formatCurrency(purchase.savedAmount)} />
                            <InfoBlock label="Falta" value={formatCurrency(reservePlan.remaining)} />
                            <InfoBlock
                              label="Sugestao"
                              value={formatCurrency(reservePlan.suggestedMonthlyAmount)}
                            />
                          </div>

                          <div className="flex flex-wrap gap-2 xl:justify-end">
                            <button
                              type="button"
                              onClick={() => openPurchaseModal(purchase)}
                              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setHomeTab("grid")}
                              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                            >
                              Ver planilha
                            </button>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            <span>Progresso da reserva</span>
                            <span>{Math.round(progress * 100)}%</span>
                          </div>
                          <ProgressBar value={progress} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Ainda nao existem reservas ativas. Crie uma compra no modo guardar dinheiro para acompanhar aqui.
                  </div>
                )}
              </div>
            </Panel>
          </div>
        ) : null}

        {planningScreen === "investments" ? (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-5 md:grid-cols-2">
              <MetricStack
                label="Meta mensal"
                value={formatCurrency(settings.monthlyInvestmentTarget)}
                support="Configuracao principal"
              />
              <MetricStack
                label="Planejado no mes"
                value={formatCurrency(selectedMonthInvestmentPlan)}
                support="Lido da planilha"
              />
              <MetricStack
                label="Aportado no mes"
                value={formatCurrency(monthSummary.investedThisMonth)}
                support="Saidas registradas"
              />
              <MetricStack
                label="Total bruto"
                value={formatCurrency(investmentSnapshot.totalGross)}
                support="Soma dos investimentos"
              />
              <MetricStack
                label="Diferenca atual"
                value={formatCurrency(investmentSnapshot.gain)}
                support="Valor atual menos bruto"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
              <Panel title="Investimentos cadastrados" description="">
                <div className="space-y-3">
                  {investments.length ? (
                    investments.map((investment) => {
                      const plannedAmount = getInvestmentPlannedAmount(investment.id, selectedMonth);
                      return (
                        <div
                          key={investment.id}
                          className="rounded-[24px] border border-slate-200 bg-white px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{investment.name}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {investment.type}
                                {investment.objective ? ` Â· ${investment.objective}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openInvestmentContributionModal(investment)}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                              >
                                Aportar
                              </button>
                              <button
                                type="button"
                                onClick={() => openInvestmentModal(investment)}
                                className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                              >
                                Editar
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <InfoBlock label="Meta mensal" value={formatCurrency(investment.monthlyTarget)} />
                            <InfoBlock label="Mes atual" value={formatCurrency(plannedAmount)} />
                            <InfoBlock
                              label="Total bruto"
                              value={formatCurrency(investment.totalGrossInvested)}
                            />
                            <InfoBlock
                              label="Valor atual"
                              value={formatCurrency(
                                investment.currentManualValue ?? investment.totalGrossInvested,
                              )}
                            />
                            <InfoBlock
                              label="Aportes"
                              value={String(investment.contributions.length)}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      Ainda nao existem investimentos cadastrados.
                    </div>
                  )}
                </div>
              </Panel>

              <Panel title="Historico de aportes" description="">
                <div className="space-y-3">
                  {investmentContributionsHistory.length ? (
                    investmentContributionsHistory.slice(0, 10).map((contribution) => (
                      <div
                        key={contribution.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {contribution.investmentName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatShortDate(contribution.contributionDate)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(contribution.amount)}
                          </span>
                        </div>
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                          {(contribution.source ?? "manual") === "planilha"
                            ? "Origem: planilha"
                            : "Origem: manual"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      Ainda nao ha aportes registrados.
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </div>
        ) : null}

        {renderPurchaseModal()}
        {renderInvestmentModal()}
        {renderInvestmentContributionModal()}
      </div>
    );
  }
  function renderCardsWorkspace() {
    const totalCreditLimit = cardSummaries.reduce((sum, card) => sum + card.creditLimit, 0);
    const totalCreditUsed = cardSummaries.reduce((sum, card) => sum + card.creditUsed, 0);
    const totalDebitUsed = cardSummaries.reduce((sum, card) => sum + card.debitUsed, 0);

    if (selectedCardDetail && selectedCardDetail.availableMode !== "debit") {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => openCardBalanceModal()}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              Fazer balanco
            </button>
            <button
              type="button"
              onClick={() => openCardModal(selectedCardDetail)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Editar cartao
            </button>
            <button
              type="button"
              onClick={() => handleDeleteCard(selectedCardDetail.id)}
              className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
            >
              Excluir
            </button>
            <button
              type="button"
              onClick={closeCardDetails}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Voltar para contas
            </button>
          </div>

          <div
            className="rounded-[32px] p-6 text-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]"
            style={getCardGradient(selectedCardDetail.accentColor)}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/65">
                  {selectedCardDetail.issuer}
                </p>
                <p className="mt-3 text-3xl font-semibold">{selectedCardDetail.name}</p>
                <p className="mt-2 text-sm text-white/80">
                  Final {selectedCardDetail.lastDigits} - fecha dia {selectedCardDetail.closingDay} e vence dia{" "}
                  {selectedCardDetail.dueDay}
                </p>
              </div>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
                {selectedCardDetail.brand}
              </span>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <MetricStack
                dark
                label="Limite"
                value={formatCurrency(selectedCardDetail.creditLimit)}
              />
              <MetricStack
                dark
                label="Fatura do mes"
                value={formatCurrency(selectedCardStatementTotal)}
              />
              <MetricStack
                dark
                label="Disponivel"
                value={formatCurrency(selectedCardAvailableLimit)}
              />
              <MetricStack
                dark
                label="Lancamentos"
                value={String(selectedCardStatementItems.length)}
                support={selectedCardStatementDueLabel ? `Vence ${selectedCardStatementDueLabel}` : "Sem fatura"}
              />
            </div>
            {selectedCardLimitSnapshot.committed > selectedCardDetail.creditLimit + 0.009 ? (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Limite excedido em faturas abertas: {formatCurrency(selectedCardLimitSnapshot.committed)} de{" "}
                {formatCurrency(selectedCardDetail.creditLimit)}.
              </div>
            ) : null}
          </div>

          <Panel title="Meses da fatura" description="Passe pelos meses e veja o que estava dentro de cada fechamento.">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {selectedCardStatementMonths.map((monthValue) => {
                const total = getCardStatementGridItems(selectedCardDetail.id, monthValue).reduce(
                  (sum, item) => sum + item.amount,
                  0,
                );

                return (
                  <button
                    key={monthValue}
                    type="button"
                    onClick={() => setSelectedCardStatementMonth(monthValue)}
                    className={`min-w-[172px] rounded-[24px] border px-4 py-4 text-left transition ${
                      monthValue === selectedCardStatementMonth
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:-translate-y-0.5"
                    }`}
                  >
                    <p className="text-sm font-semibold">{formatMonthLabel(monthValueToDate(monthValue))}</p>
                    <p
                      className={`mt-3 text-xs ${
                        monthValue === selectedCardStatementMonth ? "text-white/70" : "text-slate-500"
                      }`}
                    >
                      Total da fatura
                    </p>
                    <p className="mt-1 text-sm font-semibold">{formatCurrency(total)}</p>
                  </button>
                );
              })}
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <Panel
              title={`Lancamentos de ${formatMonthLabel(monthValueToDate(selectedCardStatementMonth))}`}
              description="Tudo o que entrou nessa fatura do cartao selecionado."
              action={
                selectedGroupableCount >= 2 ? (
                  <button
                    type="button"
                    onClick={openGroupModal}
                    className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
                  >
                    Agrupar ({selectedGroupableCount})
                  </button>
                ) : selectedTransactionIds.length > 0 || selectedBillGroupIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearTransactionSelection}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Limpar ({selectedTransactionIds.length + selectedBillGroupIds.length})
                  </button>
                ) : null
              }
            >
              <div className="space-y-3">
                {selectedCardStatementItems.length ? (
                  <>
                    {selectedCardStatementBillItems.map((item) => {
                      const canSelectBillItem = isSelectableBillStatementItem(item);
                      const bill = canSelectBillItem ? getBillByStatementGroupId(item.sourceId) : undefined;
                      const group = bill?.groupId ? transactionGroups.find((currentGroup) => currentGroup.id === bill.groupId) : null;
                      const isSelected = canSelectBillItem && selectedBillGroupIds.includes(item.sourceId);
                      const groupItems = group
                        ? selectedCardStatementBillItems.filter(
                            (currentItem) => getCardStatementItemGroup(currentItem)?.id === group.id,
                          )
                        : [];
                      const isGroupExpanded = group ? expandedGroupId === group.id : false;
                      const isFirstGroupItem = !group || groupItems[0]?.id === item.id;
                      const isGroupSummary = Boolean(group && isFirstGroupItem && !isGroupExpanded);
                      const displayAmount = isGroupSummary
                        ? groupItems.reduce((sum, groupItem) => sum + groupItem.amount, 0)
                        : item.amount;

                      if (group && !isFirstGroupItem && !isGroupExpanded) {
                        return null;
                      }

                      return (
                        <div
                          key={`card-bill-item-${item.id}`}
                          className={`rounded-2xl border bg-white px-4 py-3 ${
                            isSelected ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-200"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {canSelectBillItem ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleBillGroupSelection(item.sourceId)}
                                  className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                />
                              ) : (
                                <span className="mt-1 h-4 w-4 shrink-0" />
                              )}
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {isGroupSummary && group ? group.nome : item.title}
                                  </p>
                                  {group ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                                      {isGroupSummary
                                        ? `${groupItems.length} ${groupItems.length === 1 ? "item" : "itens"}`
                                        : `Grupo: ${group.nome}`}
                                    </span>
                                  ) : null}
                                  {group && isFirstGroupItem ? (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedGroupId(isGroupExpanded ? null : group.id)}
                                      className="rounded-full bg-violet-50 p-1 text-violet-600 transition hover:bg-violet-100"
                                      aria-label={isGroupExpanded ? "Recolher grupo" : "Expandir grupo"}
                                    >
                                      {isGroupExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-sm text-slate-500">
                                  {isGroupSummary ? "Grupo de lancamentos da fatura" : item.support}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900">{formatCurrency(displayAmount)}</p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Conta vinculada
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {selectedCardStatementTransactions.length ? (() => {
                    const grouped: Transaction[] = [];
                    const ungrouped: Transaction[] = [];
                    const groupMap = new Map<string, Transaction[]>();

                    for (const t of selectedCardStatementTransactions) {
                      if (t.groupId) {
                        if (!groupMap.has(t.groupId)) {
                          groupMap.set(t.groupId, []);
                        }
                        groupMap.get(t.groupId)!.push(t);
                        if (!grouped.some((gt) => gt.groupId === t.groupId)) {
                          grouped.push(t);
                        }
                      } else {
                        ungrouped.push(t);
                      }
                    }

                    return [
                      ...Array.from(groupMap.entries()).map(([groupId, groupTransactions]) => {
                        const group = transactionGroups.find((g) => g.id === groupId);
                        const total = groupTransactions.reduce((sum, t) => sum + t.amount, 0);
                        const isExpanded = expandedGroupId === groupId;

                        return (
                          <div key={`group-${groupId}`} className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                            <div
                              className="flex cursor-pointer items-center justify-between gap-3"
                              onClick={() => setExpandedGroupId(isExpanded ? null : groupId)}
                            >
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm">
                                  📦
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{group?.nome ?? "Grupo"}</p>
                                  <p className="mt-0.5 text-xs text-violet-600">
                                    {groupTransactions.length} {groupTransactions.length === 1 ? "item" : "itens"}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-900">{formatCurrency(total)}</p>
                                <span className="mt-1 inline-flex justify-end text-violet-600">
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </span>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="mt-3 space-y-2 border-t border-violet-200 pt-3">
                                {groupTransactions.map((t) => (
                                  <div key={t.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                                    <div>
                                      <p className="text-sm font-medium text-slate-700">{t.title}</p>
                                      <p className="text-xs text-slate-500">
                                        {getDisplayCategoryName(t.categoryId, t.categoryName)} - {formatShortDate(t.date)}
                                      </p>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(t.amount)}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }),
                      ...ungrouped.map((transaction) => {
                        const isSelected = selectedTransactionIds.includes(transaction.id);

                        return (
                          <div
                            key={transaction.id}
                            className={`rounded-2xl border bg-white px-4 py-3 ${
                              isSelected ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-200"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleTransactionSelection(transaction.id)}
                                  className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                />
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{transaction.title}</p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {getDisplayCategoryName(transaction.categoryId, transaction.categoryName)} - {formatShortDate(transaction.date)}
                                  </p>
                                  {transaction.installmentTotal ? (
                                    <span
                                      title="Cada parcela entra na fatura do mes correspondente, nao no mes da compra."
                                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700"
                                    >
                                      Parcela {transaction.installmentNumber}/{transaction.installmentTotal}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-900">
                                  {formatCurrency(getCreditCardTransactionSignedAmount(transaction))}
                                </p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                  {transaction.status}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => requestTransactionAction(transaction, "edit")}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => requestTransactionAction(transaction, "delete")}
                                className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                              >
                                <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                                Excluir
                              </button>
                            </div>
                          </div>
                        );
                      }),
                    ];
                  })() : null}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                    Nenhum lancamento de credito apareceu nesse mes ainda.
                  </div>
                )}
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel
                title="Parcelas visiveis nesse mes"
                description="Quando a parcela acaba, ela naturalmente deixa de aparecer nos meses seguintes."
              >
                <div className="space-y-3">
                  {selectedCardStatementInstallments.length ? (
                    <>
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-700">
                          Compromisso de parcelas: {formatCurrency(selectedCardStatementInstallments.reduce((sum, t) => sum + t.amount, 0))}
                          {" "}({selectedCardStatementInstallments.length} {selectedCardStatementInstallments.length === 1 ? "parcela" : "parcelas"} neste mes)
                        </p>
                        <p className="mt-1 text-xs text-sky-500">
                          Cada parcela entra na fatura do mes correspondente, nao no mes da compra.
                        </p>
                      </div>
                      {selectedCardStatementInstallments.map((transaction) => (
                        <div
                          key={`${transaction.id}-installment`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{transaction.title}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                Parcela {transaction.installmentNumber}/{transaction.installmentTotal}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-slate-900">
                              {formatCurrency(transaction.amount)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                      Nenhuma parcela ativa nesse mes da fatura.
                    </div>
                  )}
                </div>
              </Panel>

              <Panel
                title="Fixos no cartao"
                description="Itens recorrentes que entram como detalhe desta fatura."
              >
                <div className="space-y-3">
                  {selectedCardFixedItems.length ? (
                    selectedCardFixedItems.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {getDisplayCategoryName(entry.categoryId, entry.categoryName)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(entry.amountByMonth[selectedCardStatementMonth] ?? 0)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                      Nenhum fixo recorrente entrou nessa fatura.
                    </div>
                  )}
                </div>
              </Panel>

              <Panel
                title="Resumo da fatura"
                description="Aqui fica o controle rapido do limite usado e do valor que vai para contas a pagar."
              >
                <div className="space-y-3">
                  <SimulationRow
                    label="Total registrado"
                    value={formatCurrency(selectedCardStatementTotal)}
                    support="Somando todos os lancamentos desse mes"
                  />
                  <SimulationRow
                    label="Conta automatica"
                    value={selectedCardStatementAutoBill ? formatCurrency(selectedCardStatementAutoBill.bill.amount) : formatCurrency(0)}
                    support={
                      selectedCardStatementDueLabel
                        ? `Vai para Contas como fatura com vencimento em ${selectedCardStatementDueLabel}`
                        : "Sem valor pendente para gerar conta"
                    }
                  />
                  <SimulationRow
                    label="Limite restante"
                    value={formatCurrency(selectedCardAvailableLimit)}
                    support="Considerando faturas abertas ainda nao pagas"
                  />
                </div>
              </Panel>
            </div>
          </div>

          {renderCardBalanceModal()}
          {renderCardModal()}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <Panel
              title="Cartoes"
              description="Cadastro vivo dos bancos, bandeiras, modalidades, limites e datas."
            action={
              <button
                type="button"
                onClick={() => openCardModal()}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                Novo cartao
              </button>
            }
          >
            <div className="space-y-4">
              {cardSummaries.map((card) => {
                const originalCard = cards.find((item) => item.id === card.id);
                const canOpenDetails = originalCard?.availableMode !== "debit";

                return (
                  <div
                    key={card.id}
                    className={`rounded-[28px] p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] ${
                      canOpenDetails ? "cursor-pointer transition hover:-translate-y-0.5" : ""
                    }`}
                    onClick={canOpenDetails ? () => openCardDetails(card.id) : undefined}
                    style={getCardGradient(originalCard?.accentColor ?? "#1d63cf")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold">{card.name}</p>
                        <p className="mt-1 text-sm text-white/75">
                          {originalCard?.issuer} - final {card.lastDigits}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
                          {card.brand}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openCardModal(originalCard);
                          }}
                          className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold transition hover:bg-white/25"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteCard(card.id);
                          }}
                          className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-100 transition hover:bg-red-500/30"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <MetricStack dark label="Limite" value={formatCurrency(card.creditLimit)} />
                      <MetricStack dark label="Usado no credito" value={formatCurrency(card.creditUsed)} />
                      <MetricStack dark label="Disponivel" value={formatCurrency(card.availableLimit)} />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/82">
                        Modalidade:{" "}
                        {originalCard?.availableMode === "both"
                          ? "Credito e debito"
                          : originalCard?.availableMode === "credit"
                            ? "Somente credito"
                            : "Somente debito"}
                      </div>
                      <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/82">
                        Fecha dia {card.closingDay} e vence dia {card.dueDay}
                      </div>
                    </div>

                    {canOpenDetails ? (
                      <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/82">
                        Toque para abrir a fatura, ver parcelas e acompanhar os lancamentos desse cartao.
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="Uso combinado" description="Credito e debito consolidados em uma leitura unica.">
              <SegmentBarChart
                items={[
                  { label: "Credito", value: totalCreditUsed, color: "#2563eb" },
                  { label: "Debito", value: totalDebitUsed, color: "#06b6d4" },
                ]}
              />
            </Panel>
            <Panel title="Resumo rapido" description="Leitura concentrada para saber como esta o uso dos cartoes.">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-sm text-slate-500">Limite total</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatCurrency(totalCreditLimit)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-sm text-slate-500">Credito usado</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatCurrency(totalCreditUsed)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-sm text-slate-500">Debito usado</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatCurrency(totalDebitUsed)}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Proximas parcelas" description="Compras parceladas geradas automaticamente">
              <div className="space-y-3">
                {upcomingInstallments.length ? (
                  upcomingInstallments.map((transaction) => (
                    <div key={transaction.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{transaction.title}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatShortDate(transaction.date)} - parcela {transaction.installmentNumber}/
                            {transaction.installmentTotal}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(transaction.amount)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                    Nenhuma parcela futura cadastrada por enquanto.
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </div>

        {renderCardModal()}
        {renderCardBalanceModal()}
      </div>
    );
  }

  function renderCardBalanceModal() {
    if (!isCardBalanceModalOpen || !selectedCardDetail) {
      return null;
    }

    const targetValue = Number(draftCardBalanceUsed.replace(",", ".")) || 0;
    const difference = Number((targetValue - selectedCardStatementTotal).toFixed(2));

    return renderGlobalModal(
      <div className="fixed inset-0 z-[1000] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/45 px-4 py-8">
        <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-[0_32px_80px_rgba(15,23,42,0.28)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Balanco do cartao</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                {selectedCardDetail.name} - {formatMonthLabel(monthValueToDate(selectedCardStatementMonth))}
              </h3>
            </div>
            <button
              type="button"
              onClick={closeCardBalanceModal}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500 transition hover:bg-slate-50"
            >
              x
            </button>
          </div>

          <form onSubmit={handleSaveCardBalance} className="mt-6 space-y-4">
            {draftTransactionError ? (
              <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {draftTransactionError}
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">Ja registrado nessa fatura</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCurrency(selectedCardStatementTotal)}
              </p>
            </div>

            <FormField label="Total real usado no cartao nesse mes">
              <input
                value={draftCardBalanceUsed}
                onChange={(event) => setDraftCardBalanceUsed(event.target.value)}
                placeholder="Ex.: 470"
                className="field"
              />
            </FormField>

            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-slate-700">
              {difference > 0 ? (
                <p>
                  Vai ser criado um unico lancamento de balanco no valor de{" "}
                  <span className="font-semibold">{formatCurrency(difference)}</span> para completar a fatura sem apagar os registros ja feitos.
                </p>
              ) : (
                <p>
                  Informe um total maior do que o ja registrado para gerar o ajuste automatico dessa fatura.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCardBalanceModal}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={difference <= 0}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Salvar balanco
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
  function renderBills() {
    const pendingBillsAmount = allBills
      .filter((bill) => bill.status !== "paid")
      .reduce((sum, bill) => sum + bill.amount, 0);
    const activeDebtsAmount = activeDebts
      .filter((debt) => debt.status === "active")
      .reduce((sum, debt) => sum + debt.remainingAmount, 0);
    const normalBillItems = billsForDisplay.filter((item) => item.source === "manual" && !item.bill.isRecurring);
    const recurringBillItems = billsForDisplay.filter((item) => item.source === "manual" && item.bill.isRecurring);
    const archivedItemsCount =
      archivedBills.length + archivedAutoCardBills.length + archivedDebts.length + archivedFixedEntries.length;
    const normalBillsAmount = normalBillItems
      .filter((item) => item.bill.status !== "paid")
      .reduce((sum, item) => sum + item.bill.amount, 0);
    const recurringBillsCount = recurringBillItems.length;
    const accountsMenu = [
      { id: "overview" as const, label: "Visao geral" },
      { id: "normal" as const, label: "Contas" },
      { id: "recurring" as const, label: "Contas recorrentes" },
      { id: "debts" as const, label: "Dividas e acordos" },
      { id: "archived" as const, label: `Arquivados${archivedItemsCount ? ` (${archivedItemsCount})` : ""}` },
    ];

    const accountsToolbar = (
      <div className="mt-5 flex flex-wrap gap-2">
        {accountsMenu.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAccountsSection(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              accountsSection === item.id
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    );

    const accountsQuickActions = (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openCommitmentModal({ kind: "expense", schedule: "once", paymentMethod: "pix" })}
          aria-label="Novo compromisso"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-700"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );

    return (
      <div className="space-y-4">
        <Panel
          title="Contas"
          description=""
          action={accountsQuickActions}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Pendencias do mes</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(pendingBillsAmount)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Contas normais</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(normalBillsAmount)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Dividas e acordos em aberto</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(activeDebtsAmount)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Recorrencias ativas</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{recurringBillsCount}</p>
            </div>
          </div>
          {accountsToolbar}
        </Panel>

        {accountsSection === "overview" ? (
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Contas" description="">
              <div className="space-y-3">
                {normalBillItems.slice(0, 4).map((item) => (
                  <div key={item.bill.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.bill.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {getBillCategoryDisplayName(item.bill)} - vence {formatShortDate(item.bill.dueDate)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.bill.amount)}</p>
                    </div>
                  </div>
                ))}
                {!normalBillItems.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Nenhuma conta normal cadastrada.
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setAccountsSection("normal")}
                className="mt-4 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ver contas
              </button>
            </Panel>

            <Panel title="Contas recorrentes" description="">
              <div className="space-y-3">
                {recurringBillItems.slice(0, 4).map((item) => (
                  <div key={item.bill.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.bill.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Todo dia {String(item.bill.recurringDay ?? Number(item.bill.dueDate.slice(8, 10))).padStart(2, "0")}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.bill.amount)}</p>
                    </div>
                  </div>
                ))}
                {!recurringBillItems.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Nenhuma conta recorrente cadastrada.
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setAccountsSection("recurring")}
                className="mt-4 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ver recorrentes
              </button>
            </Panel>

            <Panel title="Dividas e acordos" description="">
              <div className="space-y-3">
                {activeDebts.slice(0, 3).map((debt) => (
                  <div key={debt.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{debt.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Proximo pagamento em {formatShortDate(debt.nextDueDate)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(debt.remainingAmount)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAccountsSection("debts")}
                className="mt-4 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ver dividas
              </button>
            </Panel>
          </div>
        ) : accountsSection === "normal" ? (
          <Panel title="Contas" description="">
            <div className="space-y-3">
              {normalBillItems.length ? (
                normalBillItems.map((item) => {
                  const bill = item.bill;

                  return (
                    <div
                      key={bill.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{bill.title}</p>
                            <PriorityPill priority={bill.priority} />
                            {(bill.installments ?? 1) > 1 ? (
                              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                                {bill.installments} parcelas
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                                A vista
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {getBillCategoryDisplayName(bill)} - vence {formatShortDate(bill.dueDate)}
                          </p>
                          {bill.plannedPaymentMethod ? (
                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                              Pagamento planejado: {getPlannedPaymentDetails(
                                bill.plannedPaymentMethod,
                                bill.plannedCardId,
                                bill.plannedCardMode ?? "credit",
                                cards,
                              ).label}
                            </p>
                          ) : null}
                          {bill.notes ? <p className="mt-2 text-sm text-slate-500">{bill.notes}</p> : null}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-slate-900">{formatCurrency(bill.amount)}</p>
                          <p
                            className={`mt-1 text-xs font-semibold uppercase tracking-[0.24em] ${
                              bill.status === "paid"
                                ? "text-emerald-600"
                                : bill.status === "overdue"
                                  ? "text-red-500"
                                  : "text-orange-500"
                            }`}
                          >
                            {bill.status}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openBillModal(bill)}
                          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        {bill.status !== "paid" ? (
                          <button
                            type="button"
                            onClick={() => handlePayBill(bill.id)}
                            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                          >
                            Marcar como paga
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Nenhuma conta normal cadastrada. Use + para registrar um compromisso.
                </div>
              )}
            </div>
          </Panel>
        ) : accountsSection === "recurring" ? (
          <Panel title="Contas recorrentes e vencimentos" description="">
            <div className="space-y-3">
              {recurringBillItems.map((item) => {
                const bill = item.bill;

                return (
                  <div
                    key={bill.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{bill.title}</p>
                          <PriorityPill priority={bill.priority} />
                          {item.source === "card_auto" ? (
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                              Auto
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {getBillCategoryDisplayName(bill)} - vence {formatShortDate(bill.dueDate)}
                        </p>
                        {item.source === "card_auto" ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                            Gerada pelo cartao de credito - fatura de {formatMonthLabel(monthValueToDate(item.statementMonth))}
                          </p>
                        ) : bill.plannedPaymentMethod ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                            Pagamento planejado: {getPlannedPaymentDetails(
                              bill.plannedPaymentMethod,
                              bill.plannedCardId,
                              bill.plannedCardMode ?? "credit",
                              cards,
                            ).label}
                          </p>
                        ) : null}
                        {item.source === "manual" && bill.isRecurring ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
                            Recorrente todo dia {String(bill.recurringDay ?? Number(bill.dueDate.slice(8, 10))).padStart(2, "0")}
                          </p>
                        ) : null}
                        {item.source === "manual" && isCreditLinkedBill(bill) && (bill.installments ?? 1) > 1 ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {(bill.installments ?? 1)} parcelas vinculadas ao cartao
                          </p>
                        ) : null}
                        {bill.notes ? <p className="mt-2 text-sm text-slate-500">{bill.notes}</p> : null}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">{formatCurrency(bill.amount)}</p>
                        <p
                          className={`mt-1 text-xs font-semibold uppercase tracking-[0.24em] ${
                            bill.status === "paid"
                              ? "text-emerald-600"
                              : bill.status === "overdue"
                                ? "text-red-500"
                                : "text-orange-500"
                          }`}
                        >
                          {bill.status}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.source === "manual" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openBillModal(bill)}
                            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          {isCreditLinkedBill(bill) ? (
                            <button
                              type="button"
                              onClick={() => openCardDetails(bill.plannedCardId ?? settings.defaultCardId, bill.dueDate.slice(0, 7))}
                              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                            >
                              Abrir cartao
                            </button>
                          ) : bill.status !== "paid" ? (
                            <button
                              type="button"
                              onClick={() => handlePayBill(bill.id)}
                              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                            >
                              Marcar como paga
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openCardDetails(item.cardId, item.statementMonth)}
                          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                        >
                          Abrir cartao
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        ) : accountsSection === "archived" ? (
          <Panel title="Arquivados" description="">
            <div className="space-y-3">
              {archivedItemsCount ? (
                <>
                  {archivedBills.map((bill) => (
                    <div
                      key={`archived-bill-${bill.id}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{bill.title}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Conta paga em {formatShortDate(bill.dueDate)}
                          </p>
                          {bill.archivedAt ? (
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                              Arquivada em {formatShortDate(bill.archivedAt.slice(0, 10))}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(bill.amount)}</p>
                          <button
                            type="button"
                            onClick={() => handleRestoreArchivedBill(bill.id)}
                            className="mt-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                          >
                            Voltar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {archivedAutoCardBills.map((item) => (
                    <div
                      key={`archived-card-bill-${item.cardId}-${item.statementMonth}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.bill.title}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Fatura de {formatMonthLabel(monthValueToDate(item.statementMonth))}
                          </p>
                          {item.bill.archivedAt ? (
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                              Arquivada em {formatShortDate(item.bill.archivedAt.slice(0, 10))}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.bill.amount)}</p>
                          <button
                            type="button"
                            onClick={() => handleRestoreArchivedCardBill(item.cardId, item.statementMonth)}
                            className="mt-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                          >
                            Voltar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {archivedDebts.map((debt) => (
                    <div
                      key={`archived-debt-${debt.id}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{debt.name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Divida quitada ou encerrada
                          </p>
                          {debt.archivedAt ? (
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                              Arquivada em {formatShortDate(debt.archivedAt.slice(0, 10))}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(debt.totalAmount)}</p>
                          <button
                            type="button"
                            onClick={() => handleRestoreArchivedDebt(debt.id)}
                            className="mt-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                          >
                            Voltar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {archivedFixedEntries.map((entry) => (
                    <div
                      key={`archived-fixed-${entry.id}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Linha arquivada da planilha
                          </p>
                          {entry.archivedAt ? (
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                              Arquivada em {formatShortDate(entry.archivedAt.slice(0, 10))}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreArchivedFixedEntry(entry.id)}
                          className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                          Voltar
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Nenhuma conta arquivada ainda.
                </div>
              )}
            </div>
          </Panel>
        ) : (
          <Panel
            title="Dividas e acordos"
            description=""
          >
            <div className="space-y-3">
              {activeDebts.map((debt) => (
                <div
                  key={debt.id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{debt.name}</p>
                        <PriorityPill priority={debt.priority} />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Proximo pagamento em {formatShortDate(debt.nextDueDate)}
                      </p>
                      {debt.description ? <p className="mt-2 text-sm text-slate-500">{debt.description}</p> : null}
                      {debt.plannedPaymentMethod ? (
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                          Forma planejada: {getPlannedPaymentDetails(
                            debt.plannedPaymentMethod,
                            debt.plannedCardId,
                            "credit",
                            cards,
                          ).label}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-900">{formatCurrency(debt.remainingAmount)}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        restante
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                      <span>Pago ate agora</span>
                      <span>{Math.round((debt.paidAmount / debt.totalAmount) * 100)}%</span>
                    </div>
                    <ProgressBar value={debt.paidAmount / debt.totalAmount} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoBlock label="Total" value={formatCurrency(debt.totalAmount)} />
                    <InfoBlock label="Valor da parcela" value={formatCurrency(debt.installmentAmount)} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openDebtModal(debt)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDebt(debt.id)}
                      className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                      Excluir
                    </button>
                    {debt.remainingAmount > 0 ? (
                      <button
                        type="button"
                        onClick={() => openDebtPlanModal(debt)}
                        className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                      >
                        Planejar pagamento
                      </button>
                    ) : null}
                    {debt.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => handleDebtAdvance(debt.id)}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                      >
                        Registrar abatimento
                      </button>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                        Divida quitada.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {renderNewAccountModal()}
        {renderCommitmentModal()}
        {renderBillModal()}
        {renderDebtModal()}
        {renderDebtPlanModal()}
      </div>
    );
  }

  function renderCardsHomeTab() {
    return (
      <div className="space-y-4">
        <Panel
          title="Cartoes"
          description=""
          action={
            <button
              type="button"
              onClick={() => openCardModal()}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              Novo cartao
            </button>
          }
        >
          <p className="text-sm text-slate-500">
            Cadastre, acompanhe limites, faturas, parcelas e balancos dos seus cartoes em uma area propria.
          </p>
        </Panel>
        {renderCardsWorkspace()}
      </div>
    );
  }

  function getReportDataset(section: ReportsSection) {
    switch (section) {
      case "cashflow":
        return {
          title: "Entradas e saidas",
          headers: ["Indicador", "Valor"],
          rows: [
            ["Entradas do mes", monthSummary.receivedIncome + monthSummary.variableIncome],
            ["Saidas pagas", monthSummary.paidExpenses],
            ["Resultado", monthSummary.remainingMonth],
            ["Contas em aberto", monthSummary.pendingBills],
          ],
        };
      case "categories":
        return {
          title: "Categorias",
          headers: ["Categoria", "Valor"],
          rows: categoryBreakdown.map((item) => [item.categoryName, item.amount]),
        };
      case "payment-methods":
        return {
          title: "Pagamentos",
          headers: ["Meio", "Valor"],
          rows: Object.entries(paymentMethodData).sort((left, right) => right[1] - left[1]),
        };
      case "monthly-trend":
        return {
          title: "Evolucao mensal",
          headers: ["Mes", "Entradas", "Saidas", "Resultado"],
          rows: monthlyTrend.map((item) => [item.label, item.income, item.expenses, item.result]),
        };
      case "exports":
        return {
          title: "Exportacao",
          headers: ["Secao", "Status"],
          rows: [
            ["Entradas e saidas", "Disponivel"],
            ["Categorias", "Disponivel"],
            ["Pagamentos", "Disponivel"],
            ["Evolucao mensal", "Disponivel"],
          ],
        };
    }
  }

  function downloadReportXls(section: ReportsSection) {
    const dataset = getReportDataset(section);
    const rows = [dataset.headers, ...dataset.rows].map((row) =>
      row.map((value) => String(value).replace(/\t/g, " ")).join("\t"),
    );
    const blob = new Blob([rows.join("\n")], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `monex-${section}.xls`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadReportPdf(section: ReportsSection) {
    const dataset = getReportDataset(section);
    const printWindow = window.open("", "_blank", "width=960,height=720");
    if (!printWindow) {
      return;
    }

    const tableRows = dataset.rows
      .map(
        (row) =>
          `<tr>${row
            .map((value) => `<td style="padding:10px;border:1px solid #cbd5e1;">${String(value)}</td>`)
            .join("")}</tr>`,
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${dataset.title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; background: #e2e8f0; padding: 10px; border: 1px solid #cbd5e1; }
          </style>
        </head>
        <body>
          <h1>${dataset.title}</h1>
          <table>
            <thead>
              <tr>${dataset.headers.map((header) => `<th>${header}</th>`).join("")}</tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function renderReports() {
    const reportsMenu = [
      { id: "cashflow" as const, label: "Entradas e saidas" },
      { id: "categories" as const, label: "Categorias" },
      { id: "payment-methods" as const, label: "Pagamentos" },
      { id: "monthly-trend" as const, label: "Evolucao mensal" },
      { id: "exports" as const, label: "Exportacao" },
    ];
    const paymentUsage = Object.entries(paymentMethodData).sort((left, right) => right[1] - left[1]);
    const activeReport = reportsMenu.find((item) => item.id === reportsSection) ?? reportsMenu[0];

    return (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
          <Panel title="Submenus" description="">
            <div className="space-y-2">
              {reportsMenu.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReportsSection(item.id)}
                  className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                    reportsSection === item.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                </button>
              ))}
            </div>
          </Panel>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
              <div>
                <p className="text-lg font-semibold text-slate-900">{activeReport.label}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadReportPdf(reportsSection)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Baixar PDF
                </button>
                <button
                  type="button"
                  onClick={() => downloadReportXls(reportsSection)}
                  className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
                >
                  Baixar XLS
                </button>
              </div>
            </div>

            {reportsSection === "cashflow" ? (
              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <Panel title="Resumo do mes" description="">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm text-slate-500">Entradas do mes</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {formatCurrency(monthSummary.receivedIncome + monthSummary.variableIncome)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm text-slate-500">Saidas pagas</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(monthSummary.paidExpenses)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm text-slate-500">Resultado</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(monthSummary.remainingMonth)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm text-slate-500">Contas em aberto</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(monthSummary.pendingBills)}</p>
                    </div>
                  </div>
                </Panel>

                <div className="space-y-4">
                  <Panel title="Evolucao mensal" description="">
                    <TrendBars items={monthlyTrend} />
                  </Panel>
                  <Panel title="Comparativo visual das categorias" description="">
                    <MiniBarChart
                      items={categoryBreakdown.slice(0, 6).map((item, index) => ({
                        label: item.categoryName,
                        value: item.amount,
                        color: ["#2563eb", "#0ea5e9", "#f97316", "#10b981", "#8b5cf6", "#ef4444"][index],
                      }))}
                    />
                  </Panel>
                </div>
              </div>
            ) : null}

            {reportsSection === "categories" ? (
              <div className="grid gap-4 xl:grid-cols-[0.94fr_1.06fr]">
                <Panel title="Gastos por categoria" description="">
                  <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
                    <CategoryDonut items={categoryBreakdown.slice(0, 6)} />
                    <div className="space-y-3">
                      {categoryBreakdown.slice(0, 6).map((item, index) => (
                        <LegendRow
                          key={item.categoryName}
                          index={index}
                          label={item.categoryName}
                          value={item.amount}
                        />
                      ))}
                    </div>
                  </div>
                </Panel>
                <Panel title="Ranking de categorias" description="">
                  <div className="space-y-3">
                    {categoryBreakdown.map((item, index) => (
                      <div key={item.categoryName} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <LegendBadge index={index} />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900">{item.categoryName}</p>
                            <ProgressBar value={item.amount / Math.max(categoryBreakdown[0]?.amount ?? 1, 1)} />
                          </div>
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            ) : null}

            {reportsSection === "payment-methods" ? (
              <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                <Panel title="Resumo por meio de pagamento" description="">
                  <SegmentBarChart items={paymentMethodItems} />
                </Panel>
                <Panel title="Uso por meio de pagamento" description="">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {paymentUsage.map(([label, amount]) => (
                      <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">{label}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(amount)}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            ) : null}

            {reportsSection === "monthly-trend" ? (
              <div className="space-y-4">
                <Panel title="Evolucao mensal" description="">
                  <TrendBars items={monthlyTrend} />
                </Panel>
                <Panel title="Ultimos meses" description="">
                  <div className="grid gap-3 md:grid-cols-3">
                    {monthlyTrend.slice(-3).map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-3 text-sm text-slate-500">Entradas {formatCurrency(item.income)}</p>
                        <p className="mt-1 text-sm text-slate-500">Saidas {formatCurrency(item.expenses)}</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(item.result)}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            ) : null}

            {reportsSection === "exports" ? (
              <Panel title="Exportacao historica" description="">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {reportsMenu
                    .filter((item) => item.id !== "exports")
                    .map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => downloadReportPdf(item.id)}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadReportXls(item.id)}
                            className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
                          >
                            XLS
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function renderReconciliationWorkspace() {
    const plannedSurplus = fixedMonthPlannedIncome - fixedMonthPlannedExpense;

    return (
      <div className="space-y-4">
        <Panel title="Real vs Planejado" description="">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-slate-500">Ganhos planejados</p>
              <p className="mt-2 text-xl font-semibold text-emerald-600">
                {formatCurrency(fixedMonthPlannedIncome)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-slate-500">Gastos planejados</p>
              <p className="mt-2 text-xl font-semibold text-rose-600">
                {formatCurrency(fixedMonthPlannedExpense)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-slate-500">Sobra planejada</p>
              <p className={`mt-2 text-xl font-semibold ${plannedSurplus >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                {formatCurrency(plannedSurplus)}
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4">
              <p className="text-sm font-semibold text-blue-700">Proxima etapa</p>
              <p className="mt-2 text-sm font-medium text-blue-900">
                Comparar com transacoes reais e uso da sobra.
              </p>
            </div>
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Diferencas do planejado" description="">
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">
              Aqui entram contas, faturas, ganhos e dividas planejadas que vierem com valor diferente do real.
            </div>
          </Panel>
          <Panel title="Uso da sobra" description="">
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">
              Aqui entram os gastos livres que nao pertencem aos planejados.
            </div>
          </Panel>
          <Panel title="Analise dos planejados" description="">
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">
              Aqui entram graficos por categoria, cartao, tipo e mes.
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  function renderSettingsWorkspace() {
    const settingsMenu = [
      { id: "main" as const, label: "Configuracoes principais" },
      { id: "salary" as const, label: "Salario fixo por mes" },
      { id: "categories" as const, label: "Categorias" },
      { id: "banks" as const, label: "Bancos e cartoes" },
      { id: "accounts" as const, label: "Contas e carteiras" },
      { id: "security" as const, label: "Acesso e seguranca" },
    ];

    return (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
          <Panel title="Submenus" description="">
            <div className="space-y-2">
              {settingsMenu.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSettingsSection(item.id)}
                  className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                    settingsSection === item.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                </button>
              ))}
            </div>
          </Panel>

          <div className="space-y-4">
            {settingsSection === "main" ? (
              <Panel title="Configuracoes principais" description="">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ConfigField
                    label="Salario medio base"
                    value={settings.fixedSalaryExpected}
                    onChange={(value) =>
                      setSettings((current) => ({ ...current, fixedSalaryExpected: value }))
                    }
                  />
                  <ConfigField
                    label="Meta mensal de investimentos"
                    value={settings.monthlyInvestmentTarget}
                    onChange={(value) =>
                      setSettings((current) => ({ ...current, monthlyInvestmentTarget: value }))
                    }
                  />
                  <ConfigField
                    label="Teto mensal para dividas"
                    value={settings.monthlyDebtPaymentCap}
                    onChange={(value) =>
                      setSettings((current) => ({ ...current, monthlyDebtPaymentCap: value }))
                    }
                  />
                  <ConfigField
                    label="Meta de renda extra"
                    value={settings.extraIncomeGoal}
                    onChange={(value) =>
                      setSettings((current) => ({ ...current, extraIncomeGoal: value }))
                    }
                  />
                  <FormField label="Conta padrao">
                    <CustomSelect
                      value={settings.defaultAccountId}
                      onChange={(val) =>
                        setSettings((current) => ({
                          ...current,
                          defaultAccountId: val,
                        }))
                      }
                      options={accounts.map((account) => ({ value: account.id, label: account.name, icon: Building2 }))}
                    />
                  </FormField>
                  <FormField label="Metodo de pagamento padrao da fatura">
                    <CustomSelect
                      value={settings.defaultBillPaymentMethod}
                      onChange={(val) =>
                        setSettings((current) => ({
                          ...current,
                          defaultBillPaymentMethod: val as PaymentPlanMethod,
                        }))
                      }
                      options={[
                        { value: "pix", label: "PIX" },
                        { value: "bank_transfer", label: "Transferencia bancaria" },
                        { value: "cash", label: "Dinheiro" },
                        { value: "card", label: "Cartao" },
                      ]}
                    />
                  </FormField>
                </div>

              </Panel>
            ) : null}

            {settingsSection === "salary" ? (
              <Panel
                title="Salario fixo por mes"
                description=""
                action={
                  <button
                    type="button"
                    onClick={handleApplyAverageSalaryToMonths}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                  >
                    Aplicar media em todos
                  </button>
                }
              >
                <div className="mb-5 rounded-[28px] border border-sky-100 bg-[linear-gradient(135deg,rgba(224,242,254,0.9),rgba(255,255,255,0.92))] px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-sky-700">
                    Calendario salarial {referenceMonthDate.getFullYear()}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    Media base {formatCurrency(settings.fixedSalaryExpected)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {salaryCalendarMonths.map((monthItem) => {
                    const plan =
                      monthlyPlansByMonth[monthItem.monthValue] ?? createMonthlyPlanForMonth(monthItem.monthValue);
                    const isCustom = plan.fixedIncomePlanned !== settings.fixedSalaryExpected;

                    return (
                      <button
                        key={monthItem.monthValue}
                        type="button"
                        onClick={() => openSalaryMonthModal(monthItem.monthValue)}
                        className={`rounded-[26px] border px-4 py-4 text-left transition hover:-translate-y-0.5 ${
                          monthItem.monthValue === selectedMonth
                            ? "border-sky-300 bg-sky-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                              {monthItem.label}
                            </p>
                            <p className="mt-3 text-lg font-semibold text-slate-900">
                              {formatCurrency(plan.fixedIncomePlanned)}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                              isCustom
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {isCustom ? "Ajustado" : "Base"}
                          </span>
                        </div>
                        <div className="mt-5 border-t border-slate-100 pt-3">
                          <p className="text-sm text-slate-500">{monthItem.fullLabel}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            ) : null}

            {settingsSection === "categories" ? (
              <Panel
                title="Categorias"
                description="Crie, edite ou exclua categorias para receitas e despesas."
                action={
                  <button
                    type="button"
                    onClick={() => openCategoryModal()}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                  >
                    Nova categoria
                  </button>
                }
              >
                <div className="space-y-3">
                  {categories
                    .filter((category) => !isHiddenUiCategoryId(category.id))
                    .sort((left, right) =>
                      getCategoryFullName(left, categories).localeCompare(getCategoryFullName(right, categories)),
                    )
                    .map((category) => (
                    <div key={category.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {getCategoryFullName(category, categories)}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {category.type === "income" ? "Receita" : "Despesa"}
                              {category.parentId ? " - Subcategoria" : " - Principal"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openCategoryModal(category)}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}

            {settingsSection === "banks" ? (
              <Panel
                title="Bancos e cartoes"
                description=""
              >
                <form onSubmit={handleSaveBankPreset} className="mb-5 grid gap-3 lg:grid-cols-[1fr_160px_110px_auto]">
                  <FormField label="Banco">
                    <input
                      value={draftBankPreset.issuer}
                      onChange={(event) =>
                        setDraftBankPreset((current) => ({ ...current, issuer: event.target.value }))
                      }
                      placeholder="Ex.: Mercado Pago"
                      className="field"
                    />
                  </FormField>
                  <FormField label="Bandeira padrao">
                    <CustomSelect
                      value={draftBankPreset.brand}
                      onChange={(val) =>
                        setDraftBankPreset((current) => ({ ...current, brand: val }))
                      }
                      options={[
                        { value: "Mastercard", label: "Mastercard" },
                        { value: "Visa", label: "Visa" },
                        { value: "Elo", label: "Elo" },
                        { value: "American Express", label: "American Express" },
                      ]}
                    />
                  </FormField>
                  <FormField label="Cor">
                    <input
                      type="color"
                      value={draftBankPreset.color}
                      onChange={(event) =>
                        setDraftBankPreset((current) => ({ ...current, color: event.target.value }))
                      }
                      className="field h-12"
                    />
                  </FormField>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      {editingBankIssuer ? "Atualizar" : "Adicionar"}
                    </button>
                    {editingBankIssuer ? (
                      <button
                        type="button"
                        onClick={closeBankPresetEditor}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="grid gap-3 md:grid-cols-2">
                  {bankPresets.map((preset) => (
                    <div key={preset.issuer} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-8 w-8 rounded-full border border-slate-200"
                            style={{ backgroundColor: preset.color }}
                          />
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{preset.issuer}</p>
                            <p className="mt-1 text-xs text-slate-500">{preset.brand}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openBankPresetEditor(preset)}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}

            {settingsSection === "accounts" ? (
              <Panel
                title="Contas e carteiras"
                description="Saldo calculado em tempo real a partir das transacoes"
                action={
                  <button
                    type="button"
                    onClick={() => openAccountModal()}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                  >
                    Nova conta
                  </button>
                }
              >
                <div className="space-y-3">
                  {accountsSnapshot.map((account) => (
                    <div key={account.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{account.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{account.type}</p>
                          <p className="mt-3 text-lg font-semibold text-slate-900">
                            {formatCurrency(account.balance)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openAccountModal(accounts.find((item) => item.id === account.id))}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}

            {settingsSection === "security" ? (
              <Panel title="Acesso e seguranca" description="Fluxo pensado para login privado e usuario unico">
                <div className="space-y-3 text-sm text-slate-600">
                  <p>Login publico nao esta exposto. O fluxo foi pensado para autenticacao privada via Supabase Auth.</p>
                  <p>Sessao persistente e area protegida podem ser conectadas depois sem refazer a navegacao.</p>
                  <a
                    href="/login"
                    className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                  >
                    Ver tela de login
                  </a>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>

        {renderSalaryMonthModal()}
        {renderCategoryModal()}
        {renderAccountModal()}
      </div>
    );
  }
  function createTransactionsFromDraft(
    draft: DraftTransaction,
    amount: number,
    categoryName: string,
  ) {
    const paymentMethod: PaymentMethod =
      draft.paymentOption === "card"
        ? draft.cardMode === "debit"
          ? "debit_card"
          : "credit_card"
        : draft.paymentOption;

    if (
      draft.type === "expense" &&
      paymentMethod === "credit_card" &&
      draft.cardMode === "credit" &&
      draft.installments > 1
    ) {
      const installmentGroupId = crypto.randomUUID();
      const installmentAmount = Number((amount / draft.installments).toFixed(2));

      return Array.from({ length: draft.installments }, (_, index) => {
        const installmentDate = new Date(`${draft.date}T12:00:00`);
        installmentDate.setMonth(installmentDate.getMonth() + index);

        return {
          id: crypto.randomUUID(),
          title: draft.title,
          type: draft.type,
          amount: installmentAmount,
          date: `${installmentDate.getFullYear()}-${String(
            installmentDate.getMonth() + 1,
          ).padStart(2, "0")}-${String(installmentDate.getDate()).padStart(2, "0")}`,
          categoryId: draft.categoryId,
          categoryName,
          paymentMethod,
          status: index === 0 ? "paid" : "planned",
          expenseKind:
            draft.linkedPlannedPurchaseId
              ? "planned_purchase"
              : draft.operationKind === "investment" || draft.categoryId === "cat-invest"
              ? "investment"
              : draft.operationKind === "debt_payment"
                ? "debt_payment"
                : draft.operationKind === "basic_bill" || draft.operationKind === "recurring_bill"
                  ? "basic_bill"
                  : "variable",
          cardId: draft.cardId,
          cardMode: draft.cardMode,
          installmentGroupId,
          installmentNumber: index + 1,
          installmentTotal: draft.installments,
          accountId: draft.accountId,
          description: draft.description,
          linkedPlannedPurchaseId: draft.linkedPlannedPurchaseId || undefined,
        } satisfies Transaction;
      });
    }

    return [
      {
        id: crypto.randomUUID(),
        title: draft.title,
        type: draft.type,
        amount,
        date: draft.date,
        categoryId: draft.categoryId,
        categoryName,
        paymentMethod,
        status: draft.type === "income" ? "received" : "paid",
        incomeKind: draft.type === "income" ? "variable" : undefined,
        expenseKind:
          draft.type === "expense"
            ? draft.linkedPlannedPurchaseId
              ? "planned_purchase"
              : draft.operationKind === "investment" || draft.categoryId === "cat-invest"
              ? "investment"
              : draft.operationKind === "debt_payment"
                ? "debt_payment"
                : draft.operationKind === "basic_bill" || draft.operationKind === "recurring_bill"
                  ? "basic_bill"
                  : "variable"
            : undefined,
        cardId:
          draft.type === "expense" &&
          (paymentMethod === "credit_card" || paymentMethod === "debit_card")
            ? draft.cardId
            : undefined,
        cardMode:
          draft.type === "expense" &&
          (paymentMethod === "credit_card" || paymentMethod === "debit_card")
            ? draft.cardMode
            : undefined,
        accountId: draft.accountId,
        description: draft.description,
        linkedPlannedPurchaseId: draft.linkedPlannedPurchaseId || undefined,
      } satisfies Transaction,
    ];
  }
}









