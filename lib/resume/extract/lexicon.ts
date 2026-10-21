/**
 * Word lists the deterministic CV extractor uses to classify text it has
 * already found. They never create values: a value is extracted only when it
 * appears in the document, and these lists only decide what kind of value it is.
 */

export const TITLE_WORDS = new RegExp(
  "\\b(?:" +
    [
      "developer", "designer", "engineer", "architect", "scientist", "manager", "lead", "founder", "co-?founder",
      "consultant", "specialist", "analyst", "intern", "internship", "student", "researcher", "author", "officer",
      "advisor", "adviser", "assistant", "associate", "director", "coordinator", "chair(?:person)?", "executive", "editor", "president",
      "vice president", "vp", "coo", "ceo", "cto", "cfo", "tutor", "educator", "teacher", "lecturer", "professor",
      "freelancer", "fellow", "instructor", "trainee", "apprentice", "programmer", "administrator", "volunteer",
      "mentor", "head", "representative", "ambassador", "technician", "accountant", "auditor", "clerk", "nurse",
      "doctor", "physician", "pharmacist", "therapist", "counsellor", "counselor", "writer", "journalist", "reporter",
      "photographer", "marketer", "strategist", "recruiter", "supervisor", "operator", "planner", "partner", "principal",
      "owner", "chairman", "chairperson", "secretary", "treasurer", "member", "captain", "convener", "convenor",
      "explainer", "postdoc", "postdoctoral", "intern\\b", "sde", "swe", "devops", "qa", "tester",
    ].join("|") +
    ")\\b",
  "i"
);

/** Words that make a phrase read as an organisation name. */
export const ORG_CUES = new RegExp(
  "\\b(?:" +
    [
      "ltd", "limited", "pvt", "private", "inc", "llc", "llp", "corp", "corporation", "company", "co", "labs?",
      "technologies", "technology", "tech", "systems", "solutions", "software", "services", "consulting",
      "consultants", "bank", "group", "global", "international", "foundation", "trust", "society", "institute",
      "university", "college", "school", "academy", "hospital", "health", "healthcare", "studios?", "media",
      "magazine", "analytics", "fintech", "motors", "industries", "enterprises?", "agency", "partners", "ventures",
      "capital", "networks", "retail", "pharma", "pharmaceuticals", "electronics", "shipyard", "centre", "center",
      "council", "ministry", "department", "government", "organisation", "organization", "ngo", "payments",
      "logistics", "insurance", "infotech", "infosystems", "digital", "innovations", "works", "factory", "bureau",
      "commission", "authority", "board", "association", "club", "committee", "cell", "chapter", "community",
      "laboratory", "observatory", "museum", "gallery", "press", "publications", "news", "times", "airlines",
      "railways", "telecom", "energy", "power", "steel", "cement", "foods", "beverages", "textiles", "automotive",
    ].join("|") +
    ")\\b\\.?",
  "i"
);

/** Legal suffixes that belong to the preceding name when a comma split separates them. */
export const ORG_SUFFIX = /^(?:inc|ltd|llc|llp|plc|corp|co|gmbh|pvt\.?\s*ltd|private limited|limited|s\.?a|ag)\.?$/i;

const INDIAN_CITIES = [
  "mumbai", "bombay", "delhi", "new delhi", "bengaluru", "bangalore", "hyderabad", "chennai", "madras", "kolkata",
  "calcutta", "pune", "ahmedabad", "jaipur", "lucknow", "kanpur", "nagpur", "indore", "bhopal", "patna", "gaya",
  "bodh gaya", "arrah", "arwal", "ranchi", "bhubaneswar", "cuttack", "guwahati", "chandigarh", "mohali", "panchkula",
  "ludhiana", "amritsar", "jalandhar", "phagwara", "patiala", "noida", "greater noida", "gurugram", "gurgaon",
  "faridabad", "ghaziabad", "dehradun", "shimla", "jammu", "srinagar", "varanasi", "allahabad", "prayagraj", "agra",
  "meerut", "surat", "vadodara", "rajkot", "nashik", "aurangabad", "thane", "navi mumbai", "kochi", "cochin",
  "thiruvananthapuram", "trivandrum", "kozhikode", "calicut", "thrissur", "kottayam", "coimbatore", "madurai",
  "tiruchirappalli", "trichy", "salem", "vellore", "mysuru", "mysore", "mangaluru", "mangalore", "hubli", "belgaum",
  "panaji", "panjim", "margao", "mapusa", "vasco da gama", "visakhapatnam", "vizag", "vijayawada", "guntur",
  "warangal", "raipur", "bilaspur", "jamshedpur", "dhanbad", "durgapur", "siliguri", "udaipur", "jodhpur", "kota",
  "ajmer", "gwalior", "jabalpur", "manipal", "kharagpur", "roorkee", "pilani", "vellore", "tirupati", "puducherry",
  "pondicherry", "gandhinagar", "kanyakumari", "goa",
];
const INDIAN_STATES = [
  "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana",
  "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya",
  "mizoram", "nagaland", "odisha", "orissa", "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura",
  "uttar pradesh", "uttarakhand", "west bengal", "delhi ncr", "ncr", "jammu and kashmir", "ladakh",
];
const COUNTRIES = [
  "india", "united states", "usa", "us", "united kingdom", "uk", "england", "scotland", "wales", "ireland", "canada",
  "australia", "new zealand", "germany", "france", "spain", "italy", "netherlands", "belgium", "switzerland",
  "austria", "sweden", "norway", "denmark", "finland", "poland", "portugal", "singapore", "malaysia", "indonesia",
  "thailand", "vietnam", "philippines", "japan", "china", "south korea", "korea", "hong kong", "taiwan", "uae",
  "united arab emirates", "dubai", "saudi arabia", "qatar", "oman", "bahrain", "kuwait", "nepal", "bangladesh",
  "sri lanka", "pakistan", "bhutan", "maldives", "south africa", "nigeria", "kenya", "egypt", "brazil", "mexico",
  "argentina", "chile", "fiji", "israel", "turkey", "russia",
];
const WORLD_CITIES = [
  "london", "manchester", "birmingham", "cambridge", "oxford", "edinburgh", "hinxton", "chichester", "bristol",
  "new york", "san francisco", "seattle", "boston", "chicago", "austin", "los angeles", "rochester", "toronto",
  "vancouver", "sydney", "melbourne", "berlin", "munich", "paris", "amsterdam", "zurich", "stockholm", "dublin",
  "tokyo", "beijing", "shanghai", "abu dhabi", "doha", "riyadh", "kathmandu", "dhaka", "colombo", "suva",
  "el paraiso", "estepona", "madrid", "barcelona", "lisbon",
  "valencia", "seville", "bilbao", "porto", "milan", "rome", "vienna", "prague", "warsaw", "brussels",
  "copenhagen", "oslo", "helsinki", "hamburg", "frankfurt", "lyon", "geneva",
];
const MODES = ["remote", "hybrid", "on-site", "onsite", "work from home", "wfh"];

const PLACES = new Set([...INDIAN_CITIES, ...INDIAN_STATES, ...COUNTRIES, ...WORLD_CITIES, ...MODES]);
const US_STATE = /^(?:[A-Z]{2})$/;

function placeKey(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[.()]/g, "").replace(/\s+/g, " ").trim();
}

const CITY_SET = new Set([...INDIAN_CITIES, ...WORLD_CITIES]);
const STATE_SET = new Set(INDIAN_STATES);
const COUNTRY_SET = new Set(COUNTRIES);

/** What kind of place one comma part names, from the gazetteer; null when unknown. */
export function placeKind(text: string): "city" | "state" | "country" | null {
  const k = placeKey(text);
  if (COUNTRY_SET.has(k) && !CITY_SET.has(k)) return "country";
  if (STATE_SET.has(k) && !CITY_SET.has(k)) return "state";
  if (CITY_SET.has(k)) return "city";
  if (COUNTRY_SET.has(k)) return "country";
  if (STATE_SET.has(k)) return "state";
  return null;
}

/** True when every comma part of `text` is a known place ("Pune, Maharashtra, India", "Remote"). */
export function isLocation(text: string): boolean {
  const parts = text.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length || parts.length > 4) return false;
  return parts.every((p, i) => PLACES.has(placeKey(p)) || (i > 0 && US_STATE.test(p)) || /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/.test(p));
}

/** True when the text starts with or ends with a place, used to split "Org, City". */
export function isPlace(word: string): boolean {
  return PLACES.has(placeKey(word));
}

export const SPOKEN_LANGUAGES = new Set([
  "english", "hindi", "bengali", "bangla", "marathi", "telugu", "tamil", "gujarati", "urdu", "kannada", "odia", "oriya",
  "malayalam", "punjabi", "assamese", "maithili", "bhojpuri", "konkani", "sanskrit", "sindhi", "nepali", "kashmiri",
  "dogri", "manipuri", "santali", "tulu", "rajasthani", "haryanvi", "spanish", "french", "german", "italian",
  "portuguese", "dutch", "russian", "mandarin", "chinese", "cantonese", "japanese", "korean", "arabic", "persian",
  "farsi", "turkish", "greek", "hebrew", "swedish", "norwegian", "danish", "finnish", "polish", "czech", "hungarian",
  "romanian", "ukrainian", "vietnamese", "thai", "indonesian", "malay", "tagalog", "filipino", "swahili", "sinhala",
  "burmese", "khmer", "latin",
]);

export function isSpokenLanguage(token: string): boolean {
  return SPOKEN_LANGUAGES.has(token.normalize("NFKC").toLowerCase().replace(/\s*\(.*\)\s*$/, "").trim());
}

/**
 * Degree / qualification names. Order matters: longer, more specific forms first.
 * "of X" degrees keep the subject ("Master of Social Work") but stop before " in ".
 */
export const DEGREE_RE = new RegExp(
  "(?:" +
    [
      "(?:Bachelor|Master|Doctor)(?:'s|’s)?\\s+of\\s+(?:[A-Z][A-Za-z]+)(?:\\s+(?:and\\s+|&\\s+)?[A-Z][A-Za-z]+){0,2}",
      "(?:Bachelor|Master)(?:'s|’s)?(?:\\s+degree)?",
      "Ph\\.?\\s?D\\.?", "D\\.?\\s?Phil\\.?", "Doctorate", "Post[- ]?doc(?:toral)?",
      "B\\.?\\s?Tech\\.?", "M\\.?\\s?Tech\\.?", "B\\.?\\s?E\\.?(?![a-z])", "M\\.?\\s?E\\.?(?![a-z])",
      "B\\.?\\s?Sc\\.?", "M\\.?\\s?Sc\\.?", "B\\.?\\s?Com\\.?", "M\\.?\\s?Com\\.?", "B\\.?\\s?A\\.?(?![a-z])", "M\\.?\\s?A\\.?(?![a-z])",
      "BCA", "MCA", "BBA", "MBA", "PGDM", "PGDBM", "PG\\s?Diploma", "B\\.?\\s?Des\\.?", "M\\.?\\s?Des\\.?",
      "B\\.?\\s?Arch\\.?", "M\\.?\\s?Arch\\.?", "B\\.?\\s?Pharm\\.?", "M\\.?\\s?Pharm\\.?", "MBBS", "BDS", "LLB", "LLM", "B\\.?\\s?Ed\\.?",
      "M\\.?\\s?Phil\\.?", "MSW", "BFA", "MFA", "BS", "MS", "AB", "BEng", "MEng",
      "IB\\s+Diploma(?:\\s+Programme)?", "Diploma", "Associate(?:'s)?\\s+Degree", "Certificate\\s+Programme",
      "Class\\s*(?:XII|XI|X|12(?:th)?|10(?:th)?)", "(?:XII|X)(?:th)?\\s+(?:Standard|Grade|Class)", "12th", "10th",
      "Higher\\s+Secondary(?:\\s+(?:School\\s+)?Certificate)?", "Senior\\s+Secondary(?:\\s+(?:School\\s+)?Certificate)?",
      "Secondary\\s+School(?:\\s+Certificate)?", "SSC", "HSC", "SSLC", "AISSCE", "AISSE", "ICSE", "ISC",
      "Intermediate", "Matriculation", "High\\s+School(?:\\s+Diploma)?", "A[- ]Levels?", "O[- ]Levels?", "GCSEs?",
    ].join("|") +
    ")",
  ""
);

export const INSTITUTION_RE = /\b(?:university|universit[äé]|college|institute|institution|school|academy|polytechnic|vidyalaya|vidyapeeth|vidyapith|mahavidyalaya|campus|iit|nit|iiit|iim|bits|vit|lpu|dtu|nsut|iisc|iiser|aiims|nift|nid|xlri|tiss)\b/i;

export type SkillCategory = "language" | "framework" | "library" | "tool" | "concept" | "other";

const TAXONOMY: Array<[SkillCategory, string[]]> = [
  ["language", ["python", "java", "javascript", "typescript", "c", "c++", "c#", "go", "golang", "rust", "kotlin", "swift", "scala", "ruby", "php", "r", "matlab", "perl", "bash", "shell", "sql", "html", "css", "dart", "lua", "haskell", "elixir", "julia", "solidity", "assembly", "vba", "unix scripting", "objective-c", "groovy"]],
  ["framework", ["react", "next.js", "angular", "vue", "vue.js", "svelte", "node.js", "express", "express.js", "django", "flask", "fastapi", "spring", "spring boot", "rails", "ruby on rails", "laravel", ".net", "asp.net", "tailwind css", "tailwindcss", "bootstrap", "flutter", "react native", "pytorch", "tensorflow", "keras", "langchain", "llamaindex", "nestjs", "gin", "hibernate", "jquery", "redux"]],
  ["library", ["numpy", "pandas", "scikit-learn", "sklearn", "matplotlib", "seaborn", "opencv", "librosa", "hugging face", "hugging face transformers", "transformers", "spacy", "nltk", "xgboost", "lightgbm", "plotly", "d3.js", "three.js", "prisma"]],
  ["tool", ["git", "github", "gitlab", "docker", "kubernetes", "terraform", "ansible", "jenkins", "aws", "azure", "gcp", "google cloud", "firebase", "supabase", "postgresql", "mysql", "mongodb", "redis", "sqlite", "oracle", "ms sql server", "kafka", "rabbitmq", "elasticsearch", "linux", "postman", "jira", "figma", "sketch", "adobe xd", "framer", "photoshop", "illustrator", "tableau", "power bi", "excel", "ms excel", "word", "powerpoint", "tally", "tally erp 9", "sap", "sap fico", "snowflake", "airflow", "spark", "hadoop", "slurm", "nextflow", "snakemake", "grpc", "graphql", "vercel", "netlify", "canva", "wordpress", "drupal", "joomla", "qdrant", "pinecone", "chromadb", "weaviate", "milvus", "faiss", "sisense", "zoho analytics", "gooddata", "qlik sense", "looker", "metabase", "dbt", "bigquery", "redshift", "databricks", "mlflow", "kubeflow", "sagemaker", "vertex ai", "openai api", "ollama", "raspberry pi", "arduino", "mqtt", "ros", "unity", "unreal engine", "blender", "matlab simulink", "autocad", "solidworks", "eclipse", "intellij", "vs code", "sequel pro", "phpmyadmin", "adobe photoshop", "adobe illustrator", "adobe indesign", "adobe xd", "premiere pro", "after effects", "microsoft office", "powerpoint", "ms sql server", "sql server", "mariadb", "cassandra", "dynamodb", "neo4j", "selenium", "playwright", "cypress", "jest", "pytest", "junit", "postman", "swagger", "nginx", "apache", "heroku", "netlify", "cloudflare"]],
  ["concept", ["machine learning", "deep learning", "artificial intelligence", "natural language processing", "nlp", "computer vision", "data science", "data analytics", "data modeling", "statistics", "regression", "hypothesis testing", "dbms", "operating systems", "computer networks", "data structures", "algorithms", "system design", "microservices", "devops", "ci/cd", "rest apis", "user research", "prototyping", "financial modelling", "financial modeling", "process mapping", "robotics", "generative ai", "llm", "rag"]],
];
const CATEGORY = new Map<string, SkillCategory>(TAXONOMY.flatMap(([c, names]) => names.map((n) => [n, c] as [string, SkillCategory])));

const ALIASES: Record<string, string> = {
  js: "JavaScript", javascript: "JavaScript", ts: "TypeScript", typescript: "TypeScript", nodejs: "Node.js", "node js": "Node.js",
  node: "Node.js", reactjs: "React", "react.js": "React", nextjs: "Next.js", "next js": "Next.js", expressjs: "Express",
  "express.js": "Express", postgres: "PostgreSQL", postgresql: "PostgreSQL", mongo: "MongoDB", k8s: "Kubernetes",
  golang: "Go", tailwindcss: "Tailwind CSS", "tailwind": "Tailwind CSS", sklearn: "scikit-learn", "scikit learn": "scikit-learn",
  "ms excel": "Excel", "microsoft excel": "Excel", "gcp": "Google Cloud", "vuejs": "Vue.js", "vue": "Vue.js",
};

/** Canonical display name for a skill; keeps the document's wording when no alias applies. */
export function canonicalSkill(name: string): string {
  const key = name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  return ALIASES[key] ?? name.trim();
}

export function skillCategory(name: string): SkillCategory {
  const key = name.normalize("NFKC").toLowerCase().trim();
  return CATEGORY.get(key) ?? CATEGORY.get(canonicalSkill(name).toLowerCase()) ?? "other";
}

/** Technology names matched inside project/experience text (never added to the candidate's skills). */
export const KNOWN_TECH = [...new Set(TAXONOMY.flatMap(([, n]) => n))].filter((n) => n.length > 1 || n === "c" || n === "r");

/** Section families: the first family whose pattern matches a heading wins. */
export const SECTION_FAMILIES: Array<[string, RegExp]> = [
  ["references", /^(?:references?|professional references?|referees?|references available on request)$/],
  ["contact", /^(?:contact(?: me| details| info(?:rmation)?)?|personal (?:details|information|info|profile data|particulars)|get in touch|reach me|links|profiles|online (?:profiles|presence)|social(?: links| profiles)?|web presence)$/],
  ["summary", /^(?:summary|profile|professional (?:summary|profile)|career (?:objective|summary|profile)|objective|about(?: me)?|executive summary|personal (?:profile|statement)|hello|hi|introduction|overview|who i am|bio(?:graphy)?)$/],
  ["languages", /^(?:languages?(?: known| spoken| proficiency)?|spoken languages|linguistic (?:skills|proficiency)|language skills)$/],
  ["education", /\b(?:education(?:al)?|academics?|academic (?:background|qualifications?|details|record|profile)|qualifications? academic|what i studied|studies|schooling|degrees?)\b/],
  ["certifications", /\b(?:certifications?|certificates?|licen[cs]es?|credentials|courses?(?! of)|coursework|moocs?|online (?:courses|learning)|trainings? (?:and|&) certifications?)\b/],
  ["volunteering", /\b(?:volunteer(?:ing)?|voluntary|service and outreach|outreach|community (?:service|engagement|work)|social (?:work|service)|ngo)\b/],
  ["awards", /\b(?:awards?|honou?rs?|achievements?|accomplishments?|recognitions?|fellowships?|scholarships?|distinctions?|hackathons?|competitions?|contests?|prizes?)\b/],
  ["publications", /\b(?:publications?|papers?|research (?:papers?|publications?|output)|patents?|books?|conference|journals?|articles?|presentations? and posters?|talks)\b/],
  ["memberships", /\b(?:memberships?|affiliations?|professional (?:bodies|associations?|organi[sz]ations))\b/],
  ["leadership", /\b(?:leadership|positions? of responsibility|por|extra[- ]?curricular|activities|clubs? (?:and|&) societies)\b/],
  ["projects", /\b(?:projects?|portfolio|things i'?ve (?:made|built)|what i'?ve built|case studies|client work|capstone)\b/],
  ["experience", /\b(?:experience|employment|work(?: history)?|career(?: history)?|professional background|internships?|industrial training|training|where i'?ve worked|jobs?|positions? held|research experience|teaching experience|teaching|research and teaching|appointments)\b/],
  ["skills", /\b(?:skills?|toolbox|toolkit|tool kit|tools|tech(?:nical)? stack|technolog(?:y|ies)|competenc(?:y|ies)|proficienc(?:y|ies)|expertise|strengths|programming|relevant languages|qualifications(?: summary)?|software|stack)\b/],
  ["interests", /\b(?:interests?|hobbies|passions|personal interests)\b/],
  ["declaration", /^(?:declaration|undertaking)$/],
];
