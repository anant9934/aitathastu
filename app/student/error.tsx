"use client";

import { ErrorScreen } from "@/components/system/ErrorScreen";

export default function StudentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} home="/student" />;
}
