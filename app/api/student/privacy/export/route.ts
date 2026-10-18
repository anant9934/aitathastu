import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { DataRightsService } from "@/lib/services/data-rights-service";

export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  try {
    const data = await DataRightsService.exportStudentData(auth.person.id);
    const filename = `ai-tathastu-data-export-${auth.person.id}-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to export data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
