/**
 * AI TATHASTU — GROUNDED RAG RETRIEVAL ENGINE
 * 
 * Implements deterministic semantic-lexical hybrid retrieval over the
 * Canonical AI/ML Knowledge Base. Prevents hallucination by strictly
 * bounding responses to verified educational and domain references.
 */

import {
  CANONICAL_AIML_KNOWLEDGE_BASE,
  StructuredKnowledgeRecord,
  KnowledgeResource,
} from "./aiml-knowledge-base";

export interface RagRetrievalRequest {
  query: string;
  targetRole?: string;
  evidencedSkills?: string[];
  maxResults?: number;
}

export interface RetrievedKnowledgePacket {
  record: StructuredKnowledgeRecord;
  relevanceScore: number;
  matchedKeywords: string[];
  primaryResource?: KnowledgeResource;
}

export interface RagContextBundle {
  query: string;
  retrievedConcepts: RetrievedKnowledgePacket[];
  formattedContextText: string;
  referencedResources: KnowledgeResource[];
}

/**
 * Normalizes query string into cleaned searchable tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Computes hybrid keyword + domain affinity relevance score.
 */
function computeConceptRelevance(
  concept: StructuredKnowledgeRecord,
  queryTokens: string[],
  targetRole?: string,
  evidencedSkills: string[] = []
): { score: number; matchedKeywords: string[] } {
  let score = 0;
  const matchedKeywords: string[] = [];

  const conceptSearchText = [
    concept.topicName,
    concept.domain,
    concept.shortExplanation,
    ...concept.relatedSkills,
    ...concept.learningObjectives,
  ]
    .join(" ")
    .toLowerCase();

  // 1. Token frequency scoring
  for (const token of queryTokens) {
    if (conceptSearchText.includes(token)) {
      score += 10;
      matchedKeywords.push(token);

      // Exact title match bonus
      if (concept.topicName.toLowerCase().includes(token)) {
        score += 15;
      }
      // Domain match bonus
      if (concept.domain.toLowerCase().includes(token)) {
        score += 12;
      }
    }
  }

  // 2. Target role affinity bonus
  if (targetRole && concept.relatedTargetRoles.some((r) => r.toLowerCase() === targetRole.toLowerCase())) {
    score += 8;
  }

  // 3. Evidenced skill prerequisite bridging bonus
  const hasPrereqEvidenced = concept.prerequisites.some((prereqId) =>
    evidencedSkills.some((s) => s.toLowerCase().includes(prereqId.toLowerCase()))
  );
  if (hasPrereqEvidenced) {
    score += 5;
  }

  return { score, matchedKeywords: Array.from(new Set(matchedKeywords)) };
}

/**
 * Retrieves and ranks top matching knowledge concepts for a query.
 */
export function retrieveKnowledge(request: RagRetrievalRequest): RagContextBundle {
  const queryTokens = tokenize(request.query);
  const maxResults = request.maxResults || 3;

  const scoredPackets: RetrievedKnowledgePacket[] = [];

  for (const concept of CANONICAL_AIML_KNOWLEDGE_BASE) {
    const { score, matchedKeywords } = computeConceptRelevance(
      concept,
      queryTokens,
      request.targetRole,
      request.evidencedSkills
    );

    if (score > 0) {
      scoredPackets.push({
        record: concept,
        relevanceScore: score,
        matchedKeywords,
        primaryResource: concept.resources[0],
      });
    }
  }

  // Rank by descending score
  scoredPackets.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const topPackets = scoredPackets.slice(0, maxResults);

  // If no direct keyword match, return the most fundamental concepts for the target role
  if (topPackets.length === 0 && request.targetRole) {
    const fallbackConcept = CANONICAL_AIML_KNOWLEDGE_BASE.find((c) =>
      c.relatedTargetRoles.includes(request.targetRole!.toLowerCase())
    ) || CANONICAL_AIML_KNOWLEDGE_BASE[0];

    topPackets.push({
      record: fallbackConcept,
      relevanceScore: 5,
      matchedKeywords: ["general_guidance"],
      primaryResource: fallbackConcept.resources[0],
    });
  }

  // Build minimal authorized context text
  const contextLines: string[] = [];
  const referencedResources: KnowledgeResource[] = [];

  for (const packet of topPackets) {
    contextLines.push(
      `[Topic: ${packet.record.topicName} | Domain: ${packet.record.domain}]`
    );
    contextLines.push(`Summary: ${packet.record.shortExplanation}`);
    contextLines.push(
      `Key Objectives: ${packet.record.learningObjectives.slice(0, 2).join("; ")}`
    );
    if (packet.primaryResource) {
      contextLines.push(
        `Verified Reference: ${packet.primaryResource.title} (${packet.primaryResource.url})`
      );
      referencedResources.push(packet.primaryResource);
    }
    contextLines.push("");
  }

  return {
    query: request.query,
    retrievedConcepts: topPackets,
    formattedContextText: contextLines.join("\n").trim(),
    referencedResources,
  };
}
