import { Suspense } from "react";

import { FinanceApp } from "@/components/finance-app";

export default function ReconciliationPage() {
  return (
    <Suspense fallback={null}>
      <FinanceApp />
    </Suspense>
  );
}
