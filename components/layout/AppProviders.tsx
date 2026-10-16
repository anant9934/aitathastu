"use client";

import React from "react";
import { EoraProvider } from "@/lib/client/eora/provider";
import { AppToaster, ConfirmProvider } from "@/components/ui/Feedback";
import { EoraCompanion } from "@/components/eora/EoraCompanion";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <EoraProvider>
      <ConfirmProvider>
        {children}
        <EoraCompanion />
        <AppToaster />
      </ConfirmProvider>
    </EoraProvider>
  );
}
