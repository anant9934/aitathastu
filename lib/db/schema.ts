import { pgTable, text, timestamp, boolean, jsonb, uniqueIndex, index, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const persons = pgTable("persons", {
  id: text("id").primaryKey(),
  primaryUserId: text("primary_user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizationMemberships = pgTable("organization_memberships", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  status: text("status").default("active").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const capabilities = pgTable("capabilities", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const roleCapabilities = pgTable("role_capabilities", {
  id: text("id").primaryKey(),
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  capabilityId: text("capability_id").notNull().references(() => capabilities.id, { onDelete: "cascade" }),
});

export const membershipRoles = pgTable("membership_roles", {
  id: text("id").primaryKey(),
  membershipId: text("membership_id").notNull().references(() => organizationMemberships.id, { onDelete: "cascade" }),
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
});

export const personProfiles = pgTable("person_profiles", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull().unique().references(() => persons.id, { onDelete: "cascade" }),
  education: text("education").default("").notNull(),
  experience: text("experience").default("").notNull(),
  headline: text("headline").default(""),
  degree: text("degree").default(""),
  specialization: text("specialization").default(""),
  institution: text("institution").default(""),
  currentYear: text("current_year").default(""),
  semester: text("semester").default(""),
  expectedGraduationYear: integer("expected_graduation_year"),
  location: text("location").default(""),
  placementStatus: text("placement_status").default("preparing"),
  internshipStatus: text("internship_status").default("seeking"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  source: text("source").default("preset").notNull(),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const evidenceItems = pgTable("evidence_items", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  value: text("value").notNull(),
  source: text("source").notNull(),
  verificationStatus: text("verification_status").notNull(),
  sourceReference: text("source_reference"),
  observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
  interpretation: text("interpretation").notNull(),
  whyItMatters: text("why_it_matters").notNull(),
  importKey: text("import_key"),
  verifiedByPersonId: text("verified_by_person_id").references(() => persons.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verificationMethod: text("verification_method"),
  verificationDecisionId: text("verification_decision_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const verificationRequests = pgTable("verification_requests", {
  id: text("id").primaryKey(),
  evidenceId: text("evidence_id").notNull().references(() => evidenceItems.id, { onDelete: "cascade" }),
  requesterPersonId: text("requester_person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  status: text("status").default("pending").notNull(),
  supportingReference: text("supporting_reference"),
  studentNotes: text("student_notes"),
  assignedVerifierPersonId: text("assigned_verifier_person_id").references(() => persons.id, { onDelete: "set null" }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  reviewStartedAt: timestamp("review_started_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const verificationDecisions = pgTable("verification_decisions", {
  id: text("id").primaryKey(),
  verificationRequestId: text("verification_request_id").notNull().references(() => verificationRequests.id, { onDelete: "cascade" }),
  verifierPersonId: text("verifier_person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  reason: text("reason"),
  method: text("method").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const journeyEvents = pgTable("journey_events", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  relatedEntityId: text("related_entity_id"),
  metadata: jsonb("metadata"),
  importKey: text("import_key"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const actionStates = pgTable(
  "action_states",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    recommendationKey: text("recommendation_key").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("person_rec_key_idx").on(table.personId, table.recommendationKey),
  ]
);

export const userPreferences = pgTable("user_preferences", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull().unique().references(() => persons.id, { onDelete: "cascade" }),
  reducedGuidance: boolean("reduced_guidance").default(false).notNull(),
  eoraDismissed: boolean("eora_dismissed").default(false).notNull(),
  primaryPriority: text("primary_priority"),
  secondaryPriorities: jsonb("secondary_priorities"),
  preferenceSource: text("preference_source").default("user_selected"),
  metadata: jsonb("metadata"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const integrationCredentials = pgTable(
  "integration_credentials",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    producer: text("producer").notNull(), // 'eris' | 'ai_interview'
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    status: text("status").default("active").notNull(), // 'active' | 'revoked'
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_int_cred_org_prod").on(table.organizationId, table.producer),
  ]
);

export const integrationIdentityLinks = pgTable(
  "integration_identity_links",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    producer: text("producer").notNull(), // 'eris' | 'ai_interview'
    externalSubjectId: text("external_subject_id").notNull(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_int_id_link_unique").on(table.organizationId, table.producer, table.externalSubjectId),
    index("idx_int_id_link_person").on(table.personId),
  ]
);

export const integrationEvents = pgTable(
  "integration_events",
  {
    id: text("id").primaryKey(),
    producer: text("producer").notNull(), // 'eris' | 'ai_interview'
    producerInstanceId: text("producer_instance_id"),
    eventType: text("event_type").notNull(),
    externalEventId: text("external_event_id").notNull(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => persons.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    payloadVersion: integer("payload_version").default(1).notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    processingStatus: text("processing_status").default("received").notNull(), // 'received' | 'processing' | 'processed' | 'failed' | 'identity_unresolved' | 'rejected'
    errorMessage: text("error_message"),
  },
  (table) => [
    uniqueIndex("idx_int_event_producer_ext").on(table.producer, table.externalEventId),
    index("idx_int_event_status").on(table.processingStatus),
    index("idx_int_event_person").on(table.personId),
  ]
);

export const assessmentAttempts = pgTable(
  "assessment_attempts",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    producerEventId: text("producer_event_id").notNull().references(() => integrationEvents.id, { onDelete: "cascade" }),
    externalAssessmentId: text("external_assessment_id").notNull(),
    assessmentTitle: text("assessment_title").notNull(),
    assessmentType: text("assessment_type").notNull(),
    rubricVersion: text("rubric_version").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    reviewStatus: text("review_status").default("completed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_assess_attempt_person").on(table.personId),
  ]
);

export const assessmentResults = pgTable(
  "assessment_results",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id").notNull().references(() => assessmentAttempts.id, { onDelete: "cascade" }),
    overallResult: text("overall_result"),
    maxResult: text("max_result"),
    resultType: text("result_type").notNull(), // 'score' | 'band' | 'pass_fail' | 'rubric_level'
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_assess_res_attempt").on(table.attemptId),
  ]
);

export const assessmentTopicResults = pgTable(
  "assessment_topic_results",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id").notNull().references(() => assessmentAttempts.id, { onDelete: "cascade" }),
    topicKey: text("topic_key").notNull(),
    topicLabel: text("topic_label").notNull(),
    value: text("value").notNull(),
    maxValue: text("max_value"),
    measurementType: text("measurement_type").notNull(), // 'score' | 'band' | 'pass_fail' | 'rubric_level'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_assess_topic_attempt").on(table.attemptId),
  ]
);

export const interviewSessions = pgTable(
  "interview_sessions",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    producerEventId: text("producer_event_id").notNull().references(() => integrationEvents.id, { onDelete: "cascade" }),
    externalInterviewId: text("external_interview_id").notNull(),
    targetRole: text("target_role").notNull(),
    rubricVersion: text("rubric_version").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    reviewStatus: text("review_status").default("completed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_interview_session_person").on(table.personId),
  ]
);

export const interviewDimensionResults = pgTable(
  "interview_dimension_results",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => interviewSessions.id, { onDelete: "cascade" }),
    dimensionKey: text("dimension_key").notNull(),
    dimensionLabel: text("dimension_label").notNull(),
    value: text("value").notNull(),
    scaleMin: text("scale_min").default("1").notNull(),
    scaleMax: text("scale_max").default("5").notNull(),
    explanation: text("explanation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_interview_dim_session").on(table.sessionId),
  ]
);



export const onboardingDrafts = pgTable("onboarding_drafts", {
  personId: text("person_id").primaryKey().references(() => persons.id, { onDelete: "cascade" }),
  draft: jsonb("draft").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const externalConnections = pgTable(
  "external_connections",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'github' | 'linkedin' | 'leetcode' | 'codechef' | 'hackerrank' | 'hackerearth' | 'eris' | 'mentormaze' | 'padho_code' | 'study_lpu'
    externalAccountId: text("external_account_id"),
    externalUsername: text("external_username").notNull(),
    displayName: text("display_name"),
    profileUrl: text("profile_url").notNull(),
    status: text("status").default("connected").notNull(), // 'connected' | 'syncing' | 'needs_attention' | 'reference_only' | 'disconnected' | 'unavailable'
    scopes: jsonb("scopes").default([]),
    metadata: jsonb("metadata"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_ext_conn_person_provider").on(table.personId, table.provider),
    index("idx_ext_conn_person").on(table.personId),
  ]
);

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").default(""),
    description: text("description").default(""),
    category: text("category").default("Other AI/ML"),
    purpose: text("purpose").default("personal"),
    visibility: text("visibility").default("private"),
    projectType: text("project_type").default("software").notNull(), // 'software' | 'hardware' | 'software_hardware' | 'research' | 'other'
    repositoryUrl: text("repository_url"),
    demoUrl: text("demo_url"),
    technologies: jsonb("technologies").default([]).notNull(), // string[]
    sources: jsonb("sources").default([]).notNull(), // string[]: e.g. ['github', 'resume', 'manual']
    status: text("status").default("confirmed").notNull(), // 'idea' | 'planning' | 'in_progress' | 'completed' | 'maintained' | 'archived' | 'confirmed' | 'candidate'
    links: jsonb("links").default([]).notNull(), // ProjectLinkRecord[]
    timeline: jsonb("timeline").default({}).notNull(), // ProjectTimelineRecord
    team: jsonb("team").default({}).notNull(), // { projectStructure, teamName, teamMembers, mentors }
    aiDetails: jsonb("ai_details").default({}).notNull(), // AiMlDetailsRecord
    hardwareDetails: jsonb("hardware_details").default({}).notNull(), // HardwareDetailsRecord
    media: jsonb("media").default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_projects_person").on(table.personId),
  ]
);

export const projectContributions = pgTable(
  "project_contributions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    roles: jsonb("roles").default([]).notNull(), // string[], e.g. ['Machine Learning', 'Backend']
    description: text("description").default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_proj_contrib_project_person").on(table.projectId, table.personId),
    index("idx_proj_contrib_person").on(table.personId),
  ]
);

export const sourceSnapshots = pgTable(
  "source_snapshots",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // 'github' | 'resume' | 'leetcode'
    sourceReference: text("source_reference").notNull(),
    snapshotData: jsonb("snapshot_data").notNull(),
    checksum: text("checksum"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_source_snapshots_person").on(table.personId),
  ]
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id").notNull().references(() => externalConnections.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: text("status").notNull(), // 'queued' | 'running' | 'completed' | 'partial' | 'failed'
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    recordsFetched: integer("records_fetched").default(0).notNull(),
    recordsChanged: integer("records_changed").default(0).notNull(),
    errorCode: text("error_code"),
    errorSummary: text("error_summary"),
  },
  (table) => [
    index("idx_sync_runs_person").on(table.personId),
    index("idx_sync_runs_conn").on(table.connectionId),
  ]
);

export const aiAuditLogs = pgTable(
  "ai_audit_logs",
  {
    id: text("id").primaryKey(),
    personId: text("person_id"),
    task: text("task").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    status: text("status").notNull(), // 'success' | 'error' | 'fallback'
    fallbackUsed: boolean("fallback_used").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_ai_audit_logs_person").on(table.personId),
    index("idx_ai_audit_logs_task").on(table.task),
  ]
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    type: text("type").notNull(), // 'hackathon' | 'competition' | 'workshop' | 'conference' | 'seminar' | 'bootcamp'
    isInternal: boolean("is_internal").default(false).notNull(),
    organizer: text("organizer").notNull(),
    location: text("location").default("Online"),
    isOnline: boolean("is_online").default(true).notNull(),
    registrationStart: timestamp("registration_start", { withTimezone: true }),
    registrationEnd: timestamp("registration_end", { withTimezone: true }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    registrationUrl: text("registration_url"),
    status: text("status").default("upcoming").notNull(), // 'draft' | 'upcoming' | 'open' | 'ongoing' | 'completed' | 'archived'
    skills: jsonb("skills").default([]).notNull(),
    eligibility: text("eligibility").default("Open to all students"),
    description: text("description").default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_events_type").on(table.type),
    index("idx_events_status").on(table.status),
  ]
);

export const eventParticipants = pgTable(
  "event_participants",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    participationRole: text("participation_role").default("participant").notNull(), // 'registered' | 'participant' | 'finalist' | 'winner' | 'organizer' | 'mentor'
    status: text("status").default("registered").notNull(),
    certificateUrl: text("certificate_url"),
    submissionUrl: text("submission_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_event_part_event_person").on(table.eventId, table.personId),
    index("idx_event_part_person").on(table.personId),
  ]
);

// Phase C: Study LPU normalized learning activity records
export const learningActivities = pgTable(
  "learning_activities",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    producerEventId: text("producer_event_id").notNull().references(() => integrationEvents.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("study_lpu"), // 'study_lpu'
    courseId: text("course_id"),
    courseTitle: text("course_title"),
    moduleId: text("module_id"),
    moduleTitle: text("module_title"),
    topicKey: text("topic_key"),
    topicTitle: text("topic_title"),
    status: text("status").notNull(), // 'started' | 'progressed' | 'completed'
    durationMinutes: integer("duration_minutes"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sourceReference: text("source_reference"), // externalEventId for tracing
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_learning_activities_person").on(table.personId),
    index("idx_learning_activities_source").on(table.source),
  ]
);

// Phase C: Padho Code normalized coding practice activity records
export const codingPracticeActivities = pgTable(
  "coding_practice_activities",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    producerEventId: text("producer_event_id").notNull().references(() => integrationEvents.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("padho_code"), // 'padho_code'
    language: text("language"),
    topic: text("topic").notNull(),
    topicKey: text("topic_key").notNull(),
    challengeId: text("challenge_id"),
    difficulty: text("difficulty"), // 'easy' | 'medium' | 'hard'
    status: text("status").notNull(), // 'started' | 'progressed' | 'completed'
    attempts: integer("attempts"),
    mappedSkills: jsonb("mapped_skills").default([]).notNull(), // string[] - deterministic skill mapping
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sourceReference: text("source_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_coding_activities_person").on(table.personId),
    index("idx_coding_activities_topic").on(table.topicKey),
  ]
);

// Core Intelligence V3: Source Processing Jobs
export const sourceProcessingJobs = pgTable(
  "source_processing_jobs",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(), // 'resume' | 'github' | 'portfolio' | 'manual' | 'linkedin'
    stage: text("stage").notNull(), // 'acquire' | 'parse' | 'extract' | 'validate' | 'normalize' | 'merge' | 'review' | 'persist' | 'interpret' | 'plan'
    status: text("status").notNull(), // 'queued' | 'running' | 'completed' | 'failed' | 'retry'
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    modelVersion: text("model_version"),
    resultReference: text("result_reference"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_source_jobs_person").on(table.personId),
    index("idx_source_jobs_status").on(table.status),
  ]
);

// Core Intelligence V3: Adaptive Roadmap Milestones
export const roadmapMilestones = pgTable(
  "roadmap_milestones",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    goalId: text("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    competencyId: text("competency_id").notNull(),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    outcome: text("outcome").default("").notNull(),
    actionType: text("action_type").default("Build").notNull(), // 'Build' | 'Practice' | 'Learn' | 'Verify' | 'Document'
    destinationUrl: text("destination_url").default("/student/projects").notNull(),
    prerequisiteIds: jsonb("prerequisite_ids").default([]).notNull(), // string[]
    completionCriteria: text("completion_criteria").default("").notNull(),
    evidenceRequirement: text("evidence_requirement").default("").notNull(),
    status: text("status").default("pending").notNull(), // 'pending' | 'in_progress' | 'completed' | 'skipped'
    version: integer("version").default(1).notNull(),
    orderIndex: integer("order_index").default(0).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_roadmap_milestones_person_goal").on(table.personId, table.goalId),
    index("idx_roadmap_milestones_status").on(table.status),
  ]
);

// Core Intelligence V3: Person 360 Profile Version History
export const personProfileVersions = pgTable(
  "person_profile_versions",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    changeType: text("change_type").notNull(), // 'onboarding' | 'resume_review' | 'project_confirmed' | 'goal_updated' | 'evidence_added'
    changeSummary: text("change_summary").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_profile_versions_person").on(table.personId),
  ]
);

// Core Intelligence V3: Cross-Source Conflict Registry
export const sourceConflicts = pgTable(
  "source_conflicts",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    field: text("field").notNull(), // e.g. 'education.graduationYear'
    sourceA: text("source_a").notNull(),
    valueA: text("value_a").notNull(),
    observedAtA: timestamp("observed_at_a", { withTimezone: true }),
    sourceB: text("source_b").notNull(),
    valueB: text("value_b").notNull(),
    observedAtB: timestamp("observed_at_b", { withTimezone: true }),
    status: text("status").default("detected").notNull(), // 'detected' | 'resolved' | 'dismissed'
    resolvedValue: text("resolved_value"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_source_conflicts_person").on(table.personId),
    index("idx_source_conflicts_status").on(table.status),
  ]
);

// Core Intelligence V3: Intelligence Artifacts (Versioned interpretations referenced by UI)
export const intelligenceArtifacts = pgTable(
  "intelligence_artifacts",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    artifactType: text("artifact_type").notNull(), // 'project_interpretation' | 'profile_summary' | 'roadmap_explanation' | 'skill_gap_analysis'
    profileVersion: integer("profile_version").default(1).notNull(),
    sourceReferences: jsonb("source_references").default([]).notNull(), // string[]
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_intel_artifacts_person_type").on(table.personId, table.artifactType),
  ]
);

