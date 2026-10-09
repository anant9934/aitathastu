import { NextResponse } from "next/server";
import { verifyGitHubWebhookSignature } from "@/lib/services/github-sync-service";
import { getDb, externalConnections } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { mapGitHubRepoToProject, hasRepoMeaningfullyChanged, RawGitHubRepo } from "@/lib/connectors/github/mapper";
import { saveSourceSnapshot, getLatestSourceSnapshot } from "@/lib/repositories/connection-repository";

const PROCESSED_DELIVERIES = new Set<string>();

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-hub-signature-256");
    const eventType = req.headers.get("x-github-event");
    const deliveryId = req.headers.get("x-github-delivery");

    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.length < 32) {
      return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
    }

    const rawBody = await req.text();

    // 1. Signature Verification
    const isValid = verifyGitHubWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    // 2. Event Type Allowlist
    const ALLOWED_EVENTS = ["push", "repository", "ping"];
    if (!eventType || !ALLOWED_EVENTS.includes(eventType)) {
      return NextResponse.json(
        { status: "ignored", message: `Event type "${eventType}" is not processed.` },
        { status: 200 }
      );
    }

    if (eventType === "ping") {
      return NextResponse.json({ status: "pong", message: "Webhook configured successfully." }, { status: 200 });
    }

    // 3. Idempotency Check
    if (deliveryId) {
      if (PROCESSED_DELIVERIES.has(deliveryId)) {
        return NextResponse.json({ status: "ignored", message: "Duplicate delivery ignored." }, { status: 200 });
      }
      PROCESSED_DELIVERIES.add(deliveryId);
    }

    // Parse JSON safely
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Malformed JSON payload." }, { status: 400 });
    }

    const repo = payload.repository as RawGitHubRepo | undefined;
    if (!repo || !repo.name) {
      return NextResponse.json({ status: "ignored", message: "No repository data in payload." }, { status: 200 });
    }

    const ownerLogin = repo.full_name?.split("/")[0] || "";
    if (!ownerLogin) {
      return NextResponse.json({ status: "ignored", message: "Unknown repository owner." }, { status: 200 });
    }

    // 4. Resolve Student Connection
    const db = await getDb();
    const connections = await db
      .select()
      .from(externalConnections)
      .where(
        and(
          eq(externalConnections.provider, "github"),
          eq(externalConnections.externalUsername, ownerLogin)
        )
      )
      .limit(1);

    if (connections.length === 0) {
      return NextResponse.json(
        { status: "ignored", message: "No active connection matches repository owner." },
        { status: 200 }
      );
    }

    const connection = connections[0];
    if (connection.status === "disconnected") {
      return NextResponse.json(
        { status: "ignored", message: "Connection is disconnected." },
        { status: 200 }
      );
    }

    // 5. Change Detection & Source Snapshot Update
    const project = mapGitHubRepoToProject(repo);
    const sourceRef = project.repositoryUrl;
    const priorSnapshot = await getLatestSourceSnapshot(connection.personId, "github", sourceRef);

    const isChanged = hasRepoMeaningfullyChanged(
      priorSnapshot?.checksum || undefined,
      project.checksum
    );

    if (isChanged) {
      await saveSourceSnapshot(
        connection.personId,
        "github",
        sourceRef,
        {
          title: project.title,
          description: project.description,
          technologies: project.technologies,
          stars: project.stars,
          isFork: project.isFork,
          isPrivate: project.isPrivate,
          checksum: project.checksum,
          webhookTriggeredAt: new Date().toISOString(),
        },
        project.checksum
      );
    }

    return NextResponse.json({
      status: "processed",
      meaningfullyChanged: isChanged,
      projectTitle: project.title,
      technologies: project.technologies,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook processing error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
