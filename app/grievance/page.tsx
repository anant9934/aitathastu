import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLegalDocumentByRoute } from "@/lib/legal/legal-service";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { DataRightsRequestCard } from "@/components/legal/DataRightsRequestCard";

export async function generateMetadata(): Promise<Metadata> {
  const doc = getLegalDocumentByRoute("/grievance");
  if (!doc) return { title: "Grievance Redressal — AI Tathastu" };
  return {
    title: `${doc.title} — AI Tathastu Legal & Trust Center`,
    description: doc.meta.description,
  };
}

export default function GrievancePage() {
  const doc = getLegalDocumentByRoute("/grievance");
  if (!doc) notFound();

  return (
    <LegalPageShell doc={doc}>
      <DataRightsRequestCard />
    </LegalPageShell>
  );
}
