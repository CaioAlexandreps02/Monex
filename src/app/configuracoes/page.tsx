import { Suspense } from "react";

import { FinanceApp } from "@/components/finance-app";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <FinanceApp />
    </Suspense>
  );
}
