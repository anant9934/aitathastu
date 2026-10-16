import { redirect } from "next/navigation";

// The queue lives under the faculty workspace; keep old links working.
export default function VerificationPage() {
  redirect("/faculty/verification");
}
