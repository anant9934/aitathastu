import crypto from "crypto";
import { encryptConnectionToken, decryptConnectionToken, decryptConnectionTokenWithMeta } from "../security/connection-token";
import { coreIngestionReady } from "../security/core-ingestion-gate";
import { fetchGitHubProjects } from "../connectors/github/client";
import { hasRepoMeaningfullyChanged, DiscoveredGitHubProject } from "../connectors/github/mapper";
import {
  saveExternalConnection,
  getExternalConnectionByProvider,
  disconnectConnection,
  createSyncRun,
  completeSyncRun,
  saveSourceSnapshot,
  getLatestSourceSnapshot,
} from "../repositories/connection-repository";

export type GitHubSyncResult = {
  success: boolean;
  syncRunId?: string;
  recordsFetched: number;
  recordsChanged: number;
  projects: DiscoveredGitHubProject[];
  error?: string;
};

export async function connectGitHubAccount(params: {
  personId: string;
  username: string;
  externalAccountId?: string;
  token: string;
  scopes?: string[];
}) {
  const cleanUsername = params.username.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "");

  const connection = await saveExternalConnection({
    personId: params.personId,
    provider: "github",
    externalUsername: cleanUsername,
    externalAccountId: params.externalAccountId,
    profileUrl: `https://github.com/${cleanUsername}`,
    displayName: cleanUsername,
    scopes: params.scopes || [],
    status: "connected",
    metadata: {
      connectedAt: new Date().toISOString(),
      encryptedAccessToken: encryptConnectionToken(params.token, params.personId),
    },
  });

  return connection;
}

export async function disconnectGitHubAccount(personId: string) {
  const connection = await getExternalConnectionByProvider(personId, "github");
  const encrypted = (connection?.metadata as Record<string, unknown> | null)?.encryptedAccessToken;
  let providerRevoked = false;
  if (typeof encrypted === "string" && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    try {
      const token = decryptConnectionToken(encrypted, personId);
      const credential = Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString("base64");
      const response = await fetch(`https://api.github.com/applications/${encodeURIComponent(process.env.GITHUB_CLIENT_ID)}/token`, {
        method: "DELETE",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Basic ${credential}`,
          "Content-Type": "application/json",
          "User-Agent": "AI-Tathastu-App",
        },
        body: JSON.stringify({ access_token: token }),
        signal: AbortSignal.timeout(8_000),
      });
      providerRevoked = response.status === 204;
    } catch {
      // Local access is still removed; the student must revoke the grant in GitHub settings.
    }
  }
  await disconnectConnection(personId, "github");
  return {
    success: true,
    providerRevoked,
    message: providerRevoked
      ? "GitHub access revoked and local connection disconnected."
      : "Local GitHub access removed. Revoke this app in GitHub settings to ensure provider access is removed.",
  };
}

export async function syncGitHubConnection(
  personId: string,
  token?: string
): Promise<GitHubSyncResult> {
  if (!coreIngestionReady()) return { success: false, recordsFetched: 0, recordsChanged: 0, projects: [], error: "GitHub synchronization is unavailable until credential rotation is complete." };
  const connection = await getExternalConnectionByProvider(personId, "github");
  if (!connection) {
    return {
      success: false,
      recordsFetched: 0,
      recordsChanged: 0,
      projects: [],
      error: "GitHub connection not found for this student.",
    };
  }

  if (connection.status === "disconnected") {
    return {
      success: false,
      recordsFetched: 0,
      recordsChanged: 0,
      projects: [],
      error: "GitHub connection is disconnected. Reconnect to resume synchronization.",
    };
  }

  const metadata = (connection.metadata || {}) as Record<string, unknown>;
  let storedToken: string | undefined;
  if (typeof metadata.encryptedAccessToken === "string") {
    try {
      const decrypted = decryptConnectionTokenWithMeta(metadata.encryptedAccessToken, personId);
      storedToken = decrypted.token;
      if (decrypted.keyUsed === "previous") {
        // Transparently re-encrypt with current primary key
        const reencrypted = encryptConnectionToken(decrypted.token, personId);
        await saveExternalConnection({
          personId,
          provider: "github",
          externalUsername: connection.externalUsername,
          profileUrl: connection.profileUrl,
          displayName: connection.displayName || undefined,
          scopes: Array.isArray(connection.scopes) ? (connection.scopes as string[]) : undefined,
          metadata: { ...metadata, encryptedAccessToken: reencrypted },
        }).catch(() => {});
      }
    } catch {
      return {
        success: false,
        recordsFetched: 0,
        recordsChanged: 0,
        projects: [],
        error: "GitHub authorization has expired or was encrypted with a rotated key. Please reconnect GitHub.",
      };
    }
  }
  const authorizedToken = token || storedToken;
  if (!authorizedToken) {
    return { success: false, recordsFetched: 0, recordsChanged: 0, projects: [], error: "Reconnect GitHub to authorize repository sync." };
  }

  // Start SyncRun
  const syncRun = await createSyncRun(connection.id, personId, "github");

  try {
    const fetchResult = await fetchGitHubProjects(connection.externalUsername, authorizedToken);

    if (!fetchResult.success) {
      await completeSyncRun(syncRun.id, {
        status: "failed",
        recordsFetched: 0,
        recordsChanged: 0,
        errorCode: "FETCH_FAILED",
        errorSummary: fetchResult.error || "Failed to fetch repositories from GitHub.",
      });

      return {
        success: false,
        syncRunId: syncRun.id,
        recordsFetched: 0,
        recordsChanged: 0,
        projects: [],
        error: fetchResult.error,
      };
    }

    let recordsChanged = 0;
    const projects = fetchResult.projects;

    for (const project of projects) {
      const sourceRef = project.repositoryUrl;
      const priorSnapshot = await getLatestSourceSnapshot(personId, "github", sourceRef);

      const isChanged = hasRepoMeaningfullyChanged(
        priorSnapshot?.checksum || undefined,
        project.checksum
      );

      if (isChanged) {
        recordsChanged++;
        await saveSourceSnapshot(
          personId,
          "github",
          sourceRef,
          {
            title: project.title,
            description: project.description,
            technologies: project.technologies,
            stars: project.stars,
            isFork: project.isFork,
            isPrivate: project.isPrivate,
            analysisStage: project.analysisStage,
            detectedManifests: project.detectedManifests,
            checksum: project.checksum,
            syncedAt: new Date().toISOString(),
          },
          project.checksum
        );
      }
    }

    // Update connection metadata
    await saveExternalConnection({
      personId,
      provider: "github",
      externalUsername: connection.externalUsername,
      profileUrl: connection.profileUrl,
      status: "connected",
      metadata: {
        ...metadata,
        lastSyncedAt: new Date().toISOString(),
        repositoryCount: projects.length,
        recordsChanged,
      },
    });

    await completeSyncRun(syncRun.id, {
      status: "completed",
      recordsFetched: projects.length,
      recordsChanged,
    });

    return {
      success: true,
      syncRunId: syncRun.id,
      recordsFetched: projects.length,
      recordsChanged,
      projects,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown sync error";
    await completeSyncRun(syncRun.id, {
      status: "failed",
      recordsFetched: 0,
      recordsChanged: 0,
      errorCode: "EXCEPTION",
      errorSummary: errMsg,
    });

    return {
      success: false,
      syncRunId: syncRun.id,
      recordsFetched: 0,
      recordsChanged: 0,
      projects: [],
      error: errMsg,
    };
  }
}

export function verifyGitHubWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const expectedSignature = parts[1];
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");

  const digestBuf = Buffer.from(digest);
  const expectedBuf = Buffer.from(expectedSignature);

  if (digestBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuf, expectedBuf);
}
