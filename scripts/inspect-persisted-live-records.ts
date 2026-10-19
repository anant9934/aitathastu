import { getDb, githubProfiles, githubRepositories, githubCommits, githubPullRequests, githubTechnologies, githubSyncRuns } from "../lib/db";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  const profiles = await db.select().from(githubProfiles);
  console.log("================================================================================");
  console.log("   LIVE DATABASE INSPECTION: PERSISTED GITHUB PROFILES (" + profiles.length + ")");
  console.log("================================================================================");
  for (const p of profiles) {
    console.log({
      id: p.id,
      personId: p.personId,
      githubUserId: p.githubUserId,
      username: p.username,
      displayName: p.displayName,
      publicRepos: p.publicRepos,
      followers: p.followers,
      following: p.following,
      bio: p.bio,
      location: p.location,
      company: p.company,
      hasReadme: Boolean(p.profileReadme),
    });
  }

  const anantRepos = await db.select().from(githubRepositories).where(eq(githubRepositories.ownerLogin, "anant9934"));
  console.log("\n================================================================================");
  console.log("   LIVE DATABASE INSPECTION: ANANT9934 REPOSITORIES (" + anantRepos.length + ")");
  console.log("================================================================================");
  for (const r of anantRepos) {
    console.log(`- ${r.fullName} [stars: ${r.stars}, forks: ${r.forks}, defaultBranch: ${r.defaultBranch}, lang: ${r.primaryLanguage || "None"}, fork: ${r.isFork}, archived: ${r.isArchived}]`);
  }

  const shivamRepos = await db.select().from(githubRepositories).where(eq(githubRepositories.ownerLogin, "shiviiii5165"));
  console.log("\n================================================================================");
  console.log("   LIVE DATABASE INSPECTION: SHIVIIII5165 REPOSITORIES (" + shivamRepos.length + ")");
  console.log("================================================================================");
  for (const r of shivamRepos) {
    console.log(`- ${r.fullName} [stars: ${r.stars}, forks: ${r.forks}, defaultBranch: ${r.defaultBranch}, lang: ${r.primaryLanguage || "None"}, fork: ${r.isFork}, archived: ${r.isArchived}]`);
  }

  const commits = await db.select().from(githubCommits);
  console.log("\n================================================================================");
  console.log("   LIVE DATABASE INSPECTION: COMMITS (" + commits.length + " rows)");
  console.log("================================================================================");
  if (commits.length > 0) {
    console.log("Sample Commits:");
    for (const c of commits.slice(0, 5)) {
      console.log(`- SHA: ${c.sha.slice(0, 7)} | Msg: "${c.message.slice(0, 40)}" | Author: ${c.authorLogin || c.authorName} | Attributed: ${c.isAttributedToCandidate} (${c.attributionMethod}) | Changes: +${c.additions}/-${c.deletions}`);
    }
  }

  const prs = await db.select().from(githubPullRequests);
  console.log("\n================================================================================");
  console.log("   LIVE DATABASE INSPECTION: PULL REQUESTS (" + prs.length + " rows)");
  console.log("================================================================================");
  for (const pr of prs) {
    console.log(`- PR #${pr.number}: "${pr.title}" [${pr.state}] by ${pr.authorLogin} (isCandidate: ${pr.isCandidateAuthor})`);
  }

  const techs = await db.select().from(githubTechnologies);
  console.log("\n================================================================================");
  console.log("   LIVE DATABASE INSPECTION: TECHNOLOGIES (" + techs.length + " rows)");
  console.log("================================================================================");
  const uniqueTechs = [...new Set(techs.map(t => `${t.name} (${t.category}, method: ${t.detectionMethod}, conf: ${t.confidence})`))];
  console.log(uniqueTechs.slice(0, 20).join("\n"));

  const runs = await db.select().from(githubSyncRuns);
  console.log("\n================================================================================");
  console.log("   LIVE DATABASE INSPECTION: SYNC RUNS (" + runs.length + " rows)");
  console.log("================================================================================");
  for (const run of runs) {
    console.log(`- Run ${run.id}: user ${run.username} [status: ${run.status}] | repos: ${run.discoveredReposCount} | commits: ${run.totalCommitsFetched} | trigger: ${run.trigger} | started: ${run.startedAt.toISOString()}`);
  }

  process.exit(0);
}

main().catch(console.error);
