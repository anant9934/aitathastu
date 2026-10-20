/** Digital-account connectors offered during onboarding and on /student/connections. */

export type ProviderType = "PUBLIC_API" | "PUBLIC_SCRAPE" | "EXPORT_REQUIRED" | "REFERENCE_ONLY" | "OAUTH_REQUIRED";

export type PlatformGroup = "development" | "professional" | "problem_solving" | "data_ai" | "community" | "research";

export const PLATFORM_GROUPS: Array<{ id: PlatformGroup; name: string; purpose: string }> = [
  { id: "development", name: "Development", purpose: "Code and shipped work: the strongest evidence of what you can build." },
  { id: "professional", name: "Professional", purpose: "Roles, education and certifications." },
  { id: "problem_solving", name: "Problem solving", purpose: "Practice and contest records." },
  { id: "data_ai", name: "Data and AI", purpose: "Models, datasets, notebooks and competitions." },
  { id: "community", name: "Community and writing", purpose: "Answers and articles that show how you explain things." },
  { id: "research", name: "Research", purpose: "Papers and affiliations." },
];

export interface PlatformConfig {
  id: string;
  group: PlatformGroup;
  /** How this source connects, in plain words (shown on the row). */
  method: string;
  name: string;
  /** Two-letter monogram used where we don't ship the brand's own mark. */
  monogram: string;
  placeholder: string;
  type: ProviderType;
  actionLabel: string;
  capability: string;
  supportsExportUpload?: boolean;
  dataCollected: string[];
  guarantees: string[];
}

export const PLATFORMS: PlatformConfig[] = [
  {
    id: "github", group: "development", method: "Username link; sign in to verify; app for private repos", name: "GitHub", monogram: "GH", placeholder: "Username or profile URL, e.g. torvalds", type: "PUBLIC_API",
    actionLabel: "Import public data", capability: "Public repositories; optional selected private repositories",
    dataCollected: ["Public profile and repositories", "Repositories you explicitly select in the GitHub App installation", "README and dependency manifests such as package.json, requirements.txt, pyproject.toml and Dockerfile", "Languages, declared frameworks and likely AI/ML project structures"],
    guarantees: ["Private repositories are accessed only after you install the GitHub App and select repository access.", "GitHub App access is limited to read-only Metadata and Contents permissions.", "No commits are pushed, files changed, or code executed.", "Imported evidence is unverified and waits for your review."],
  },
  {
    id: "linkedin", group: "professional", method: "Profile link, data export, or public-profile extraction", name: "LinkedIn", monogram: "IN", placeholder: "Profile URL or handle, e.g. in/anant-kumar", type: "EXPORT_REQUIRED",
    actionLabel: "Import your export", capability: "Roles and education from your data export", supportsExportUpload: true,
    dataCollected: ["Roles and positions (Positions.csv)", "Degrees and institutions (Education.csv)", "Listed skills (Skills.csv)", "Projects and certifications (Projects.csv)"],
    guarantees: ["We never ask for your LinkedIn password or session.", "The export archive you download from LinkedIn (.zip or .csv) is the most complete source.", "Public-profile extraction runs only if this server has it configured, and only after you ask.", "Every record keeps where it came from, and re-importing never duplicates records."],
  },
  {
    id: "portfolio", group: "development", method: "Website link", name: "Portfolio or website", monogram: "WW", placeholder: "https://your-site.dev", type: "PUBLIC_SCRAPE",
    actionLabel: "Link and import", capability: "Title, project links, frameworks",
    dataCollected: ["Page title, description and author", "Outbound project and demo links", "Detected client-side frameworks"],
    guarantees: ["Private networks and localhost are blocked.", "No JavaScript is run; static HTML only."],
  },
  {
    id: "leetcode", group: "problem_solving", method: "Username link or export", name: "LeetCode", monogram: "LC", placeholder: "Username, e.g. anant99", type: "PUBLIC_API",
    actionLabel: "Link and import", capability: "Problems solved and contest rating", supportsExportUpload: true,
    dataCollected: ["Problems solved by difficulty", "Contest rating and ranking", "Topic tags"],
    guarantees: ["Public profile stats or an export you provide.", "No passwords or session cookies."],
  },
  {
    id: "kaggle", group: "data_ai", method: "Username link or export", name: "Kaggle", monogram: "KG", placeholder: "Username", type: "PUBLIC_API",
    actionLabel: "Link and import", capability: "Tiers, medals and notebooks", supportsExportUpload: true,
    dataCollected: ["Competition, dataset and notebook tiers", "Medals", "Public notebooks"],
    guarantees: ["Public metadata only."],
  },
  {
    id: "huggingface", group: "data_ai", method: "Username link", name: "Hugging Face", monogram: "HF", placeholder: "Handle", type: "PUBLIC_API",
    actionLabel: "Link and import", capability: "Public models and datasets",
    dataCollected: ["Public models and pipelines", "Datasets you authored", "Model tags, tasks and likes"],
    guarantees: ["Official Hugging Face Hub API.", "Public models and datasets only; no tokens or weights."],
  },
  {
    id: "orcid", group: "research", method: "ORCID iD", name: "ORCID", monogram: "ID", placeholder: "0000-0002-1825-0097", type: "PUBLIC_API",
    actionLabel: "Link and import", capability: "Papers and affiliations",
    dataCollected: ["Scholarly works and publications", "DOIs and years", "Research affiliations"],
    guarantees: ["Official ORCID public API.", "Checksum-validated iD; nothing guessed from your name."],
  },
  {
    id: "google_scholar", group: "research", method: "Profile link only", name: "Google Scholar", monogram: "GS", placeholder: "Profile URL or user ID", type: "REFERENCE_ONLY",
    actionLabel: "Link profile", capability: "Profile link; papers matched by DOI",
    dataCollected: ["Your Scholar profile link", "Publications matched through DOI and Crossref"],
    guarantees: ["No automated scraping of Google Scholar.", "Papers are matched through DOI, Crossref or ORCID metadata."],
  },
  {
    id: "hackerrank", group: "problem_solving", method: "Username link or export", name: "HackerRank", monogram: "HR", placeholder: "Username", type: "PUBLIC_API",
    actionLabel: "Link and import", capability: "Skill badges and stars", supportsExportUpload: true,
    dataCollected: ["Skill badges (Python, Problem Solving, SQL)", "Stars and badge levels"],
    guarantees: ["Public badge data or an export you provide."],
  },
  {
    id: "stackoverflow", group: "community", method: "Profile link", name: "Stack Overflow", monogram: "SO", placeholder: "Profile URL or user ID", type: "PUBLIC_API",
    actionLabel: "Link and import", capability: "Reputation and top tags",
    dataCollected: ["Reputation", "Top answer tags", "Badge totals"],
    guarantees: ["Official Stack Exchange API."],
  },
  {
    id: "devto", group: "community", method: "Username link", name: "DEV Community", monogram: "DV", placeholder: "Username", type: "PUBLIC_API",
    actionLabel: "Link and import", capability: "Published articles",
    dataCollected: ["Articles, tags and dates", "Reactions and comment counts"],
    guarantees: ["Official Forem API; public posts only."],
  },
  {
    id: "codechef", group: "problem_solving", method: "Export upload, or link only", name: "CodeChef", monogram: "CC", placeholder: "Handle", type: "EXPORT_REQUIRED",
    actionLabel: "Import your export", capability: "Rating and problems solved", supportsExportUpload: true,
    dataCollected: ["Division, star rating and rank", "Problems solved"],
    guarantees: ["Uses a contest summary you upload, or just links your profile."],
  },
  {
    id: "hackerearth", group: "problem_solving", method: "Export upload, or link only", name: "HackerEarth", monogram: "HE", placeholder: "Handle", type: "EXPORT_REQUIRED",
    actionLabel: "Import your export", capability: "Hackathons and ratings", supportsExportUpload: true,
    dataCollected: ["Hackathon participation and scores", "Ratings"],
    guarantees: ["Uses a practice summary you upload, or just links your profile."],
  },
];

export const platformById = (id: string) => PLATFORMS.find((p) => p.id === id);
