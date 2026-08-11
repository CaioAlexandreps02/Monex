type JsonObject = Record<string, unknown>;

export type SupabaseRestConfig = {
  url: string;
  serviceRoleKey: string;
};

export type RelationalFinanceState = {
  selectedMonth: string;
  accounts: JsonObject[];
  cards: JsonObject[];
  transactions: JsonObject[];
  transactionGroups: JsonObject[];
  bills: JsonObject[];
  categories: JsonObject[];
  debts: JsonObject[];
  fixedEntries: JsonObject[];
  plannedPurchases: JsonObject[];
  investments: JsonObject[];
  cardBillEstimates: Record<string, JsonObject>;
  importedStatementBatches: JsonObject[];
  importedStatementItems: JsonObject[];
  importLearningRules: JsonObject[];
  importMerchants: JsonObject[];
  importAutomationConfigs: JsonObject[];
  settings: JsonObject;
  monthlyPlansByMonth: Record<string, JsonObject>;
};

const OWNER_KEY = "default";

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function omitUndefined<T extends JsonObject>(object: T): T {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) as T;
}

function tableUrl(config: SupabaseRestConfig, table: string, query = `select=*&owner_key=eq.${OWNER_KEY}`) {
  return `${config.url}/rest/v1/${table}?${query}`;
}

async function fetchTable(config: SupabaseRestConfig, table: string, signal: AbortSignal, query?: string) {
  const response = await fetch(tableUrl(config, table, query), {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Could not fetch ${table}: ${response.status} ${details}`);
  }

  return (await response.json()) as JsonObject[];
}

async function fetchAppStateMeta(config: SupabaseRestConfig, signal: AbortSignal) {
  const response = await fetch(`${config.url}/rest/v1/app_state?select=state,updated_at&key=eq.${OWNER_KEY}&limit=1`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    return { selectedMonth: new Date().toISOString().slice(0, 7), updatedAt: null };
  }

  const rows = (await response.json()) as Array<{ state?: JsonObject; updated_at?: string }>;
  return {
    selectedMonth: asString(rows[0]?.state?.selectedMonth, new Date().toISOString().slice(0, 7)),
    updatedAt: rows[0]?.updated_at ?? null,
  };
}

function mapAccount(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    name: asString(row.name),
    type: asString(row.type),
    initialBalance: asNumber(row.initial_balance),
    currentBalance: asNumber(row.current_balance),
    isActive: asBoolean(row.is_active, true),
  });
}

function mapCard(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    name: asString(row.name),
    issuer: asString(row.issuer),
    brand: asString(row.brand),
    lastDigits: asString(row.last_digits),
    accentColor: asString(row.accent_color),
    availableMode: asString(row.available_mode, "credit"),
    closingDay: asNumber(row.closing_day, 1),
    dueDay: asNumber(row.due_day, 1),
    creditLimit: asNumber(row.credit_limit),
    linkedAccountId: asOptionalString(row.linked_account_id),
    isActive: asBoolean(row.is_active, true),
  });
}

function mapCategory(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    name: asString(row.name),
    type: asString(row.type, "expense"),
    color: asString(row.color, "#94A3B8"),
    parentId: asOptionalString(row.parent_id),
  });
}

function mapTransactionGroup(row: JsonObject) {
  return {
    id: asString(row.id),
    nome: asString(row.name, "Grupo"),
    createdAt: asString(row.created_at, new Date().toISOString()),
  };
}

function mapBill(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    title: asString(row.title),
    amount: asNumber(row.amount),
    categoryId: asString(row.category_id),
    categoryName: asString(row.category_name),
    dueDate: asString(row.due_date),
    priority: asString(row.priority),
    isRecurring: asBoolean(row.is_recurring),
    recurringDay: row.recurring_day === null ? undefined : asNumber(row.recurring_day),
    status: asString(row.status, "pending"),
    plannedPaymentMethod: asOptionalString(row.planned_payment_method),
    plannedCardId: asOptionalString(row.planned_card_id),
    plannedCardMode: asOptionalString(row.planned_card_mode),
    installments: row.installments === null ? undefined : asNumber(row.installments),
    recurringGroupId: asOptionalString(row.recurring_group_id),
    notes: asOptionalString(row.notes),
    archivedAt: asOptionalString(row.archived_at),
  });
}

function mapTransaction(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    title: asString(row.title),
    type: asString(row.type, "expense"),
    amount: asNumber(row.amount),
    date: asString(row.date),
    categoryId: asString(row.category_id),
    categoryName: asString(row.category_name),
    description: asOptionalString(row.description),
    accountId: asOptionalString(row.account_id),
    paymentMethod: asString(row.payment_method, "pix"),
    status: asString(row.status, "planned"),
    incomeKind: asOptionalString(row.income_kind),
    expenseKind: asOptionalString(row.expense_kind),
    cardId: asOptionalString(row.card_id),
    cardMode: asOptionalString(row.card_mode),
    installmentGroupId: asOptionalString(row.installment_group_id),
    installmentNumber: row.installment_number === null ? undefined : asNumber(row.installment_number),
    installmentTotal: row.installment_total === null ? undefined : asNumber(row.installment_total),
    sourceBillId: asOptionalString(row.source_bill_id),
    linkedPlannedPurchaseId: asOptionalString(row.linked_planned_purchase_id),
    notes: asOptionalString(row.notes),
    groupId: asOptionalString(row.group_id),
  });
}

function mapDebt(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    name: asString(row.name),
    description: asOptionalString(row.description),
    totalAmount: asNumber(row.total_amount),
    paidAmount: asNumber(row.paid_amount),
    remainingAmount: asNumber(row.remaining_amount),
    totalInstallments: asNumber(row.total_installments, 1),
    paidInstallments: asNumber(row.paid_installments),
    installmentAmount: asNumber(row.installment_amount),
    nextDueDate: asString(row.next_due_date),
    priority: asString(row.priority),
    status: asString(row.status, "active"),
    plannedPaymentMethod: asOptionalString(row.planned_payment_method),
    plannedCardId: asOptionalString(row.planned_card_id),
    notes: asOptionalString(row.notes),
    archivedAt: asOptionalString(row.archived_at),
  });
}

function mapFixedEntry(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    section: asString(row.section),
    title: asString(row.title),
    kind: asString(row.kind, "expense"),
    categoryId: asString(row.category_id),
    categoryName: asString(row.category_name),
    amountByMonth: asObject(row.amount_by_month),
    completedMonths: asArray(row.completed_months),
    paymentMethod: asString(row.payment_method, "pix"),
    accountId: asOptionalString(row.account_id),
    cardId: asOptionalString(row.card_id),
    cardMode: asOptionalString(row.card_mode),
    linkedBillGroupId: asOptionalString(row.linked_bill_group_id),
    linkedDebtId: asOptionalString(row.linked_debt_id),
    linkedInvestmentId: asOptionalString(row.linked_investment_id),
    syncCardLimit: row.sync_card_limit === null ? undefined : asBoolean(row.sync_card_limit),
    manualAmountMonths: asArray(row.manual_amount_months),
    notes: asOptionalString(row.notes),
    archivedAt: asOptionalString(row.archived_at),
  });
}

function mapPlannedPurchase(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    name: asString(row.name),
    description: asOptionalString(row.description),
    estimatedValue: asNumber(row.estimated_value),
    priority: asString(row.priority),
    desiredDate: asOptionalString(row.desired_date),
    targetMonth: asOptionalString(row.target_month),
    targetWeek: asOptionalString(row.target_week),
    scheduleType: asOptionalString(row.schedule_type),
    specificMonthTarget: asBoolean(row.specific_month_target),
    boardColumn: asString(row.board_column, "later"),
    savedAmount: asNumber(row.saved_amount),
    suggestedPeriodAmount: asNumber(row.suggested_period_amount),
    plannedAmountByMonth: asObject(row.planned_amount_by_month),
    status: asString(row.status, "idea"),
    planningMode: asOptionalString(row.planning_mode),
    plannedPaymentMethod: asOptionalString(row.planned_payment_method),
    plannedCardId: asOptionalString(row.planned_card_id),
    plannedCardMode: asOptionalString(row.planned_card_mode),
    plannedInstallments: row.planned_installments === null ? undefined : asNumber(row.planned_installments),
    notes: asOptionalString(row.notes),
  });
}

function mapContribution(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    contributionDate: asString(row.contribution_date),
    amount: asNumber(row.amount),
    monthValue: asOptionalString(row.month_value),
    source: asOptionalString(row.source),
    linkedTransactionId: asOptionalString(row.linked_transaction_id),
    paymentMethod: asOptionalString(row.payment_method),
    accountId: asOptionalString(row.account_id),
    cardId: asOptionalString(row.card_id),
    cardMode: asOptionalString(row.card_mode),
    notes: asOptionalString(row.notes),
  });
}

function mapInvestment(row: JsonObject, contributions: JsonObject[]) {
  return omitUndefined({
    id: asString(row.id),
    name: asString(row.name),
    type: asString(row.type),
    objective: asOptionalString(row.objective),
    totalGrossInvested: asNumber(row.total_gross_invested),
    currentManualValue: row.current_manual_value === null ? undefined : asNumber(row.current_manual_value),
    notes: asOptionalString(row.notes),
    monthlyTarget: asNumber(row.monthly_target),
    paymentMethod: asOptionalString(row.payment_method),
    accountId: asOptionalString(row.account_id),
    cardId: asOptionalString(row.card_id),
    cardMode: asOptionalString(row.card_mode),
    plannedAmountByMonth: asObject(row.planned_amount_by_month),
    contributions,
  });
}

function mapCardBillEstimate(row: JsonObject) {
  return omitUndefined({
    cardId: asString(row.card_id),
    monthValue: asString(row.month_value),
    estimatedAmount: asNumber(row.estimated_amount),
    isAutoEstimate: asBoolean(row.is_auto_estimate, true),
    status: asString(row.status, "pending"),
    paidTransactionId: asOptionalString(row.paid_transaction_id),
    archivedAt: asOptionalString(row.archived_at),
  });
}

function mapImportBatch(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    fileName: asString(row.file_name),
    fileType: asString(row.file_type, "csv"),
    sourceKind: asString(row.source_kind, "unknown"),
    transport: asOptionalString(row.transport),
    sourceInstitution: asOptionalString(row.source_institution),
    accountId: asOptionalString(row.account_id),
    cardId: asOptionalString(row.card_id),
    externalSourceId: asOptionalString(row.external_source_id),
    sourceLabel: asOptionalString(row.source_label),
    importedAt: asString(row.imported_at),
    periodStart: asOptionalString(row.period_start),
    periodEnd: asOptionalString(row.period_end),
    status: asString(row.status, "pending_review"),
    itemCount: asNumber(row.item_count),
    confirmedCount: asNumber(row.confirmed_count),
    ignoredCount: asNumber(row.ignored_count),
    duplicateCount: asNumber(row.duplicate_count),
  });
}

function mapSuggestedMatch(value: unknown) {
  return Object.keys(asObject(value)).length > 0 ? asObject(value) : undefined;
}

function mapMerchant(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    name: asString(row.name),
    aliases: asArray(row.aliases),
    sourceKind: asString(row.source_kind, "unknown"),
    suggestedCategoryId: asOptionalString(row.suggested_category_id),
    suggestedTransactionType: asOptionalString(row.suggested_transaction_type),
    paymentMethod: asOptionalString(row.payment_method),
    suggestedMatch: mapSuggestedMatch(row.suggested_match),
    supportCount: asNumber(row.support_count),
    mistakeCount: asNumber(row.mistake_count),
    status: asString(row.status, "suggested"),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    lastAppliedAt: asOptionalString(row.last_applied_at),
  });
}

function mapLearningRule(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    pattern: asString(row.pattern),
    sourceKind: asString(row.source_kind, "unknown"),
    suggestedCategoryId: asOptionalString(row.suggested_category_id),
    suggestedTransactionType: asOptionalString(row.suggested_transaction_type),
    paymentMethod: asOptionalString(row.payment_method),
    suggestedMatch: mapSuggestedMatch(row.suggested_match),
    supportCount: asNumber(row.support_count),
    mistakeCount: asNumber(row.mistake_count),
    status: asString(row.status, "suggested"),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    lastAppliedAt: asOptionalString(row.last_applied_at),
  });
}

function mapAutomationConfig(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    transport: asString(row.transport),
    label: asString(row.label),
    status: asString(row.status, "planned"),
    isEnabled: asBoolean(row.is_enabled),
    provider: asOptionalString(row.provider),
    accountId: asOptionalString(row.account_id),
    cardId: asOptionalString(row.card_id),
    allowedSenders: asArray(row.allowed_senders),
    keywords: asArray(row.keywords),
    externalConnectionId: asOptionalString(row.external_connection_id),
    processedExternalIds: asArray(row.processed_external_ids),
    authorizedAt: asOptionalString(row.authorized_at),
    lastSyncAt: asOptionalString(row.last_sync_at),
    notes: asOptionalString(row.notes),
  });
}

function mapImportItem(row: JsonObject) {
  return omitUndefined({
    id: asString(row.id),
    batchId: asString(row.batch_id),
    rawDescription: asString(row.raw_description),
    reviewTitle: asOptionalString(row.review_title),
    normalizedDescription: asString(row.normalized_description),
    date: asString(row.date),
    amount: asNumber(row.amount),
    direction: asString(row.direction, "outflow"),
    sourceKind: asString(row.source_kind, "unknown"),
    transport: asOptionalString(row.transport),
    paymentMethod: asString(row.payment_method, "unknown"),
    accountId: asOptionalString(row.account_id),
    cardId: asOptionalString(row.card_id),
    externalItemId: asOptionalString(row.external_item_id),
    originLabel: asOptionalString(row.origin_label),
    suggestedCategoryId: asOptionalString(row.suggested_category_id),
    suggestedTransactionType: asOptionalString(row.suggested_transaction_type),
    suggestedMatch: mapSuggestedMatch(row.suggested_match),
    appliedLearningRuleId: asOptionalString(row.applied_learning_rule_id),
    detectedMerchantId: asOptionalString(row.detected_merchant_id),
    statementMonth: asOptionalString(row.statement_month),
    confidence: asNumber(row.confidence),
    status: asString(row.status, "pending"),
    confirmedTransactionId: asOptionalString(row.confirmed_transaction_id),
    ignoredReason: asOptionalString(row.ignored_reason),
    fingerprint: asString(row.fingerprint),
  });
}

function mapSettings(row: JsonObject | undefined) {
  return omitUndefined({
    fixedSalaryExpected: asNumber(row?.fixed_salary_expected),
    monthlyInvestmentTarget: asNumber(row?.monthly_investment_target),
    monthlyDebtPaymentCap: asNumber(row?.monthly_debt_payment_cap),
    bankPresets: Array.isArray(row?.bank_presets) ? row?.bank_presets : [],
    defaultAccountId: asString(row?.default_account_id),
    defaultCardId: asString(row?.default_card_id),
    weekStartDay: asNumber(row?.week_start_day, 1),
    extraIncomeGoal: asNumber(row?.extra_income_goal),
    defaultBillPaymentMethod: asString(row?.default_bill_payment_method, "pix"),
  });
}

function buildCardBillEstimates(rows: JsonObject[]) {
  return Object.fromEntries(rows.map((row) => [asString(row.id), mapCardBillEstimate(row)]));
}

function buildInvestments(investments: JsonObject[], contributions: JsonObject[]) {
  const contributionsByInvestment = new Map<string, JsonObject[]>();

  for (const contribution of contributions) {
    const investmentId = asString(contribution.investment_id);
    const items = contributionsByInvestment.get(investmentId) ?? [];
    items.push(mapContribution(contribution));
    contributionsByInvestment.set(investmentId, items);
  }

  return investments.map((investment) => mapInvestment(investment, contributionsByInvestment.get(asString(investment.id)) ?? []));
}

function buildMonthlyPlans(plans: JsonObject[], budgets: JsonObject[], reserveGoals: JsonObject[]) {
  const budgetsByPlan = new Map<string, JsonObject[]>();
  const reserveGoalsByPlan = new Map<string, JsonObject[]>();

  for (const budget of budgets) {
    const planId = asString(budget.monthly_plan_id);
    const items = budgetsByPlan.get(planId) ?? [];
    items.push({
      id: asString(budget.budget_key),
      name: asString(budget.name),
      kind: asString(budget.kind),
      planned: asNumber(budget.planned),
    });
    budgetsByPlan.set(planId, items);
  }

  for (const goal of reserveGoals) {
    const planId = asString(goal.monthly_plan_id);
    const items = reserveGoalsByPlan.get(planId) ?? [];
    items.push({
      id: asString(goal.goal_key),
      name: asString(goal.name),
      target: asNumber(goal.target),
      current: asNumber(goal.current),
      deadline: asString(goal.deadline),
      priority: asString(goal.priority),
    });
    reserveGoalsByPlan.set(planId, items);
  }

  return Object.fromEntries(
    plans.map((plan) => [
      asString(plan.month_value),
      {
        monthLabel: asString(plan.month_label),
        fixedIncomePlanned: asNumber(plan.fixed_income_planned),
        variableIncomePlanned: asNumber(plan.variable_income_planned),
        fixedExpensesPlanned: asNumber(plan.fixed_expenses_planned),
        variableExpensesPlanned: asNumber(plan.variable_expenses_planned),
        categoryBudgets: budgetsByPlan.get(asString(plan.id)) ?? [],
        reserveGoals: reserveGoalsByPlan.get(asString(plan.id)) ?? [],
        debtTarget: asNumber(plan.debt_target),
        investmentTarget: asNumber(plan.investment_target),
        extraIncomeGoal: asNumber(plan.extra_income_goal),
      },
    ]),
  );
}

export async function loadRelationalFinanceState(config: SupabaseRestConfig, signal: AbortSignal) {
  const [
    meta,
    accounts,
    cards,
    categories,
    transactionGroups,
    bills,
    transactions,
    debts,
    fixedEntries,
    plannedPurchases,
    investments,
    contributions,
    cardBillEstimates,
    importedStatementBatches,
    importedStatementItems,
    importMerchants,
    importLearningRules,
    importAutomationConfigs,
    monthlyPlans,
    monthlyPlanCategoryBudgets,
    reserveGoals,
    settings,
  ] = await Promise.all([
    fetchAppStateMeta(config, signal),
    fetchTable(config, "monex_accounts", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=name.asc`),
    fetchTable(config, "monex_cards", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=name.asc`),
    fetchTable(config, "monex_categories", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=name.asc`),
    fetchTable(config, "monex_transaction_groups", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=created_at.asc`),
    fetchTable(config, "monex_bills", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=due_date.asc,title.asc`),
    fetchTable(config, "monex_transactions", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=date.desc,title.asc`),
    fetchTable(config, "monex_debts", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=next_due_date.asc,name.asc`),
    fetchTable(config, "monex_fixed_flow_entries", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=section.asc,title.asc`),
    fetchTable(config, "monex_planned_purchases", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=name.asc`),
    fetchTable(config, "monex_investments", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=name.asc`),
    fetchTable(config, "monex_investment_contributions", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=contribution_date.asc`),
    fetchTable(config, "monex_card_bill_estimates", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=month_value.asc,card_id.asc`),
    fetchTable(config, "monex_imported_statement_batches", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=imported_at.desc`),
    fetchTable(config, "monex_imported_statement_items", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=date.desc`),
    fetchTable(config, "monex_import_merchants", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=name.asc`),
    fetchTable(config, "monex_import_learning_rules", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=updated_at.desc`),
    fetchTable(config, "monex_import_automation_configs", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=label.asc`),
    fetchTable(config, "monex_monthly_plans", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=month_value.asc`),
    fetchTable(config, "monex_monthly_plan_category_budgets", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=budget_key.asc`),
    fetchTable(config, "monex_reserve_goals", signal, `select=*&owner_key=eq.${OWNER_KEY}&order=deadline.asc`),
    fetchTable(config, "monex_settings", signal, `select=*&owner_key=eq.${OWNER_KEY}&limit=1`),
  ]);

  return {
    state: {
      selectedMonth: meta.selectedMonth,
      accounts: accounts.map(mapAccount),
      cards: cards.map(mapCard),
      transactions: transactions.map(mapTransaction),
      transactionGroups: transactionGroups.map(mapTransactionGroup),
      bills: bills.map(mapBill),
      categories: categories.map(mapCategory),
      debts: debts.map(mapDebt),
      fixedEntries: fixedEntries.map(mapFixedEntry),
      plannedPurchases: plannedPurchases.map(mapPlannedPurchase),
      investments: buildInvestments(investments, contributions),
      cardBillEstimates: buildCardBillEstimates(cardBillEstimates),
      importedStatementBatches: importedStatementBatches.map(mapImportBatch),
      importedStatementItems: importedStatementItems.map(mapImportItem),
      importLearningRules: importLearningRules.map(mapLearningRule),
      importMerchants: importMerchants.map(mapMerchant),
      importAutomationConfigs: importAutomationConfigs.map(mapAutomationConfig),
      settings: mapSettings(settings[0]),
      monthlyPlansByMonth: buildMonthlyPlans(monthlyPlans, monthlyPlanCategoryBudgets, reserveGoals),
    } satisfies RelationalFinanceState,
    updatedAt: meta.updatedAt,
  };
}
