import { ExactScreensContainer } from "@/components/exact-screens/ExactScreensContainer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tathastu — You imagine. AI makes it happen.",
  description: "An intelligent platform that understands your journey, connects your skills, projects and achievements, and opens doors to real opportunities.",
};

export default function Home() {
  return <ExactScreensContainer initialScreen={1} isGalleryMode={false} />;
}
