import type { Metadata } from "next";
import { ConnectionsView } from "@/components/connections/ConnectionsView";

export const metadata: Metadata = { title: "Connections", description: "Your linked accounts and import status." };

export default function ConnectionsPage() {
  return <ConnectionsView />;
}
