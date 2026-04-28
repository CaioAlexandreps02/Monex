import type {
  Account,
  Bill,
  BoardColumn,
  Card,
  Debt,
  Investment,
  MonthlyPlan,
  PlannedPurchase,
  Settings,
  Transaction,
} from "@/types/finance";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatMonthLabel(date: Date) {
  const label = monthFormatter.format(date);
  return label.slice(0, 1).toUpperCase() + label.slice(1);
}

export function formatShortDate(value: string) {
  return shortDateFormatter.format(new Date(`${value}T12:00:00`));
}

export function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthValueToDate(monthValue: string) {
  return new Date(`${monthValue}-01T12:00:00`);
}

export function isSameMonth(dateValue: string, referenceDate: Date) {
  const date = new Date(`${dateValue}T12:00:00`);
  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  );
}

export function getWeekRange(referenceDate: Date, weekStartDay = 1) {
  const start = new Date(referenceDate);
  const diff = (start.getDay() - weekStartDay + 7) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function isWithinWeek(dateValue: string, referenceDate: Date, weekStartDay = 1) {
  const date = new Date(`${dateValue}T12:00:00`);
  const { start, end } = getWeekRange(referenceDate, weekStartDay);
  return date >= start && date <= end;
}

export function getAvailableMonths(transactions: Transaction[], bills: Bill[]) {
  const months = new Set<string>();

  for (const transaction of transactions) {
    months.add(transaction.date.slice(0, 7));
  }

  for (const bill of bills) {
    months.add(bill.dueDate.slice(0, 7));
  }

  return Array.from(months).sort().reverse();
}

export function getMonthTransactions(transactions: Transaction[], referenceDate: Date) {
  return transactions.filter((transaction) => isSameMonth(transaction.date, referenceDate));
}

export function getMonthBills(bills: Bill[], referenceDate: Date) {
  return bills.filter((bill) => isSameMonth(bill.dueDate, referenceDate));
}

export function getMonthInvestments(investments: Investment[], referenceDate: Date) {
  return investments.flatMap((investment) =>
    investment.contributions
      .filter((contribution) => isSameMonth(contribution.contributionDate, referenceDate))
      .map((contribution) => ({
        investmentId: investment.id,
        investmentName: investment.name,
        amount: contribution.amount,
        contributionDate: contribution.contributionDate,
      })),
  );
}

export function getMonthlySummary(
  transactions: Transaction[],
  bills: Bill[],
  investments: Investment[],
  settings: Settings,
  referenceDate: Date,
) {
  const monthTransactions = getMonthTransactions(transactions, referenceDate);
  const monthBills = getMonthBills(bills, referenceDate);
  const investmentEntries = getMonthInvestments(investments, referenceDate);
  const cashExpenses = monthTransactions.filter(
    (transaction) =>
      transaction.type === "expense" &&
      !(transaction.paymentMethod === "credit_card" && transaction.cardMode === "credit"),
  );

  const expectedIncome = monthTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const receivedIncome = monthTransactions
    .filter(
      (transaction) =>
        transaction.type === "income" &&
        (transaction.status === "received" || transaction.incomeKind === "fixed_received"),
    )
    .reduce((total, transaction) => total + transaction.amount, 0);

  const variableIncome = monthTransactions
    .filter((transaction) => transaction.type === "income" && transaction.incomeKind === "variable")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const paidExpenses = cashExpenses
    .filter((transaction) => transaction.status === "paid")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const plannedExpenses = cashExpenses
    .filter((transaction) => transaction.status === "planned")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const pendingBills = monthBills
    .filter((bill) => bill.status !== "paid")
    .reduce((total, bill) => total + bill.amount, 0);

  const paidBills = monthBills
    .filter((bill) => bill.status === "paid")
    .reduce((total, bill) => total + bill.amount, 0);

  const investedThisMonth = investmentEntries.reduce(
    (total, contribution) => total + contribution.amount,
    0,
  );

  const remainingMonth = receivedIncome - paidExpenses - pendingBills;
  const projectedBalance = expectedIncome - paidExpenses - plannedExpenses - pendingBills;
  const extraIncomeNeeded = Math.max(0, plannedExpenses + pendingBills - receivedIncome);
  const salaryCoverage =
    settings.fixedSalaryExpected > 0
      ? Math.min(
          100,
          (settings.fixedSalaryExpected /
            Math.max(1, paidExpenses + plannedExpenses + pendingBills)) *
            100,
        )
      : 0;

  return {
    expectedIncome,
    receivedIncome,
    variableIncome,
    paidExpenses,
    plannedExpenses,
    paidBills,
    pendingBills,
    investedThisMonth,
    remainingMonth,
    projectedBalance,
    differenceBetweenExpectedAndActual: receivedIncome - expectedIncome,
    extraIncomeNeeded,
    salaryCoverage,
  };
}

export function getWeeklySummary(
  transactions: Transaction[],
  bills: Bill[],
  plannedPurchases: PlannedPurchase[],
  referenceDate: Date,
  weekStartDay = 1,
) {
  const weekTransactions = transactions.filter((transaction) =>
    isWithinWeek(transaction.date, referenceDate, weekStartDay),
  );
  const weekCashTransactions = weekTransactions.filter(
    (transaction) =>
      transaction.type === "income" ||
      !(transaction.paymentMethod === "credit_card" && transaction.cardMode === "credit"),
  );
  const weekBills = bills.filter((bill) =>
    isWithinWeek(bill.dueDate, referenceDate, weekStartDay),
  );

  const weekPurchases = plannedPurchases.filter(
    (purchase) => purchase.boardColumn === "this_week" || purchase.boardColumn === "next_week",
  );

  const income = weekCashTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const expenses = weekCashTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);

  return {
    income,
    expenses,
    balance: income - expenses,
    commitments: weekBills.reduce((total, bill) => total + bill.amount, 0),
    plannedPurchases: weekPurchases.reduce(
      (total, purchase) => total + purchase.estimatedValue,
      0,
    ),
  };
}

export function getAlerts(
  bills: Bill[],
  debts: Debt[],
  plannedPurchases: PlannedPurchase[],
  summary: ReturnType<typeof getMonthlySummary>,
  referenceDate: Date,
) {
  const dueSoon = bills.filter((bill) => {
    if (bill.status === "paid") {
      return false;
    }

    const dueDate = new Date(`${bill.dueDate}T12:00:00`);
    const diff = dueDate.getTime() - referenceDate.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 5;
  });

  const overdueBills = bills.filter((bill) => bill.status === "overdue");
  const activeDebts = debts.filter((debt) => debt.status === "active" && debt.priority !== "Baixa");
  const urgentPlans = plannedPurchases.filter((purchase) => purchase.priority === "Urgente");

  const items = [
    ...dueSoon.map((bill) => ({
      id: bill.id,
      title: `${bill.title} vence em breve`,
      detail: `${formatCurrency(bill.amount)} até ${formatShortDate(bill.dueDate)}`,
      tone: "warn",
    })),
    ...overdueBills.map((bill) => ({
      id: bill.id,
      title: `${bill.title} atrasada`,
      detail: `${formatCurrency(bill.amount)} precisa de ação agora`,
      tone: "danger",
    })),
    ...activeDebts.slice(0, 2).map((debt) => ({
      id: debt.id,
      title: `Parcela de ${debt.name}`,
      detail: `${formatCurrency(debt.installmentAmount)} em ${formatShortDate(debt.nextDueDate)}`,
      tone: "info",
    })),
    ...urgentPlans.slice(0, 2).map((purchase) => ({
      id: purchase.id,
      title: purchase.name,
      detail: `${formatCurrency(purchase.estimatedValue)} com ${formatCurrency(
        purchase.savedAmount,
      )} reservado`,
      tone: "accent",
    })),
  ];

  if (summary.extraIncomeNeeded > 0) {
    items.unshift({
      id: "extra-income",
      title: "Renda extra necessária",
      detail: `Faltam ${formatCurrency(summary.extraIncomeNeeded)} para fechar o mês`,
      tone: "danger",
    });
  }

  return items.slice(0, 6);
}

export function getCategoryBreakdown(transactions: Transaction[], referenceDate: Date) {
  const monthTransactions = getMonthTransactions(transactions, referenceDate).filter(
    (transaction) => transaction.type === "expense" && transaction.status === "paid",
  );

  const grouped = monthTransactions.reduce<Record<string, number>>((accumulator, transaction) => {
    accumulator[transaction.categoryName] =
      (accumulator[transaction.categoryName] ?? 0) + transaction.amount;
    return accumulator;
  }, {});

  return Object.entries(grouped)
    .map(([categoryName, amount]) => ({
      categoryName,
      amount,
    }))
    .sort((left, right) => right.amount - left.amount);
}

export function getMonthlyTrend(transactions: Transaction[]) {
  const grouped = transactions.reduce<
    Record<string, { month: string; income: number; expenses: number }>
  >((accumulator, transaction) => {
    const month = transaction.date.slice(0, 7);
    const current = accumulator[month] ?? {
      month,
      income: 0,
      expenses: 0,
    };

    if (transaction.type === "income" && transaction.status !== "planned") {
      current.income += transaction.amount;
    }

    if (transaction.type === "expense" && transaction.status !== "planned") {
      current.expenses += transaction.amount;
    }

    accumulator[month] = current;
    return accumulator;
  }, {});

  return Object.values(grouped)
    .sort((left, right) => left.month.localeCompare(right.month))
    .slice(-4)
    .map((item) => ({
      ...item,
      label: item.month,
      result: item.income - item.expenses,
    }));
}

export function getCardSummaries(cards: Card[], transactions: Transaction[], referenceDate: Date) {
  const monthTransactions = getMonthTransactions(transactions, referenceDate).filter(
    (transaction) => transaction.cardId,
  );

  return cards.map((card) => {
    const cardTransactions = monthTransactions.filter((transaction) => transaction.cardId === card.id);
    const creditUsed = cardTransactions
      .filter((transaction) => transaction.cardMode === "credit")
      .reduce((total, transaction) => total + transaction.amount, 0);
    const debitUsed = cardTransactions
      .filter((transaction) => transaction.cardMode === "debit")
      .reduce((total, transaction) => total + transaction.amount, 0);
    const availableLimit = Math.max(0, card.creditLimit - creditUsed);

    return {
      ...card,
      creditUsed,
      debitUsed,
      availableLimit,
    };
  });
}

export function getUpcomingInstallments(transactions: Transaction[], referenceDate: Date) {
  return transactions
    .filter(
      (transaction) =>
        transaction.cardMode === "credit" &&
        transaction.installmentTotal &&
        transaction.installmentTotal > 1 &&
        new Date(`${transaction.date}T12:00:00`) >= new Date(referenceDate),
    )
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 6);
}

export function getBudgetComparison(
  monthlyPlan: MonthlyPlan,
  transactions: Transaction[],
  bills: Bill[],
  referenceDate: Date,
) {
  const monthTransactions = getMonthTransactions(transactions, referenceDate);
  const monthBills = getMonthBills(bills, referenceDate);

  return monthlyPlan.categoryBudgets.map((budget) => {
    let actual = 0;

    if (budget.kind === "expense" || budget.kind === "investment" || budget.kind === "debt") {
      actual =
        monthTransactions
          .filter((transaction) => transaction.categoryName === budget.name)
          .reduce((total, transaction) => total + transaction.amount, 0) +
        monthBills
          .filter((bill) => bill.categoryName === budget.name && bill.status !== "paid")
          .reduce((total, bill) => total + bill.amount, 0);
    }

    return {
      ...budget,
      actual,
      difference: budget.planned - actual,
      percentageUsed: budget.planned > 0 ? (actual / budget.planned) * 100 : 0,
    };
  });
}

export function getBoardColumns() {
  return [
    { id: "this_week", label: "Esta semana" },
    { id: "next_week", label: "Próxima semana" },
    { id: "this_month", label: "Este mês" },
    { id: "next_month", label: "Próximo mês" },
    { id: "later", label: "Depois" },
    { id: "bought", label: "Comprado" },
  ] satisfies Array<{ id: BoardColumn; label: string }>;
}

export function getPurchasesByColumn(plannedPurchases: PlannedPurchase[]) {
  return plannedPurchases.reduce<Record<BoardColumn, PlannedPurchase[]>>(
    (accumulator, purchase) => {
      accumulator[purchase.boardColumn].push(purchase);
      return accumulator;
    },
    {
      this_week: [],
      next_week: [],
      this_month: [],
      next_month: [],
      later: [],
      bought: [],
    },
  );
}

export function getAccountsSnapshot(
  transactions: Transaction[],
  accounts: Account[],
) {
  return accounts.map((account) => {
    const delta = transactions.reduce((total, transaction) => {
      if (transaction.accountId !== account.id) {
        return total;
      }

      if (transaction.type === "income" && transaction.status !== "planned") {
        return total + transaction.amount;
      }

      if (
        transaction.type === "expense" &&
        transaction.status !== "planned" &&
        !(transaction.paymentMethod === "credit_card" && transaction.cardMode === "credit")
      ) {
        return total - transaction.amount;
      }

      return total;
    }, 0);

    return {
      ...account,
      balance: account.initialBalance + delta,
    };
  });
}

export function getInvestmentSnapshot(investments: Investment[]) {
  const totalGross = investments.reduce(
    (total, investment) => total + investment.totalGrossInvested,
    0,
  );
  const totalCurrent = investments.reduce(
    (total, investment) => total + (investment.currentManualValue ?? investment.totalGrossInvested),
    0,
  );

  return {
    totalGross,
    totalCurrent,
    gain: totalCurrent - totalGross,
  };
}
