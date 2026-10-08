# AI Tathastu — Phase E.4 Project Functional Audit

**Audit Date:** October 8, 2026  
**Auditor:** AI Tathastu Technical Committee  
**Target:** AI/ML Student Project Management, Data Integrity, and Complete Feature Functionalization  

---

## 1. Executive Summary

This audit inventories the existing project lifecycle across UI components, API routes, domain services, database schemas, and integration points to identify gaps between the current implementation and the comprehensive Phase E.4 specification.

Prior to Phase E.4:
- Basic project creation, listing, and deletion were operational via `app/api/student/projects/route.ts` and `lib/repositories/project-repository.ts`.
- However, project editing did not exist (no `PUT` / `PATCH` endpoint or edit modal/page).
- There was no dedicated **Project Detail** page (`/student/projects/[id]` did not exist).
- Multi-link support was absent (only a single `repositoryUrl` and `demoUrl` column existed).
- Rich AI/ML project dimensions (problem statement, solution, dataset metadata, model architecture, structured evaluation metrics, limitations) and Hardware project dimensions (microcontrollers, sensors, schematics) existed only as ideas and were not stored.
- Personal contributions were captured as basic role tags and notes, without full support for team members, mentors, or timeline dates.
- Minor demo fixtures (e.g. `opportunitiesCount = 5` in `Screen12StudentDashboard.tsx`) lingered and violated the Zero Mock Data policy.

---

## 2. Inventory of Project Components & Endpoints

| Component / File | Purpose | Current State | Audit Findings & Required Remediation |
| :--- | :--- | :--- | :--- |
| `lib/db/schema.ts` (`projects`) | Stores normalized project rows | **PARTIAL** | Stores `title`, `description`, `projectType`, `repositoryUrl`, `demoUrl`, `technologies`, `sources`, `status`. Needs extension for `summary`, `category`, `purpose`, `visibility`, `links` (jsonb), `timeline` (jsonb), `team` (jsonb), `aiDetails` (jsonb), `hardwareDetails` (jsonb), and `media` (jsonb). |
| `lib/db/schema.ts` (`projectContributions`) | Stores personal contribution breakdown | **WORKS** | Stores `roles` (jsonb) and `description` (text) per `projectId` + `personId`. Fully normalized. |
| `lib/repositories/project-repository.ts` | CRUD data access for projects & contributions | **PARTIAL** | Supports `saveProject`, `getProjectsByPersonId`, `saveProjectContribution`, `deleteProject`. Missing `getProjectById(personId, projectId)` and `updateProject(personId, projectId, patch)`. |
| `app/api/student/projects/route.ts` | Main REST API for student projects | **PARTIAL** | Supports `GET`, `POST` (basic create), `DELETE`. Missing full validation, multi-link support, and rich AI/ML + Hardware field handling. |
| `app/api/student/projects/[id]/route.ts` | Single project endpoint | **BROKEN / MISSING** | Does not exist. Needs `GET` (detail), `PUT`/`PATCH` (edit), `DELETE` (delete). |
| `app/student/projects/page.tsx` | Project list entrypoint | **WORKS** | Wraps `StudentLayout` and `StudentProjectsView`. |
| `app/student/projects/[id]/page.tsx` | Project Detail page | **BROKEN / MISSING** | Does not exist. Must be created with full header, overview, contribution, tech stack, AI/ML details, hardware details, team, and links. |
| `components/student/student-projects-view.tsx` | Client view for projects | **PARTIAL** | Renders cards and a basic creation modal. Needs: 1) Link to view project details (`/student/projects/[id]`), 2) Comprehensive multi-section Add/Edit Project editor with 3 creation methods (Manual, GitHub, Link), 3) Edit project action. |
| `components/exact-screens/Screen10GitHubProjects.tsx` | Onboarding project selection | **WORKS** | Clean ivory/violet cards with role selection and manual add modal. Persists to draft and database. |
| `lib/acquisition/acquisition-service.ts` | Discovers & confirms projects | **WORKS** | Handles candidate deduplication, snapshot parsing, and evidence generation. |
| `lib/connectors/github/client.ts` & `mapper.ts` | GitHub API client and tech detection | **WORKS** | Discovers repos and detects technologies via `AI_ML_TECH_REGISTRY`. Needs single repo metadata inspection helper. |
| `lib/services/person-360-service.ts` | Person 360 aggregator | **WORKS** | Includes `projects` array and accurate count from `getProjectsByPersonId()`. |
| `components/exact-screens/Screen12StudentDashboard.tsx` | Student Home dashboard | **PARTIAL** | Has `opportunitiesCount` hardcoded fallback (`5`). Must be removed and set to 0 when no opportunities exist. |

---

## 3. Data Flow & Persistence Analysis

### Currently Persisted Fields (in PostgreSQL):
- `projects.id` (Primary Key)
- `projects.personId` (Foreign Key to `persons.id`)
- `projects.title` (Required string)
- `projects.description` (Text)
- `projects.projectType` (String, default `'software'`)
- `projects.repositoryUrl` (Nullable string)
- `projects.demoUrl` (Nullable string)
- `projects.technologies` (JSON array of strings)
- `projects.sources` (JSON array of strings)
- `projects.status` (String, default `'confirmed'`)
- `projects.createdAt` / `projects.updatedAt` (Timestamps)
- `projectContributions.roles` (JSON array of strings)
- `projectContributions.description` (Text)

### Fields Currently Missing or In Memory Only:
- **Project Category:** (Machine Learning, Generative AI, Computer Vision, NLP, etc.)
- **Project Purpose:** (Academic, Personal, Research, Hackathon, Internship, etc.)
- **Project Visibility:** (Private, Public, Institution, Connections)
- **Short Summary:** (1-2 sentences)
- **Detailed Links:** Array of link objects `{ type, label, url, description, visibility }`
- **Team & Mentors:** Team name, collaborators list, mentors list
- **Timeline:** Start date, end date, expected completion date, institution/lab, course/event
- **AI/ML Technical Specifications:** Problem statement, proposed solution, dataset metadata, model architecture, training details, structured metric measurements (Accuracy, F1, Latency, etc.), limitations, future improvements
- **Hardware Technical Specifications:** Microcontrollers, sensors, camera modules, communication protocols, prototype stage, schematic URLs, demo videos

---

## 4. Remediation Plan

1. **Database Schema Extension:**
   - Extend `projects` table in `lib/db/schema.ts` with columns for `summary`, `category`, `purpose`, `visibility`, `links` (jsonb), `timeline` (jsonb), `team` (jsonb), `aiDetails` (jsonb), `hardwareDetails` (jsonb), and `media` (jsonb).
   - Update `lib/repositories/project-repository.ts` to support saving, updating, retrieving single projects, and deleting projects with these extended fields.

2. **Project API Expansion:**
   - Enhance `app/api/student/projects/route.ts` to validate and store all extended fields on `POST`.
   - Create `app/api/student/projects/[id]/route.ts` with `GET` (detail), `PUT`/`PATCH` (update with personId ownership), and `DELETE`.
   - Add URL validation (rejecting non-http/https, SSRF defense).

3. **Add Project Experience Redesign:**
   - Implement the 3-mode creation flow:
     - **Add Manually:** Organized accordion / tabs with progressive disclosure (Basic Info, Links, Tech & Skills, Personal Contribution, AI/ML Details, Hardware Details, Team & Timeline).
     - **Import from GitHub:** Select an authorized repository with auto-extracted details and technology tagging.
     - **Import from Link:** Provide a repository or paper link with validation.
   - Built with the unified design system: warm ivory `#F9F8F5`, white surface, violet `#5942DC`, dark ink `#171626`.

4. **Project Detail Page:**
   - Create `app/student/projects/[id]/page.tsx` rendering header, overview, contribution breakdown, technologies, AI/ML / Hardware technical specs, team, links, and evidence status.
   - Wire cards in `student-projects-view.tsx` to open the detail page and support the Edit workflow.

5. **Zero Mock Data Scrub:**
   - Remove fake opportunity counts or hardcoded numbers in `Screen12StudentDashboard.tsx` and all student views.
   - Ensure truthful empty states everywhere.
