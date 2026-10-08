import { ExactScreensContainer } from "@/components/exact-screens/ExactScreensContainer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tathastu — 12 Screens Mockup Gallery",
  description: "Exact 1:1 implementation of the 12 AI Tathastu screens with real data, look, and features.",
};

export default async function ScreensPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; gallery?: string }>;
}) {
  const params = await searchParams;
  const screenParam = params.screen !== undefined ? parseInt(params.screen, 10) : undefined;
  const initialScreen = screenParam !== undefined && !isNaN(screenParam) ? screenParam : 0;
  const isGalleryMode = params.gallery === "true" || (screenParam === undefined && params.gallery !== "false");

  return <ExactScreensContainer initialScreen={initialScreen} isGalleryMode={isGalleryMode} />;
}
