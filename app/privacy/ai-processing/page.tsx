import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLegalDocumentByRoute } from "@/lib/legal/legal-service";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const doc = getLegalDocumentByRoute("/privacy/ai-processing");
  if (!doc) return { title: "AI Processing Notice — AI Tathastu" };
  return {
    title: `${doc.title} — AI Tathastu Legal & Trust Center`,
    description: doc.meta.description,
  };
}

export default function AiProcessingPage() {
  const doc = getLegalDocumentByRoute("/privacy/ai-processing");
  if (!doc) notFound();
  return <LegalPageShell doc={doc} />;
}
