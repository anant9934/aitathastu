CREATE TABLE "action_states" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"recommendation_key" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_audit_logs" (
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
);
--> statement-breakpoint
CREATE TABLE "assessment_attempts" (
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
);
--> statement-breakpoint
CREATE TABLE "assessment_results" (
	"id" text PRIMARY KEY NOT NULL,
	"attempt_id" text NOT NULL,
	"overall_result" text,
	"max_result" text,
	"result_type" text NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_topic_results" (
	"id" text PRIMARY KEY NOT NULL,
	"attempt_id" text NOT NULL,
	"topic_key" text NOT NULL,
	"topic_label" text NOT NULL,
	"value" text NOT NULL,
	"max_value" text,
	"measurement_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capabilities" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capabilities_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "coding_practice_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"producer_event_id" text NOT NULL,
	"source" text DEFAULT 'padho_code' NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "event_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"person_id" text NOT NULL,
	"participation_role" text DEFAULT 'participant' NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"certificate_url" text,
	"submission_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
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
);
--> statement-breakpoint
CREATE TABLE "evidence_items" (
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
	"verified_by_person_id" text,
	"verified_at" timestamp with time zone,
	"verification_method" text,
	"verification_decision_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_account_id" text,
	"external_username" text NOT NULL,
	"display_name" text,
	"profile_url" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb,
	"last_synced_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source" text DEFAULT 'preset' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"producer" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
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
);
--> statement-breakpoint
CREATE TABLE "integration_identity_links" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"producer" text NOT NULL,
	"external_subject_id" text NOT NULL,
	"person_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"artifact_type" text NOT NULL,
	"profile_version" integer DEFAULT 1 NOT NULL,
	"source_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_dimension_results" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"dimension_key" text NOT NULL,
	"dimension_label" text NOT NULL,
	"value" text NOT NULL,
	"scale_min" text DEFAULT '1' NOT NULL,
	"scale_max" text DEFAULT '5' NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
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
);
--> statement-breakpoint
CREATE TABLE "journey_events" (
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
);
--> statement-breakpoint
CREATE TABLE "learning_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"producer_event_id" text NOT NULL,
	"source" text DEFAULT 'study_lpu' NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "membership_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"membership_id" text NOT NULL,
	"role_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_drafts" (
	"person_id" text PRIMARY KEY NOT NULL,
	"draft" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "person_profile_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"change_type" text NOT NULL,
	"change_summary" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"education" text DEFAULT '' NOT NULL,
	"experience" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '',
	"degree" text DEFAULT '',
	"specialization" text DEFAULT '',
	"institution" text DEFAULT '',
	"current_year" text DEFAULT '',
	"semester" text DEFAULT '',
	"expected_graduation_year" integer,
	"location" text DEFAULT '',
	"placement_status" text DEFAULT 'preparing',
	"internship_status" text DEFAULT 'seeking',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_profiles_person_id_unique" UNIQUE("person_id")
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" text PRIMARY KEY NOT NULL,
	"primary_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persons_primary_user_id_unique" UNIQUE("primary_user_id")
);
--> statement-breakpoint
CREATE TABLE "project_contributions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"person_id" text NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"title" text NOT NULL,
	"normalized_title" text,
	"summary" text DEFAULT '',
	"description" text DEFAULT '',
	"category" text DEFAULT 'Other AI/ML',
	"purpose" text DEFAULT 'personal',
	"visibility" text DEFAULT 'private',
	"project_type" text DEFAULT 'software' NOT NULL,
	"repository_url" text,
	"demo_url" text,
	"technologies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timeline" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"team" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hardware_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_document_blobs" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"mime_type" text NOT NULL,
	"payload_base64" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"organization_id" text,
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
);
--> statement-breakpoint
CREATE TABLE "resume_review_history" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"person_id" text NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "roadmap_milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"goal_id" text NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "role_capabilities" (
	"id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"capability_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "source_conflicts" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "source_processing_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"source" text NOT NULL,
	"source_reference" text NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"checksum" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"person_id" text NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"records_fetched" integer DEFAULT 0 NOT NULL,
	"records_changed" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
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
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"verification_request_id" text NOT NULL,
	"verifier_person_id" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
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
);
--> statement-breakpoint
ALTER TABLE "action_states" ADD CONSTRAINT "action_states_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_producer_event_id_integration_events_id_fk" FOREIGN KEY ("producer_event_id") REFERENCES "public"."integration_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_attempt_id_assessment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."assessment_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_topic_results" ADD CONSTRAINT "assessment_topic_results_attempt_id_assessment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."assessment_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_practice_activities" ADD CONSTRAINT "coding_practice_activities_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_practice_activities" ADD CONSTRAINT "coding_practice_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_practice_activities" ADD CONSTRAINT "coding_practice_activities_producer_event_id_integration_events_id_fk" FOREIGN KEY ("producer_event_id") REFERENCES "public"."integration_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_verified_by_person_id_persons_id_fk" FOREIGN KEY ("verified_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_connections" ADD CONSTRAINT "external_connections_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_identity_links" ADD CONSTRAINT "integration_identity_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_identity_links" ADD CONSTRAINT "integration_identity_links_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_artifacts" ADD CONSTRAINT "intelligence_artifacts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_dimension_results" ADD CONSTRAINT "interview_dimension_results_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_producer_event_id_integration_events_id_fk" FOREIGN KEY ("producer_event_id") REFERENCES "public"."integration_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_events" ADD CONSTRAINT "journey_events_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_activities" ADD CONSTRAINT "learning_activities_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_activities" ADD CONSTRAINT "learning_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_activities" ADD CONSTRAINT "learning_activities_producer_event_id_integration_events_id_fk" FOREIGN KEY ("producer_event_id") REFERENCES "public"."integration_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_organization_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organization_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_drafts" ADD CONSTRAINT "onboarding_drafts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_profile_versions" ADD CONSTRAINT "person_profile_versions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_primary_user_id_users_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_contributions" ADD CONSTRAINT "project_contributions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_contributions" ADD CONSTRAINT "project_contributions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_document_blobs" ADD CONSTRAINT "resume_document_blobs_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_documents" ADD CONSTRAINT "resume_documents_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_documents" ADD CONSTRAINT "resume_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_review_history" ADD CONSTRAINT "resume_review_history_document_id_resume_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."resume_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_review_history" ADD CONSTRAINT "resume_review_history_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_milestones" ADD CONSTRAINT "roadmap_milestones_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_milestones" ADD CONSTRAINT "roadmap_milestones_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_capabilities" ADD CONSTRAINT "role_capabilities_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_capabilities" ADD CONSTRAINT "role_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_conflicts" ADD CONSTRAINT "source_conflicts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_processing_jobs" ADD CONSTRAINT "source_processing_jobs_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_connection_id_external_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_decisions" ADD CONSTRAINT "verification_decisions_verification_request_id_verification_requests_id_fk" FOREIGN KEY ("verification_request_id") REFERENCES "public"."verification_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_decisions" ADD CONSTRAINT "verification_decisions_verifier_person_id_persons_id_fk" FOREIGN KEY ("verifier_person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_evidence_id_evidence_items_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_requester_person_id_persons_id_fk" FOREIGN KEY ("requester_person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_assigned_verifier_person_id_persons_id_fk" FOREIGN KEY ("assigned_verifier_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_rec_key_idx" ON "action_states" USING btree ("person_id","recommendation_key");--> statement-breakpoint
CREATE INDEX "idx_ai_audit_logs_person" ON "ai_audit_logs" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_ai_audit_logs_task" ON "ai_audit_logs" USING btree ("task");--> statement-breakpoint
CREATE INDEX "idx_assess_attempt_person" ON "assessment_attempts" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_assess_res_attempt" ON "assessment_results" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "idx_assess_topic_attempt" ON "assessment_topic_results" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "idx_coding_activities_person" ON "coding_practice_activities" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_coding_activities_topic" ON "coding_practice_activities" USING btree ("topic_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_part_event_person" ON "event_participants" USING btree ("event_id","person_id");--> statement-breakpoint
CREATE INDEX "idx_event_part_person" ON "event_participants" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_events_type" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_events_status" ON "events" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evidence_person_import_key" ON "evidence_items" USING btree ("person_id","import_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ext_conn_person_provider" ON "external_connections" USING btree ("person_id","provider");--> statement-breakpoint
CREATE INDEX "idx_ext_conn_person" ON "external_connections" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_int_cred_org_prod" ON "integration_credentials" USING btree ("organization_id","producer");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_int_event_producer_ext" ON "integration_events" USING btree ("producer","external_event_id");--> statement-breakpoint
CREATE INDEX "idx_int_event_status" ON "integration_events" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "idx_int_event_person" ON "integration_events" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_int_id_link_unique" ON "integration_identity_links" USING btree ("organization_id","producer","external_subject_id");--> statement-breakpoint
CREATE INDEX "idx_int_id_link_person" ON "integration_identity_links" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_intel_artifacts_person_type" ON "intelligence_artifacts" USING btree ("person_id","artifact_type");--> statement-breakpoint
CREATE INDEX "idx_interview_dim_session" ON "interview_dimension_results" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_interview_session_person" ON "interview_sessions" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_learning_activities_person" ON "learning_activities" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_learning_activities_source" ON "learning_activities" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_profile_versions_person" ON "person_profile_versions" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_proj_contrib_project_person" ON "project_contributions" USING btree ("project_id","person_id");--> statement-breakpoint
CREATE INDEX "idx_proj_contrib_person" ON "project_contributions" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_projects_person" ON "projects" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_projects_person_normalized_title" ON "projects" USING btree ("person_id","normalized_title");--> statement-breakpoint
CREATE INDEX "idx_resume_blobs_person" ON "resume_document_blobs" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_resume_documents_person" ON "resume_documents" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_resume_documents_status" ON "resume_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_resume_documents_checksum" ON "resume_documents" USING btree ("checksum");--> statement-breakpoint
CREATE INDEX "idx_resume_review_document" ON "resume_review_history" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_resume_review_person" ON "resume_review_history" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_roadmap_milestones_person_goal" ON "roadmap_milestones" USING btree ("person_id","goal_id");--> statement-breakpoint
CREATE INDEX "idx_roadmap_milestones_status" ON "roadmap_milestones" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_source_conflicts_person" ON "source_conflicts" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_source_conflicts_status" ON "source_conflicts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_source_jobs_person" ON "source_processing_jobs" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_source_jobs_status" ON "source_processing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_source_snapshots_person" ON "source_snapshots" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_sync_runs_person" ON "sync_runs" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_sync_runs_conn" ON "sync_runs" USING btree ("connection_id");