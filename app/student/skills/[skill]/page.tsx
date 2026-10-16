import type { Metadata } from "next";
import { SkillDetailView } from "@/components/skills/SkillDetailView";

export async function generateMetadata({ params }: { params: Promise<{ skill: string }> }): Promise<Metadata> {
  const { skill } = await params;
  return { title: decodeURIComponent(skill) };
}

export default async function SkillDetailPage({ params }: { params: Promise<{ skill: string }> }) {
  const { skill } = await params;
  return <SkillDetailView skill={decodeURIComponent(skill)} />;
}
