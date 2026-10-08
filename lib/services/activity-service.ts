import { getLearningActivitiesByPersonId, getCodingActivitiesByPersonId, getStudentAssessments, getStudentInterviews } from "../repositories/integration-repository";
import { getProjectsByPersonId } from "../repositories/project-repository";
import type { StudentActivity, AssessmentTopicResult, InterviewDimensionResult } from "../domain/integrations";

/**
 * Builds a unified, chronological student activity feed across all ecosystem sources.
 * Sources: study_lpu, padho_code, eris, mentormaze, github, project, event.
 */
export async function getUnifiedStudentActivities(
  personId: string,
  limit: number = 20
): Promise<StudentActivity[]> {
  const [learning, coding, assessments, interviews, projects] = await Promise.all([
    getLearningActivitiesByPersonId(personId).catch(() => []),
    getCodingActivitiesByPersonId(personId).catch(() => []),
    getStudentAssessments(personId).catch(() => []),
    getStudentInterviews(personId).catch(() => []),
    getProjectsByPersonId(personId).catch(() => []),
  ]);

  const activities: StudentActivity[] = [];

  // 1. Study LPU activities
  for (const l of learning) {
    activities.push({
      id: `act_${l.id}`,
      personId,
      source: "study_lpu",
      activityType: l.status === "completed" ? "module_completed" : "module_started",
      title: l.moduleTitle || l.topicTitle || l.courseTitle || "Study LPU Module",
      status: l.status,
      occurredAt: l.completedAt || l.startedAt || l.createdAt,
      sourceReference: l.id,
      linkedSkills: l.topicKey ? [l.topicKey] : [],
      metadata: {
        courseTitle: l.courseTitle,
        durationMinutes: l.durationMinutes,
      },
    });
  }

  // 2. Padho Code activities
  for (const c of coding) {
    activities.push({
      id: `act_${c.id}`,
      personId,
      source: "padho_code",
      activityType: "coding_practice",
      title: `Practice: ${c.topic}`,
      status: c.status,
      occurredAt: c.completedAt || c.createdAt,
      sourceReference: c.id,
      linkedSkills: c.mappedSkills || [],
      metadata: {
        language: c.language,
        difficulty: c.difficulty,
        attempts: c.attempts,
      },
    });
  }

  // 3. ERIS assessments
  for (const a of assessments) {
    const topics = (a.topics || []) as AssessmentTopicResult[];
    activities.push({
      id: `act_${a.id}`,
      personId,
      source: "eris",
      activityType: "assessment_completed",
      title: `Assessment: ${a.assessmentTitle}`,
      status: a.reviewStatus,
      occurredAt: a.completedAt || a.createdAt,
      sourceReference: a.id,
      linkedSkills: topics.map((t) => t.topicLabel),
      metadata: {
        rubricVersion: a.rubricVersion,
        topicsCount: topics.length,
      },
    });
  }

  // 4. MentorMaze interviews
  for (const i of interviews) {
    const dimensions = (i.dimensions || []) as InterviewDimensionResult[];
    activities.push({
      id: `act_${i.id}`,
      personId,
      source: "mentormaze",
      activityType: "interview_completed",
      title: `Interview: ${i.targetRole}`,
      status: i.reviewStatus,
      occurredAt: i.completedAt || i.createdAt,
      sourceReference: i.id,
      linkedSkills: dimensions.map((d) => d.dimensionLabel),
      metadata: {
        rubricVersion: i.rubricVersion,
        dimensionsCount: dimensions.length,
      },
    });
  }

  // 5. Confirmed Projects
  for (const p of projects) {
    activities.push({
      id: `act_${p.id}`,
      personId,
      source: "project",
      activityType: "project_confirmed",
      title: `Project: ${p.title}`,
      status: p.status,
      occurredAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
      sourceReference: p.id,
      linkedSkills: Array.isArray(p.technologies) ? (p.technologies as string[]) : [],
      metadata: {
        repositoryUrl: p.repositoryUrl,
      },
    });
  }

  // Sort descending by occurredAt
  activities.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return activities.slice(0, limit);
}
