import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLegalDocumentByRoute } from "@/lib/legal/legal-service";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const doc = getLegalDocumentByRoute("/accessibility");
  if (!doc) return { title: "Accessibility Commitment — AI Tathastu" };
  return {
    title: `${doc.title} — AI Tathastu Legal & Trust Center`,
    description: doc.meta.description,
  };
}

export default function AccessibilityPage() {
  const doc = getLegalDocumentByRoute("/accessibility");
  if (!doc) notFound();
  return <LegalPageShell doc={doc} />;
}
