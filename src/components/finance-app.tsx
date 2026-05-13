"use client";

import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  CardMode,
    Category,
    Debt,
    FinancePriority,
    FixedFlowEntry,
    FixedFlowSection,
    Investment,
    MonthlyGridRow,
    MonthlyPlan,
    Settings,
    PaymentPlanMethod,
  PaymentMethod,
  PlannedPurchase,
  Transaction,
  ViewId,
} from "@/types/finance";
import {
  CategoryDonut,
  ConfigField,
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

type DraftTransaction = {
  title: string;
  type: "income" | "expense";
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
type AccountsSection = "overview" | "recurring" | "debts";
type HomeTab = "grid" | "planning" | "accounts" | "cards";
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
};

type DraftSalaryMonth = {
  monthValue: string;
  fixedIncomePlanned: string;
};

const viewPathMap: Record<ViewId, string> = {
  home: "/",
  transactions: "/transacoes",
  history: "/historico",
  settings: "/configuracoes",
};

function isHomeTab(value: string | null): value is HomeTab {
  return value === "grid" || value === "planning" || value === "accounts" || value === "cards";
}

function isPlanningScreen(value: string | null): value is Exclude<PlanningScreen, "board"> {
  return value === "purchases" || value === "reserves" || value === "investments";
}

function isAccountsSection(value: string | null): value is AccountsSection {
  return value === "overview" || value === "recurring" || value === "debts";
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

const initialMonth = referenceDate.slice(0, 7);
const FINANCE_STORAGE_KEY = "monex-app-state-v1";
const FINANCE_STORAGE_BACKUP_KEY = "monex-app-state-v1-backup";
type FinancePersistedState = {
  selectedMonth: string;
  accounts: Account[];
  cards: Card[];
  transactions: Transaction[];
  bills: Bill[];
  categories: Category[];
  debts: Debt[];
  fixedEntries: FixedFlowEntry[];
  plannedPurchases: PlannedPurchase[];
  investments: Investment[];
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
  "Gastos fixos",
  "Dividas e repasses",
  "Compras planejadas",
];

const fixedSectionStyles: Record<FixedFlowSection, string> = {
  Ganhos: "border-emerald-200 bg-emerald-50/80",
  "Gastos fixos": "border-rose-200 bg-rose-50/80",
  "Dividas e repasses": "border-amber-200 bg-amber-50/80",
  "Compras planejadas": "border-violet-200 bg-violet-50/80",
};

const fixedSectionDisplayLabels: Record<FixedFlowSection, string> = {
  Ganhos: "Ganhos",
  "Gastos fixos": "Contas fixas",
  "Dividas e repasses": "Dividas e repasses",
  "Compras planejadas": "Compras planejadas",
};

const shortMonthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function buildYearMonths(year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(`${year}-${String(index + 1).padStart(2, "0")}-01T12:00:00`);

    return {
      monthValue: `${year}-${String(index + 1).padStart(2, "0")}`,
      label: shortMonthFormatter.format(date).replace(".", "").toUpperCase(),
      fullLabel: formatMonthLabel(date),
    };
  });
}

function createFixedEntryAmountDraft(year: number, entry?: FixedFlowEntry) {
  return Object.fromEntries(
    buildYearMonths(year).map((monthItem) => [
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
      : pathname === "/historico"
        ? "history"
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
  const [draftCategory, setDraftCategory] = useState(initialDraftCategory);
  const [draftCard, setDraftCard] = useState(initialDraftCard);
  const [draftBankPreset, setDraftBankPreset] = useState(initialDraftBankPreset);
  const [draftBill, setDraftBill] = useState(initialDraftBill);
  const [draftDebt, setDraftDebt] = useState(initialDraftDebt);
  const [draftDebtPlan, setDraftDebtPlan] = useState(initialDraftDebtPlan);
  const [draftAccount, setDraftAccount] = useState(initialDraftAccount);
  const [draftFixedEntry, setDraftFixedEntry] = useState<DraftFixedEntry>(() => ({
    ...initialDraftFixedEntry,
    amountByMonth: createFixedEntryAmountDraft(monthValueToDate(initialMonth).getFullYear()),
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
  const [selectedMonthlyGridCard, setSelectedMonthlyGridCard] = useState<{
    rowId: string;
    sourceId: string;
    sourceType: MonthlyGridRow["sourceType"];
    monthValue: string;
  } | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
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
    "Gastos fixos": false,
    "Dividas e repasses": false,
    "Compras planejadas": false,
  });
  const [expandedCardBillRows, setExpandedCardBillRows] = useState<Record<string, boolean>>({});
  const [isFixedClosingCollapsed, setIsFixedClosingCollapsed] = useState(true);
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

  const buildPersistedState = useCallback(
    (): FinancePersistedState => ({
      selectedMonth,
      accounts,
      cards,
      transactions,
      bills,
      categories,
      debts,
      fixedEntries,
      plannedPurchases,
      investments,
      settings,
      monthlyPlansByMonth,
    }),
    [
      selectedMonth,
      accounts,
      cards,
      transactions,
      bills,
      categories,
      debts,
      fixedEntries,
      plannedPurchases,
      investments,
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
    if (persisted.selectedMonth) setSelectedMonth(persisted.selectedMonth);
    if (persisted.accounts) setAccounts(persisted.accounts);
    if (persisted.cards) setCards(persisted.cards);
    if (persisted.transactions) setTransactions(persisted.transactions);
    if (persisted.bills) setBills(persisted.bills);
    if (persisted.categories) setCategories(persisted.categories);
    if (persisted.debts) setDebts(persisted.debts);
    if (persisted.fixedEntries) setFixedEntries(persisted.fixedEntries);
    if (persisted.plannedPurchases) setPlannedPurchases(persisted.plannedPurchases);
    if (persisted.investments) setInvestments(persisted.investments);
    if (persisted.settings) setSettings(persisted.settings);
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
      const localUpdatedAt = localCache?.updatedAt;
      setRemoteSaveStatus("loading");
      setRemoteSaveError(null);

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
            const remoteTimestamp = remoteUpdatedAt ? Date.parse(remoteUpdatedAt) : Number.NEGATIVE_INFINITY;
            const localTimestamp = localUpdatedAt ? Date.parse(localUpdatedAt) : Number.NEGATIVE_INFINITY;

            const shouldPreferLocalState =
              localState &&
              (!localUpdatedAt || (Number.isFinite(localTimestamp) && localTimestamp > remoteTimestamp));

            if (shouldPreferLocalState) {
              applyPersistedState(localState);
              pendingRemoteSnapshotRef.current = localState as FinancePersistedState;
              writeLocalPersistedCache(localState, localUpdatedAt ?? null);
            } else {
              applyPersistedState(payload.state);
              writeLocalPersistedCache(payload.state, remoteUpdatedAt);
              setLastRemoteSavedAt(remoteUpdatedAt);
              setRemoteSaveStatus("saved");
            }
            return;
          }
        }

        if (localState) {
          applyPersistedState(localState);
          pendingRemoteSnapshotRef.current = localState as FinancePersistedState;
          writeLocalPersistedCache(localState, localUpdatedAt ?? null);
        } else {
          setRemoteSaveStatus("saved");
        }
      } catch (error) {
        setRemoteSaveStatus(localState ? "error" : "saved");
        setRemoteSaveError(
          error instanceof Error ? error.message : "Nao foi possivel carregar dados do Supabase.",
        );
      } finally {
        if (!isCancelled) {
          setHasLoadedPersistedState(true);
          setHasHydratedRemoteState(true);
        }
      }
    }

    hydratePersistedState();

    return () => {
      isCancelled = true;
    };
  }, [applyPersistedState, parseLocalPersistedCache, writeLocalPersistedCache]);

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
      const groupedByMonth = transactions
        .filter((transaction) => transaction.cardId === card.id && transaction.cardMode === "credit")
        .reduce<Record<string, number>>((accumulator, transaction) => {
          const monthValue = transaction.date.slice(0, 7);
          accumulator[monthValue] = (accumulator[monthValue] ?? 0) + transaction.amount;
          return accumulator;
        }, {});

      return Object.entries(groupedByMonth)
        .filter(([, amount]) => amount > 0)
        .map(([statementMonth, amount]) => {
          const dueDate = monthValueToDate(statementMonth);
          dueDate.setMonth(dueDate.getMonth() + 1);
          dueDate.setDate(Math.min(card.dueDay, 28));

          const dueDateValue = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(
            dueDate.getDate(),
          ).padStart(2, "0")}`;
          const today = new Date(`${referenceDate}T12:00:00`);
          const status: Bill["status"] = dueDate < today ? "overdue" : "pending";

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
              plannedPaymentMethod: "pix",
              notes: `Gerada automaticamente a partir dos lancamentos de credito de ${formatMonthLabel(
                monthValueToDate(statementMonth),
              )}.`,
            } satisfies Bill,
          };
        });
    })
    .sort((left, right) => left.bill.dueDate.localeCompare(right.bill.dueDate));
  const allBills = [
    ...bills.filter((bill) => !isCreditLinkedBill(bill)),
    ...autoCardBills.map((item) => item.bill),
  ];
  const manualBillsForDisplay: BillDisplayItem[] = Array.from(
    bills.reduce((groups, bill) => {
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
  const selectableBillCategories = categories.filter(
    (category) => category.type === "expense" && !isHiddenUiCategoryId(category.id),
  );
  const defaultBillCategoryId =
    selectableBillCategories[0]?.id ??
    categories.find((category) => category.type === "expense")?.id ??
    initialDraftBill.categoryId;
  const availableAnalysisMonths = Array.from(
    new Set([selectedMonth, ...getAvailableMonths(transactions, allBills)]),
  )
    .sort()
    .reverse();
  const activeViewLabel = navItems.find((item) => item.id === activeView)?.label ?? "Home";
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
  const cardSummaries = getCardSummaries(cards, transactions, referenceMonthDate);
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
  const activePlannedPurchases = plannedPurchases.filter(
    (purchase) =>
      purchase.status !== "cancelled" &&
      purchase.status !== "bought" &&
      !realizedPlannedPurchaseIds.has(purchase.id),
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

  const salaryCalendarMonths = buildYearMonths(referenceMonthDate.getFullYear());
  const monthlyGridRows = createMonthlyGridRows();
  const fixedEntriesByCardId = fixedEntries.reduce<Record<string, FixedFlowEntry[]>>((accumulator, entry) => {
    if (entry.paymentMethod !== "credit_card" || !entry.cardId || !entry.linkedBillGroupId) {
      return accumulator;
    }

    accumulator[entry.cardId] = [...(accumulator[entry.cardId] ?? []), entry];
    return accumulator;
  }, {});
  const fixedMonthEntries = monthlyGridRows.filter((entry) => (entry.amountByMonth[selectedMonth] ?? 0) > 0);
  const fixedMonthCompletedCount = fixedMonthEntries.filter((entry) =>
    entry.completedMonths.includes(selectedMonth),
  ).length;
  const fixedMonthPendingCount = fixedMonthEntries.length - fixedMonthCompletedCount;
  const fixedMonthCompletedValue = fixedMonthEntries.reduce((sum, entry) => {
    if (!entry.completedMonths.includes(selectedMonth)) {
      return sum;
    }

    return sum + (entry.amountByMonth[selectedMonth] ?? 0);
  }, 0);
  const fixedMonthPlannedIncome = fixedMonthEntries
    .filter((entry) => {
      if (entry.sourceType === "planned_purchase") {
        return false;
      }

       if (entry.sourceType === "card_auto_bill") {
        return false;
      }

      return fixedEntries.find((item) => item.id === entry.sourceId)?.kind === "income";
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

      return fixedEntries.find((item) => item.id === entry.sourceId)?.kind === "expense";
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
              .map((transaction) => transaction.date.slice(0, 7)),
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
            transaction.date.slice(0, 7) === selectedCardStatementMonth,
        )
        .sort((left, right) => left.date.localeCompare(right.date))
    : [];
  const selectedCardStatementInstallments = selectedCardStatementTransactions.filter(
    (transaction) => (transaction.installmentTotal ?? 1) > 1,
  );
  const selectedCardStatementTotal = selectedCardStatementTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  );
  const selectedCardStatementSummary =
    selectedCardDetail && selectedCardStatementMonth
      ? getCardSummaries(
          [selectedCardDetail],
          transactions,
          monthValueToDate(selectedCardStatementMonth),
        )[0]
      : null;
  const selectedCardStatementAutoBill = selectedCardDetail
    ? autoCardBills.find(
        (item) =>
          item.cardId === selectedCardDetail.id &&
          item.statementMonth === selectedCardStatementMonth,
      )
    : undefined;
  const selectedCardFixedItems = selectedCardDetail
    ? fixedEntries.filter(
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
      section: existingEntry?.section ?? "Gastos fixos",
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
        if (!bill.isRecurring || !bill.recurringGroupId) {
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
          (entry.section === "Gastos fixos" &&
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

        salaryCalendarMonths.forEach((monthItem) => {
          const isManualOverride = existingEntry?.manualAmountMonths?.includes(monthItem.monthValue);
          nextAmountByMonth[monthItem.monthValue] = isManualOverride
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
          section: "Gastos fixos",
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
          manualAmountMonths: existingEntry?.manualAmountMonths ?? [],
          notes: investment.notes || investment.objective || undefined,
        };

        if (existingIndex >= 0) {
          nextEntries[existingIndex] = syncedEntry;
        } else {
          nextEntries.unshift(syncedEntry);
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

  useEffect(() => {
    if (!hasLoadedPersistedState) {
      return;
    }

    setFixedEntries((currentEntries) => {
      const debtCategory =
        categories.find((item) => item.id === "cat-debt") ??
        categories.find((item) => item.name === "Dividas") ??
        categories.find((item) => item.type === "expense") ??
        categories[0];
      const nextEntries = currentEntries.map((entry) => {
        if (!entry.linkedDebtId) {
          return entry;
        }

        const linkedDebt = debts.find((debt) => debt.id === entry.linkedDebtId);
        if (!linkedDebt) {
          return entry;
        }

        const paymentDetails = getPlannedPaymentDetails(
          linkedDebt.plannedPaymentMethod,
          linkedDebt.plannedCardId,
          "credit",
          cards,
        );

        return {
          ...entry,
          section: "Dividas e repasses" as FixedFlowSection,
          title: linkedDebt.name,
          categoryId: debtCategory?.id ?? entry.categoryId,
          categoryName: debtCategory?.name ?? entry.categoryName,
          paymentMethod: paymentDetails.transactionMethod,
          accountId: entry.accountId ?? settings.defaultAccountId,
          cardId: paymentDetails.cardId,
          cardMode: paymentDetails.cardMode,
          notes: linkedDebt.description ?? entry.notes,
        };
      });

      const debtIds = new Set(debts.map((debt) => debt.id));
      const filteredEntries = nextEntries.filter(
        (entry) => !entry.linkedDebtId || debtIds.has(entry.linkedDebtId),
      );

      return JSON.stringify(filteredEntries) === JSON.stringify(currentEntries)
        ? currentEntries
        : filteredEntries;
    });
  }, [hasLoadedPersistedState, debts, categories, cards, settings.defaultAccountId]);

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

  function handleAddTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(draftTransaction.amount.replace(",", "."));
    if (!amount || !draftTransaction.title.trim()) {
      return;
    }

    const category = categories.find((item) => item.id === draftTransaction.categoryId);
    if (!category) {
      return;
    }

    const nextTransactions = createTransactionsFromDraft(draftTransaction, amount, category.name);
    setTransactions((current) =>
      [...nextTransactions, ...current].sort((left, right) => right.date.localeCompare(left.date)),
    );
    setDraftTransaction((current) => ({
      ...current,
      title: "",
      amount: "",
      description: "",
      installments: 1,
      linkedPlannedPurchaseId: "",
    }));
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

  function openPurchaseModal(purchase?: PlannedPurchase) {
    setEditingPurchaseId(purchase?.id ?? null);
    setDraftPurchase(buildPurchaseDraft(purchase));
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

  function openCategoryModal(category?: Category) {
    setEditingCategoryId(category?.id ?? null);
    setDraftCategory(
      category
        ? {
            name: category.name,
            type: category.type,
            color: category.color,
          }
        : initialDraftCategory,
    );
    setIsCategoryModalOpen(true);
  }

  function closeCategoryModal() {
    setEditingCategoryId(null);
    setDraftCategory(initialDraftCategory);
    setIsCategoryModalOpen(false);
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
    };

    setCategories((current) => {
      if (editingCategoryId) {
        return current.map((category) => (category.id === editingCategoryId ? nextCategory : category));
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

    setCategories((current) => current.filter((item) => item.id !== categoryId));

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
    if (categoryId === "cat-bills" || categoryName === "Contas a pagar") {
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

    return {
      name: debt.name,
      description: debt.description ?? "",
      totalAmount: String(debt.totalAmount),
      paidAmount: String(debt.paidAmount),
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
          .filter(([monthValue, amount]) => amount > 0 && !linkedEntry.completedMonths.includes(monthValue))
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

    const configuredCap =
      settings.monthlyDebtPaymentCap > 0
        ? settings.monthlyDebtPaymentCap
        : debt.installmentAmount > 0
          ? debt.installmentAmount
          : Number((Math.max(0, debt.remainingAmount) / 2).toFixed(2));
    const safeAmount = Number(Math.max(0.01, configuredCap).toFixed(2));
    const safeMonths = Math.max(1, Math.ceil(Math.max(0, debt.remainingAmount) / safeAmount));

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
    const cardTransactions = transactions
      .filter((transaction) => transaction.cardId === cardId && transaction.cardMode === "credit")
      .map((transaction) => transaction.date.slice(0, 7))
      .sort((left, right) => left.localeCompare(right));

    updateHomeLocation("cards", {
      cardId,
      statementMonth: statementMonth ?? cardTransactions.at(-1) ?? selectedMonth,
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
  }

  function handleSaveCardBalance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

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

    setTransactions((current) => [
      {
        id: crypto.randomUUID(),
        title: `Balanco manual ${selectedCardDetail.name}`,
        type: "expense",
        amount: difference,
        date: adjustmentDate,
        categoryId: "cat-bills",
        categoryName: "Fatura do cartao",
        paymentMethod: "credit_card",
        status: "paid",
        expenseKind: "variable",
        accountId: selectedCardDetail.linkedAccountId ?? settings.defaultAccountId,
        cardId: selectedCardDetail.id,
        cardMode: "credit",
        description: `Ajuste manual para fechar a fatura de ${formatMonthLabel(
          monthValueToDate(selectedCardStatementMonth),
        )}.`,
      },
      ...current,
    ]);

    closeCardBalanceModal();
  }

  function openBillModal(bill?: Bill) {
    setEditingBillId(bill?.id ?? null);
    setDraftBill(createBillDraft(bill));
    setIsBillModalOpen(true);
  }

  function openNewAccountModal(kind: AccountEntryKind = "bill") {
    setNewAccountKind(kind);
    setEditingBillId(null);
    setEditingDebtId(null);
    setDraftBill(createBillDraft());
    setDraftDebt(initialDraftDebt);
    setIsNewAccountModalOpen(true);
  }

  function closeNewAccountModal() {
    setIsNewAccountModalOpen(false);
    setNewAccountKind("bill");
    setDraftBill(createBillDraft());
    setDraftDebt(initialDraftDebt);
  }

  function closeBillModal() {
    setEditingBillId(null);
    setDraftBill(createBillDraft());
    setIsBillModalOpen(false);
  }

  function persistBillDraft(targetBillId: string | null = editingBillId) {
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
      return false;
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
      const linkedTransactions = nextBills.flatMap((bill) => {
        if (isCreditLinkedBill(bill)) {
          return buildLinkedTransactionsFromBill(bill);
        }

        return bill.status === "paid" ? buildSettlementTransactionsFromBill(bill) : [];
      });

      return [...linkedTransactions, ...cleanedTransactions].sort((left, right) =>
        right.date.localeCompare(left.date),
      );
    });

    return true;
  }

  function handleSaveBill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (persistBillDraft(editingBillId)) {
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
    const installmentAmount = Number(draftDebt.installmentAmount.replace(",", ".")) || 0;

    if (!draftDebt.name.trim() || !totalAmount) {
      return false;
    }

    const safePaid = Math.max(0, Math.min(totalAmount, paidAmount));
    const remainingAmount = Math.max(0, totalAmount - safePaid);
    const totalInstallments = installmentAmount > 0 ? Math.max(1, Math.ceil(totalAmount / installmentAmount)) : 1;
    const paidInstallments = installmentAmount > 0 ? Math.min(totalInstallments, Math.floor(safePaid / installmentAmount)) : 0;

    const nextDebt: Debt = {
      id: targetDebtId ?? `debt-${crypto.randomUUID()}`,
      name: draftDebt.name.trim(),
      description: draftDebt.description.trim() || undefined,
      totalAmount,
      paidAmount: safePaid,
      remainingAmount,
      totalInstallments,
      paidInstallments,
      installmentAmount: installmentAmount || remainingAmount || totalAmount,
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
    const debtCategory =
      categories.find((item) => item.id === "cat-debt") ??
      categories.find((item) => item.name === "Dividas") ??
      categories.find((item) => item.type === "expense") ??
      categories[0];
    if (!debtCategory) {
      return;
    }

    const paymentDetails = getPlannedPaymentDetails(
      debt.plannedPaymentMethod,
      debt.plannedCardId,
      "credit",
      cards,
    );
    const linkedEntry = getLinkedDebtEntry(debt.id);
    const { schedule } = buildDebtPlanSchedule(
      selectedMonth,
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
      section: "Dividas e repasses",
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
      manualAmountMonths: linkedEntry?.manualAmountMonths ?? [],
      notes: debt.description ?? linkedEntry?.notes,
    };

    setFixedEntries((current) => {
      const existingIndex = current.findIndex((entry) => entry.linkedDebtId === debt.id);
      if (existingIndex >= 0) {
        return current.map((entry, index) => (index === existingIndex ? nextEntry : entry));
      }

      return [nextEntry, ...current];
    });

    const nextDueDate = alignDateToDay(
      `${selectedMonth}-01`,
      Number(debt.nextDueDate.slice(8, 10)) || 1,
    );

    setDebts((current) =>
      current.map((item) =>
        item.id === debt.id
          ? {
              ...item,
              installmentAmount,
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

    if (section === "Dividas e repasses") {
      return (
        categories.find((category) => category.id === "cat-debt")?.id ??
        categories.find((category) => category.name === "Dividas")?.id ??
        categories.find((category) => category.type === "expense")?.id ??
        initialDraftBill.categoryId
      );
    }

    return (
      categories.find((category) => category.id === "cat-bills")?.id ??
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
    const yearMonths = buildYearMonths(referenceMonthDate.getFullYear()).map((monthItem) => monthItem.monthValue);
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

  function createMonthlyGridRows(): MonthlyGridRow[] {
    const fixedRows: MonthlyGridRow[] = fixedEntries
      .filter((entry) => !(entry.linkedBillGroupId && entry.paymentMethod === "credit_card" && entry.cardId))
      .map((entry) => ({
        id: `fixed-grid-${entry.id}`,
        section: entry.section,
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
    const cardAutoRows: MonthlyGridRow[] = cards
      .filter((card) => card.availableMode !== "debit")
      .map((card) => {
        const relatedBills = autoCardBills.filter((item) => item.cardId === card.id);
        const amountByMonth = Object.fromEntries(
          salaryCalendarMonths.map((monthItem) => [monthItem.monthValue, 0]),
        ) as Record<string, number>;

        relatedBills.forEach((item) => {
          amountByMonth[item.bill.dueDate.slice(0, 7)] = item.bill.amount;
        });

        return {
          id: `card-auto-grid-${card.id}`,
          section: "Gastos fixos" as FixedFlowSection,
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
      .filter((row) => Object.values(row.amountByMonth).some((amount) => amount > 0));

    const purchaseRows: MonthlyGridRow[] = plannedPurchases
      .filter(
        (purchase) =>
          purchase.status !== "cancelled" &&
          purchase.status !== "bought" &&
          !realizedPlannedPurchaseIds.has(purchase.id),
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
          section: "Compras planejadas",
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

    return [...fixedRows, ...cardAutoRows, ...purchaseRows];
  }

  function createFixedEntryDraft(section: FixedFlowSection, entry?: FixedFlowEntry): DraftFixedEntry {
    return {
      section,
      title: entry?.title ?? "",
      categoryId: entry?.categoryId ?? getDefaultCategoryIdForFixedSection(section),
      paymentMethod: entry?.paymentMethod ?? (section === "Ganhos" ? "pix" : "pix"),
      accountId: entry?.accountId ?? settings.defaultAccountId,
      cardId: entry?.cardId ?? settings.defaultCardId,
      cardMode: entry?.cardMode ?? "credit",
      syncCardLimit: entry?.syncCardLimit ?? false,
      notes: entry?.notes ?? "",
      amountByMonth: createFixedEntryAmountDraft(referenceMonthDate.getFullYear(), entry),
    };
  }

  function openFixedEntryModal(section: FixedFlowSection, entry?: FixedFlowEntry) {
    setEditingFixedEntryId(entry?.id ?? null);
    setDraftFixedEntry(createFixedEntryDraft(section, entry));
    setIsFixedEntryModalOpen(true);
  }

  function closeFixedEntryModal() {
    setEditingFixedEntryId(null);
    setDraftFixedEntry({
      ...initialDraftFixedEntry,
      cardId: settings.defaultCardId,
      amountByMonth: createFixedEntryAmountDraft(referenceMonthDate.getFullYear()),
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
      notes: draftInvestment.notes.trim() || undefined,
      contributions:
        investments.find((investment) => investment.id === editingInvestmentId)?.contributions ?? [],
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
      section: draftFixedEntry.section,
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

    closeFixedEntryModal();
  }

  function buildFixedFlowTransaction(entry: FixedFlowEntry, monthValue: string): Transaction {
    const transactionDate = `${monthValue}-${entry.kind === "income" ? "05" : "12"}`;
    const amount = entry.amountByMonth[monthValue] ?? 0;

    return {
      id: crypto.randomUUID(),
      title: entry.title,
      type: entry.kind,
      amount,
      date: transactionDate,
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      paymentMethod: entry.paymentMethod,
      status: entry.kind === "income" ? "received" : "paid",
      incomeKind: entry.kind === "income" ? "fixed_received" : undefined,
      expenseKind:
        entry.kind === "expense"
          ? entry.linkedInvestmentId
            ? "investment"
            : entry.linkedDebtId || entry.categoryId === "cat-debt"
            ? "debt_payment"
            : "fixed"
          : undefined,
      accountId: entry.accountId ?? settings.defaultAccountId,
      cardId: entry.cardId,
      cardMode: entry.cardMode,
      description: getFixedEntryMarker(entry.id, monthValue),
    };
  }

  function getFixedEntryMarker(entryId: string, monthValue: string) {
    return `Monex fixo:${entryId}:${monthValue}`;
  }

  function buildDebtFixedAmounts(
    entry: FixedFlowEntry,
    monthValue: string,
    nextAmount: number,
  ) {
    const orderedMonths = salaryCalendarMonths.map((monthItem) => monthItem.monthValue);
    const currentIndex = orderedMonths.indexOf(monthValue);

    if (currentIndex < 0) {
      return {
        ...entry.amountByMonth,
        [monthValue]: Number(nextAmount.toFixed(2)),
      };
    }

    const affectedMonths = orderedMonths
      .slice(currentIndex)
      .filter((value) => (entry.amountByMonth[value] ?? 0) > 0 || value === monthValue);
    const outstanding = affectedMonths.reduce(
      (sum, value) => sum + (entry.amountByMonth[value] ?? 0),
      0,
    );
    const appliedAmount = Number(Math.max(0, Math.min(nextAmount, outstanding)).toFixed(2));
    const baseInstallment =
      (entry.amountByMonth[monthValue] ?? 0) ||
      affectedMonths
        .map((value) => entry.amountByMonth[value] ?? 0)
        .find((value) => value > 0) ||
      appliedAmount;
    const nextAmounts = { ...entry.amountByMonth };

    affectedMonths.forEach((value) => {
      nextAmounts[value] = 0;
    });
    nextAmounts[monthValue] = appliedAmount;

    let remaining = Number((outstanding - appliedAmount).toFixed(2));
    const futureMonths = affectedMonths.filter((value) => value !== monthValue);

    futureMonths.forEach((value, index) => {
      if (remaining <= 0) {
        nextAmounts[value] = 0;
        return;
      }

      const allocation =
        index === futureMonths.length - 1
          ? remaining
          : Math.min(baseInstallment, remaining);

      nextAmounts[value] = Number(allocation.toFixed(2));
      remaining = Number((remaining - allocation).toFixed(2));
    });

    return nextAmounts;
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
      entry.linkedDebtId || entry.categoryId === "cat-debt"
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

          return {
            ...investment,
            totalGrossInvested,
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

  function handleToggleFixedEntry(entryId: string, monthValue: string) {
    const entry = fixedEntries.find((item) => item.id === entryId);
    const amount = entry?.amountByMonth[monthValue] ?? 0;

    if (!entry || amount <= 0) {
      return;
    }

    const marker = getFixedEntryMarker(entry.id, monthValue);
    const isCompleted = entry.completedMonths.includes(monthValue);
    const matchingBill = bills.find(
      (bill) =>
        bill.title === entry.title &&
        bill.categoryId === entry.categoryId &&
        bill.dueDate.slice(0, 7) === monthValue,
    );

    setFixedEntries((current) =>
      current.map((item) =>
        item.id === entryId
          ? {
              ...item,
              completedMonths: isCompleted
                ? item.completedMonths.filter((value) => value !== monthValue)
                : [...item.completedMonths, monthValue],
            }
          : item,
      ),
    );

    if (entry.linkedDebtId) {
      setDebts((current) =>
        current.map((debt) => {
          if (debt.id !== entry.linkedDebtId) {
            return debt;
          }

          const nextPaidAmount = Number(
            Math.max(
              0,
              Math.min(
                debt.totalAmount,
                debt.paidAmount + (isCompleted ? -amount : amount),
              ),
            ).toFixed(2),
          );
          const nextPaidInstallments = Math.max(
            0,
            Math.min(
              debt.totalInstallments,
              debt.paidInstallments + (isCompleted ? -1 : 1),
            ),
          );
          const nextRemainingAmount = Number(
            Math.max(0, debt.totalAmount - nextPaidAmount).toFixed(2),
          );

          return {
            ...debt,
            paidAmount: nextPaidAmount,
            paidInstallments: nextPaidInstallments,
            remainingAmount: nextRemainingAmount,
            status:
              nextRemainingAmount === 0
                ? "settled"
                : debt.status === "paused"
                  ? "paused"
                  : "active",
          };
        }),
      );
    }

    if (entry.linkedInvestmentId) {
      const linkedInvestment = investments.find((investment) => investment.id === entry.linkedInvestmentId);
      if (!linkedInvestment) {
        return;
      }

      if (isCompleted) {
        const monthContributions = linkedInvestment.contributions.filter(
          (contribution) =>
            (contribution.monthValue ?? contribution.contributionDate.slice(0, 7)) === monthValue,
        );
        const contributionToRemove =
          monthContributions.find((contribution) => contribution.source === "planilha") ??
          monthContributions.at(-1);

        if (!contributionToRemove) {
          return;
        }

        setInvestments((current) =>
          current.map((investment) => {
            if (investment.id !== linkedInvestment.id) {
              return investment;
            }

            const nextContributions = investment.contributions.filter(
              (contribution) => contribution.id !== contributionToRemove.id,
            );
            const totalGrossInvested = Number(
              nextContributions.reduce((sum, contribution) => sum + contribution.amount, 0).toFixed(2),
            );

            return {
              ...investment,
              totalGrossInvested,
              contributions: nextContributions,
            };
          }),
        );

        if (contributionToRemove.linkedTransactionId) {
          setTransactions((current) =>
            current.filter((transaction) => transaction.id !== contributionToRemove.linkedTransactionId),
          );
        }

        return;
      }

      const transaction = buildInvestmentTransaction(
        linkedInvestment,
        amount,
        `${monthValue}-12`,
        entry.paymentMethod,
        entry.accountId,
        entry.cardId,
        entry.cardMode,
        marker,
      );
      const nextContribution = {
        id: crypto.randomUUID(),
        contributionDate: `${monthValue}-12`,
        amount,
        monthValue,
        source: "planilha" as const,
        linkedTransactionId: transaction.id,
        paymentMethod: entry.paymentMethod,
        accountId: entry.accountId,
        cardId: entry.cardId,
        cardMode: entry.cardMode,
        notes: entry.notes,
      };

      setTransactions((current) =>
        [transaction, ...current].sort((left, right) => right.date.localeCompare(left.date)),
      );
      setInvestments((current) =>
        current.map((investment) =>
          investment.id === linkedInvestment.id
            ? {
                ...investment,
                totalGrossInvested: Number((investment.totalGrossInvested + amount).toFixed(2)),
                contributions: [...investment.contributions, nextContribution].sort((left, right) =>
                  left.contributionDate.localeCompare(right.contributionDate),
                ),
              }
            : investment,
        ),
      );

      return;
    }

    if (entry.linkedBillGroupId) {
      const nextCompletedMonths = isCompleted
        ? entry.completedMonths.filter((value) => value !== monthValue)
        : [...entry.completedMonths, monthValue];
      const nextBillsGroup: Bill[] = bills
        .filter((bill) => (bill.recurringGroupId ?? bill.id) === entry.linkedBillGroupId)
        .map((bill) => {
          const billMonthValue = bill.dueDate.slice(0, 7);
          return {
            ...bill,
            status: (nextCompletedMonths.includes(billMonthValue) ? "paid" : "pending") as Bill["status"],
            amount: entry.amountByMonth[billMonthValue] ?? bill.amount,
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

    if (isCompleted && matchingBill) {
      setBills((current) =>
        current.map((bill) =>
          bill.id === matchingBill.id ? { ...bill, status: "pending" } : bill,
        ),
      );
    }

    if (!isCompleted && matchingBill && matchingBill.status !== "paid") {
      setBills((current) =>
        current.map((bill) =>
          bill.id === matchingBill.id ? { ...bill, amount, status: "paid" } : bill,
        ),
      );
    }

    setTransactions((current) => {
      const matchingIndex = current.findIndex((transaction) => {
        if (transaction.description === marker) {
          return true;
        }

        return (
          transaction.type === entry.kind &&
          transaction.categoryId === entry.categoryId &&
          transaction.date.slice(0, 7) === monthValue &&
          transaction.paymentMethod === entry.paymentMethod &&
          (transaction.accountId ?? settings.defaultAccountId) ===
            (entry.accountId ?? settings.defaultAccountId) &&
          (entry.cardId ? transaction.cardId === entry.cardId : true) &&
          (entry.cardMode ? transaction.cardMode === entry.cardMode : true)
        );
      });

      if (isCompleted) {
        return current.filter(
          (transaction) =>
            transaction.description !== marker &&
            (matchingBill ? transaction.sourceBillId !== matchingBill.id : true),
        );
      }

      if (matchingBill) {
        const billTransactions = current.filter((transaction) => transaction.sourceBillId === matchingBill.id);

        if (billTransactions.length) {
          return current.map((transaction) =>
            transaction.sourceBillId === matchingBill.id ? { ...transaction, status: "paid" } : transaction,
          );
        }

        return [...buildSettlementTransactionsFromBill(matchingBill), ...current].sort((left, right) =>
          right.date.localeCompare(left.date),
        );
      }

      if (matchingIndex >= 0) {
        return current.map((transaction, index) => {
          if (index !== matchingIndex) {
            return transaction;
          }

          return {
            ...transaction,
            amount,
            status: entry.kind === "income" ? "received" : "paid",
            incomeKind: entry.kind === "income" ? "fixed_received" : transaction.incomeKind,
            expenseKind:
              entry.kind === "expense"
                ? entry.linkedDebtId || entry.categoryId === "cat-debt"
                  ? "debt_payment"
                  : "fixed"
                : transaction.expenseKind,
          };
        });
      }

      return [buildFixedFlowTransaction(entry, monthValue), ...current].sort((left, right) =>
        right.date.localeCompare(left.date),
      );
    });
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
    if (row.sourceType === "card_auto_bill") {
      openCardDetails(row.sourceId, getMonthValueOffset(selectedMonth, -1));
      return;
    }

    if (row.sourceType === "planned_purchase") {
      const purchase = plannedPurchases.find((item) => item.id === row.sourceId);
      openPurchaseModal(purchase);
      return;
    }

    const entry = fixedEntries.find((item) => item.id === row.sourceId);
    if (!entry) {
      return;
    }

    openFixedEntryModal(entry.section, entry);
  }

  function beginMonthlyGridDrag(rowId: string, monthValue: string) {
    monthlyGridClickSuppressedUntilRef.current = Date.now() + 500;
    setDraggedGridCell({ rowId, monthValue });
    setSelectedMonthlyGridCard(null);
  }

  function endMonthlyGridDrag() {
    monthlyGridClickSuppressedUntilRef.current = Date.now() + 250;
    setDraggedGridCell(null);
  }

  function openMonthlyGridCardModal(row: MonthlyGridRow, monthValue: string) {
    if (Date.now() < monthlyGridClickSuppressedUntilRef.current) {
      return;
    }

    if (row.sourceType === "card_auto_bill") {
      openCardDetails(row.sourceId, getMonthValueOffset(monthValue, -1));
      return;
    }

    setSelectedMonthlyGridCard({
      rowId: row.id,
      sourceId: row.sourceId,
      sourceType: row.sourceType,
      monthValue,
    });
  }

  function closeMonthlyGridCardModal() {
    setSelectedMonthlyGridCard(null);
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
        categoryId: "cat-debt",
        categoryName: "Dividas",
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

  function openTransactionModal() {
    setIsTransactionModalOpen(true);
  }

  function closeTransactionModal() {
    setIsTransactionModalOpen(false);
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(103,181,255,0.25),_transparent_32%),linear-gradient(180deg,_#eef6ff_0%,_#f8fbff_35%,_#f4f7fb_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-4 px-4 py-4 lg:px-6 lg:py-6">
        <NavigationRail
          activeView={activeView}
          onNavigate={handleNavigate}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="rounded-[26px] border border-white/70 bg-white/85 px-5 py-4 shadow-[0_18px_50px_rgba(31,58,126,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-slate-950">{activeViewLabel}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={`flex min-h-[60px] items-center gap-3 rounded-[20px] border px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.05)] ${remoteSaveTone}`}
                  title={remoteSaveError ?? undefined}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${remoteSaveDot}`} />
                  <div className="text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                      Dados
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {remoteSaveLabel}
                    </p>
                    {remoteSaveStatus === "saved" && lastRemoteSavedLabel ? (
                      <p className="mt-0.5 text-[11px] opacity-75">Ultimo: {lastRemoteSavedLabel}</p>
                    ) : null}
                  </div>
                  {remoteSaveStatus === "error" ? (
                    <button
                      type="button"
                      onClick={() => saveStateToSupabase(buildPersistedState())}
                      className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold transition hover:bg-white"
                    >
                      Tentar
                    </button>
                  ) : null}
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-white px-3 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                  <label
                    className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400"
                    htmlFor="header-month-select"
                  >
                    Mes de analise
                  </label>
                  <select
                    id="header-month-select"
                    value={selectedMonth}
                    onChange={(event) => handleMonthChange(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none"
                  >
                    {availableAnalysisMonths.map((monthValue) => (
                      <option key={monthValue} value={monthValue}>
                        {formatMonthLabel(monthValueToDate(monthValue))}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAlertsPanelOpen((current) => !current)}
                    className="flex min-h-[60px] items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition hover:bg-slate-50"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-lg text-white">
                      !
                    </span>
                    <div className="text-left">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Alertas
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {headerFocusItems.length} itens de foco
                      </p>
                    </div>
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

          <MobileNavigation activeView={activeView} onNavigate={handleNavigate} />

          <main className="pb-24 lg:pb-6">
            {activeView === "home" && renderDashboard()}
            {activeView === "transactions" && renderTransactionsWorkspace()}
            {activeView === "history" && renderReports()}
            {activeView === "settings" && renderSettingsWorkspace()}
          </main>
        </div>
      </div>
    </div>
  );

  function renderDashboard() {
    const homeTabs: Array<{ id: HomeTab; label: string; description: string; tone: string }> = [
      {
        id: "grid",
        label: "Planilha",
        description: "Planejar meses",
        tone: "from-blue-600 to-sky-500",
      },
      {
        id: "planning",
        label: "Planejamento",
        description: "Compras e metas",
        tone: "from-violet-600 to-indigo-500",
      },
      {
        id: "accounts",
        label: "Contas",
        description: "Obrigacoes",
        tone: "from-emerald-600 to-teal-500",
      },
      {
        id: "cards",
        label: "Cartoes",
        description: "Faturas",
        tone: "from-sky-600 to-blue-500",
      },
    ];
    const activeHomeTab = homeTabs.find((tab) => tab.id === homeTab) ?? homeTabs[0];

    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-[34px] border border-white/80 bg-white/80 shadow-[0_24px_80px_rgba(30,79,160,0.10)] backdrop-blur">
          <div className={`bg-gradient-to-r ${activeHomeTab.tone} px-5 py-5 text-white`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">
                  Central Monex
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {activeHomeTab.id === "grid" ? "Planeje os proximos meses pela planilha" : activeHomeTab.label}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-white/78">
                  {activeHomeTab.id === "grid"
                    ? "Ajuste entradas, contas, faturas e compras futuras sem sair do fluxo principal."
                    : activeHomeTab.description}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-right sm:flex">
                <div className="rounded-2xl bg-white/14 px-4 py-3 ring-1 ring-white/18">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/62">Entradas</p>
                  <p className="mt-1 text-sm font-semibold">{formatCurrency(fixedMonthPlannedIncome)}</p>
                </div>
                <div className="rounded-2xl bg-white/14 px-4 py-3 ring-1 ring-white/18">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/62">Saidas</p>
                  <p className="mt-1 text-sm font-semibold">{formatCurrency(fixedMonthPlannedExpense)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-t border-white/70 bg-white/72 px-3 py-3">
            {homeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => updateHomeLocation(tab.id)}
                className={`group min-w-[150px] rounded-[22px] px-4 py-3 text-left transition duration-200 ${
                  homeTab === tab.id
                    ? "bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
                    : "bg-white/72 text-slate-600 ring-1 ring-slate-200 hover:-translate-y-0.5 hover:bg-white hover:text-slate-950"
                }`}
              >
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span
                  className={`mt-1 block text-[11px] uppercase tracking-[0.16em] ${
                    homeTab === tab.id ? "text-white/58" : "text-slate-400 group-hover:text-slate-500"
                  }`}
                >
                  {tab.description}
                </span>
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
                : renderCardsHomeTab()}
        </div>
      </div>
    );
  }

  function renderTransactionsWorkspace() {
    const workspaceMode: "fixed" | "month" = activeView === "home" ? "fixed" : "month";
    const fixedSections = fixedSectionOrder.map((section) => ({
      section,
      rows: monthlyGridRows.filter((row) => row.section === section),
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

          return fixedEntries.find((item) => item.id === entry.sourceId)?.kind === "income";
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

          return fixedEntries.find((item) => item.id === entry.sourceId)?.kind === "expense";
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
              title="Centro operacional em planilha"
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
                <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white px-4 py-4 shadow-[0_18px_42px_rgba(16,185,129,0.08)] transition duration-200 hover:-translate-y-0.5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-700">Entradas do mes</p>
                  <p className="mt-2 text-xl font-semibold text-emerald-700">
                    {formatCurrency(fixedMonthPlannedIncome)}
                  </p>
                </div>
                <div className="rounded-[24px] border border-rose-100 bg-gradient-to-br from-rose-50 to-white px-4 py-4 shadow-[0_18px_42px_rgba(244,63,94,0.08)] transition duration-200 hover:-translate-y-0.5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-rose-700">Saidas do mes</p>
                  <p className="mt-2 text-xl font-semibold text-rose-700">
                    {formatCurrency(fixedMonthPlannedExpense)}
                  </p>
                </div>
                <div className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-sky-50 to-white px-4 py-4 shadow-[0_18px_42px_rgba(14,165,233,0.08)] transition duration-200 hover:-translate-y-0.5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-sky-700">Ja marcados</p>
                  <p className="mt-2 text-xl font-semibold text-sky-700">{fixedMonthCompletedCount}</p>
                </div>
                <div className="rounded-[24px] border border-violet-100 bg-gradient-to-br from-violet-50 to-white px-4 py-4 shadow-[0_18px_42px_rgba(124,58,237,0.08)] transition duration-200 hover:-translate-y-0.5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-violet-700">Saldo previsto</p>
                  <p
                    className={`mt-2 text-xl font-semibold ${
                      fixedMonthPlannedIncome - fixedMonthPlannedExpense >= 0
                        ? "text-violet-700"
                        : "text-rose-700"
                    }`}
                  >
                    {formatCurrency(fixedMonthPlannedIncome - fixedMonthPlannedExpense)}
                  </p>
                </div>
              </div>

              <div className="mt-5 max-w-full overflow-x-auto pb-2">
                <div className="w-full min-w-[820px] rounded-[28px] border border-blue-950/80 bg-[linear-gradient(135deg,#020617,#0b1f4d_55%,#0a3c73)] px-3 py-3 shadow-[0_22px_58px_rgba(15,23,42,0.22)]">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-2">
                    <p className="text-sm font-semibold text-white">Comparativo mensal</p>
                    <p className="max-w-full text-[11px] uppercase tracking-[0.18em] text-white/60">
                      Entradas, saidas programadas e saldo previsto
                    </p>
                  </div>
                  <table className="w-full border-separate border-spacing-0 text-[11px]">
                    <thead>
                      <tr className="text-left">
                        <th className="min-w-[96px] rounded-l-2xl border border-white/10 bg-white/8 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white">
                          Linha
                        </th>
                        {fixedMonthlyComparison.map((monthItem) => (
                          <th
                            key={monthItem.monthValue}
                            className={`min-w-[58px] border border-white/10 px-2 py-2 text-center text-[10px] uppercase tracking-[0.16em] text-white ${
                              monthItem.monthValue === selectedMonth ? "bg-sky-700" : "bg-white/8"
                            }`}
                          >
                            {monthItem.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th className="rounded-l-2xl border border-white/10 bg-emerald-500/16 px-3 py-2.5 text-left text-[10px] uppercase tracking-[0.16em] text-emerald-100">
                          Entradas
                        </th>
                        {fixedMonthlyComparison.map((monthItem) => (
                          <td
                            key={`income-${monthItem.monthValue}`}
                            className={`border border-white/10 px-2 py-2.5 text-center font-semibold text-emerald-100 ${
                              monthItem.monthValue === selectedMonth ? "bg-emerald-500/20" : "bg-transparent"
                            }`}
                          >
                            {monthItem.income > 0 ? formatCurrency(monthItem.income) : "-"}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th className="rounded-l-2xl border border-white/10 bg-rose-500/16 px-3 py-2.5 text-left text-[10px] uppercase tracking-[0.16em] text-rose-100">
                          Saidas
                        </th>
                        {fixedMonthlyComparison.map((monthItem) => (
                          <td
                            key={`expenses-${monthItem.monthValue}`}
                            className={`border border-white/10 px-2 py-2.5 text-center font-semibold text-rose-100 ${
                              monthItem.monthValue === selectedMonth ? "bg-rose-500/20" : "bg-transparent"
                            }`}
                          >
                            {monthItem.expenses > 0 ? formatCurrency(monthItem.expenses) : "-"}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th className="rounded-l-2xl border border-white/10 bg-white/12 px-3 py-2.5 text-left text-[10px] uppercase tracking-[0.16em] text-white">
                          Saldo
                        </th>
                        {fixedMonthlyComparison.map((monthItem) => (
                          <td
                            key={`balance-${monthItem.monthValue}`}
                            className={`border border-white/10 px-2 py-2.5 text-center font-semibold ${
                              monthItem.balance >= 0 ? "text-emerald-100" : "text-rose-100"
                            } ${monthItem.monthValue === selectedMonth ? "bg-white/10" : "bg-transparent"}`}
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
                      sum + Object.values(row.amountByMonth).reduce((rowSum, value) => rowSum + value, 0),
                    0,
                  );
                  const sectionCurrentMonthTotal = rows.reduce(
                    (sum, row) => sum + (row.amountByMonth[selectedMonth] ?? 0),
                    0,
                  );
                  const sectionMonthlyTotals = salaryCalendarMonths.map((monthItem) =>
                    rows.reduce((sum, row) => sum + (row.amountByMonth[monthItem.monthValue] ?? 0), 0),
                  );
                  const isCollapsed = collapsedFixedSections[section];

                  return (
                    <div
                      key={section}
                      className={`min-w-0 overflow-hidden rounded-[30px] border px-3 py-3 shadow-[0_18px_46px_rgba(31,58,126,0.06)] transition duration-200 ${fixedSectionStyles[section]}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-base font-semibold text-slate-900">{fixedSectionDisplayLabels[section]}</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {rows.length} itens
                            </span>
                            <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Mes atual {formatCurrency(sectionCurrentMonthTotal)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-start gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              section === "Compras planejadas" ? openPurchaseModal() : openFixedEntryModal(section)
                            }
                            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                          >
                            Adicionar item
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedFixedSections((current) => ({
                                ...current,
                                [section]: !current[section],
                              }))
                            }
                            className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                          >
                            {isCollapsed ? "Expandir" : "Recolher"}
                          </button>
                          <div className="rounded-2xl bg-white/85 px-4 py-3 text-right">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Total do ano</p>
                            <p className="mt-2 text-base font-semibold text-slate-900">
                              {formatCurrency(sectionTotal)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {!isCollapsed ? (
                        <div className="mt-4 overflow-x-auto pb-2">
                          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[11px]">
                            <thead>
                              <tr className="text-left">
                                <th className="sticky left-0 z-10 min-w-[132px] rounded-l-2xl border border-slate-200 bg-slate-900 px-2 py-2.5 text-[10px] uppercase tracking-[0.16em] text-white">
                                  Item
                                </th>
                                {salaryCalendarMonths.map((monthItem) => (
                                  <th
                                    key={monthItem.monthValue}
                                    className={`min-w-[48px] border border-slate-200 bg-slate-900 px-1 py-2.5 text-center text-[10px] uppercase tracking-[0.16em] text-white ${
                                      monthItem.monthValue === selectedMonth ? "bg-sky-700" : ""
                                    }`}
                                  >
                                    {monthItem.label}
                                  </th>
                                ))}
                                <th className="rounded-r-2xl border border-slate-200 bg-slate-900 px-2 py-2.5 text-right text-[10px] uppercase tracking-[0.16em] text-white">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => (
                                <tr key={row.id} className="align-top">
                                  <th className="sticky left-0 z-10 border border-slate-200 bg-white px-2 py-2.5 text-left">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => openMonthlyGridRowModal(row)}
                                          className="text-left text-xs font-semibold text-slate-900 transition hover:text-sky-700"
                                        >
                                          {row.title}
                                        </button>
                                        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                          {getDisplayCategoryName(row.categoryId, row.categoryName)}
                                        </p>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <button
                                          type="button"
                                          onClick={() => openMonthlyGridRowModal(row)}
                                          className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 transition hover:bg-slate-50"
                                        >
                                          Editar
                                        </button>
                                        {row.sourceType === "card_auto_bill" &&
                                        (fixedEntriesByCardId[row.sourceId] ?? []).length ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedCardBillRows((current) => ({
                                                ...current,
                                                [row.sourceId]: !current[row.sourceId],
                                              }))
                                            }
                                            className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 transition hover:bg-sky-100"
                                          >
                                            {expandedCardBillRows[row.sourceId] ? "Ocultar itens" : "Visualizar itens"}
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  </th>
                                  {salaryCalendarMonths.map((monthItem) => {
                                    const amount = row.amountByMonth[monthItem.monthValue] ?? 0;
                                    const isCompleted = row.completedMonths.includes(monthItem.monthValue);
                                    const isPurchaseRow = row.sourceType === "planned_purchase";
                                    const isCardAutoBillRow = row.sourceType === "card_auto_bill";
                                    const cardFixedItems =
                                      isCardAutoBillRow
                                        ? fixedEntries.filter(
                                            (entry) =>
                                              entry.paymentMethod === "credit_card" &&
                                              entry.cardId === row.sourceId &&
                                              Boolean(entry.linkedBillGroupId) &&
                                              (entry.amountByMonth[monthItem.monthValue] ?? 0) > 0,
                                          )
                                        : [];
                                    const visibleCardFixedItems = cardFixedItems.slice(-5);
                                    const hiddenCardFixedItemCount = Math.max(
                                      0,
                                      cardFixedItems.length - visibleCardFixedItems.length,
                                    );

                                    return (
                                      <td
                                        key={monthItem.monthValue}
                                        className={`border border-slate-200 bg-white p-1 ${
                                          monthItem.monthValue === selectedMonth ? "bg-sky-50" : ""
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
                                        {isPurchaseRow ? (
                                          <div
                                            draggable={amount > 0}
                                            onDragStart={() =>
                                              amount > 0
                                                ? beginMonthlyGridDrag(row.id, monthItem.monthValue)
                                                : undefined
                                            }
                                            onDragEnd={endMonthlyGridDrag}
                                            onClick={() => openMonthlyGridCardModal(row, monthItem.monthValue)}
                                            className={`flex h-full min-h-[72px] w-full flex-col justify-between rounded-[18px] px-2 py-2 text-left transition ${
                                              amount <= 0
                                                ? "bg-slate-50 text-slate-300 hover:bg-slate-100"
                                                : isCompleted
                                                  ? "cursor-grab bg-violet-100 text-violet-800 hover:bg-violet-200 active:cursor-grabbing"
                                                  : "cursor-grab bg-violet-50 text-violet-700 hover:bg-violet-100 active:cursor-grabbing"
                                            }`}
                                          >
                                            <input
                                              value={amount > 0 ? String(amount) : ""}
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
                                              className="w-full bg-transparent text-[11px] font-semibold leading-tight outline-none placeholder:text-current/40"
                                            />
                                            <span className="text-[9px] font-semibold uppercase tracking-[0.12em]">
                                              {amount <= 0 ? "Sem valor" : "Abrir"}
                                            </span>
                                          </div>
                                        ) : isCardAutoBillRow ? (
                                          <div
                                            className={`flex min-h-[72px] w-full flex-col justify-between rounded-[18px] px-2 py-2 text-left transition ${
                                              amount <= 0
                                                ? "bg-slate-50 text-slate-300"
                                                : isCompleted
                                                  ? "bg-sky-100 text-sky-800"
                                                  : "bg-slate-100 text-slate-700"
                                            }`}
                                          >
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openCardDetails(row.sourceId, getMonthValueOffset(monthItem.monthValue, -1))
                                              }
                                              className="text-left"
                                            >
                                              <span className="block text-[11px] font-semibold leading-tight">
                                                {amount > 0 ? formatCurrency(amount) : "-"}
                                              </span>
                                              <span className="mt-2 block text-[9px] font-semibold uppercase tracking-[0.12em]">
                                                {amount <= 0 ? "Sem fatura" : isCompleted ? "Quitada" : "Abrir"}
                                              </span>
                                            </button>
                                            {expandedCardBillRows[row.sourceId] && cardFixedItems.length ? (
                                              <div className="mt-2 space-y-1 border-t border-sky-200/70 pt-2">
                                                {visibleCardFixedItems.map((entry) => (
                                                  <div key={entry.id} className="flex justify-between gap-2 text-[10px]">
                                                    <span className="truncate">{entry.title}</span>
                                                    <span className="font-semibold">
                                                      {formatCurrency(entry.amountByMonth[monthItem.monthValue] ?? 0)}
                                                    </span>
                                                  </div>
                                                ))}
                                                {hiddenCardFixedItemCount > 0 ? (
                                                  <button
                                                    type="button"
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      openCardDetails(
                                                        row.sourceId,
                                                        getMonthValueOffset(monthItem.monthValue, -1),
                                                      );
                                                    }}
                                                    className="mt-1 w-full rounded-full bg-white/80 px-2 py-1 text-left text-[10px] font-semibold text-sky-700 transition hover:bg-white"
                                                  >
                                                    Ver mais {hiddenCardFixedItemCount}
                                                  </button>
                                                ) : null}
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
                                            onClick={() => openMonthlyGridCardModal(row, monthItem.monthValue)}
                                            className={`flex h-full min-h-[72px] w-full flex-col justify-between rounded-[18px] px-2 py-2 transition ${
                                              amount <= 0
                                                ? "bg-slate-50 text-slate-300"
                                                : isCompleted
                                                  ? row.section === "Ganhos"
                                                    ? "cursor-grab bg-emerald-100 text-emerald-800 active:cursor-grabbing"
                                                    : "cursor-grab bg-sky-100 text-sky-800 active:cursor-grabbing"
                                                  : row.section === "Ganhos"
                                                    ? "cursor-grab bg-emerald-50 text-emerald-700 active:cursor-grabbing"
                                                    : "cursor-grab bg-rose-50 text-rose-700 active:cursor-grabbing"
                                            }`}
                                          >
                                            <input
                                              value={amount > 0 ? String(amount) : ""}
                                              onClick={(event) => event.stopPropagation()}
                                              onFocus={(event) => event.stopPropagation()}
                                              onChange={(event) =>
                                                handleFixedEntryAmountChange(
                                                  row.sourceId,
                                                  monthItem.monthValue,
                                                  event.target.value,
                                                )
                                              }
                                              inputMode="decimal"
                                              placeholder="0"
                                              className="w-full bg-transparent text-[11px] font-semibold leading-tight outline-none placeholder:text-current/40"
                                            />
                                            <button
                                              type="button"
                                              disabled={amount <= 0}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                handleToggleFixedEntry(row.sourceId, monthItem.monthValue);
                                              }}
                                              className="mt-2 rounded-full bg-white/70 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-left transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                              {amount <= 0
                                                ? "Sem valor"
                                                : isCompleted
                                                  ? row.section === "Ganhos"
                                                    ? "Entrou"
                                                    : "Pago"
                                                  : row.section === "Ganhos"
                                                    ? "Marcar"
                                                    : "Pagar"}
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="border border-slate-200 bg-white px-2 py-2.5 text-right">
                                    <p className="text-[11px] font-semibold text-slate-900">
                                      {formatCurrency(
                                        Object.values(row.amountByMonth).reduce((sum, value) => sum + value, 0),
                                      )}
                                    </p>
                                  </td>
                                </tr>
                              ))}
                              <tr className="align-top">
                                <th className="sticky left-0 z-10 rounded-bl-2xl border border-slate-200 bg-slate-900 px-2 py-2.5 text-left text-[10px] uppercase tracking-[0.16em] text-white">
                                  Soma
                                </th>
                                {sectionMonthlyTotals.map((amount, index) => (
                                  <td
                                    key={`${section}-total-${salaryCalendarMonths[index].monthValue}`}
                                    className={`border border-slate-200 bg-slate-900 px-1 py-2.5 text-center text-[10px] font-semibold text-white ${
                                      salaryCalendarMonths[index].monthValue === selectedMonth ? "bg-sky-700" : ""
                                    }`}
                                  >
                                    {amount > 0 ? formatCurrency(amount) : "-"}
                                  </td>
                                ))}
                                <td className="rounded-br-2xl border border-slate-200 bg-slate-900 px-2 py-2.5 text-right text-[10px] font-semibold text-white">
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

          <Panel
            title={`Fechamento de ${formatMonthLabel(monthValueToDate(selectedMonth))}`}
            description=""
            action={
              <button
                type="button"
                onClick={() => setIsFixedClosingCollapsed((current) => !current)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {isFixedClosingCollapsed ? "Expandir" : "Recolher"}
              </button>
            }
          >
            {!isFixedClosingCollapsed ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px]">
                <div className="space-y-3">
                  {fixedMonthEntries.map((entry) => {
                    const amount = entry.amountByMonth[selectedMonth] ?? 0;
                    const isCompleted = entry.completedMonths.includes(selectedMonth);
                    const isPurchaseRow = entry.sourceType === "planned_purchase";
                    const isCardAutoBillRow = entry.sourceType === "card_auto_bill";
                    const sourceFixedEntry = fixedEntries.find((item) => item.id === entry.sourceId);
                    const entryKind = sourceFixedEntry?.kind ?? "expense";

                    return (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {getDisplayCategoryName(entry.categoryId, entry.categoryName)}
                            </p>
                          </div>
                          <p
                            className={`text-lg font-semibold ${
                              entryKind === "income" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {entryKind === "income" ? "+" : "-"}
                            {formatCurrency(amount)}
                          </p>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                          {isPurchaseRow ? (
                            <>
                              <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-4 text-sm text-violet-800">
                                Ajuste completo da compra planejada pelo modal central.
                              </div>
                              <button
                                type="button"
                                onClick={() => openMonthlyGridRowModal(entry)}
                                className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
                              >
                                Abrir compra
                              </button>
                            </>
                          ) : isCardAutoBillRow ? (
                            <>
                              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-sky-800">
                                Fatura automatica vinculada ao cartao. O valor acompanha os lancamentos de credito e pode ser revisado no detalhe do cartao.
                              </div>
                              <button
                                type="button"
                                onClick={() => openCardDetails(entry.sourceId, getMonthValueOffset(selectedMonth, -1))}
                                className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                              >
                                Abrir cartao
                              </button>
                            </>
                          ) : (
                            <>
                              <FormField label={entryKind === "income" ? "Valor que entrou" : "Valor pago"}>
                                <input
                                  value={String(amount || "")}
                                  onChange={(event) =>
                                    handleFixedEntryAmountChange(entry.sourceId, selectedMonth, event.target.value)
                                  }
                                  inputMode="decimal"
                                  className="field"
                                />
                              </FormField>
                              <button
                                type="button"
                                onClick={() => handleToggleFixedEntry(entry.sourceId, selectedMonth)}
                                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                                  isCompleted
                                    ? "bg-slate-900 text-white hover:bg-slate-700"
                                    : entryKind === "income"
                                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                      : "bg-rose-500 text-white hover:bg-rose-600"
                                }`}
                              >
                                {isCompleted
                                  ? entryKind === "income"
                                    ? "Desmarcar entrada"
                                    : "Desmarcar pagamento"
                                  : entryKind === "income"
                                    ? "Marcar que entrou"
                                    : "Marcar como pago"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Valor confirmado</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {formatCurrency(fixedMonthCompletedValue)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-700">Entradas</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-700">
                      {formatCurrency(fixedMonthPlannedIncome)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-rose-700">Saidas</p>
                    <p className="mt-2 text-lg font-semibold text-rose-700">
                      {formatCurrency(fixedMonthPlannedExpense)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-sky-700">Status</p>
                    <p className="mt-2 text-sm font-semibold text-sky-700">
                      {fixedMonthCompletedCount} confirmados
                    </p>
                    <p className="mt-1 text-sm text-sky-700/80">{fixedMonthPendingCount} pendentes</p>
                  </div>
                </div>
              </div>
            ) : null}
          </Panel>

          {renderMonthlyGridCardModal()}
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
                  onClick={openTransactionModal}
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
                <select
                  value={transactionTypeFilter}
                  onChange={(event) =>
                    setTransactionTypeFilter(event.target.value as "all" | "income" | "expense")
                  }
                  className="field"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="income">Entradas</option>
                  <option value="expense">Saidas</option>
                </select>
                <select
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value as "all" | PaymentMethod)}
                  className="field"
                >
                  <option value="all">Todos os meios</option>
                  {Object.entries(paymentLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 space-y-3">
                {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_18px_42px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{transaction.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {getDisplayCategoryName(transaction.categoryId, transaction.categoryName)} - {paymentLabels[transaction.paymentMethod]} -{" "}
                          {formatShortDate(transaction.date)}
                        </p>
                        {transaction.description ? (
                          <p className="mt-2 text-sm text-slate-500">{transaction.description}</p>
                        ) : null}
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
                ))}
              </div>
            </Panel>
          </div>
        )}

        {isTransactionModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-600">Nova transacao</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Adicionar lancamento
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Se a forma de pagamento for cartao, a modalidade define se existe parcela ou nao.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTransactionModal}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
                  aria-label="Fechar modal"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="mt-6 space-y-4">
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
                    <select
                      value={draftTransaction.type}
                      onChange={(event) =>
                        setDraftTransaction((current) => ({
                          ...current,
                          type: event.target.value as "income" | "expense",
                          categoryId: event.target.value === "income" ? "cat-salary" : "cat-market",
                          paymentOption:
                            event.target.value === "income" ? "bank_transfer" : current.paymentOption,
                          linkedPlannedPurchaseId:
                            event.target.value === "income" ? "" : current.linkedPlannedPurchaseId,
                        }))
                      }
                      className="field"
                    >
                      <option value="expense">Saida</option>
                      <option value="income">Entrada</option>
                    </select>
                  </FormField>
                </div>

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
                    <select
                      value={draftTransaction.categoryId}
                      onChange={(event) =>
                        setDraftTransaction((current) => ({
                          ...current,
                          categoryId: event.target.value,
                        }))
                      }
                      className="field"
                    >
                      {categories
                        .filter((category) =>
                          draftTransaction.type === "income"
                            ? category.type === "income"
                            : category.type === "expense" && !isHiddenUiCategoryId(category.id),
                        )
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                  </FormField>
                  <FormField label="Forma de pagamento">
                    <select
                      value={draftTransaction.paymentOption}
                      onChange={(event) =>
                        setDraftTransaction((current) => ({
                          ...current,
                          paymentOption: event.target.value as DraftTransaction["paymentOption"],
                        }))
                      }
                      className="field"
                    >
                      {draftTransaction.type === "income" ? (
                        <>
                          <option value="bank_transfer">Transferencia</option>
                          <option value="pix">Pix</option>
                          <option value="cash">Dinheiro</option>
                        </>
                      ) : (
                        <>
                          <option value="pix">Pix</option>
                          <option value="cash">Dinheiro</option>
                          <option value="bank_transfer">Transferencia</option>
                          <option value="card">Cartao</option>
                        </>
                      )}
                    </select>
                  </FormField>
                </div>

                {draftTransaction.type === "expense" && draftTransaction.paymentOption === "card" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Cartao">
                      <select
                        value={draftTransaction.cardId}
                        onChange={(event) => {
                          const nextCard = cards.find((card) => card.id === event.target.value) ?? cards[0];
                          const nextMode =
                            nextCard.availableMode === "both" ? draftTransaction.cardMode : nextCard.availableMode;
                          setDraftTransaction((current) => ({
                            ...current,
                            cardId: event.target.value,
                            cardMode: nextMode,
                            installments: nextMode === "debit" ? 1 : current.installments,
                          }));
                        }}
                        className="field"
                      >
                        {cards.map((card) => (
                          <option key={card.id} value={card.id}>
                            {card.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Modalidade">
                      <select
                        value={draftTransaction.cardMode}
                        onChange={(event) =>
                          setDraftTransaction((current) => ({
                            ...current,
                            cardMode: event.target.value as CardMode,
                            installments: event.target.value === "debit" ? 1 : current.installments,
                          }))
                        }
                        className="field"
                      >
                        {getAvailableDraftModes().map((mode) => (
                          <option key={mode} value={mode}>
                            {mode === "credit" ? "Credito" : "Debito"}
                          </option>
                        ))}
                      </select>
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
                    <select
                      value={draftTransaction.linkedPlannedPurchaseId}
                      onChange={(event) => {
                        const purchase = activePlannedPurchases.find((item) => item.id === event.target.value);
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
                      className="field"
                    >
                      <option value="">Nenhuma</option>
                      {activePlannedPurchases.map((purchase) => (
                        <option key={purchase.id} value={purchase.id}>
                          {purchase.name}
                        </option>
                      ))}
                    </select>
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
                    Salvar transacao
                  </button>
                </div>
              </form>
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
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
              x
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
                  <select
                    value={draftInvestment.paymentMethod}
                    onChange={(event) =>
                      setDraftInvestment((current) => ({
                        ...current,
                        paymentMethod: event.target.value as PaymentMethod,
                      }))
                    }
                    className="field"
                  >
                    {Object.entries(paymentLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Conta">
                  <select
                    value={draftInvestment.accountId}
                    onChange={(event) =>
                      setDraftInvestment((current) => ({ ...current, accountId: event.target.value }))
                    }
                    className="field"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                {usesCard ? (
                  <>
                    <FormField label="Cartao">
                      <select
                        value={draftInvestment.cardId}
                        onChange={(event) =>
                          setDraftInvestment((current) => ({ ...current, cardId: event.target.value }))
                        }
                        className="field"
                      >
                        {cards.map((card) => (
                          <option key={card.id} value={card.id}>
                            {card.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Modalidade">
                      <select
                        value={draftInvestment.cardMode}
                        onChange={(event) =>
                          setDraftInvestment((current) => ({
                            ...current,
                            cardMode: event.target.value as CardMode,
                          }))
                        }
                        className="field"
                      >
                        <option value="credit">Credito</option>
                        <option value="debit">Debito</option>
                      </select>
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
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
              x
            </button>
          </div>

          <form onSubmit={handleSaveInvestmentContribution} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Investimento">
                  <select
                    value={draftInvestmentContribution.investmentId}
                    onChange={(event) => {
                      const nextInvestment = investments.find((item) => item.id === event.target.value);
                      setDraftInvestmentContribution((current) => ({
                        ...current,
                        investmentId: event.target.value,
                        paymentMethod: nextInvestment?.paymentMethod ?? current.paymentMethod,
                        accountId: nextInvestment?.accountId ?? current.accountId,
                        cardId: nextInvestment?.cardId ?? current.cardId,
                        cardMode: nextInvestment?.cardMode ?? current.cardMode,
                      }));
                    }}
                    className="field"
                  >
                    {investments.map((investment) => (
                      <option key={investment.id} value={investment.id}>
                        {investment.name}
                      </option>
                    ))}
                  </select>
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
                  <select
                    value={draftInvestmentContribution.paymentMethod}
                    onChange={(event) =>
                      setDraftInvestmentContribution((current) => ({
                        ...current,
                        paymentMethod: event.target.value as PaymentMethod,
                      }))
                    }
                    className="field"
                  >
                    {Object.entries(paymentLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <FormField label="Conta">
                  <select
                    value={draftInvestmentContribution.accountId}
                    onChange={(event) =>
                      setDraftInvestmentContribution((current) => ({
                        ...current,
                        accountId: event.target.value,
                      }))
                    }
                    className="field"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                {usesCard ? (
                  <>
                    <FormField label="Cartao">
                      <select
                        value={draftInvestmentContribution.cardId}
                        onChange={(event) =>
                          setDraftInvestmentContribution((current) => ({
                            ...current,
                            cardId: event.target.value,
                          }))
                        }
                        className="field"
                      >
                        {cards.map((card) => (
                          <option key={card.id} value={card.id}>
                            {card.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Modalidade">
                      <select
                        value={draftInvestmentContribution.cardMode}
                        onChange={(event) =>
                          setDraftInvestmentContribution((current) => ({
                            ...current,
                            cardMode: event.target.value as CardMode,
                          }))
                        }
                        className="field"
                      >
                        <option value="credit">Credito</option>
                        <option value="debit">Debito</option>
                      </select>
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

  function renderMonthlyGridCardModal() {
    if (!selectedMonthlyGridCard) {
      return null;
    }

    const row = monthlyGridRows.find((item) => item.id === selectedMonthlyGridCard.rowId);
    if (!row) {
      return null;
    }

    const monthValue = selectedMonthlyGridCard.monthValue;
    const amount = row.amountByMonth[monthValue] ?? 0;
    const isCompleted = row.completedMonths.includes(monthValue);
    const fixedEntry = row.sourceType === "fixed"
      ? fixedEntries.find((item) => item.id === row.sourceId)
      : undefined;
    const plannedPurchase = row.sourceType === "planned_purchase"
      ? plannedPurchases.find((item) => item.id === row.sourceId)
      : undefined;
    const entryKind = fixedEntry?.kind ?? (row.section === "Ganhos" ? "income" : "expense");
    const accountName = row.accountId
      ? accounts.find((account) => account.id === row.accountId)?.name
      : undefined;
    const cardName = row.cardId ? cards.find((card) => card.id === row.cardId)?.name : undefined;
    const paymentLabel = paymentLabels[row.paymentMethod];
    const purchasePaymentLabel = plannedPurchase?.plannedPaymentMethod
      ? getPlannedPaymentDetails(
          plannedPurchase.plannedPaymentMethod,
          plannedPurchase.plannedCardId,
          plannedPurchase.plannedCardMode ?? "credit",
          cards,
        ).label
      : undefined;
    const originLabel =
      row.sourceType === "planned_purchase"
        ? "Compra planejada"
        : row.linkedDebtId
          ? "Planejamento de divida"
        : row.linkedBillGroupId
          ? "Valor fixo sincronizado com Contas"
          : "Valor fixo recorrente";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                Detalhe do card
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {row.title}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {formatMonthLabel(monthValueToDate(monthValue))}
              </p>
            </div>
            <button
              type="button"
              onClick={closeMonthlyGridCardModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              x
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoBlock label="Secao" value={row.section} />
              <InfoBlock label="Valor do mes" value={amount > 0 ? formatCurrency(amount) : "Sem valor"} />
              <InfoBlock
                label="Status"
                value={
                  amount <= 0
                    ? "Sem lancamento"
                    : isCompleted
                      ? entryKind === "income"
                        ? "Entrou"
                        : "Pago"
                      : entryKind === "income"
                        ? "Pendente de entrada"
                        : "Pendente"
                }
              />
              <InfoBlock label="Origem" value={originLabel} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Categoria</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {getDisplayCategoryName(row.categoryId, row.categoryName)}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Pagamento</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {row.sourceType === "planned_purchase" ? purchasePaymentLabel ?? "Nao definido" : paymentLabel}
                </p>
                {cardName ? <p className="mt-1 text-xs text-slate-500">Cartao {cardName}</p> : null}
                {accountName ? <p className="mt-1 text-xs text-slate-500">Conta {accountName}</p> : null}
              </div>
            </div>

            {row.linkedBillGroupId ? (
              <div className="rounded-[24px] border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-sky-800">
                Este item esta sincronizado com a area de Contas. Ajustes estruturais refletem nos dois lados.
              </div>
            ) : null}

            {row.linkedDebtId ? (
              <div className="rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                Este item veio do planejamento de uma divida e permanece vinculado a ela na area de Contas.
              </div>
            ) : null}

            {row.sourceType === "planned_purchase" && plannedPurchase ? (
              <div className="rounded-[24px] border border-violet-100 bg-violet-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-violet-500">Compra planejada</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {getPurchasePlanningLabel(plannedPurchase)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Alvo: {getPurchasePlacementLabel(plannedPurchase)}
                </p>
                {plannedPurchase.plannedInstallments ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Parcelas: {plannedPurchase.plannedInstallments}x
                  </p>
                ) : null}
              </div>
            ) : null}

            {row.notes ? (
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Observacoes</p>
                <p className="mt-2 text-sm text-slate-700">{row.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-6 py-5">
            {row.sourceType === "fixed" ? (
              <button
                type="button"
                disabled={amount <= 0}
                onClick={() => handleToggleFixedEntry(row.sourceId, monthValue)}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  amount <= 0
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : isCompleted
                      ? "bg-slate-900 text-white hover:bg-slate-700"
                      : entryKind === "income"
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : "bg-rose-500 text-white hover:bg-rose-600"
                }`}
              >
                {amount <= 0
                  ? "Sem valor"
                  : isCompleted
                    ? entryKind === "income"
                      ? "Desmarcar entrada"
                      : "Desmarcar pagamento"
                    : entryKind === "income"
                      ? "Marcar que entrou"
                      : "Marcar como pago"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                openMonthlyGridRowModal(row);
                closeMonthlyGridCardModal();
              }}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Abrir edicao completa
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
    const fixedCategoryOptions = categories.filter((category) => category.type === fixedEntryKind);
    const usesCard =
      draftFixedEntry.paymentMethod === "credit_card" || draftFixedEntry.paymentMethod === "debit_card";
    const selectedFixedCard = cards.find((card) => card.id === draftFixedEntry.cardId) ?? cards[0];
    const canSyncCardLimit =
      draftFixedEntry.section === "Gastos fixos" &&
      draftFixedEntry.paymentMethod === "credit_card" &&
      selectedFixedCard?.availableMode !== "debit";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
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
              x
            </button>
          </div>

          <form onSubmit={handleSaveFixedEntry} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FormField label="Faixa">
                <select
                  value={draftFixedEntry.section}
                  onChange={(event) =>
                    setDraftFixedEntry((current) => ({
                      ...current,
                      section: event.target.value as FixedFlowSection,
                      categoryId: getDefaultCategoryIdForFixedSection(event.target.value as FixedFlowSection),
                    }))
                  }
                  className="field"
                >
                  {fixedSectionOrder.filter((section) => section !== "Compras planejadas").map((section) => (
                    <option key={section} value={section}>
                      {fixedSectionDisplayLabels[section]}
                    </option>
                  ))}
                </select>
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
                <select
                  value={draftFixedEntry.categoryId}
                  onChange={(event) =>
                    setDraftFixedEntry((current) => ({ ...current, categoryId: event.target.value }))
                  }
                  className="field"
                >
                  {fixedCategoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Forma de pagamento">
                <select
                  value={draftFixedEntry.paymentMethod}
                  onChange={(event) =>
                    setDraftFixedEntry((current) => ({
                      ...current,
                      paymentMethod: event.target.value as PaymentMethod,
                      syncCardLimit: event.target.value === "credit_card" ? current.syncCardLimit : false,
                    }))
                  }
                  className="field"
                >
                  {Object.entries(paymentLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FormField label="Conta">
                <select
                  value={draftFixedEntry.accountId}
                  onChange={(event) =>
                    setDraftFixedEntry((current) => ({ ...current, accountId: event.target.value }))
                  }
                  className="field"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </FormField>

              {usesCard ? (
                <>
                  <FormField label="Cartao">
                    <select
                      value={draftFixedEntry.cardId}
                      onChange={(event) =>
                        setDraftFixedEntry((current) => ({ ...current, cardId: event.target.value }))
                      }
                      className="field"
                    >
                      {cards.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Modalidade">
                    <select
                      value={draftFixedEntry.cardMode}
                      onChange={(event) =>
                        setDraftFixedEntry((current) => ({
                          ...current,
                          cardMode: event.target.value as CardMode,
                          syncCardLimit:
                            event.target.value === "credit" ? current.syncCardLimit : false,
                        }))
                      }
                      className="field"
                    >
                      <option value="credit">Credito</option>
                      <option value="debit">Debito</option>
                    </select>
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

  function renderPurchaseModal() {
    if (!isPurchaseModalOpen) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-600">
                {editingPurchaseId ? "Editar planejamento" : "Novo planejamento"}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {editingPurchaseId ? "Ajustar item do planejamento" : "Adicionar item ao planejamento"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Aqui voce configura a compra futura. Os valores mes a mes podem ser ajustados direto na planilha.
              </p>
            </div>
            <button
              type="button"
              onClick={closePurchaseModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
              aria-label="Fechar modal"
            >
              x
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
                <select
                  value={draftPurchase.priority}
                  onChange={(event) =>
                    setDraftPurchase((current) => ({
                      ...current,
                      priority: event.target.value as FinancePriority,
                    }))
                  }
                  className="field"
                >
                  {planningPriorityOptions.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
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
                <select
                  value={draftPurchase.boardColumn}
                  onChange={(event) =>
                    setDraftPurchase((current) => ({
                      ...current,
                      boardColumn: event.target.value as Exclude<BoardColumn, "bought">,
                    }))
                  }
                  className="field"
                >
                  {planningBoardColumns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.label}
                    </option>
                  ))}
                </select>
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
                <select
                  value={draftPurchase.planningMode}
                  onChange={(event) =>
                    setDraftPurchase((current) => {
                      const nextMode = event.target.value as DraftPurchase["planningMode"];
                      return {
                        ...current,
                        planningMode: nextMode,
                        paymentOption: nextMode === "card_parcelado" ? "card" : current.paymentOption === "card" ? "pix" : current.paymentOption,
                        cardMode: nextMode === "card_parcelado" ? "credit" : current.cardMode,
                        installments: nextMode === "card_parcelado" ? Math.max(1, current.installments) : 1,
                      };
                    })
                  }
                  className="field"
                >
                  <option value="save_over_time">Guardar dinheiro</option>
                  <option value="buy_in_target_period">Comprar a vista</option>
                  <option value="card_parcelado">Comprar no cartao</option>
                </select>
              </FormField>
              {draftPurchase.planningMode !== "card_parcelado" ? (
                <FormField label={draftPurchase.planningMode === "save_over_time" ? "Onde guardar" : "Meio previsto"}>
                  <select
                    value={draftPurchase.paymentOption === "card" ? "pix" : draftPurchase.paymentOption}
                    onChange={(event) =>
                      setDraftPurchase((current) => ({
                        ...current,
                        paymentOption: event.target.value as PaymentPlanMethod,
                      }))
                    }
                    className="field"
                  >
                    <option value="pix">Pix</option>
                    <option value="cash">Dinheiro</option>
                    <option value="bank_transfer">Transferencia</option>
                  </select>
                </FormField>
              ) : (
                <FormField label="Cartao planejado">
                  <select
                    value={draftPurchase.cardId}
                    onChange={(event) =>
                      setDraftPurchase((current) => ({ ...current, cardId: event.target.value }))
                    }
                    className="field"
                  >
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
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
              x
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
                <select
                  value={draftCategory.type}
                  onChange={(event) =>
                    setDraftCategory((current) => ({
                      ...current,
                      type: event.target.value as "income" | "expense",
                    }))
                  }
                  className="field"
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
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
              x
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
                <select
                  value={draftCard.issuer}
                  onChange={(event) => handleIssuerChange(event.target.value)}
                  className="field"
                >
                  {bankPresets.map((preset) => (
                    <option key={preset.issuer} value={preset.issuer}>
                      {preset.issuer}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Bandeira">
                <select
                  value={draftCard.brand}
                  onChange={(event) => setDraftCard((current) => ({ ...current, brand: event.target.value }))}
                  className="field"
                >
                  <option value="Mastercard">Mastercard</option>
                  <option value="Visa">Visa</option>
                  <option value="Elo">Elo</option>
                </select>
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
                <select
                  value={draftCard.availableMode}
                  onChange={(event) => setDraftCard((current) => ({ ...current, availableMode: event.target.value as DraftCard["availableMode"] }))}
                  className="field"
                >
                  <option value="both">Credito e debito</option>
                  <option value="credit">Somente credito</option>
                  <option value="debit">Somente debito</option>
                </select>
              </FormField>
              <FormField label="Conta vinculada">
                <select
                  value={draftCard.linkedAccountId}
                  onChange={(event) => setDraftCard((current) => ({ ...current, linkedAccountId: event.target.value }))}
                  className="field"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
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
              <select
                value={draftBill.priority}
                onChange={(event) =>
                  setDraftBill((current) => ({ ...current, priority: event.target.value as FinancePriority }))
                }
                className="field"
              >
                {planningPriorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          {showPriorityAndStatus ? (
            <FormField label="Status">
              <select
                value={draftBill.status}
                onChange={(event) =>
                  setDraftBill((current) => ({ ...current, status: event.target.value as DraftBill["status"] }))
                }
                className="field"
              >
                <option value="pending">Pendente</option>
                <option value="paid">Paga</option>
                <option value="overdue">Atrasada</option>
              </select>
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
            <select
              value={draftBill.categoryId}
              onChange={(event) => setDraftBill((current) => ({ ...current, categoryId: event.target.value }))}
              className="field"
            >
              {selectableBillCategories.length > 0 ? (
                selectableBillCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))
              ) : (
                <option value={draftBill.categoryId}>Sem categoria de despesa</option>
              )}
            </select>
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
            <select
              value={draftBill.plannedPaymentMethod}
              onChange={(event) => updateDraftBillPaymentMethod(event.target.value as PaymentPlanMethod)}
              className="field"
            >
              <option value="pix">Pix</option>
              <option value="cash">Dinheiro</option>
              <option value="bank_transfer">Transferencia</option>
              <option value="card">Cartao</option>
            </select>
          </FormField>
        </div>

        {usesCard ? (
          <div className={`grid gap-3 ${canShowInstallments ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <FormField label="Cartao">
              <select
                value={draftBill.plannedCardId}
                onChange={(event) => updateDraftBillCardSelection(event.target.value)}
                className="field"
              >
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Modalidade">
              <select
                value={draftBill.plannedCardMode}
                onChange={(event) => updateDraftBillCardMode(event.target.value as CardMode)}
                className="field"
              >
                {getDraftBillCardModes().map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === "credit" ? "Credito" : "Debito"}
                  </option>
                ))}
              </select>
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
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
                x
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
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
                x
              </button>
            </div>

            <form onSubmit={handleSaveNewAccount} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
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
                <div className="grid gap-3 sm:grid-cols-3">
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
                  <FormField label="Abatimento sugerido">
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
                    <select
                      value={draftDebt.plannedPaymentMethod}
                      onChange={(event) =>
                        setDraftDebt((current) => ({
                          ...current,
                          plannedPaymentMethod: event.target.value as PaymentPlanMethod,
                        }))
                      }
                      className="field"
                    >
                      <option value="pix">Pix</option>
                      <option value="cash">Dinheiro</option>
                      <option value="bank_transfer">Transferencia</option>
                      <option value="card">Cartao</option>
                    </select>
                  </FormField>
                </div>
                {draftDebt.plannedPaymentMethod === "card" ? (
                  <FormField label="Cartao planejado">
                    <select
                      value={draftDebt.plannedCardId}
                      onChange={(event) =>
                        setDraftDebt((current) => ({ ...current, plannedCardId: event.target.value }))
                      }
                      className="field"
                    >
                      {cards.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.name}
                        </option>
                      ))}
                    </select>
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
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
            <button type="button" onClick={closeDebtModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200">
              x
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
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Ja pago">
                <input value={draftDebt.paidAmount} onChange={(event) => setDraftDebt((current) => ({ ...current, paidAmount: event.target.value }))} inputMode="decimal" className="field" />
              </FormField>
              <FormField label="Abatimento sugerido">
                <input value={draftDebt.installmentAmount} onChange={(event) => setDraftDebt((current) => ({ ...current, installmentAmount: event.target.value }))} inputMode="decimal" className="field" />
              </FormField>
              <FormField label="Proximo vencimento">
                <input type="date" value={draftDebt.nextDueDate} onChange={(event) => setDraftDebt((current) => ({ ...current, nextDueDate: event.target.value }))} className="field" />
              </FormField>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Prioridade">
                <select value={draftDebt.priority} onChange={(event) => setDraftDebt((current) => ({ ...current, priority: event.target.value as FinancePriority }))} className="field">
                  {planningPriorityOptions.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status">
                <select value={draftDebt.status} onChange={(event) => setDraftDebt((current) => ({ ...current, status: event.target.value as DraftDebt["status"] }))} className="field">
                  <option value="active">Ativa</option>
                  <option value="paused">Pausada</option>
                  <option value="settled">Quitada</option>
                </select>
              </FormField>
              <FormField label="Como pagar">
                <select value={draftDebt.plannedPaymentMethod} onChange={(event) => setDraftDebt((current) => ({ ...current, plannedPaymentMethod: event.target.value as PaymentPlanMethod }))} className="field">
                  <option value="pix">Pix</option>
                  <option value="cash">Dinheiro</option>
                  <option value="bank_transfer">Transferencia</option>
                  <option value="card">Cartao</option>
                </select>
              </FormField>
            </div>
            {draftDebt.plannedPaymentMethod === "card" ? (
              <FormField label="Cartao planejado">
                <select value={draftDebt.plannedCardId} onChange={(event) => setDraftDebt((current) => ({ ...current, plannedCardId: event.target.value }))} className="field">
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>{card.name}</option>
                  ))}
                </select>
              </FormField>
            ) : null}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeDebtModal} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">Salvar divida</button>
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
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
              x
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
                <FormField label="Quantidade de meses">
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
                      Ao confirmar, essa distribuicao vai direto para `Dividas e repasses` na planilha.
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
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
            <button type="button" onClick={closeAccountModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200">
              x
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-8 backdrop-blur-sm">
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
              x
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
          <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
            <Panel title="Reservas por objetivo" description="">
              <div className="space-y-3">
                {activePlannedPurchases.length ? (
                  activePlannedPurchases.map((purchase) => {
                    const reservePlan = getReserveMonthlyPlan(purchase);
                    return (
                      <div
                        key={purchase.id}
                        className="rounded-[24px] border border-slate-200 bg-white px-4 py-4"
                      >
                        <div className="grid gap-3 xl:grid-cols-[1.35fr_0.65fr]">
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{purchase.name}</p>
                                <p className="mt-1 text-sm text-slate-500">
                                  {purchase.description || "Objetivo em acompanhamento"}
                                </p>
                              </div>
                              <PriorityPill priority={purchase.priority} />
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <InfoBlock label="Alvo" value={formatCurrency(purchase.estimatedValue)} />
                              <InfoBlock label="Reservado" value={formatCurrency(purchase.savedAmount)} />
                              <InfoBlock label="Falta" value={formatCurrency(reservePlan.remaining)} />
                              <InfoBlock
                                label="Parcela mensal"
                                value={formatCurrency(reservePlan.suggestedMonthlyAmount)}
                              />
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Prazo</p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">
                              {purchase.desiredDate ? formatShortDate(purchase.desiredDate) : "Sem data"}
                            </p>
                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {reservePlan.monthCount} meses ate {formatMonthLabel(monthValueToDate(reservePlan.targetMonth))}
                            </p>
                            <div className="mt-4">
                              <ProgressBar
                                value={
                                  purchase.estimatedValue
                                    ? purchase.savedAmount / purchase.estimatedValue
                                    : 0
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Ainda nao existem objetivos de reserva ativos.
                  </div>
                )}
              </div>
            </Panel>

            <Panel
              title="Metas do mes"
              description=""
              action={
                <button
                  type="button"
                  onClick={() => openPurchaseModal()}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Novo objetivo
                </button>
              }
            >
              <div className="space-y-3">
                {currentMonthlyPlan.reserveGoals.length ? (
                  currentMonthlyPlan.reserveGoals.map((goal) => (
                    <div key={goal.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{goal.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Prazo {formatShortDate(goal.deadline)}
                          </p>
                        </div>
                        <PriorityPill priority={goal.priority} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-slate-500">{formatCurrency(goal.current)}</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(goal.target)}</span>
                      </div>
                      <ProgressBar value={goal.target ? goal.current / goal.target : 0} />
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Nenhuma meta mensal cadastrada por enquanto.
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
                value={formatCurrency(selectedCardStatementSummary?.creditUsed ?? selectedCardStatementTotal)}
              />
              <MetricStack
                dark
                label="Disponivel"
                value={formatCurrency(
                  Math.max(0, selectedCardDetail.creditLimit - selectedCardStatementTotal),
                )}
              />
              <MetricStack
                dark
                label="Lancamentos"
                value={String(selectedCardStatementTransactions.length)}
                support={selectedCardStatementDueLabel ? `Vence ${selectedCardStatementDueLabel}` : "Sem fatura"}
              />
            </div>
          </div>

          <Panel title="Meses da fatura" description="Passe pelos meses e veja o que estava dentro de cada fechamento.">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {selectedCardStatementMonths.map((monthValue) => {
                const total = transactions
                  .filter(
                    (transaction) =>
                      transaction.cardId === selectedCardDetail.id &&
                      transaction.cardMode === "credit" &&
                      transaction.date.slice(0, 7) === monthValue,
                  )
                  .reduce((sum, transaction) => sum + transaction.amount, 0);

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
            >
              <div className="space-y-3">
                {selectedCardStatementTransactions.length ? (
                  selectedCardStatementTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{transaction.title}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {getDisplayCategoryName(transaction.categoryId, transaction.categoryName)} - {formatShortDate(transaction.date)}
                          </p>
                          {transaction.installmentTotal ? (
                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                              Parcela {transaction.installmentNumber}/{transaction.installmentTotal}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(transaction.amount)}
                          </p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {transaction.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
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
                    selectedCardStatementInstallments.map((transaction) => (
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
                    ))
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
                    value={formatCurrency(
                      Math.max(0, selectedCardDetail.creditLimit - selectedCardStatementTotal),
                    )}
                    support="Considerando apenas a fatura do mes selecionado"
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
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
    const activeDebtsAmount = debts
      .filter((debt) => debt.status === "active")
      .reduce((sum, debt) => sum + debt.remainingAmount, 0);
    const recurringBillsCount = bills.filter((bill) => bill.isRecurring).length;
    const accountsMenu = [
      { id: "overview" as const, label: "Visao geral" },
      { id: "recurring" as const, label: "Contas recorrentes" },
      { id: "debts" as const, label: "Dividas" },
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
          onClick={() => openNewAccountModal("bill")}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
        >
          Nova conta
        </button>
        <button
          type="button"
          onClick={() => openNewAccountModal("debt")}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Nova divida
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Pendencias do mes</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(pendingBillsAmount)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Dividas em aberto</p>
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
          <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <Panel title="Contas recorrentes e vencimentos" description="">
              <div className="space-y-3">
                {billsForDisplay.slice(0, 4).map((item) => (
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
              </div>
              <button
                type="button"
                onClick={() => setAccountsSection("recurring")}
                className="mt-4 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ver todas as contas
              </button>
            </Panel>

            <div className="space-y-4">
              <Panel title="Dividas e abatimentos" description="">
                <div className="space-y-3">
                  {debts.slice(0, 3).map((debt) => (
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
          </div>
        ) : accountsSection === "recurring" ? (
          <Panel title="Contas recorrentes e vencimentos" description="">
            <div className="space-y-3">
              {billsForDisplay.map((item) => {
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
        ) : (
          <Panel
            title="Dividas e abatimentos"
            description=""
          >
            <div className="space-y-3">
              {debts.map((debt) => (
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
                    <InfoBlock label="Abatimento sugerido" value={formatCurrency(debt.installmentAmount)} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openDebtModal(debt)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Editar
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
                    <select
                      value={settings.defaultAccountId}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          defaultAccountId: event.target.value,
                        }))
                      }
                      className="field"
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
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
                    .map((category) => (
                    <div key={category.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{category.name}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {category.type === "income" ? "Receita" : "Despesa"}
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
                    <select
                      value={draftBankPreset.brand}
                      onChange={(event) =>
                        setDraftBankPreset((current) => ({ ...current, brand: event.target.value }))
                      }
                      className="field"
                    >
                      <option value="Mastercard">Mastercard</option>
                      <option value="Visa">Visa</option>
                      <option value="Elo">Elo</option>
                      <option value="American Express">American Express</option>
                    </select>
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
              : draft.categoryId === "cat-invest"
              ? "investment"
              : draft.categoryId === "cat-debt"
                ? "debt_payment"
                : "planned_purchase",
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
              : draft.categoryId === "cat-invest"
              ? "investment"
              : draft.categoryId === "cat-debt"
                ? "debt_payment"
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









