import { EcosystemLanding } from "@/components/landing/EcosystemLanding";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tathastu — You imagine. AI makes it happen.",
  description: "Explore the AI Tathastu ecosystem for learning, building, collaboration and growth, with EORA helping you find your next step.",
};

export default function Home() {
  return <EcosystemLanding />;
}
