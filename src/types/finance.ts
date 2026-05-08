export type ViewId =
  | "home"
  | "transactions"
  | "history"
  | "settings";

export type FinancePriority = "Urgente" | "Alta" | "Média" | "Baixa" | "Adiável";

export type TransactionType = "income" | "expense";
export type TransactionStatus = "planned" | "received" | "paid";
export type PaymentMethod =
  | "pix"
  | "cash"
  | "bank_transfer"
  | "credit_card"
  | "debit_card";
export type PaymentPlanMethod = "pix" | "cash" | "bank_transfer" | "card";
export type CardMode = "credit" | "debit";
export type BillStatus = "pending" | "paid" | "overdue";
export type DebtStatus = "active" | "paused" | "settled";
export type BoardColumn =
  | "this_week"
  | "next_week"
  | "this_month"
  | "next_month"
  | "later"
  | "bought";

export interface NavItem {
  id: ViewId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface UserProfile {
  name: string;
  email: string;
  focus: string;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  initialBalance: number;
  currentBalance: number;
  isActive: boolean;
}

export interface Card {
  id: string;
  name: string;
  issuer: string;
  brand: string;
  lastDigits: string;
  accentColor: string;
  availableMode: "credit" | "debit" | "both";
  closingDay: number;
  dueDay: number;
  creditLimit: number;
  linkedAccountId?: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
}

export interface Transaction {
  id: string;
  title: string;
  type: TransactionType;
  amount: number;
  date: string;
  categoryId: string;
  categoryName: string;
  description?: string;
  accountId?: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  incomeKind?: "fixed_expected" | "fixed_received" | "variable";
  expenseKind?:
    | "fixed"
    | "variable"
    | "debt_payment"
    | "planned_purchase"
    | "investment"
    | "basic_bill";
  cardId?: string;
  cardMode?: CardMode;
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  sourceBillId?: string;
  notes?: string;
}

export interface Bill {
  id: string;
  title: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  dueDate: string;
  priority: FinancePriority;
  isRecurring: boolean;
  recurringDay?: number;
  status: BillStatus;
  plannedPaymentMethod?: PaymentPlanMethod;
  plannedCardId?: string;
  plannedCardMode?: CardMode;
  installments?: number;
  recurringGroupId?: string;
  notes?: string;
}

export interface Debt {
  id: string;
  name: string;
  description?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  installmentAmount: number;
  nextDueDate: string;
  priority: FinancePriority;
  status: DebtStatus;
  plannedPaymentMethod?: PaymentPlanMethod;
  plannedCardId?: string;
  notes?: string;
}

export interface PlannedPurchase {
  id: string;
  name: string;
  description?: string;
  estimatedValue: number;
  priority: FinancePriority;
  desiredDate?: string;
  targetMonth?: string;
  targetWeek?: string;
  scheduleType?: "week" | "month";
  specificMonthTarget?: boolean;
  boardColumn: BoardColumn;
  savedAmount: number;
  suggestedPeriodAmount: number;
  status: "idea" | "planned" | "active" | "bought" | "cancelled";
  planningMode?: "save_over_time" | "buy_in_target_period" | "card_parcelado";
  plannedPaymentMethod?: PaymentPlanMethod;
  plannedCardId?: string;
  plannedCardMode?: CardMode;
  plannedInstallments?: number;
  notes?: string;
}

export interface InvestmentContribution {
  id: string;
  contributionDate: string;
  amount: number;
  monthValue?: string;
  source?: "manual" | "planilha";
  linkedTransactionId?: string;
  paymentMethod?: PaymentMethod;
  accountId?: string;
  cardId?: string;
  cardMode?: CardMode;
  notes?: string;
}

export interface Investment {
  id: string;
  name: string;
  type: string;
  objective?: string;
  totalGrossInvested: number;
  currentManualValue?: number;
  notes?: string;
  monthlyTarget: number;
  paymentMethod?: PaymentMethod;
  accountId?: string;
  cardId?: string;
  cardMode?: CardMode;
  contributions: InvestmentContribution[];
}

export interface Settings {
  fixedSalaryExpected: number;
  monthlyInvestmentTarget: number;
  defaultAccountId: string;
  defaultCardId: string;
  weekStartDay: number;
  extraIncomeGoal: number;
}

export interface BudgetCategory {
  id: string;
  name: string;
  kind: "income" | "expense" | "reserve" | "investment" | "debt";
  planned: number;
}

export interface ReserveGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  priority: FinancePriority;
}

export interface MonthlyPlan {
  monthLabel: string;
  fixedIncomePlanned: number;
  variableIncomePlanned: number;
  fixedExpensesPlanned: number;
  variableExpensesPlanned: number;
  categoryBudgets: BudgetCategory[];
  reserveGoals: ReserveGoal[];
  debtTarget: number;
  investmentTarget: number;
  extraIncomeGoal: number;
}

export type FixedFlowSection =
  | "Ganhos"
  | "Gastos fixos"
  | "Dividas e repasses"
  | "Compras planejadas";

export interface FixedFlowEntry {
  id: string;
  section: FixedFlowSection;
  title: string;
  kind: TransactionType;
  categoryId: string;
  categoryName: string;
  amountByMonth: Record<string, number>;
  completedMonths: string[];
  paymentMethod: PaymentMethod;
  accountId?: string;
  cardId?: string;
  cardMode?: CardMode;
  linkedBillGroupId?: string;
  linkedInvestmentId?: string;
  syncCardLimit?: boolean;
  manualAmountMonths?: string[];
  notes?: string;
}

export interface MonthlyGridRow {
  id: string;
  section: FixedFlowSection;
  sourceType: "fixed" | "planned_purchase" | "card_auto_bill";
  sourceId: string;
  title: string;
  categoryId: string;
  categoryName: string;
  paymentMethod: PaymentMethod;
  accountId?: string;
  cardId?: string;
  cardMode?: CardMode;
  linkedBillGroupId?: string;
  linkedInvestmentId?: string;
  syncCardLimit?: boolean;
  notes?: string;
  amountByMonth: Record<string, number>;
  completedMonths: string[];
}
