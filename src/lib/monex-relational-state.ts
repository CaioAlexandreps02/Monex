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

function restHeaders(config: SupabaseRestConfig, extraHeaders?: HeadersInit) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...extraHeaders,
  };
}

async function fetchTable(config: SupabaseRestConfig, table: string, signal: AbortSignal, query?: string) {
  const response = await fetch(tableUrl(config, table, query), {
    headers: restHeaders(config),
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
    headers: restHeaders(config),
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

async function fetchBackupAppState(config: SupabaseRestConfig, signal: AbortSignal) {
  const response = await fetch(`${config.url}/rest/v1/app_state?select=state&key=eq.${OWNER_KEY}&limit=1`, {
    headers: restHeaders(config),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as Array<{ state?: JsonObject }>;
  return rows[0]?.state ?? null;
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
    groupId: asOptionalString(row.group_id),
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

async function deleteOwnerRows(config: SupabaseRestConfig, table: string, signal: AbortSignal) {
  const response = await fetch(tableUrl(config, table, `owner_key=eq.${OWNER_KEY}`), {
    method: "DELETE",
    headers: restHeaders(config),
    signal,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Could not clear ${table}: ${response.status} ${details}`);
  }
}

async function insertRows(config: SupabaseRestConfig, table: string, rows: JsonObject[], signal: AbortSignal) {
  if (!rows.length) {
    return;
  }

  const chunkSize = 500;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const response = await fetch(`${config.url}/rest/v1/${table}`, {
      method: "POST",
      headers: restHeaders(config, {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      }),
      body: JSON.stringify(chunk),
      signal,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Could not insert ${table}: ${response.status} ${details}`);
    }
  }
}

function optional(value: unknown) {
  return value === undefined || value === "" ? null : value;
}

function ownerRow(row: JsonObject) {
  return { owner_key: OWNER_KEY, ...row };
}

function toAccountRow(account: JsonObject) {
  return ownerRow({
    id: asString(account.id),
    name: asString(account.name),
    type: asString(account.type),
    initial_balance: asNumber(account.initialBalance),
    current_balance: asNumber(account.currentBalance),
    is_active: asBoolean(account.isActive, true),
  });
}

function toCardRow(card: JsonObject) {
  return ownerRow({
    id: asString(card.id),
    linked_account_id: optional(card.linkedAccountId),
    name: asString(card.name),
    issuer: asString(card.issuer),
    brand: asString(card.brand),
    last_digits: asString(card.lastDigits),
    accent_color: asString(card.accentColor),
    available_mode: asString(card.availableMode, "credit"),
    closing_day: asNumber(card.closingDay, 1),
    due_day: asNumber(card.dueDay, 1),
    credit_limit: asNumber(card.creditLimit),
    is_active: asBoolean(card.isActive, true),
  });
}

function toCategoryRow(category: JsonObject) {
  return ownerRow({
    id: asString(category.id),
    name: asString(category.name),
    type: asString(category.type, "expense"),
    color: asString(category.color, "#94A3B8"),
    parent_id: optional(category.parentId),
  });
}

function buildReferencedCategoryRows(state: JsonObject) {
  const categories = new Map<string, JsonObject>();
  const addCategory = (id: unknown, name: unknown, type: unknown) => {
    const categoryId = asOptionalString(id);
    if (!categoryId || categories.has(categoryId)) {
      return;
    }

    categories.set(
      categoryId,
      toCategoryRow({
        id: categoryId,
        name: asString(name, categoryId),
        type: asString(type, "expense") === "income" ? "income" : "expense",
        color: "#94A3B8",
      }),
    );
  };

  for (const bill of asJsonArray(state.bills)) {
    addCategory(bill.categoryId, bill.categoryName, "expense");
  }
  for (const transaction of asJsonArray(state.transactions)) {
    addCategory(transaction.categoryId, transaction.categoryName, transaction.type);
  }
  for (const entry of asJsonArray(state.fixedEntries)) {
    addCategory(entry.categoryId, entry.categoryName, entry.kind);
  }

  return Array.from(categories.values());
}

function toTransactionGroupRow(group: JsonObject) {
  return ownerRow({
    id: asString(group.id),
    name: asString(group.nome, asString(group.name, "Grupo")),
    created_at: optional(group.createdAt) ?? new Date().toISOString(),
  });
}

function toBillRow(bill: JsonObject) {
  return ownerRow({
    id: asString(bill.id),
    title: asString(bill.title),
    amount: asNumber(bill.amount),
    category_id: optional(bill.categoryId),
    category_name: asString(bill.categoryName),
    due_date: asString(bill.dueDate),
    priority: asString(bill.priority),
    is_recurring: asBoolean(bill.isRecurring),
    recurring_day: optional(bill.recurringDay),
    status: asString(bill.status, "pending"),
    planned_payment_method: optional(bill.plannedPaymentMethod),
    planned_card_id: optional(bill.plannedCardId),
    planned_card_mode: optional(bill.plannedCardMode),
    installments: optional(bill.installments),
    recurring_group_id: optional(bill.recurringGroupId),
    group_id: optional(bill.groupId),
    notes: optional(bill.notes),
    archived_at: optional(bill.archivedAt),
  });
}

function toPlannedPurchaseRow(purchase: JsonObject) {
  return ownerRow({
    id: asString(purchase.id),
    name: asString(purchase.name),
    description: optional(purchase.description),
    estimated_value: asNumber(purchase.estimatedValue),
    priority: asString(purchase.priority),
    desired_date: optional(purchase.desiredDate),
    target_month: optional(purchase.targetMonth),
    target_week: optional(purchase.targetWeek),
    schedule_type: optional(purchase.scheduleType),
    specific_month_target: asBoolean(purchase.specificMonthTarget),
    board_column: asString(purchase.boardColumn, "later"),
    saved_amount: asNumber(purchase.savedAmount),
    suggested_period_amount: asNumber(purchase.suggestedPeriodAmount),
    planned_amount_by_month: asObject(purchase.plannedAmountByMonth),
    status: asString(purchase.status, "idea"),
    planning_mode: optional(purchase.planningMode),
    planned_payment_method: optional(purchase.plannedPaymentMethod),
    planned_card_id: optional(purchase.plannedCardId),
    planned_card_mode: optional(purchase.plannedCardMode),
    planned_installments: optional(purchase.plannedInstallments),
    notes: optional(purchase.notes),
  });
}

function toTransactionRow(transaction: JsonObject) {
  return ownerRow({
    id: asString(transaction.id),
    title: asString(transaction.title),
    type: asString(transaction.type, "expense"),
    amount: asNumber(transaction.amount),
    date: asString(transaction.date),
    category_id: optional(transaction.categoryId),
    category_name: asString(transaction.categoryName),
    description: optional(transaction.description),
    account_id: optional(transaction.accountId),
    payment_method: asString(transaction.paymentMethod, "pix"),
    status: asString(transaction.status, "planned"),
    income_kind: optional(transaction.incomeKind),
    expense_kind: optional(transaction.expenseKind),
    card_id: optional(transaction.cardId),
    card_mode: optional(transaction.cardMode),
    installment_group_id: optional(transaction.installmentGroupId),
    installment_number: optional(transaction.installmentNumber),
    installment_total: optional(transaction.installmentTotal),
    source_bill_id: optional(transaction.sourceBillId),
    linked_planned_purchase_id: optional(transaction.linkedPlannedPurchaseId),
    notes: optional(transaction.notes),
    group_id: optional(transaction.groupId),
  });
}

function toDebtRow(debt: JsonObject) {
  return ownerRow({
    id: asString(debt.id),
    name: asString(debt.name),
    description: optional(debt.description),
    total_amount: asNumber(debt.totalAmount),
    paid_amount: asNumber(debt.paidAmount),
    remaining_amount: asNumber(debt.remainingAmount),
    total_installments: asNumber(debt.totalInstallments, 1),
    paid_installments: asNumber(debt.paidInstallments),
    installment_amount: asNumber(debt.installmentAmount),
    next_due_date: asString(debt.nextDueDate),
    priority: asString(debt.priority),
    status: asString(debt.status, "active"),
    planned_payment_method: optional(debt.plannedPaymentMethod),
    planned_card_id: optional(debt.plannedCardId),
    notes: optional(debt.notes),
    archived_at: optional(debt.archivedAt),
  });
}

function toFixedEntryRow(entry: JsonObject) {
  return ownerRow({
    id: asString(entry.id),
    section: asString(entry.section),
    title: asString(entry.title),
    kind: asString(entry.kind, "expense"),
    category_id: optional(entry.categoryId),
    category_name: asString(entry.categoryName),
    amount_by_month: asObject(entry.amountByMonth),
    completed_months: asArray(entry.completedMonths),
    payment_method: asString(entry.paymentMethod, "pix"),
    account_id: optional(entry.accountId),
    card_id: optional(entry.cardId),
    card_mode: optional(entry.cardMode),
    linked_bill_group_id: optional(entry.linkedBillGroupId),
    linked_debt_id: optional(entry.linkedDebtId),
    linked_investment_id: optional(entry.linkedInvestmentId),
    sync_card_limit: entry.syncCardLimit === undefined ? null : asBoolean(entry.syncCardLimit),
    manual_amount_months: asArray(entry.manualAmountMonths),
    notes: optional(entry.notes),
    archived_at: optional(entry.archivedAt),
  });
}

function toInvestmentRow(investment: JsonObject) {
  return ownerRow({
    id: asString(investment.id),
    name: asString(investment.name),
    type: asString(investment.type),
    objective: optional(investment.objective),
    total_gross_invested: asNumber(investment.totalGrossInvested),
    current_manual_value: optional(investment.currentManualValue),
    notes: optional(investment.notes),
    monthly_target: asNumber(investment.monthlyTarget),
    payment_method: optional(investment.paymentMethod),
    account_id: optional(investment.accountId),
    card_id: optional(investment.cardId),
    card_mode: optional(investment.cardMode),
    planned_amount_by_month: asObject(investment.plannedAmountByMonth),
  });
}

function toInvestmentContributionRows(investments: JsonObject[]) {
  return investments.flatMap((investment) =>
    asJsonArray(investment.contributions).map((contribution) =>
      ownerRow({
        id: asString(contribution.id),
        investment_id: asString(investment.id),
        contribution_date: asString(contribution.contributionDate),
        amount: asNumber(contribution.amount),
        month_value: optional(contribution.monthValue),
        source: optional(contribution.source),
        linked_transaction_id: optional(contribution.linkedTransactionId),
        payment_method: optional(contribution.paymentMethod),
        account_id: optional(contribution.accountId),
        card_id: optional(contribution.cardId),
        card_mode: optional(contribution.cardMode),
        notes: optional(contribution.notes),
      }),
    ),
  );
}

function toCardBillEstimateRows(cardBillEstimates: JsonObject) {
  return Object.entries(cardBillEstimates).map(([id, estimate]) =>
    ownerRow({
      id,
      card_id: asString(asObject(estimate).cardId),
      month_value: asString(asObject(estimate).monthValue),
      estimated_amount: asNumber(asObject(estimate).estimatedAmount),
      is_auto_estimate: asBoolean(asObject(estimate).isAutoEstimate, true),
      status: asString(asObject(estimate).status, "pending"),
      paid_transaction_id: optional(asObject(estimate).paidTransactionId),
      archived_at: optional(asObject(estimate).archivedAt),
    }),
  );
}

function toImportBatchRow(batch: JsonObject) {
  return ownerRow({
    id: asString(batch.id),
    file_name: asString(batch.fileName),
    file_type: asString(batch.fileType, "csv"),
    source_kind: asString(batch.sourceKind, "unknown"),
    transport: optional(batch.transport),
    source_institution: optional(batch.sourceInstitution),
    account_id: optional(batch.accountId),
    card_id: optional(batch.cardId),
    external_source_id: optional(batch.externalSourceId),
    source_label: optional(batch.sourceLabel),
    imported_at: asString(batch.importedAt, new Date().toISOString()),
    period_start: optional(batch.periodStart),
    period_end: optional(batch.periodEnd),
    status: asString(batch.status, "pending_review"),
    item_count: asNumber(batch.itemCount),
    confirmed_count: asNumber(batch.confirmedCount),
    ignored_count: asNumber(batch.ignoredCount),
    duplicate_count: asNumber(batch.duplicateCount),
  });
}

function toMerchantRow(merchant: JsonObject) {
  return ownerRow({
    id: asString(merchant.id),
    name: asString(merchant.name),
    aliases: asArray(merchant.aliases),
    source_kind: asString(merchant.sourceKind, "unknown"),
    suggested_category_id: optional(merchant.suggestedCategoryId),
    suggested_transaction_type: optional(merchant.suggestedTransactionType),
    payment_method: optional(merchant.paymentMethod),
    suggested_match: Object.keys(asObject(merchant.suggestedMatch)).length ? asObject(merchant.suggestedMatch) : null,
    support_count: asNumber(merchant.supportCount),
    mistake_count: asNumber(merchant.mistakeCount),
    status: asString(merchant.status, "suggested"),
    created_at: asString(merchant.createdAt, new Date().toISOString()),
    updated_at: asString(merchant.updatedAt, new Date().toISOString()),
    last_applied_at: optional(merchant.lastAppliedAt),
  });
}

function toLearningRuleRow(rule: JsonObject) {
  return ownerRow({
    id: asString(rule.id),
    pattern: asString(rule.pattern),
    source_kind: asString(rule.sourceKind, "unknown"),
    suggested_category_id: optional(rule.suggestedCategoryId),
    suggested_transaction_type: optional(rule.suggestedTransactionType),
    payment_method: optional(rule.paymentMethod),
    suggested_match: Object.keys(asObject(rule.suggestedMatch)).length ? asObject(rule.suggestedMatch) : null,
    support_count: asNumber(rule.supportCount),
    mistake_count: asNumber(rule.mistakeCount),
    status: asString(rule.status, "suggested"),
    created_at: asString(rule.createdAt, new Date().toISOString()),
    updated_at: asString(rule.updatedAt, new Date().toISOString()),
    last_applied_at: optional(rule.lastAppliedAt),
  });
}

function toAutomationConfigRow(config: JsonObject) {
  return ownerRow({
    id: asString(config.id),
    transport: asString(config.transport),
    label: asString(config.label),
    status: asString(config.status, "planned"),
    is_enabled: asBoolean(config.isEnabled),
    provider: optional(config.provider),
    account_id: optional(config.accountId),
    card_id: optional(config.cardId),
    allowed_senders: asArray(config.allowedSenders),
    keywords: asArray(config.keywords),
    external_connection_id: optional(config.externalConnectionId),
    processed_external_ids: asArray(config.processedExternalIds),
    authorized_at: optional(config.authorizedAt),
    last_sync_at: optional(config.lastSyncAt),
    notes: optional(config.notes),
  });
}

function toImportItemRow(item: JsonObject) {
  return ownerRow({
    id: asString(item.id),
    batch_id: asString(item.batchId),
    raw_description: asString(item.rawDescription),
    review_title: optional(item.reviewTitle),
    normalized_description: asString(item.normalizedDescription),
    date: asString(item.date),
    amount: asNumber(item.amount),
    direction: asString(item.direction, "outflow"),
    source_kind: asString(item.sourceKind, "unknown"),
    transport: optional(item.transport),
    payment_method: asString(item.paymentMethod, "unknown"),
    account_id: optional(item.accountId),
    card_id: optional(item.cardId),
    external_item_id: optional(item.externalItemId),
    origin_label: optional(item.originLabel),
    suggested_category_id: optional(item.suggestedCategoryId),
    suggested_transaction_type: optional(item.suggestedTransactionType),
    suggested_match: Object.keys(asObject(item.suggestedMatch)).length ? asObject(item.suggestedMatch) : null,
    applied_learning_rule_id: optional(item.appliedLearningRuleId),
    detected_merchant_id: optional(item.detectedMerchantId),
    statement_month: optional(item.statementMonth),
    confidence: asNumber(item.confidence),
    status: asString(item.status, "pending"),
    confirmed_transaction_id: optional(item.confirmedTransactionId),
    ignored_reason: optional(item.ignoredReason),
    fingerprint: asString(item.fingerprint),
  });
}

function toMonthlyPlanRows(monthlyPlansByMonth: JsonObject) {
  return Object.entries(monthlyPlansByMonth).map(([monthValue, planValue]) => {
    const plan = asObject(planValue);
    return ownerRow({
      id: `monthly-plan-${monthValue}`,
      month_value: monthValue,
      month_label: asString(plan.monthLabel),
      fixed_income_planned: asNumber(plan.fixedIncomePlanned),
      variable_income_planned: asNumber(plan.variableIncomePlanned),
      fixed_expenses_planned: asNumber(plan.fixedExpensesPlanned),
      variable_expenses_planned: asNumber(plan.variableExpensesPlanned),
      debt_target: asNumber(plan.debtTarget),
      investment_target: asNumber(plan.investmentTarget),
      extra_income_goal: asNumber(plan.extraIncomeGoal),
    });
  });
}

function toMonthlyBudgetRows(monthlyPlansByMonth: JsonObject) {
  return Object.entries(monthlyPlansByMonth).flatMap(([monthValue, planValue]) =>
    asJsonArray(asObject(planValue).categoryBudgets).map((budget) =>
      ownerRow({
        id: `monthly-budget-${monthValue}-${asString(budget.id)}`,
        monthly_plan_id: `monthly-plan-${monthValue}`,
        budget_key: asString(budget.id),
        name: asString(budget.name),
        kind: asString(budget.kind, "expense"),
        planned: asNumber(budget.planned),
      }),
    ),
  );
}

function toReserveGoalRows(monthlyPlansByMonth: JsonObject) {
  return Object.entries(monthlyPlansByMonth).flatMap(([monthValue, planValue]) =>
    asJsonArray(asObject(planValue).reserveGoals).map((goal) =>
      ownerRow({
        id: `monthly-reserve-${monthValue}-${asString(goal.id)}`,
        monthly_plan_id: `monthly-plan-${monthValue}`,
        goal_key: asString(goal.id),
        name: asString(goal.name),
        target: asNumber(goal.target),
        current: asNumber(goal.current),
        deadline: asString(goal.deadline),
        priority: asString(goal.priority),
      }),
    ),
  );
}

function toSettingsRow(settings: JsonObject) {
  return {
    owner_key: OWNER_KEY,
    fixed_salary_expected: asNumber(settings.fixedSalaryExpected),
    monthly_investment_target: asNumber(settings.monthlyInvestmentTarget),
    monthly_debt_payment_cap: asNumber(settings.monthlyDebtPaymentCap),
    bank_presets: Array.isArray(settings.bankPresets) ? settings.bankPresets : [],
    default_account_id: optional(settings.defaultAccountId),
    default_card_id: optional(settings.defaultCardId),
    week_start_day: asNumber(settings.weekStartDay, 1),
    extra_income_goal: asNumber(settings.extraIncomeGoal),
    default_bill_payment_method: optional(settings.defaultBillPaymentMethod),
  };
}

function asJsonArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(asObject).filter((item) => Object.keys(item).length > 0) : [];
}

function dedupeRows(rows: JsonObject[]) {
  return Array.from(new Map(rows.map((row) => [asString(row.id), row])).values());
}

function collectionCount(state: JsonObject | null, key: string) {
  if (!state) {
    return 0;
  }

  const value = state[key];
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length;
  }

  return 0;
}

function validateSnapshotAgainstBackup(state: JsonObject, backupState: JsonObject | null) {
  const requiredArrayKeys = [
    "accounts",
    "cards",
    "transactions",
    "bills",
    "categories",
    "debts",
    "fixedEntries",
    "plannedPurchases",
    "investments",
    "importedStatementBatches",
    "importedStatementItems",
    "importLearningRules",
    "importMerchants",
    "importAutomationConfigs",
  ];

  const missingKeys = requiredArrayKeys.filter((key) => !Array.isArray(state[key]));
  if (missingKeys.length) {
    throw new Error(`Relational snapshot is missing required collections: ${missingKeys.join(", ")}`);
  }

  if (!state.cardBillEstimates || typeof state.cardBillEstimates !== "object" || Array.isArray(state.cardBillEstimates)) {
    throw new Error("Relational snapshot is missing cardBillEstimates.");
  }

  if (!state.monthlyPlansByMonth || typeof state.monthlyPlansByMonth !== "object" || Array.isArray(state.monthlyPlansByMonth)) {
    throw new Error("Relational snapshot is missing monthlyPlansByMonth.");
  }

  if (!backupState) {
    return;
  }

  const protectedKeys = [
    "accounts",
    "cards",
    "transactions",
    "bills",
    "fixedEntries",
    "debts",
    "plannedPurchases",
    "importedStatementItems",
    "cardBillEstimates",
    "monthlyPlansByMonth",
  ];
  const dangerousDrops = protectedKeys
    .map((key) => ({
      key,
      backupCount: collectionCount(backupState, key),
      incomingCount: collectionCount(state, key),
    }))
    .filter(({ backupCount, incomingCount }) => backupCount >= 3 && incomingCount < Math.floor(backupCount * 0.7));

  if (dangerousDrops.length > 1) {
    throw new Error(
      `Relational snapshot rejected because it looks incomplete: ${dangerousDrops
        .map(({ key, backupCount, incomingCount }) => `${key} ${incomingCount}/${backupCount}`)
        .join(", ")}`,
    );
  }
}

export async function saveRelationalFinanceState(config: SupabaseRestConfig, stateValue: unknown, signal: AbortSignal) {
  const state = asObject(stateValue);
  const backupState = await fetchBackupAppState(config, signal);
  validateSnapshotAgainstBackup(state, backupState);

  const investments = asJsonArray(state.investments);
  const monthlyPlansByMonth = asObject(state.monthlyPlansByMonth);
  const categoryRows = dedupeRows([
    ...asJsonArray(state.categories).map(toCategoryRow),
    ...buildReferencedCategoryRows(state),
  ]).map((row) => ({ ...row, parent_id: null }));

  const deleteOrder = [
    "monex_settings",
    "monex_reserve_goals",
    "monex_monthly_plan_category_budgets",
    "monex_monthly_plans",
    "monex_imported_statement_items",
    "monex_import_automation_configs",
    "monex_import_learning_rules",
    "monex_import_merchants",
    "monex_imported_statement_batches",
    "monex_card_bill_estimates",
    "monex_investment_contributions",
    "monex_fixed_flow_entries",
    "monex_debts",
    "monex_transactions",
    "monex_bills",
    "monex_planned_purchases",
    "monex_investments",
    "monex_transaction_groups",
    "monex_cards",
    "monex_categories",
    "monex_accounts",
  ];

  for (const table of deleteOrder) {
    await deleteOwnerRows(config, table, signal);
  }

  await insertRows(config, "monex_accounts", asJsonArray(state.accounts).map(toAccountRow), signal);
  await insertRows(config, "monex_cards", asJsonArray(state.cards).map(toCardRow), signal);
  await insertRows(config, "monex_categories", categoryRows, signal);
  await insertRows(config, "monex_transaction_groups", asJsonArray(state.transactionGroups).map(toTransactionGroupRow), signal);
  await insertRows(config, "monex_bills", asJsonArray(state.bills).map(toBillRow), signal);
  await insertRows(config, "monex_planned_purchases", asJsonArray(state.plannedPurchases).map(toPlannedPurchaseRow), signal);
  await insertRows(config, "monex_transactions", asJsonArray(state.transactions).map(toTransactionRow), signal);
  await insertRows(config, "monex_debts", asJsonArray(state.debts).map(toDebtRow), signal);
  await insertRows(config, "monex_fixed_flow_entries", asJsonArray(state.fixedEntries).map(toFixedEntryRow), signal);
  await insertRows(config, "monex_investments", investments.map(toInvestmentRow), signal);
  await insertRows(config, "monex_investment_contributions", toInvestmentContributionRows(investments), signal);
  await insertRows(config, "monex_card_bill_estimates", toCardBillEstimateRows(asObject(state.cardBillEstimates)), signal);
  await insertRows(config, "monex_imported_statement_batches", asJsonArray(state.importedStatementBatches).map(toImportBatchRow), signal);
  await insertRows(config, "monex_import_merchants", asJsonArray(state.importMerchants).map(toMerchantRow), signal);
  await insertRows(config, "monex_import_learning_rules", asJsonArray(state.importLearningRules).map(toLearningRuleRow), signal);
  await insertRows(config, "monex_import_automation_configs", asJsonArray(state.importAutomationConfigs).map(toAutomationConfigRow), signal);
  await insertRows(config, "monex_imported_statement_items", asJsonArray(state.importedStatementItems).map(toImportItemRow), signal);
  await insertRows(config, "monex_monthly_plans", toMonthlyPlanRows(monthlyPlansByMonth), signal);
  await insertRows(config, "monex_monthly_plan_category_budgets", toMonthlyBudgetRows(monthlyPlansByMonth), signal);
  await insertRows(config, "monex_reserve_goals", toReserveGoalRows(monthlyPlansByMonth), signal);
  await insertRows(config, "monex_settings", [toSettingsRow(asObject(state.settings))], signal);

  return { updatedAt: new Date().toISOString() };
}
