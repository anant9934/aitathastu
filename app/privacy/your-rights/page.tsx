import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLegalDocumentByRoute } from "@/lib/legal/legal-service";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { DataRightsRequestCard } from "@/components/legal/DataRightsRequestCard";

export async function generateMetadata(): Promise<Metadata> {
  const doc = getLegalDocumentByRoute("/privacy/your-rights");
  if (!doc) return { title: "Your Privacy Rights — AI Tathastu" };
  return {
    title: `${doc.title} — AI Tathastu Legal & Trust Center`,
    description: doc.meta.description,
  };
}

export default function YourRightsPage() {
  const doc = getLegalDocumentByRoute("/privacy/your-rights");
  if (!doc) notFound();

  return (
    <LegalPageShell doc={doc}>
      <DataRightsRequestCard />
    </LegalPageShell>
  );
}
