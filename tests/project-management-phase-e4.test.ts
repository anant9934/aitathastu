import test from "node:test";
import assert from "node:assert/strict";
import {
  getProjectsByPersonId,
  getProjectById,
  updateProject,
  deleteProject,
} from "../lib/repositories/project-repository";
import { confirmDiscoveredProject } from "../lib/acquisition/acquisition-service";
import type { ProjectLinkRecord, AiMlDetailsRecord } from "../lib/domain/project-taxonomy";
import { validateProjectUrl } from "../lib/domain/project-taxonomy";
import { createUser } from "../lib/repositories/user-repository";
import { getPerson360 } from "../lib/services/person-360-service";
import { getDb } from "../lib/db";

test("Phase E.4: Complete Project Management, SSRF Defense & Real Data Integrity", async (t) => {
  process.env.PGLITE_IN_MEMORY = "true";
  await getDb();

  // Setup isolated test users
  const studentA = await createUser({
    email: `anant.student.${Date.now()}@example.edu`,
    passwordHash: "hash_123",
    displayName: "Anant Student A",
  });

  const studentB = await createUser({
    email: `unauthorized.student.${Date.now()}@example.edu`,
    passwordHash: "hash_456",
    displayName: "Unauthorized Student B",
  });

  await t.test("1. SSRF URL validator blocks internal IPs, metadata endpoints, and malicious schemes", () => {
    // Valid URLs
    assert.equal(validateProjectUrl("https://github.com/org/ai-app").valid, true);
    assert.equal(validateProjectUrl("https://huggingface.co/models/llama-3").valid, true);
    assert.equal(validateProjectUrl("https://arxiv.org/abs/2301.00001").valid, true);

    // Malicious schemes
    assert.equal(validateProjectUrl("javascript:alert(1)").valid, false);
    assert.equal(validateProjectUrl("file:///etc/passwd").valid, false);
    assert.equal(validateProjectUrl("data:text/html,test").valid, false);

    // SSRF private IP attempts
    assert.equal(validateProjectUrl("http://localhost:3000").valid, false);
    assert.equal(validateProjectUrl("http://127.0.0.1:8000").valid, false);
    assert.equal(validateProjectUrl("http://169.254.169.254/latest/meta-data").valid, false);
    assert.equal(validateProjectUrl("http://10.0.0.1").valid, false);
    assert.equal(validateProjectUrl("http://192.168.1.1").valid, false);
  });

  await t.test("2. Zero Mock Baseline: New user starts with zero projects and zero mock opportunity numbers", async () => {
    const projects = await getProjectsByPersonId(studentA.personId);
    assert.equal(projects.length, 0, "New user must have 0 projects");

    const p360 = await getPerson360(studentA.personId, studentA.personId);
    assert.equal(p360.projects?.length || 0, 0, "Confirmed projects in Person 360 must be genuine 0");
    assert.equal(p360.evidence.length, 0, "Initial evidence count must be genuine 0");
  });

  let savedProjectId = "";

  await t.test("3. Save Project persists multi-link records, AI/ML specs, and structured results", async () => {
    const saved = await confirmDiscoveredProject(studentA.personId, {
      title: "Autonomous RAG Retrieval Engine",
      summary: "Production semantic retrieval engine with hybrid dense-sparse reranking.",
      description: "Implemented custom vector indexing, reciprocal rank fusion, and latency-optimized embedding pipeline.",
      category: "Generative AI",
      purpose: "personal",
      visibility: "public",
      projectType: "software",
      technologies: ["Python", "PyTorch", "FAISS", "FastAPI", "Docker"],
      sources: ["manual", "github"],
      repositoryUrl: "https://github.com/student/autonomous-rag",
      demoUrl: "https://rag-demo.tathastu.ai",
      contributionRoles: ["RAG Pipeline", "Model Development", "Backend"],
      contributionNote: "Personally designed the chunking hierarchy and FAISS IVF-PQ index.",
      links: [
        {
          id: "lnk_1",
          type: "github",
          label: "GitHub Source",
          url: "https://github.com/student/autonomous-rag",
          visibility: "public",
        },
        {
          id: "lnk_2",
          type: "paper",
          label: "Design Whitepaper",
          url: "https://arxiv.org/abs/2301.00001",
          visibility: "public",
        },
        {
          id: "lnk_3",
          type: "dataset",
          label: "Benchmark Dataset",
          url: "https://huggingface.co/datasets/custom-eval",
          visibility: "public",
        },
      ],
      aiDetails: {
        problemStatement: "Off-the-shelf vector search produces hallucinated context on domain queries.",
        proposedSolution: "Hybrid reciprocal rank fusion combining BM25 and ColBERT embeddings.",
        dataset: {
          name: "Domain Retrieval QA Split",
          source: "Hugging Face Hub",
          url: "https://huggingface.co/datasets/custom-eval",
          license: "MIT",
        },
        modelFamily: "ColBERT / MiniLM",
        algorithm: "Reciprocal Rank Fusion (RRF)",
        trainingApproach: "Fine-tuned contrastive loss",
        results: [
          {
            id: "m_1",
            metricName: "NDCG@10",
            metricValue: "0.892",
            datasetSplit: "Test Set",
            baseline: "0.741",
          },
          {
            id: "m_2",
            metricName: "P95 Latency",
            metricValue: "18.4ms",
            datasetSplit: "Production Split",
            baseline: "45.0ms",
          },
        ],
        limitations: "Memory footprint scales with IVF centroid count.",
        futureImprovements: "Quantize vectors to 4-bit with PQ product quantization.",
      },
      team: {
        projectStructure: "individual",
      },
      timeline: {
        startDate: "2026-01-15",
        endDate: "2026-03-30",
        institution: "Tathastu AI Labs",
      },
    });

    assert.ok(saved.id, "Saved project must receive a persistent ID");
    savedProjectId = saved.id;

    // Verify database retrieval
    const retrieved = await getProjectById(studentA.personId, saved.id);
    assert.ok(retrieved, "Project must be retrievable from database");
    assert.equal(retrieved.title, "Autonomous RAG Retrieval Engine");
    assert.equal(retrieved.summary, "Production semantic retrieval engine with hybrid dense-sparse reranking.");
    assert.equal(retrieved.category, "Generative AI");
    assert.equal(retrieved.visibility, "public");

    // Verify multi-links
    const savedLinks = (retrieved.links as ProjectLinkRecord[]) || [];
    assert.equal(savedLinks.length, 3, "All 3 links must be saved in jsonb");
    assert.equal(savedLinks[1].label, "Design Whitepaper");
    assert.equal(savedLinks[1].url, "https://arxiv.org/abs/2301.00001");

    // Verify AI/ML specs & structured metrics
    const aiSpecs = (retrieved.aiDetails as AiMlDetailsRecord) || {};
    assert.equal(aiSpecs.modelFamily, "ColBERT / MiniLM");
    assert.equal(aiSpecs.results?.length, 2);
    assert.equal(aiSpecs.results[0].metricName, "NDCG@10");
    assert.equal(aiSpecs.results[0].metricValue, "0.892");

    // Verify personal contribution boundaries
    assert.deepEqual(retrieved.contributionRoles, ["RAG Pipeline", "Model Development", "Backend"]);
    assert.equal(retrieved.contributionNote, "Personally designed the chunking hierarchy and FAISS IVF-PQ index.");
  });

  await t.test("4. Person 360 unifies authoritative project count and creates unverified evidence", async () => {
    const p360 = await getPerson360(studentA.personId, studentA.personId);
    assert.equal(p360.projects?.length || 0, 1, "Person 360 must show exactly 1 confirmed project");

    // Evidence records should exist but MUST be unverified/self-reported
    const projEvidence = p360.evidence.filter((e) => e.category === "project");
    assert.ok(projEvidence.length >= 1, "Project evidence record must be created");
    assert.equal(projEvidence[0].verificationStatus, "self_reported", "Project evidence must remain self_reported until verified");

    // Tech evidence should be registered as unverified, NOT promoted to verified mastery
    const skillEvidence = p360.evidence.filter((e) => e.category === "skill");
    for (const se of skillEvidence) {
      assert.equal(se.verificationStatus, "unverified", "Technologies must NOT be automatically promoted to verified");
    }
  });

  await t.test("5. IDOR & Authorization Protection: Student B cannot view, edit, or delete Student A's project", async () => {
    // Student B attempts to fetch Student A's project
    const forbiddenGet = await getProjectById(studentB.personId, savedProjectId);
    assert.equal(forbiddenGet, null, "User B must not be able to retrieve User A's project");

    // Student B attempts to update Student A's project
    const forbiddenUpdate = await updateProject(studentB.personId, savedProjectId, {
      title: "Hacked Title",
    });
    assert.equal(forbiddenUpdate, null, "User B must not be able to update User A's project");

    // Student B attempts to delete Student A's project
    const forbiddenDelete = await deleteProject(studentB.personId, savedProjectId);
    assert.equal(forbiddenDelete, undefined, "User B must not be able to delete User A's project");

    // Verify project is intact
    const stillIntact = await getProjectById(studentA.personId, savedProjectId);
    assert.ok(stillIntact);
    assert.equal(stillIntact.title, "Autonomous RAG Retrieval Engine");
  });

  await t.test("6. Update Project persists modifications to summary, links, and status", async () => {
    const updated = await updateProject(studentA.personId, savedProjectId, {
      summary: "Updated summary: production RAG engine serving 500k queries/day.",
      status: "completed",
      contributionNote: "Expanded contribution to include production Kubernetes Helm chart deployment.",
    });

    assert.ok(updated);
    assert.equal(updated.summary, "Updated summary: production RAG engine serving 500k queries/day.");
    assert.equal(updated.status, "completed");

    const reloaded = await getProjectById(studentA.personId, savedProjectId);
    assert.equal(reloaded?.contributionNote, "Expanded contribution to include production Kubernetes Helm chart deployment.");
  });

  await t.test("7. Delete Project cleanly removes project and personal contributions", async () => {
    const deleted = await deleteProject(studentA.personId, savedProjectId);
    assert.ok(deleted);
    assert.equal(deleted.id, savedProjectId);

    const reloaded = await getProjectById(studentA.personId, savedProjectId);
    assert.equal(reloaded, null, "Deleted project must no longer exist in database");

    const p360 = await getPerson360(studentA.personId, studentA.personId);
    assert.equal(p360.projects?.length || 0, 0, "Person 360 confirmed project count must return to 0");
  });
});
