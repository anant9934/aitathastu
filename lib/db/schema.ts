import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, jsonb, uniqueIndex, index, integer, doublePrecision } from "drizzle-orm/pg-core";

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
  bio: text("bio").default(""),
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
}, (table) => [
  // At most one active goal per person, enforced by the database so concurrent
  // onboarding completions cannot each insert one (Task 2.1.7).
  uniqueIndex("uq_goals_one_active").on(table.personId).where(sql`${table.status} = 'active'`),
]);

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
  /** Platform the evidence came from: resume | github | linkedin | leetcode | hackerrank | kaggle | scholar | manual (Task 1.2.2). */
  originSource: text("origin_source"),
  /** 0..1 confidence in the evidence itself (not the skill); null until scored (Task 1.3.1). */
  confidenceScore: doublePrecision("confidence_score"),
  /** False for evidence the student may not edit (faculty-verified, assessment results). */
  editable: boolean("editable").default(true).notNull(),
  /** In the student's verified portfolio / application pack, e.g. a publication (Task 2.5.5). */
  portfolioIncluded: boolean("portfolio_included").default(false).notNull(),
  verifiedByPersonId: text("verified_by_person_id").references(() => persons.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verificationMethod: text("verification_method"),
  verificationDecisionId: text("verification_decision_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Closes the dedupe race in createEvidenceRecord (see migration-sql.ts for rollout).
  uniqueIndex("uq_evidence_person_import_key").on(table.personId, table.importKey),
]);

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
}, (table) => [
  // An import-keyed event exists once per person, even under concurrent writers (Task 2.1.7).
  uniqueIndex("uq_journey_events_import_key").on(table.personId, table.importKey).where(sql`${table.importKey} IS NOT NULL`),
]);

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
  /** Bumped on every write; writers compare-and-swap on it (Task 1.2.4). */
  revision: integer("revision").default(0).notNull(),
  /** Per array field, entry keys added by system writers and the revision they landed in. */
  systemEntries: jsonb("system_entries").default({}).notNull(),
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
    /** normalizeProjectTitle(title): matches the same project across CV, GitHub and manual entry. */
    normalizedTitle: text("normalized_title"),
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
    /** In the student's verified portfolio / application pack (Task 2.5.1). */
    portfolioIncluded: boolean("portfolio_included").default(false).notNull(),
    /** ProjectLedgerMetadata (lib/domain/project-ledger.ts): GitHub stats, highlights, AI summary, preview, edited fields. */
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_projects_person").on(table.personId),
    uniqueIndex("uq_projects_person_normalized_title").on(table.personId, table.normalizedTitle),
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
    personId: text("person_id").references(() => persons.id, { onDelete: "set null" }), // Task 2.6.4
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
    // At most one LinkedIn extraction in flight per student, enforced by the database.
    uniqueIndex("uq_linkedin_extract_inflight").on(table.personId).where(sql`source_id = 'linkedin_extract' AND status IN ('queued', 'processing')`),
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

// Universal Resume Extractor V2.0 Integration Tables
export const resumeDocuments = pgTable(
  "resume_documents",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    filename: text("filename").notNull(),
    fileFormat: text("file_format").notNull(),
    fileSize: integer("file_size").notNull(),
    checksum: text("checksum"),
    status: text("status").default("uploaded").notNull(), // 'uploaded' | 'queued' | 'processing' | 'completed' | 'partial' | 'failed' | 'deleted'
    warnings: jsonb("warnings").default([]).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    extractedProfile: jsonb("extracted_profile"), // Canonical ResumeProfile Schema 2.0
    sectionsPreview: jsonb("sections_preview").default([]).notNull(),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_resume_documents_person").on(table.personId),
    index("idx_resume_documents_status").on(table.status),
    index("idx_resume_documents_checksum").on(table.checksum),
  ]
);

export const resumeDocumentBlobs = pgTable(
  "resume_document_blobs",
  {
    id: text("id").primaryKey(), // matches resume_documents.id
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    mimeType: text("mime_type").notNull(),
    payloadBase64: text("payload_base64").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_resume_blobs_person").on(table.personId),
  ]
);

export const resumeReviewHistory = pgTable(
  "resume_review_history",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull().references(() => resumeDocuments.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    groupKey: text("group_key").notNull(),
    recordId: text("record_id").notNull(),
    fieldKey: text("field_key"),
    action: text("action").notNull(), // 'accept' | 'correct' | 'reject' | 'uncertain' | 'confirm' | 'verify'
    actor: text("actor").notNull(), // 'student' | 'verifier'
    actorPersonId: text("actor_person_id").references(() => persons.id, { onDelete: "set null" }), // Task 2.6.4
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    previousState: text("previous_state"),
    newState: text("new_state").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_resume_review_document").on(table.documentId),
    index("idx_resume_review_person").on(table.personId),
  ]
);

/**
 * One row per CV processing job: what read the document, how well, and what
 * came out. The id is derived from the job, so a retried job updates its row.
 */
export const resumeExtractionRuns = pgTable(
  "resume_extraction_runs",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull().references(() => resumeDocuments.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    jobId: text("job_id").notNull(),
    schemaVersion: text("schema_version").notNull(),
    parserVersion: text("parser_version").notNull(),
    method: text("method").notNull(), // native_pdf | docx | ocr
    textQuality: text("text_quality").notNull(), // good | limited | poor | unreadable
    status: text("status").notNull(), // persisting | completed | failed
    documentChecksum: text("document_checksum"),
    pageCount: integer("page_count").default(1).notNull(),
    recordCount: integer("record_count").default(0).notNull(),
    candidateCount: integer("candidate_count").default(0).notNull(),
    needsReviewCount: integer("needs_review_count").default(0).notNull(),
    llmUsed: boolean("llm_used").default(false).notNull(),
    warnings: jsonb("warnings").default([]).notNull(),
    timings: jsonb("timings").default({}).notNull(),
    errorCode: text("error_code"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_resume_runs_document").on(table.documentId),
    index("idx_resume_runs_person").on(table.personId),
  ]
);

/**
 * Normalised CV records with their evidence and review state. The id is a hash
 * of (person, document, category, record key), so reprocessing the same
 * document updates rows instead of duplicating them, and a row the student
 * confirmed, corrected or rejected is never overwritten by a later run.
 */
export const resumeExtractedRecords = pgTable(
  "resume_extracted_records",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    documentId: text("document_id").notNull().references(() => resumeDocuments.id, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    category: text("category").notNull(),
    recordKey: text("record_key").notNull(),
    candidateId: text("candidate_id"),
    data: jsonb("data").notNull(),
    evidence: jsonb("evidence"),
    review: jsonb("review"),
    provenance: text("provenance").default("deterministic").notNull(),
    reviewStatus: text("review_status").default("pending").notNull(), // pending | confirmed | rejected
    userValue: text("user_value"),
    carriedFromDocumentId: text("carried_from_document_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_resume_records_identity").on(table.personId, table.documentId, table.category, table.recordKey),
    index("idx_resume_records_person").on(table.personId),
    index("idx_resume_records_document").on(table.documentId),
  ]
);

/**
 * One row per sync attempt chain for one (person, source): the idempotency,
 * correlation and dead-letter ledger behind every scraper (Tasks 1.9.1-1.9.4).
 * States follow lib/sync/state-machine.ts.
 */
export const syncOperations = pgTable(
  "sync_operations",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    correlationId: text("correlation_id").notNull(),
    trigger: text("trigger").notNull(), // 'user' | 'scheduler'
    state: text("state").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").notNull(),
    lastErrorCode: text("last_error_code"),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    result: jsonb("result").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_sync_operations_idempotency_key").on(table.idempotencyKey),
    index("idx_sync_operations_person_source").on(table.personId, table.source, table.createdAt),
  ]
);

/** Request-level idempotency for non-sync writes, e.g. CV uploads (Task 1.9.1). */
export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  response: jsonb("response"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ============================================================================
// GITHUB INTELLIGENCE & DATA PERSISTENCE ENGINE SCHEMA
// ============================================================================

export const githubProfiles = pgTable(
  "github_profiles",
  {
    id: text("id").primaryKey(), // e.g. `ghp_${personId}`
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    githubUserId: integer("github_user_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    profileUrl: text("profile_url").notNull(),
    email: text("email"),
    company: text("company"),
    location: text("location"),
    blog: text("blog"),
    twitterUsername: text("twitter_username"),
    publicRepos: integer("public_repos").default(0).notNull(),
    publicGists: integer("public_gists").default(0).notNull(),
    followers: integer("followers").default(0).notNull(),
    following: integer("following").default(0).notNull(),
    githubCreatedAt: timestamp("github_created_at", { withTimezone: true }),
    githubUpdatedAt: timestamp("github_updated_at", { withTimezone: true }),
    profileReadme: text("profile_readme"),
    organizations: jsonb("organizations").default([]).notNull(), // Array<{ login, id, avatarUrl, description }>
    activitySummary: jsonb("activity_summary").default({}).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_github_profiles_person").on(table.personId),
    index("idx_github_profiles_user_id").on(table.githubUserId),
    index("idx_github_profiles_username").on(table.username),
  ]
);

export const githubProfileSnapshots = pgTable(
  "github_profile_snapshots",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    profileId: text("profile_id").notNull().references(() => githubProfiles.id, { onDelete: "cascade" }),
    snapshotData: jsonb("snapshot_data").notNull(),
    metrics: jsonb("metrics").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_gh_prof_snap_person").on(table.personId),
    index("idx_gh_prof_snap_profile").on(table.profileId),
  ]
);

export const githubRepositories = pgTable(
  "github_repositories",
  {
    id: text("id").primaryKey(), // e.g. `ghr_${personId}_${githubRepoId}`
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    githubRepoId: integer("github_repo_id").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    ownerLogin: text("owner_login").notNull(),
    description: text("description"),
    canonicalUrl: text("canonical_url").notNull(),
    homepage: text("homepage"),
    isPrivate: boolean("is_private").default(false).notNull(),
    isFork: boolean("is_fork").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    isTemplate: boolean("is_template").default(false).notNull(),
    isEmpty: boolean("is_empty").default(false).notNull(),
    defaultBranch: text("default_branch").default("main").notNull(),
    primaryLanguage: text("primary_language"),
    languages: jsonb("languages").default({}).notNull(),
    stars: integer("stars").default(0).notNull(),
    forks: integer("forks").default(0).notNull(),
    watchers: integer("watchers").default(0).notNull(),
    openIssues: integer("open_issues").default(0).notNull(),
    diskUsageKb: integer("disk_usage_kb").default(0).notNull(),
    license: text("license"),
    topics: jsonb("topics").default([]).notNull(),
    parentRepo: jsonb("parent_repo"),
    branches: jsonb("branches").default([]).notNull(),
    tags: jsonb("tags").default([]).notNull(),
    workflows: jsonb("workflows").default([]).notNull(),
    fileStructure: jsonb("file_structure").default([]).notNull(),
    manifests: jsonb("manifests").default({}).notNull(),
    readmeContent: text("readme_content"),
    projectClassification: text("project_classification"),
    aiMlCategories: jsonb("ai_ml_categories").default([]).notNull(),
    checksum: text("checksum").notNull(),
    firstCommitAt: timestamp("first_commit_at", { withTimezone: true }),
    lastPushAt: timestamp("last_push_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
    availabilityStatus: text("availability_status").default("available").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_github_repos_person_repo_id").on(table.personId, table.githubRepoId),
    index("idx_github_repos_person").on(table.personId),
    index("idx_github_repos_full_name").on(table.fullName),
  ]
);

export const githubRepositorySnapshots = pgTable(
  "github_repository_snapshots",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").notNull().references(() => githubRepositories.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(),
    forks: integer("forks").notNull(),
    openIssues: integer("open_issues").notNull(),
    description: text("description"),
    defaultBranch: text("default_branch"),
    checksum: text("checksum").notNull(),
    diffSummary: jsonb("diff_summary").default({}).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_gh_repo_snap_person").on(table.personId),
    index("idx_gh_repo_snap_repo").on(table.repositoryId),
  ]
);

export const githubCommits = pgTable(
  "github_commits",
  {
    id: text("id").primaryKey(), // e.g. `ghc_${repositoryId}_${sha}`
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").notNull().references(() => githubRepositories.id, { onDelete: "cascade" }),
    sha: text("sha").notNull(),
    message: text("message").notNull(),
    authorName: text("author_name"),
    authorEmail: text("author_email"),
    authorLogin: text("author_login"),
    authorDate: timestamp("author_date", { withTimezone: true }).notNull(),
    committerName: text("committer_name"),
    committerEmail: text("committer_email"),
    committerLogin: text("committer_login"),
    committerDate: timestamp("committer_date", { withTimezone: true }).notNull(),
    parents: jsonb("parents").default([]).notNull(),
    additions: integer("additions").default(0).notNull(),
    deletions: integer("deletions").default(0).notNull(),
    totalChanges: integer("total_changes").default(0).notNull(),
    isAttributedToCandidate: boolean("is_attributed_to_candidate").default(false).notNull(),
    attributionMethod: text("attribution_method").default("unattributed").notNull(),
    commitUrl: text("commit_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_github_commits_repo_sha").on(table.repositoryId, table.sha),
    index("idx_github_commits_person").on(table.personId),
    index("idx_github_commits_date").on(table.authorDate),
  ]
);

export const githubPullRequests = pgTable(
  "github_pull_requests",
  {
    id: text("id").primaryKey(), // e.g. `ghpr_${repositoryId}_${number}`
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").notNull().references(() => githubRepositories.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    state: text("state").notNull(), // 'open' | 'closed' | 'merged'
    body: text("body"),
    htmlUrl: text("html_url").notNull(),
    authorLogin: text("author_login").notNull(),
    isCandidateAuthor: boolean("is_candidate_author").default(false).notNull(),
    headRef: text("head_ref"),
    baseRef: text("base_ref"),
    merged: boolean("merged").default(false).notNull(),
    mergedAt: timestamp("merged_at", { withTimezone: true }),
    mergedByLogin: text("merged_by_login"),
    reviewCommentsCount: integer("review_comments_count").default(0).notNull(),
    commitsCount: integer("commits_count").default(0).notNull(),
    additions: integer("additions").default(0).notNull(),
    deletions: integer("deletions").default(0).notNull(),
    changedFiles: integer("changed_files").default(0).notNull(),
    labels: jsonb("labels").default([]).notNull(),
    reviews: jsonb("reviews").default([]).notNull(),
    createdAtGitHub: timestamp("created_at_github", { withTimezone: true }).notNull(),
    updatedAtGitHub: timestamp("updated_at_github", { withTimezone: true }).notNull(),
    closedAtGitHub: timestamp("closed_at_github", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_github_prs_repo_number").on(table.repositoryId, table.number),
    index("idx_github_prs_person").on(table.personId),
  ]
);

export const githubIssues = pgTable(
  "github_issues",
  {
    id: text("id").primaryKey(), // e.g. `ghi_${repositoryId}_${number}`
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").notNull().references(() => githubRepositories.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    state: text("state").notNull(), // 'open' | 'closed'
    body: text("body"),
    htmlUrl: text("html_url").notNull(),
    authorLogin: text("author_login").notNull(),
    isCandidateAuthor: boolean("is_candidate_author").default(false).notNull(),
    commentsCount: integer("comments_count").default(0).notNull(),
    labels: jsonb("labels").default([]).notNull(),
    assignees: jsonb("assignees").default([]).notNull(),
    createdAtGitHub: timestamp("created_at_github", { withTimezone: true }).notNull(),
    updatedAtGitHub: timestamp("updated_at_github", { withTimezone: true }).notNull(),
    closedAtGitHub: timestamp("closed_at_github", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_github_issues_repo_number").on(table.repositoryId, table.number),
    index("idx_github_issues_person").on(table.personId),
  ]
);

export const githubReleases = pgTable(
  "github_releases",
  {
    id: text("id").primaryKey(), // e.g. `ghrel_${repositoryId}_${githubReleaseId}`
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").notNull().references(() => githubRepositories.id, { onDelete: "cascade" }),
    githubReleaseId: integer("github_release_id").notNull(),
    tagName: text("tag_name").notNull(),
    name: text("name"),
    body: text("body"),
    htmlUrl: text("html_url").notNull(),
    isPrerelease: boolean("is_prerelease").default(false).notNull(),
    isDraft: boolean("is_draft").default(false).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_github_releases_repo_rel_id").on(table.repositoryId, table.githubReleaseId),
    index("idx_github_releases_person").on(table.personId),
  ]
);

export const githubTechnologies = pgTable(
  "github_technologies",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").notNull().references(() => githubRepositories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(), // 'language' | 'framework' | 'library' | 'database' | 'tool' | 'cloud' | 'ai_ml'
    detectionMethod: text("detection_method").notNull(), // 'manifest_declared' | 'language_stat' | 'readme_documented' | 'file_observed'
    sourceFile: text("source_file"),
    version: text("version"),
    confidence: doublePrecision("confidence").notNull(),
    lastObservedAt: timestamp("last_observed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_github_tech_repo_name_method").on(table.repositoryId, table.name, table.detectionMethod),
    index("idx_github_tech_person").on(table.personId),
    index("idx_github_tech_name").on(table.name),
  ]
);

export const githubResumeMatches = pgTable(
  "github_resume_matches",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").notNull().references(() => githubRepositories.id, { onDelete: "cascade" }),
    resumeProjectId: text("resume_project_id"),
    resumeProjectTitle: text("resume_project_title").notNull(),
    matchScore: doublePrecision("match_score").notNull(),
    matchReasons: jsonb("match_reasons").default([]).notNull(), // string[]
    matchedTechnologies: jsonb("matched_technologies").default([]).notNull(), // string[]
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_github_resume_matches_person_repo_proj").on(table.personId, table.repositoryId, table.resumeProjectTitle),
    index("idx_github_resume_matches_person").on(table.personId),
  ]
);

export const githubSyncRuns = pgTable(
  "github_sync_runs",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    trigger: text("trigger").notNull(), // 'user_refresh' | 'onboarding' | 'scheduled' | 'api'
    status: text("status").notNull(), // 'queued' | 'running' | 'completed' | 'partial' | 'failed'
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    discoveredReposCount: integer("discovered_repos_count").default(0).notNull(),
    processedReposCount: integer("processed_repos_count").default(0).notNull(),
    skippedReposCount: integer("skipped_repos_count").default(0).notNull(),
    failedReposCount: integer("failed_repos_count").default(0).notNull(),
    totalCommitsFetched: integer("total_commits_fetched").default(0).notNull(),
    totalPrsFetched: integer("total_prs_fetched").default(0).notNull(),
    totalIssuesFetched: integer("total_issues_fetched").default(0).notNull(),
    rateLimitRemaining: integer("rate_limit_remaining"),
    rateLimitResetAt: timestamp("rate_limit_reset_at", { withTimezone: true }),
    failedResources: jsonb("failed_resources").default([]).notNull(),
    apiCoverage: jsonb("api_coverage").default({}).notNull(),
    checkpoints: jsonb("checkpoints").default({}).notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_github_sync_runs_person").on(table.personId),
    index("idx_github_sync_runs_status").on(table.status),
  ]
);


// ============================================================================
// LINKEDIN PUBLIC PROFILE (extracted through an approved provider; see
// lib/services/linkedin-extraction-service.ts). One profile row per student and
// one row per extracted record; runs are tracked in source_processing_jobs.
// ============================================================================

export const linkedinProfiles = pgTable(
  "linkedin_profiles",
  {
    id: text("id").primaryKey(), // `lip_${personId}`
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    profileUrl: text("profile_url").notNull(),
    publicIdentifier: text("public_identifier"),
    fullName: text("full_name"),
    headline: text("headline"),
    about: text("about"),
    location: text("location"),
    provider: text("provider").notNull(), // 'apify'
    providerActor: text("provider_actor"),
    normalizationVersion: text("normalization_version").notNull(),
    /** Outcome of the latest run: queued | running | succeeded | partial | failed. */
    extractionStatus: text("extraction_status").notNull(),
    lastJobId: text("last_job_id"),
    lastSuccessfulJobId: text("last_successful_job_id"),
    lastSuccessfulAt: timestamp("last_successful_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("uq_linkedin_profiles_person").on(table.personId)]
);

export const linkedinProfileRecords = pgTable(
  "linkedin_profile_records",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    /** experience | education | skill | language | certification | course | project | publication | volunteering | honor | link */
    kind: text("kind").notNull(),
    /** Deterministic key from normalized source fields (or the provider's own ID), so re-runs upsert. */
    recordKey: text("record_key").notNull(),
    data: jsonb("data").notNull(),
    source: text("source").notNull(), // 'linkedin' | 'website'
    provider: text("provider").notNull(), // 'apify' | 'firecrawl'
    sourceUrl: text("source_url").notNull(),
    providerRecordId: text("provider_record_id"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastJobId: text("last_job_id"),
    /** Set when a later successful run returned this section without this record; never deleted automatically. */
    missingSince: timestamp("missing_since", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_linkedin_records_person_kind_key").on(table.personId, table.kind, table.recordKey),
    index("idx_linkedin_records_person").on(table.personId),
  ]
);
