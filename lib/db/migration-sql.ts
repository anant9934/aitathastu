/**
 * CANONICAL database migrations. This list is the only schema source that
 * runs: `npm run db:migrate` (scripts/migrate.ts) applies it, and dev PGlite
 * applies it on startup. Every statement must be idempotent (IF NOT EXISTS /
 * guarded DO blocks), because the whole list is re-run on every migrate.
 *
 * lib/db/schema.ts is the Drizzle *query* model and must be kept in step by
 * hand: add a column there and append an ALTER TABLE ... ADD COLUMN IF NOT
 * EXISTS here. (The old drizzle-kit output in lib/db/migrations had drifted
 * from both and was removed.)
 *
 * Known gap: several person_id/user_id columns created below have no FOREIGN
 * KEY even though schema.ts declares one (see deleteAccountCompletely in
 * lib/services/guest-cleanup-service.ts). Adding them needs orphan cleanup on
 * production data first.
 */
/**
 * Referential repair (Task 2.6.4). The CREATE TABLE statements above predate
 * the foreign keys declared in lib/db/schema.ts, so these 27 references were
 * never enforced (orphans could pile up and account deletion could not
 * cascade). Each is added NOT VALID (enforced for new rows at once, without
 * failing on old data), orphans are removed (person/org-owned rows) or
 * detached (who-did-it references), then the constraint is validated. The
 * onDelete rule for each comes from schema.ts. Every step is idempotent.
 */
type FkSpec = [table: string, column: string, refTable: string, onDelete: "CASCADE" | "SET NULL"];
const FOREIGN_KEY_REPAIRS: FkSpec[] = [
  ["action_states", "person_id", "persons", "CASCADE"],
  ["ai_audit_logs", "person_id", "persons", "SET NULL"],
  ["assessment_attempts", "organization_id", "organizations", "CASCADE"],
  ["assessment_attempts", "person_id", "persons", "CASCADE"],
  ["evidence_items", "person_id", "persons", "CASCADE"],
  ["evidence_items", "verified_by_person_id", "persons", "SET NULL"],
  ["goals", "person_id", "persons", "CASCADE"],
  ["integration_credentials", "organization_id", "organizations", "CASCADE"],
  ["integration_events", "organization_id", "organizations", "CASCADE"],
  ["integration_events", "person_id", "persons", "CASCADE"],
  ["integration_identity_links", "organization_id", "organizations", "CASCADE"],
  ["integration_identity_links", "person_id", "persons", "CASCADE"],
  ["interview_sessions", "organization_id", "organizations", "CASCADE"],
  ["interview_sessions", "person_id", "persons", "CASCADE"],
  ["journey_events", "person_id", "persons", "CASCADE"],
  ["organization_memberships", "organization_id", "organizations", "CASCADE"],
  ["organization_memberships", "person_id", "persons", "CASCADE"],
  ["person_profiles", "person_id", "persons", "CASCADE"],
  ["resume_review_history", "actor_person_id", "persons", "SET NULL"],
  ["roles", "organization_id", "organizations", "CASCADE"],
  ["sessions", "user_id", "users", "CASCADE"],
  ["user_preferences", "person_id", "persons", "CASCADE"],
  ["verification_decisions", "verifier_person_id", "persons", "CASCADE"],
  ["verification_requests", "assigned_verifier_person_id", "persons", "SET NULL"],
  ["verification_requests", "evidence_id", "evidence_items", "CASCADE"],
  ["verification_requests", "organization_id", "organizations", "CASCADE"],
  ["verification_requests", "requester_person_id", "persons", "CASCADE"],
];
const fkName = (t: string, c: string) => `fk_${t}_${c}`.slice(0, 63);
export const FOREIGN_KEY_REPAIR_STATEMENTS: string[] = FOREIGN_KEY_REPAIRS.flatMap(([t, c, ref, onDelete]) => [
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fkName(t, c)}') THEN ALTER TABLE "${t}" ADD CONSTRAINT "${fkName(t, c)}" FOREIGN KEY ("${c}") REFERENCES "${ref}"("id") ON DELETE ${onDelete} NOT VALID; END IF; END $$;`,
  onDelete === "CASCADE"
    ? `DELETE FROM "${t}" x WHERE x."${c}" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "${ref}" p WHERE p."id" = x."${c}");`
    : `UPDATE "${t}" x SET "${c}" = NULL WHERE x."${c}" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "${ref}" p WHERE p."id" = x."${c}");`,
  `ALTER TABLE "${t}" VALIDATE CONSTRAINT "${fkName(t, c)}";`,
]);

export const MIGRATION_SQL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "action_states" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL,
    "recommendation_key" text NOT NULL,
    "status" text NOT NULL,
    "started_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "capabilities" (
    "id" text PRIMARY KEY NOT NULL,
    "key" text NOT NULL,
    "description" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "capabilities_key_unique" UNIQUE("key")
  );`,
  `CREATE TABLE IF NOT EXISTS "evidence_items" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL,
    "category" text NOT NULL,
    "subject" text NOT NULL,
    "value" text NOT NULL,
    "source" text NOT NULL,
    "verification_status" text NOT NULL,
    "source_reference" text,
    "observed_at" timestamp with time zone DEFAULT now() NOT NULL,
    "interpretation" text NOT NULL,
    "why_it_matters" text NOT NULL,
    "import_key" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "goals" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "source" text DEFAULT 'preset' NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "journey_events" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL,
    "type" text NOT NULL,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "related_entity_id" text,
    "metadata" jsonb,
    "import_key" text,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "organizations" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
  );`,
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" text PRIMARY KEY NOT NULL,
    "email" text NOT NULL,
    "password_hash" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "users_email_unique" UNIQUE("email")
  );`,
  `CREATE TABLE IF NOT EXISTS "persons" (
    "id" text PRIMARY KEY NOT NULL,
    "primary_user_id" text NOT NULL,
    "display_name" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "persons_primary_user_id_unique" UNIQUE("primary_user_id")
  );`,
  `CREATE TABLE IF NOT EXISTS "person_profiles" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL,
    "education" text DEFAULT '' NOT NULL,
    "experience" text DEFAULT '' NOT NULL,
    "headline" text DEFAULT '',
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "person_profiles_person_id_unique" UNIQUE("person_id")
  );`,
  `CREATE TABLE IF NOT EXISTS "organization_memberships" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL,
    "organization_id" text NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "joined_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "roles" (
    "id" text PRIMARY KEY NOT NULL,
    "key" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "organization_id" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "roles_key_unique" UNIQUE("key")
  );`,
  `CREATE TABLE IF NOT EXISTS "membership_roles" (
    "id" text PRIMARY KEY NOT NULL,
    "membership_id" text NOT NULL,
    "role_id" text NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "role_capabilities" (
    "id" text PRIMARY KEY NOT NULL,
    "role_id" text NOT NULL,
    "capability_id" text NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "sessions" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "token" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "sessions_token_unique" UNIQUE("token")
  );`,
  `CREATE TABLE IF NOT EXISTS "user_preferences" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL,
    "reduced_guidance" boolean DEFAULT false NOT NULL,
    "eora_dismissed" boolean DEFAULT false NOT NULL,
    "primary_priority" text,
    "secondary_priorities" jsonb,
    "preference_source" text DEFAULT 'user_selected',
    "metadata" jsonb,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "user_preferences_person_id_unique" UNIQUE("person_id")
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "person_rec_key_idx" ON "action_states" USING btree ("person_id","recommendation_key");`,
  `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "verified_by_person_id" text;`,
  `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone;`,
  `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "verification_method" text;`,
  `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "verification_decision_id" text;`,
  `CREATE TABLE IF NOT EXISTS "verification_requests" (
    "id" text PRIMARY KEY NOT NULL,
    "evidence_id" text NOT NULL,
    "requester_person_id" text NOT NULL,
    "organization_id" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "supporting_reference" text,
    "student_notes" text,
    "assigned_verifier_person_id" text,
    "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
    "review_started_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "verification_decisions" (
    "id" text PRIMARY KEY NOT NULL,
    "verification_request_id" text NOT NULL,
    "verifier_person_id" text NOT NULL,
    "decision" text NOT NULL,
    "reason" text,
    "method" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "integration_credentials" (
    "id" text PRIMARY KEY NOT NULL,
    "organization_id" text NOT NULL,
    "producer" text NOT NULL,
    "key_hash" text NOT NULL,
    "key_prefix" text NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "label" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "revoked_at" timestamp with time zone
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_int_cred_org_prod" ON "integration_credentials" ("organization_id", "producer");`,
  `CREATE TABLE IF NOT EXISTS "integration_identity_links" (
    "id" text PRIMARY KEY NOT NULL,
    "organization_id" text NOT NULL,
    "producer" text NOT NULL,
    "external_subject_id" text NOT NULL,
    "person_id" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_int_id_link_unique" ON "integration_identity_links" ("organization_id", "producer", "external_subject_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_int_id_link_person" ON "integration_identity_links" ("person_id");`,
  `CREATE TABLE IF NOT EXISTS "integration_events" (
    "id" text PRIMARY KEY NOT NULL,
    "producer" text NOT NULL,
    "producer_instance_id" text,
    "event_type" text NOT NULL,
    "external_event_id" text NOT NULL,
    "organization_id" text NOT NULL,
    "person_id" text,
    "occurred_at" timestamp with time zone NOT NULL,
    "payload_version" integer DEFAULT 1 NOT NULL,
    "payload" jsonb NOT NULL,
    "received_at" timestamp with time zone DEFAULT now() NOT NULL,
    "processing_status" text DEFAULT 'received' NOT NULL,
    "error_message" text
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_int_event_producer_ext" ON "integration_events" ("producer", "external_event_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_int_event_status" ON "integration_events" ("processing_status");`,
  `CREATE INDEX IF NOT EXISTS "idx_int_event_person" ON "integration_events" ("person_id");`,
  `CREATE TABLE IF NOT EXISTS "assessment_attempts" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL,
    "organization_id" text NOT NULL,
    "producer_event_id" text NOT NULL,
    "external_assessment_id" text NOT NULL,
    "assessment_title" text NOT NULL,
    "assessment_type" text NOT NULL,
    "rubric_version" text NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone NOT NULL,
    "review_status" text DEFAULT 'completed' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_assess_attempt_person" ON "assessment_attempts" ("person_id");`,
  `CREATE TABLE IF NOT EXISTS "assessment_results" (
    "id" text PRIMARY KEY NOT NULL,
    "attempt_id" text NOT NULL,
    "overall_result" text,
    "max_result" text,
    "result_type" text NOT NULL,
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_assess_res_attempt" ON "assessment_results" ("attempt_id");`,
  `CREATE TABLE IF NOT EXISTS "assessment_topic_results" (
    "id" text PRIMARY KEY NOT NULL,
    "attempt_id" text NOT NULL,
    "topic_key" text NOT NULL,
    "topic_label" text NOT NULL,
    "value" text NOT NULL,
    "max_value" text,
    "measurement_type" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_assess_topic_attempt" ON "assessment_topic_results" ("attempt_id");`,
  `CREATE TABLE IF NOT EXISTS "interview_sessions" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL,
    "organization_id" text NOT NULL,
    "producer_event_id" text NOT NULL,
    "external_interview_id" text NOT NULL,
    "target_role" text NOT NULL,
    "rubric_version" text NOT NULL,
    "completed_at" timestamp with time zone NOT NULL,
    "review_status" text DEFAULT 'completed' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_interview_session_person" ON "interview_sessions" ("person_id");`,
  `CREATE TABLE IF NOT EXISTS "interview_dimension_results" (
    "id" text PRIMARY KEY NOT NULL,
    "session_id" text NOT NULL,
    "dimension_key" text NOT NULL,
    "dimension_label" text NOT NULL,
    "value" text NOT NULL,
    "scale_min" text DEFAULT '1' NOT NULL,
    "scale_max" text DEFAULT '5' NOT NULL,
    "explanation" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_interview_dim_session" ON "interview_dimension_results" ("session_id");`,
  `CREATE TABLE IF NOT EXISTS "onboarding_drafts" ("person_id" text PRIMARY KEY NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE, "draft" jsonb NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);`,
  `ALTER TABLE "person_profiles" ADD COLUMN IF NOT EXISTS "degree" text DEFAULT '';`,
  `ALTER TABLE "person_profiles" ADD COLUMN IF NOT EXISTS "specialization" text DEFAULT '';`,
  `ALTER TABLE "person_profiles" ADD COLUMN IF NOT EXISTS "institution" text DEFAULT '';`,
  `ALTER TABLE "person_profiles" ADD COLUMN IF NOT EXISTS "current_year" text DEFAULT '';`,
  `ALTER TABLE "person_profiles" ADD COLUMN IF NOT EXISTS "semester" text DEFAULT '';`,
  `ALTER TABLE "person_profiles" ADD COLUMN IF NOT EXISTS "expected_graduation_year" integer;`,
  `ALTER TABLE "person_profiles" ADD COLUMN IF NOT EXISTS "location" text DEFAULT '';`,
  `ALTER TABLE "person_profiles" ADD COLUMN IF NOT EXISTS "placement_status" text DEFAULT 'preparing';`,
  `ALTER TABLE "person_profiles" ADD COLUMN IF NOT EXISTS "internship_status" text DEFAULT 'seeking';`,
  // Task 2.2.2: student-written bio, edited in place on /student/profile.
  `ALTER TABLE "person_profiles" ADD COLUMN IF NOT EXISTS "bio" text DEFAULT '';`,
  `CREATE TABLE IF NOT EXISTS "external_connections" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "provider" text NOT NULL,
    "external_username" text NOT NULL,
    "profile_url" text NOT NULL,
    "status" text DEFAULT 'connected' NOT NULL,
    "metadata" jsonb,
    "last_synced_at" timestamp with time zone,
    "disconnected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_ext_conn_person_provider" ON "external_connections" ("person_id", "provider");`,
  `CREATE INDEX IF NOT EXISTS "idx_ext_conn_person" ON "external_connections" ("person_id");`,
  `CREATE TABLE IF NOT EXISTS "projects" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "title" text NOT NULL,
    "description" text DEFAULT '',
    "project_type" text DEFAULT 'software' NOT NULL,
    "repository_url" text,
    "demo_url" text,
    "technologies" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "status" text DEFAULT 'confirmed' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_projects_person" ON "projects" ("person_id");`,
  `CREATE TABLE IF NOT EXISTS "project_contributions" (
    "id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "description" text DEFAULT '',
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_proj_contrib_project_person" ON "project_contributions" ("project_id", "person_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_proj_contrib_person" ON "project_contributions" ("person_id");`,
  `CREATE TABLE IF NOT EXISTS "source_snapshots" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "source" text NOT NULL,
    "source_reference" text NOT NULL,
    "snapshot_data" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_source_snapshots_person" ON "source_snapshots" ("person_id");`,
  `ALTER TABLE "external_connections" ADD COLUMN IF NOT EXISTS "external_account_id" text;`,
  `ALTER TABLE "external_connections" ADD COLUMN IF NOT EXISTS "display_name" text;`,
  `ALTER TABLE "external_connections" ADD COLUMN IF NOT EXISTS "scopes" jsonb DEFAULT '[]'::jsonb;`,
  `ALTER TABLE "external_connections" ADD COLUMN IF NOT EXISTS "disconnected_at" timestamp with time zone;`,
  `ALTER TABLE "source_snapshots" ADD COLUMN IF NOT EXISTS "checksum" text;`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "summary" text DEFAULT '';`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'Other AI/ML';`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "purpose" text DEFAULT 'personal';`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'private';`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "links" jsonb DEFAULT '[]'::jsonb;`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "timeline" jsonb DEFAULT '{}'::jsonb;`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "team" jsonb DEFAULT '{}'::jsonb;`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "ai_details" jsonb DEFAULT '{}'::jsonb;`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "hardware_details" jsonb DEFAULT '{}'::jsonb;`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "media" jsonb DEFAULT '[]'::jsonb;`,
  `ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "primary_priority" text;`,
  `ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "secondary_priorities" jsonb;`,
  `ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "preference_source" text DEFAULT 'user_selected';`,
  `ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "metadata" jsonb;`,
  `ALTER TABLE "external_connections" ADD COLUMN IF NOT EXISTS "external_account_id" text;`,
  `ALTER TABLE "external_connections" ADD COLUMN IF NOT EXISTS "display_name" text;`,
  `ALTER TABLE "external_connections" ADD COLUMN IF NOT EXISTS "scopes" jsonb DEFAULT '[]'::jsonb;`,
  `CREATE TABLE IF NOT EXISTS "sync_runs" (
    "id" text PRIMARY KEY NOT NULL,
    "connection_id" text NOT NULL REFERENCES "external_connections"("id") ON DELETE CASCADE,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "provider" text NOT NULL,
    "status" text NOT NULL,
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone,
    "records_fetched" integer DEFAULT 0 NOT NULL,
    "records_changed" integer DEFAULT 0 NOT NULL,
    "error_code" text,
    "error_summary" text
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_sync_runs_person" ON "sync_runs" ("person_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_sync_runs_conn" ON "sync_runs" ("connection_id");`,
  `CREATE TABLE IF NOT EXISTS "ai_audit_logs" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text,
    "task" text NOT NULL,
    "provider" text NOT NULL,
    "model" text NOT NULL,
    "prompt_version" text NOT NULL,
    "latency_ms" integer DEFAULT 0 NOT NULL,
    "status" text NOT NULL,
    "fallback_used" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_ai_audit_logs_person" ON "ai_audit_logs" ("person_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_ai_audit_logs_task" ON "ai_audit_logs" ("task");`,
  `CREATE TABLE IF NOT EXISTS "events" (
    "id" text PRIMARY KEY NOT NULL,
    "title" text NOT NULL,
    "type" text NOT NULL,
    "is_internal" boolean DEFAULT false NOT NULL,
    "organizer" text NOT NULL,
    "location" text DEFAULT 'Online',
    "is_online" boolean DEFAULT true NOT NULL,
    "registration_start" timestamp with time zone,
    "registration_end" timestamp with time zone,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "registration_url" text,
    "status" text DEFAULT 'upcoming' NOT NULL,
    "skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "eligibility" text DEFAULT 'Open to all students',
    "description" text DEFAULT '',
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_events_type" ON "events" ("type");`,
  `CREATE INDEX IF NOT EXISTS "idx_events_status" ON "events" ("status");`,
  `CREATE TABLE IF NOT EXISTS "event_participants" (
    "id" text PRIMARY KEY NOT NULL,
    "event_id" text NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "participation_role" text DEFAULT 'participant' NOT NULL,
    "status" text DEFAULT 'registered' NOT NULL,
    "certificate_url" text,
    "submission_url" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_event_part_event_person" ON "event_participants" ("event_id", "person_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_event_part_person" ON "event_participants" ("person_id");`,
  // Phase C: Study LPU learning activity table
  `CREATE TABLE IF NOT EXISTS "learning_activities" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "producer_event_id" text NOT NULL REFERENCES "integration_events"("id") ON DELETE CASCADE,
    "source" text NOT NULL DEFAULT 'study_lpu',
    "course_id" text,
    "course_title" text,
    "module_id" text,
    "module_title" text,
    "topic_key" text,
    "topic_title" text,
    "status" text NOT NULL,
    "duration_minutes" integer,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "source_reference" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_learning_activities_person" ON "learning_activities" ("person_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_learning_activities_source" ON "learning_activities" ("source");`,
  // Phase C: Padho Code coding practice activity table
  `CREATE TABLE IF NOT EXISTS "coding_practice_activities" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "producer_event_id" text NOT NULL REFERENCES "integration_events"("id") ON DELETE CASCADE,
    "source" text NOT NULL DEFAULT 'padho_code',
    "language" text,
    "topic" text NOT NULL,
    "topic_key" text NOT NULL,
    "challenge_id" text,
    "difficulty" text,
    "status" text NOT NULL,
    "attempts" integer,
    "mapped_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "completed_at" timestamp with time zone,
    "source_reference" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_coding_activities_person" ON "coding_practice_activities" ("person_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_coding_activities_topic" ON "coding_practice_activities" ("topic_key");`,
  // Core V3: source_processing_jobs
  `CREATE TABLE IF NOT EXISTS "source_processing_jobs" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "source_id" text NOT NULL,
    "stage" text NOT NULL,
    "status" text NOT NULL,
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone,
    "model_version" text,
    "result_reference" text,
    "error_code" text,
    "error_message" text,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_source_jobs_person" ON "source_processing_jobs" ("person_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_source_jobs_status" ON "source_processing_jobs" ("status");`,
  // Core V3: roadmap_milestones
  `CREATE TABLE IF NOT EXISTS "roadmap_milestones" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "goal_id" text NOT NULL REFERENCES "goals"("id") ON DELETE CASCADE,
    "competency_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "outcome" text DEFAULT '' NOT NULL,
    "action_type" text DEFAULT 'Build' NOT NULL,
    "destination_url" text DEFAULT '/student/projects' NOT NULL,
    "prerequisite_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "completion_criteria" text DEFAULT '' NOT NULL,
    "evidence_requirement" text DEFAULT '' NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_roadmap_milestones_person_goal" ON "roadmap_milestones" ("person_id", "goal_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_roadmap_milestones_status" ON "roadmap_milestones" ("status");`,
  // Core V3: person_profile_versions
  `CREATE TABLE IF NOT EXISTS "person_profile_versions" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "version_number" integer NOT NULL,
    "change_type" text NOT NULL,
    "change_summary" text NOT NULL,
    "snapshot" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_profile_versions_person" ON "person_profile_versions" ("person_id");`,
  // Core V3: source_conflicts
  `CREATE TABLE IF NOT EXISTS "source_conflicts" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "field" text NOT NULL,
    "source_a" text NOT NULL,
    "value_a" text NOT NULL,
    "observed_at_a" timestamp with time zone,
    "source_b" text NOT NULL,
    "value_b" text NOT NULL,
    "observed_at_b" timestamp with time zone,
    "status" text DEFAULT 'detected' NOT NULL,
    "resolved_value" text,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_source_conflicts_person" ON "source_conflicts" ("person_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_source_conflicts_status" ON "source_conflicts" ("status");`,
  // Core V3: intelligence_artifacts
  `CREATE TABLE IF NOT EXISTS "intelligence_artifacts" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "artifact_type" text NOT NULL,
    "profile_version" integer DEFAULT 1 NOT NULL,
    "source_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "content" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_intel_artifacts_person_type" ON "intelligence_artifacts" ("person_id", "artifact_type");`,
  // Universal Resume Extractor V2.0 Integration Tables
  `CREATE TABLE IF NOT EXISTS "resume_documents" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "organization_id" text REFERENCES "organizations"("id") ON DELETE SET NULL,
    "filename" text NOT NULL,
    "file_format" text NOT NULL,
    "file_size" integer NOT NULL,
    "checksum" text,
    "status" text DEFAULT 'uploaded' NOT NULL,
    "warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "extracted_profile" jsonb,
    "sections_preview" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "retention_expires_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_resume_documents_person" ON "resume_documents" ("person_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_resume_documents_status" ON "resume_documents" ("status");`,
  `CREATE INDEX IF NOT EXISTS "idx_resume_documents_checksum" ON "resume_documents" ("checksum");`,
  `CREATE TABLE IF NOT EXISTS "resume_document_blobs" (
    "id" text PRIMARY KEY NOT NULL,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "mime_type" text NOT NULL,
    "payload_base64" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_resume_blobs_person" ON "resume_document_blobs" ("person_id");`,
  `CREATE TABLE IF NOT EXISTS "resume_review_history" (
    "id" text PRIMARY KEY NOT NULL,
    "document_id" text NOT NULL REFERENCES "resume_documents"("id") ON DELETE CASCADE,
    "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
    "group_key" text NOT NULL,
    "record_id" text NOT NULL,
    "field_key" text,
    "action" text NOT NULL,
    "actor" text NOT NULL,
    "actor_person_id" text,
    "previous_value" text,
    "new_value" text,
    "previous_state" text,
    "new_state" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS "idx_resume_review_document" ON "resume_review_history" ("document_id");`,
  `CREATE INDEX IF NOT EXISTS "idx_resume_review_person" ON "resume_review_history" ("person_id");`,

  // Dedupe constraints (audit 2026-10-12). Application code dedupes with an
  // update -> insert-or-nothing -> update sequence that is correct with or
  // without these indexes; the indexes close the remaining race. Creating a
  // unique index fails if duplicates already exist, so each one is created
  // only when the data is clean, and otherwise skipped with a NOTICE.
  // scripts/report-duplicate-keys.ts lists the offending rows to resolve.
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "normalized_title" text;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_evidence_person_import_key') THEN
      IF EXISTS (SELECT 1 FROM "evidence_items" WHERE "import_key" IS NOT NULL GROUP BY "person_id", "import_key" HAVING count(*) > 1) THEN
        RAISE NOTICE 'Skipped uq_evidence_person_import_key: duplicate (person_id, import_key) rows exist';
      ELSE
        CREATE UNIQUE INDEX "uq_evidence_person_import_key" ON "evidence_items" ("person_id", "import_key");
      END IF;
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_projects_person_normalized_title') THEN
      IF EXISTS (SELECT 1 FROM "projects" WHERE "normalized_title" IS NOT NULL GROUP BY "person_id", "normalized_title" HAVING count(*) > 1) THEN
        RAISE NOTICE 'Skipped uq_projects_person_normalized_title: duplicate (person_id, normalized_title) rows exist';
      ELSE
        CREATE UNIQUE INDEX "uq_projects_person_normalized_title" ON "projects" ("person_id", "normalized_title");
      END IF;
    END IF;
  END $$;`,

  // Optimistic concurrency for onboarding drafts (Task 1.2.4).
  `ALTER TABLE "onboarding_drafts" ADD COLUMN IF NOT EXISTS "revision" integer DEFAULT 0 NOT NULL;`,
  `ALTER TABLE "onboarding_drafts" ADD COLUMN IF NOT EXISTS "system_entries" jsonb DEFAULT '{}'::jsonb NOT NULL;`,

  // Sync operation ledger: idempotency, correlation IDs, dead letters (Tasks 1.9.1-1.9.4).
  `CREATE TABLE IF NOT EXISTS "sync_operations" ("id" text PRIMARY KEY NOT NULL, "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE, "source" text NOT NULL, "idempotency_key" text NOT NULL, "correlation_id" text NOT NULL, "trigger" text NOT NULL, "state" text NOT NULL, "attempts" integer DEFAULT 0 NOT NULL, "max_attempts" integer NOT NULL, "last_error_code" text, "last_error" text, "next_attempt_at" timestamp with time zone, "started_at" timestamp with time zone, "finished_at" timestamp with time zone, "result" jsonb DEFAULT '{}'::jsonb NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_sync_operations_idempotency_key" ON "sync_operations" ("idempotency_key");`,
  `CREATE INDEX IF NOT EXISTS "idx_sync_operations_person_source" ON "sync_operations" ("person_id", "source", "created_at");`,
  // At most one in-flight operation per (person, source): a double-clicked "Sync Now"
  // that straddles an idempotency bucket boundary still cannot start a second run.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_sync_operations_active" ON "sync_operations" ("person_id", "source") WHERE "state" IN ('queued', 'running', 'awaiting_user');`,

  // Per-source provenance on evidence (Task 1.2.2). Backfill derives the
  // platform from the import-key prefix / source kind; idempotent.
  `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "origin_source" text;`,
  `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "confidence_score" double precision;`,
  `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "editable" boolean DEFAULT true NOT NULL;`,
  `UPDATE "evidence_items" SET "origin_source" = CASE
     WHEN "import_key" LIKE 'github\_%' THEN 'github'
     WHEN "import_key" LIKE 'resume%' OR "source" = 'resume_extracted' THEN 'resume'
     WHEN "source" = 'institutional' THEN 'institutional'
     ELSE 'manual' END
   WHERE "origin_source" IS NULL;`,
  `UPDATE "evidence_items" SET "source_reference" = coalesce("origin_source", 'manual') || ':' || coalesce("import_key", "id") WHERE "source_reference" IS NULL;`,
  `UPDATE "evidence_items" SET "editable" = false WHERE "verification_status" = 'verified' AND "editable" = true;`,
  `CREATE INDEX IF NOT EXISTS "idx_evidence_person_origin" ON "evidence_items" ("person_id", "origin_source");`,

  // Request-level idempotency ledger (Task 1.9.1).
  `CREATE TABLE IF NOT EXISTS "idempotency_keys" ("key" text PRIMARY KEY NOT NULL, "person_id" text NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE, "scope" text NOT NULL, "response" jsonb, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "completed_at" timestamp with time zone);`,
  `CREATE INDEX IF NOT EXISTS "idx_idempotency_keys_created" ON "idempotency_keys" ("created_at");`,
  // One active goal per person (Task 2.1.7). Existing duplicates (left by concurrent
  // onboarding completions) are paused first, keeping the newest; idempotent.
  `UPDATE "goals" g SET "status" = 'paused' WHERE g."status" = 'active' AND EXISTS (SELECT 1 FROM "goals" g2 WHERE g2."person_id" = g."person_id" AND g2."status" = 'active' AND (g2."updated_at" > g."updated_at" OR (g2."updated_at" = g."updated_at" AND g2."id" > g."id")));`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_goals_one_active" ON "goals" ("person_id") WHERE "status" = 'active';`,
  // Import-keyed journey events are written once per person (Task 2.1.7). Exact
  // duplicates (same person + import_key, left by concurrent completions) are
  // removed first, keeping the earliest; idempotent.
  `DELETE FROM "journey_events" j USING "journey_events" k WHERE j."import_key" IS NOT NULL AND j."person_id" = k."person_id" AND j."import_key" = k."import_key" AND (j."created_at" > k."created_at" OR (j."created_at" = k."created_at" AND j."id" > k."id"));`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_journey_events_import_key" ON "journey_events" ("person_id", "import_key") WHERE "import_key" IS NOT NULL;`,
  ...FOREIGN_KEY_REPAIR_STATEMENTS,
  // Project Evidence Ledger (Tasks 2.5.1-2.5.5). Confirmed projects start in
  // the portfolio; the backfill runs only while the column is new (no row
  // has been touched yet), so it never overrides a student's later choice.
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'portfolio_included') THEN
     ALTER TABLE "projects" ADD COLUMN "portfolio_included" boolean DEFAULT false NOT NULL;
     UPDATE "projects" SET "portfolio_included" = true WHERE "status" = 'confirmed';
   END IF; END $$;`,
  `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "portfolio_included" boolean DEFAULT false NOT NULL;`,
];
