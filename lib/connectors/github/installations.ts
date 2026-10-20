/**
 * A student's GitHub App installations, stored on their GitHub connection's
 * metadata (JSON, so no schema migration). A personal installation and any
 * number of organisation installations coexist; installing one never replaces
 * another. The legacy single field `githubAppInstallationId` is kept in step
 * (personal installation first) for code that still reads it.
 */
export type StoredInstallation = {
  id: string;
  accountLogin: string | null;
  accountId: string | null;
  accountType: "User" | "Organization" | null;
  repositorySelection: "all" | "selected" | null;
  connectedAt: string;
  revokedAt: string | null;
};

type Meta = Record<string, unknown>;

const isId = (v: unknown): v is string => typeof v === "string" && /^\d+$/.test(v);

/** Every installation on record, including one saved before installations were a list. */
export function installationsOf(meta: Meta | null | undefined): StoredInstallation[] {
  const m = meta || {};
  const list: StoredInstallation[] = Array.isArray(m.githubAppInstallations)
    ? (m.githubAppInstallations as Array<Record<string, unknown>>)
        .filter((i) => i && isId(i.id))
        .map((i) => ({
          id: String(i.id),
          accountLogin: typeof i.accountLogin === "string" ? i.accountLogin : null,
          accountId: i.accountId != null ? String(i.accountId) : null,
          accountType: i.accountType === "Organization" ? "Organization" : i.accountType === "User" ? "User" : null,
          repositorySelection: i.repositorySelection === "all" || i.repositorySelection === "selected" ? i.repositorySelection : null,
          connectedAt: typeof i.connectedAt === "string" ? i.connectedAt : "",
          revokedAt: typeof i.revokedAt === "string" ? i.revokedAt : null,
        }))
    : [];
  if (isId(m.githubAppInstallationId) && !list.some((i) => i.id === m.githubAppInstallationId)) {
    list.push({
      id: m.githubAppInstallationId,
      accountLogin: typeof m.githubAppAccountLogin === "string" ? m.githubAppAccountLogin : null,
      accountId: null,
      accountType: m.githubAppAccountType === "Organization" ? "Organization" : m.githubAppAccountType === "User" ? "User" : null,
      repositorySelection: m.githubAppRepositorySelection === "all" || m.githubAppRepositorySelection === "selected" ? m.githubAppRepositorySelection : null,
      connectedAt: typeof m.githubAppConnectedAt === "string" ? m.githubAppConnectedAt : "",
      revokedAt: typeof m.githubAppRevokedAt === "string" ? m.githubAppRevokedAt : null,
    });
  }
  return list;
}

export const activeInstallations = (meta: Meta | null | undefined) => installationsOf(meta).filter((i) => !i.revokedAt);

/** Legacy single-installation fields, derived from the list (personal installation first). */
function legacyFields(list: StoredInstallation[]): Meta {
  const active = list.filter((i) => !i.revokedAt);
  const primary = active.find((i) => i.accountType === "User") ?? active[0] ?? list[0];
  return {
    githubAppInstallations: list,
    githubAppInstallationId: primary?.id ?? null,
    githubAppAccountLogin: primary?.accountLogin ?? null,
    githubAppAccountType: primary?.accountType ?? null,
    githubAppRepositorySelection: primary?.repositorySelection ?? null,
    // "Revoked" overall only when every installation is gone.
    githubAppRevokedAt: list.length && !active.length ? list.map((i) => i.revokedAt).filter(Boolean).sort().at(-1) ?? null : null,
  };
}

/** Adds or refreshes one installation; others are untouched. Idempotent for a repeated callback. */
export function withInstallation(meta: Meta | null | undefined, inst: Omit<StoredInstallation, "revokedAt" | "connectedAt"> & { connectedAt?: string }): Meta {
  const list = installationsOf(meta).filter((i) => i.id !== inst.id);
  const previous = installationsOf(meta).find((i) => i.id === inst.id);
  list.push({ ...inst, connectedAt: previous?.connectedAt || inst.connectedAt || new Date().toISOString(), revokedAt: null });
  return legacyFields(list);
}

/** Marks one installation revoked (deleted or suspended on GitHub); imported work is untouched. */
export function withInstallationRevoked(meta: Meta | null | undefined, installationId: string, at = new Date().toISOString()): Meta {
  return legacyFields(installationsOf(meta).map((i) => (i.id === installationId ? { ...i, revokedAt: i.revokedAt ?? at } : i)));
}
