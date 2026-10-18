import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLegalDocumentByRoute } from "@/lib/legal/legal-service";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const doc = getLegalDocumentByRoute("/privacy/digital-sources");
  if (!doc) return { title: "Digital Sources Notice — AI Tathastu" };
  return {
    title: `${doc.title} — AI Tathastu Legal & Trust Center`,
    description: doc.meta.description,
  };
}

export default function DigitalSourcesPage() {
  const doc = getLegalDocumentByRoute("/privacy/digital-sources");
  if (!doc) notFound();
  return <LegalPageShell doc={doc} />;
}
