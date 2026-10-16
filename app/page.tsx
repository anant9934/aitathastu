import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: { absolute: "AI Tathastu · One honest picture of what you can do in AI and ML" },
  description: "Turn your CV, GitHub and other profiles into a skills profile where every claim shows its evidence, and see your next step toward the AI/ML role you want.",
};

export default function Home() {
  return <Landing />;
}
