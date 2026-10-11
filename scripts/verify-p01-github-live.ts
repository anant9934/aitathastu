import { fetchGitHubIntelligence } from "../lib/connectors/github/client";

async function main() {
  const username = process.argv[2];
  if (!username) throw new Error("Provide the authorized public GitHub username");
  const result = await fetchGitHubIntelligence(username, {
    maxReposToDiscover: 60,
    maxReposToDeepInspect: 3,
  });
  console.log(JSON.stringify({
    success: result.success,
    source: result.source,
    username: result.username,
    profileId: result.profile?.id,
    publicRepos: result.totalPublicRepos,
    fetched: result.fetchedReposCount,
    analyzed: result.analyzedReposCount,
    complete: result.isComplete,
    projectLinks: result.projects.map((project) => project.repositoryUrl),
    projectTechnologies: result.projects.map((project) => ({
      url: project.repositoryUrl,
      technologies: project.technologies,
      evidence: project.technologyFindings.map((finding) => finding.provenance),
    })),
    error: result.error,
  }, null, 2));
  if (!result.success || result.source !== "api") process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
