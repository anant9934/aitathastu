import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLegalDocumentByRoute } from "@/lib/legal/legal-service";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const doc = getLegalDocumentByRoute("/disclaimer");
  if (!doc) return { title: "AI & Educational Disclaimer — AI Tathastu" };
  return {
    title: `${doc.title} — AI Tathastu Legal & Trust Center`,
    description: doc.meta.description,
  };
}

export default function DisclaimerPage() {
  const doc = getLegalDocumentByRoute("/disclaimer");
  if (!doc) notFound();
  return <LegalPageShell doc={doc} />;
}
