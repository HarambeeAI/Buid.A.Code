# PRD: Build.A.Code — AI-Powered Building Plan Compliance Platform

## 1. Introduction

Build.A.Code is an AI-powered SaaS platform that automates building plan compliance analysis. Users upload architectural drawings (PDF, images, or CAD files), and the system extracts measurements and specifications using Gemini 2.5 Flash Preview's multimodal vision capabilities, compares them against regional building codes using a rigorous code-by-code, page-by-page analysis matrix, and generates professional-grade compliance reports within minutes.

The platform is built on **Railway** as a unified infrastructure provider with **Logto** for authentication, minimising external dependencies and operational complexity.

### 1.1 Problem Statement

Building compliance verification is traditionally manual and time-consuming, requiring professionals to cross-reference drawings against hundreds of pages of regulations. This causes:

- Delays in permit approvals due to compliance oversights
- Costly redesigns when non-compliance is discovered late in construction
- Inconsistent interpretations of complex regulations across reviewers
- Heavy dependency on scarce specialist knowledge

### 1.2 Solution

Build.A.Code provides automated, AI-driven compliance checking that:

- Reduces analysis time from days to minutes (2-5 minute processing)
- Extracts measurements automatically from architectural drawings using Gemini 2.5 Flash Preview vision
- Applies a rigorous code-by-code analysis matrix with structured requirement definitions
- Supports multiple regional building codes (Australia, UK, US) with an admin-managed code knowledge base
- Provides confidence-scored findings with actionable recommendations
- Generates exportable professional compliance reports following industry best practices
- Offers a tiered pricing model: free tier for evaluation, Pro for unlimited professional use

---

## 2. Goals

- Deliver automated compliance analysis completing in under 5 minutes for standard documents (< 20 pages)
- Achieve > 95% analysis completion rate with < 2% error rate
- Support three regional jurisdictions at launch: Australia, UK, United States
- Implement rigorous code x page matrix analysis producing traceable, confidence-scored findings
- Generate industry-standard compliance reports with cover page, executive summary, categorised findings, and compliance matrix
- Maintain API response times < 200ms for non-processing endpoints
- Achieve 30-day user retention > 40%
- Convert > 15% of free users to Pro tier within 60 days
- Support PDF, PNG, JPG, and TIFF at MVP; DXF at V1.1; IFC at V1.2
- Provide admin tooling for building code ingestion, verification, and publishing
- Enable users to request unsupported building codes and track request status

---

## 3. User Personas and Target Market

### 3.1 Licensed Architect
Goals: Pre-submit compliance checks, reduce revision cycles. Pain Points: Manual code cross-referencing, permit delays. Usage: Multiple projects, batch analysis, needs PDF export. Tier: Pro.

### 3.2 Building Contractor
Goals: Validate subcontractor plans, avoid costly rework. Pain Points: Discovering compliance issues during construction. Usage: Project-based, quick turnaround. Tier: Starts Free, upgrades when limits hit.

### 3.3 Private Developer / Homeowner
Goals: Understand compliance status before council submission. Pain Points: Lack of expertise, expensive consultants. Usage: Occasional, small drawing sets. Tier: Free may suffice for small projects.

### 3.4 Structural Engineer
Goals: Verify structural compliance, coordinate with architects. Pain Points: Multi-code verification across disciplines. Usage: Detailed analysis, DXF/IFC files. Tier: Pro.

### 3.5 Platform Admin (Internal)
Goals: Manage building code knowledge base, review code requests. Usage: Periodic code ingestion and verification workflows.

---

## 4. Pricing and Tier Structure

### 4.1 Free Tier (on signup, no credit card)
- 2 free analyses total
- Maximum 5 pages per document
- Maximum 3 building codes per analysis
- Standard processing queue
- Reports viewable in-app only (no PDF export)
- Watermark on shared report links

### 4.2 Pro Tier (subscription)
- Unlimited analyses
- Up to 50 pages per document
- All building codes available
- Priority processing queue
- Full PDF export with professional formatting
- Clean shared links (no watermark)
- Full history and organisation features

### 4.3 Upgrade Triggers
- Upload exceeds 5 pages: page limit message + upgrade CTA
- Code selection exceeds 3: code limit message + upgrade CTA
- Analyses exhausted: "Upgrade for unlimited" CTA
- PDF export attempted: "Export requires Pro" CTA

### 4.4 Enterprise (Future, not MVP)
- Custom limits, team collaboration, custom code upload, API access

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14+ / React 18+ / TypeScript / Tailwind CSS | UI, SSR |
| API | Next.js API Routes + FastAPI (worker) | Routing, business logic |
| Auth | Logto (self-hosted on Railway) | OIDC, social login, RBAC, webhooks |
| Database | Railway PostgreSQL + pgvector | Primary data + embeddings |
| Storage | Railway Buckets (S3-compatible) | Documents, reports |
| Queue/Cache | Railway Redis + BullMQ | Async jobs, caching |
| Vision AI | Google Gemini 2.5 Flash Preview | All vision analysis |
| PDF Processing | Python + PyMuPDF / pdfplumber | Page extraction |
| CAD Processing | Python + ezdxf (V1.1) / ifcopenshell (V1.2) | Structured extraction |

### 5.2 Railway Project Structure

| Service | Type | Notes |
|---------|------|-------|
| frontend | Next.js | App Router with SSR, admin routes |
| api | FastAPI | Worker + processing pipeline |
| logto | Auth Service | OIDC provider with RBAC |
| PostgreSQL | Database | With pgvector extension |
| Redis | Database | BullMQ queues + caching |
| Buckets | Volume | S3-compatible storage |

### 5.3 Environment Variables
DATABASE_URL, REDIS_URL (auto-injected), BUCKET_URL, BUCKET_ACCESS_KEY, BUCKET_SECRET_KEY, GEMINI_API_KEY, VISION_MODEL=gemini-2.5-flash-preview, LOGTO_ENDPOINT, LOGTO_APP_ID, LOGTO_APP_SECRET, JWT_SECRET, SENDGRID_API_KEY (optional).

---

## 6. Compliance Analysis Pipeline

### 6.1 Stage 1: Document Ingestion and Normalisation
PDF: split to PNG pages at 300 DPI via PyMuPDF + text extraction. Images (PNG/JPG/TIFF): normalise to PNG, split multi-page TIFF. DXF (V1.1): parse via ezdxf for structured dimensions + render to images. IFC (V1.2): parse via ifcopenshell for semantic BIM data + render views. Output: normalised page images + optional structured geometry.

### 6.2 Stage 2: Page Classification
Each page sent to Gemini 2.5 Flash Preview. Returns: page_type (floor_plan/elevation/section/site_plan/detail/schedule/title_block/other), description, scale_detected. Determines which requirements apply to each page.

### 6.3 Stage 3: Code x Page Matrix Construction
Fetch PUBLISHED CodeRequirement records for selected codes. Pair each requirement with pages matching applies_to_drawing_types. Only relevant pairs proceed, avoiding wasted calls and hallucination from irrelevant context.

### 6.4 Stage 4: Per-Requirement Vision Analysis
For each requirement x page pair, focused Gemini call with prompt constructed from CodeRequirement fields (code_ref, full_text, thresholds, exceptions, extraction_guidance, evaluation_guidance). Returns structured JSON: measurements_found, status (COMPLIANT/WARNING/CRITICAL/NOT_ASSESSED), confidence (HIGH/MEDIUM/LOW), reasoning, recommendation. Parallel execution in batches of 10 concurrent calls.

### 6.5 Stage 5: Cross-Validation and Aggregation
Cross-page validation: same requirement on multiple pages compared, conflicts flagged. DXF/IFC validation (V1.1+): programmatic dimensions vs vision extraction. Deduplication keeping highest-confidence results.

### 6.6 Stage 6: Scoring and Finding Generation
Score: COMPLIANT / (COMPLIANT + WARNING + CRITICAL) x 100. NOT_ASSESSED excluded. Overall status: PASS (>= 90% and 0 critical), CONDITIONAL (>= 70% or has critical), FAIL (< 70%). Category assignment from CodeRequirement. Report ID: BAC-YYYY-NNNNN.

### 6.7 Stage 7: Recommendation Generation
Final pass sends all non-compliant findings to Gemini for coordinated, actionable recommendations.

### 6.8 Cost Estimate
Typical 10-page document, 8 code sections (~45 requirements): 40-80 vision calls, ~$0.10-0.40 per analysis.

---

## 7. Building Code Knowledge Base

### 7.1 CodeRequirement Schema
Each checkable requirement: id, building_code_id (FK), code_ref, title, category, full_text, check_type (measurement_threshold/presence_check/ratio_check/boolean_check), thresholds (JSON), applies_to_drawing_types (JSON), applies_to_building_types (JSON), applies_to_spaces (JSON), exceptions (JSON), extraction_guidance (Text), evaluation_guidance (Text), source_page, status (DRAFT/VERIFIED/PUBLISHED/DEPRECATED), embedding (vector 768).

### 7.2 Ingestion Workflow
Admin uploads code PDF -> AI extracts draft requirements -> Admin reviews/edits/verifies each -> Admin publishes (embeddings generated, code goes ACTIVE) -> Available to users. For updates: new version created, old marked DEPRECATED.

### 7.3 Launch Codes
AU: NCC 2022, SI-01, SI-02, SI-03, BP-01. UK: Building Regs 2010. US: IRC 2021, IBC 2021.

---

## 8. Report Design

### 8.1 In-App Report View
Three-panel: left (score donut, status stamp, breakdown), centre (findings by category), right (quick-nav with colour dots, filters, search). Finding cards: code_ref, status badge, confidence badge, description, Required vs As Shown, page ref, location, analysis notes, recommendation callout. Report header: report_ref, project name, date, status stamp, Report/Plan toggle, Share + Export.

### 8.2 PDF Export (Pro Only)
Cover page: logo, report title, report_ref, project name, codes assessed, status stamp, assessor line. Executive summary: score donut, breakdown bar, scope, limitations. Detailed findings: grouped by category, structured blocks. Appendix A: compliance matrix table. Appendix B: methodology. Every page: header + footer + disclaimer.

### 8.3 Shared Links
Public URL /shared/reports/:token. Read-only. Free: watermarked. Pro: clean. Revocable.

---

## 9. UX and Interface Design

### 9.1 Information Architecture
Dashboard (activity, tier, actions) -> Projects -> Project Detail -> Analysis Wizard (3 steps) -> Processing -> Report. Sidebar: Dashboard, Projects, Folders, Supported Codes. Admin: Code Management, Code Requests.

### 9.2 Wizard (3 Steps)
Step 1: Upload + Details (drag-drop, preview, tier limit check, optional context). Step 2: Region + Codes (cards, checkboxes, smart defaults, tier limits, code request link). Step 3: Review + Submit.

### 9.3 Processing Screen
Vertical timeline: Uploading -> Classifying -> Analysing (X of Y) -> Validating -> Generating. Polls every 5s.

### 9.4 Empty States
Every empty state: illustration + single CTA.

### 9.5 Keyboard Shortcuts
N (new analysis), / (search), F (filter), E (export), ? (help overlay). Only when no input focused.

---

## 10. Data Models

### 10.1 User
id (UUID), logto_user_id (unique), email, name, tier (FREE/PRO default FREE), analyses_remaining (Integer default 2, null for PRO), role (USER/ADMIN default USER), created_at, updated_at.

### 10.2 Project
id, user_id (FK), name, description, folder_id (nullable FK), created_at, updated_at.

### 10.3 Folder
id, user_id (FK), name, created_at.

### 10.4 Analysis
id, project_id (FK), report_ref (unique BAC-YYYY-NNNNN), document_name, document_url, document_size, document_type (PDF/PNG/JPG/TIFF/DXF/IFC), page_count, description, page_numbers, region (AU/UK/US), selected_codes (JSON), status (PENDING/CLASSIFYING/ANALYSING/VALIDATING/GENERATING/COMPLETED/FAILED), current_stage, compliance_score, overall_status (PASS/CONDITIONAL/FAIL), critical_count, warning_count, compliant_count, not_assessed_count, total_checks, started_at, completed_at, created_at.

### 10.5 Finding
id, analysis_id (FK), code_reference, category (STRUCTURAL/FIRE_SAFETY/EGRESS/ACCESSIBILITY/ENERGY/GENERAL_BUILDING/SITE/PLUMBING/ELECTRICAL/MECHANICAL), status (COMPLIANT/WARNING/CRITICAL/NOT_ASSESSED), confidence (HIGH/MEDIUM/LOW), description, required_value, proposed_value, page_number, location, analysis_notes, recommendation, raw_extraction (JSON), sort_order.

### 10.6 BuildingCode
id, region, code_id (unique), name, description, version, status (DRAFT/ACTIVE/DEPRECATED), source_document_url, published_at, published_by (FK User), created_at.

### 10.7 CodeRequirement
id, building_code_id (FK), code_ref, title, category, full_text, check_type, thresholds (JSON), applies_to_drawing_types (JSON), applies_to_building_types (JSON), applies_to_spaces (JSON), exceptions (JSON), extraction_guidance, evaluation_guidance, source_page, status (DRAFT/VERIFIED/PUBLISHED/DEPRECATED), embedding (vector 768), created_at, updated_at.

### 10.8 CodeRequest
id, user_id (FK), code_name, region, description, reference_url, status (SUBMITTED/UNDER_REVIEW/IN_PROGRESS/PUBLISHED/DECLINED), admin_notes, resolved_code_id (FK BuildingCode), created_at, updated_at.

### 10.9 ShareToken
id, analysis_id (FK), token (unique), is_active (default true), created_at.

---

## 11. API Specifications

### Auth
GET /api/auth/login, GET /api/auth/callback, POST /api/auth/logout, GET /api/auth/me, POST /api/webhooks/logto.

### Projects
GET /api/projects, POST /api/projects, GET /api/projects/:id, PATCH /api/projects/:id, DELETE /api/projects/:id.

### Folders
GET /api/folders, POST /api/folders, PATCH /api/folders/:id, DELETE /api/folders/:id.

### Analyses
POST /api/projects/:pid/analyses, GET /api/projects/:pid/analyses, GET /api/analyses/:id, GET /api/analyses/:id/status, GET /api/analyses/:id/findings, GET /api/analyses/:id/report, GET /api/analyses/:id/export (Pro only), POST /api/analyses/:id/share, DELETE /api/analyses/:id/share, DELETE /api/analyses/:id.

### Public
GET /shared/reports/:token.

### Building Codes
GET /api/regions, GET /api/regions/:region/codes.

### Code Requests
POST /api/code-requests, GET /api/code-requests.

### Upload
POST /api/upload/presigned-url, POST /api/upload/confirm.

### Admin
POST /api/admin/codes, POST /api/admin/codes/:id/extract, GET /api/admin/codes/:id/requirements, PATCH /api/admin/requirements/:id, PATCH /api/admin/requirements/:id/verify, POST /api/admin/codes/:id/publish, PATCH /api/admin/codes/:id/deprecate, GET /api/admin/code-requests, PATCH /api/admin/code-requests/:id.

---

## 12. File Format Support

### MVP: PDF (.pdf), PNG (.png), JPEG (.jpg/.jpeg), TIFF (.tif/.tiff)
### V1.1: DXF (.dxf), DWG (.dwg via auto-conversion)
### V1.2: IFC (.ifc)

---

## 13. User Stories

### US-001: Core Schema - User, Project, Folder
**Description:** As a developer, I need foundational database tables.

**Acceptance Criteria:**
- [x] Prisma schema: User (id UUID, logto_user_id unique, email, name, tier enum FREE/PRO default FREE, analyses_remaining Integer default 2 nullable, role enum USER/ADMIN default USER, created_at, updated_at)
- [x] Project (id, user_id FK, name, description, folder_id nullable FK, created_at, updated_at)
- [x] Folder (id, user_id FK, name, created_at)
- [x] Cascade: User -> Projects, Folders
- [x] Migration runs on Railway PostgreSQL
- [x] Typecheck passes

### US-002: Schema - Analysis
**Description:** As a developer, I need the Analysis table for compliance jobs.

**Acceptance Criteria:**
- [x] Analysis: id, project_id FK, report_ref (unique), document_name, document_url, document_size, document_type (enum PDF/PNG/JPG/TIFF/DXF/IFC), page_count, description, page_numbers nullable, region (enum AU/UK/US), selected_codes JSON, status (enum PENDING/CLASSIFYING/ANALYSING/VALIDATING/GENERATING/COMPLETED/FAILED), current_stage nullable, compliance_score nullable, overall_status (enum PASS/CONDITIONAL/FAIL nullable), critical_count default 0, warning_count default 0, compliant_count default 0, not_assessed_count default 0, total_checks default 0, started_at, completed_at, created_at
- [x] Cascade: Project -> Analyses
- [x] Migration runs
- [x] Typecheck passes

### US-003: Schema - Finding
**Description:** As a developer, I need the Finding table for compliance results.

**Acceptance Criteria:**
- [x] Finding: id, analysis_id FK, code_reference, category (enum 10 values), status (enum 4 values), confidence (enum HIGH/MEDIUM/LOW), description, required_value, proposed_value nullable, page_number nullable, location nullable, analysis_notes, recommendation nullable, raw_extraction JSON nullable, sort_order
- [x] Cascade: Analysis -> Findings
- [x] Index on analysis_id + sort_order
- [x] Migration runs
- [x] Typecheck passes

### US-004: Schema - BuildingCode and CodeRequirement
**Description:** As a developer, I need code tables with full requirement schema.

**Acceptance Criteria:**
- [ ] BuildingCode: id, region enum, code_id unique, name, description, version, status (DRAFT/ACTIVE/DEPRECATED), source_document_url nullable, published_at nullable, published_by nullable FK, created_at
- [ ] CodeRequirement: id, building_code_id FK, code_ref, title, category enum, full_text, check_type enum, thresholds JSON, applies_to_drawing_types JSON, applies_to_building_types JSON, applies_to_spaces JSON, exceptions JSON, extraction_guidance, evaluation_guidance, source_page nullable, status (DRAFT/VERIFIED/PUBLISHED/DEPRECATED), created_at, updated_at
- [ ] pgvector extension enabled, embedding vector(768) on CodeRequirement
- [ ] Cascade: BuildingCode -> CodeRequirements
- [ ] Migration runs
- [ ] Typecheck passes

### US-005: Schema - CodeRequest and ShareToken
**Description:** As a developer, I need supporting tables.

**Acceptance Criteria:**
- [ ] CodeRequest: id, user_id FK, code_name, region, description nullable, reference_url nullable, status enum (5 values), admin_notes nullable, resolved_code_id nullable FK, created_at, updated_at
- [ ] ShareToken: id, analysis_id FK, token unique, is_active default true, created_at
- [ ] Migration runs
- [ ] Typecheck passes

### US-006: Seed Data - Building Codes and Sample Requirements
**Description:** As a developer, I need seed data for launch codes.

**Acceptance Criteria:**
- [ ] Seed BuildingCode: AU (5 codes), UK (1), US (2) - all ACTIVE
- [ ] Seed 10+ CodeRequirement records for IRC 2021 across categories with complete fields including extraction_guidance and evaluation_guidance, status PUBLISHED
- [ ] Seed runs without errors
- [ ] Typecheck passes

### US-007: Logto Auth - Login / Callback / Logout
**Description:** As a user, I want to sign in via Logto.

**Acceptance Criteria:**
- [ ] GET /api/auth/login redirects to Logto OIDC
- [ ] GET /api/auth/callback exchanges code, sets httpOnly/Secure/SameSite=Lax cookie
- [ ] POST /api/auth/logout clears session
- [ ] Protected routes return 401 without auth
- [ ] Typecheck passes

### US-008: Logto Webhook - User Sync
**Description:** As a new user, I get an account with 2 free analyses on signup.

**Acceptance Criteria:**
- [ ] POST /api/webhooks/logto handles user.created
- [ ] Validates signature header
- [ ] Creates User: tier=FREE, analyses_remaining=2, role=USER
- [ ] Handles duplicates gracefully
- [ ] Typecheck passes

### US-009: GET /api/auth/me
**Description:** As a user, I want my profile and tier info.

**Acceptance Criteria:**
- [ ] Validates JWT via Logto JWKS
- [ ] Returns { id, email, name, tier, analyses_remaining, role }
- [ ] 401 if invalid
- [ ] Typecheck passes

### US-010: Project CRUD
**Description:** As a user, I want project management endpoints.

**Acceptance Criteria:**
- [ ] POST creates with name/description/folder_id
- [ ] GET list paginated with analysis count
- [ ] GET detail (403 if not owner)
- [ ] PATCH updates
- [ ] DELETE cascades
- [ ] All require auth
- [ ] Typecheck passes

### US-011: Folder CRUD
**Description:** As a user, I want folder endpoints.

**Acceptance Criteria:**
- [ ] POST creates, GET lists, PATCH renames, DELETE removes (projects get null folder_id)
- [ ] All require auth
- [ ] Typecheck passes

### US-012: Analysis Creation with Tier Validation
**Description:** As a user, I want to create analyses respecting tier limits.

**Acceptance Criteria:**
- [ ] POST accepts document fields, region, selected_codes
- [ ] Generates BAC-YYYY-NNNNN report_ref
- [ ] FREE: page_count <= 5, codes <= 3, analyses_remaining > 0, decrements remaining
- [ ] PRO: page_count <= 50, no code limit
- [ ] 403 with specific message if limit exceeded
- [ ] Sets status=PENDING
- [ ] Typecheck passes

### US-013: Analysis Read and Delete
**Description:** As a user, I want to view and manage analyses.

**Acceptance Criteria:**
- [ ] GET list, GET detail, GET findings (filterable by category/status), GET report (full payload)
- [ ] DELETE removes analysis + findings
- [ ] All scoped to owner
- [ ] Typecheck passes

### US-014: Analysis Status Endpoint
**Description:** As a developer, I need lightweight polling.

**Acceptance Criteria:**
- [ ] Returns status, current_stage, score, overall_status, total_checks, timestamps
- [ ] < 50ms response
- [ ] 404 if not found/owned
- [ ] Typecheck passes

### US-015: File Upload with Tier Validation
**Description:** As a user, I want document upload with type and size checks.

**Acceptance Criteria:**
- [ ] Presigned URL validates: PDF/PNG/JPG/TIFF types, FREE <= 10MB, PRO <= 100MB
- [ ] Returns uploadUrl, fileKey
- [ ] Confirm verifies existence, returns pageCount
- [ ] Typecheck passes

### US-016: Building Codes Public Endpoints
**Description:** As a user, I want to browse codes.

**Acceptance Criteria:**
- [ ] GET regions with flags, GET codes for region (ACTIVE only) with requirement_count
- [ ] 404 for unknown region
- [ ] Typecheck passes

### US-017: Code Request Endpoints
**Description:** As a user, I want to request codes.

**Acceptance Criteria:**
- [ ] POST creates request (SUBMITTED), GET lists user's requests with status
- [ ] Auth required
- [ ] Typecheck passes

### US-018: Report Export (Pro Only)
**Description:** As a Pro user, I want PDF export.

**Acceptance Criteria:**
- [ ] GET /api/analyses/:id/export generates professional PDF (cover, summary, findings by category, matrix, disclaimer)
- [ ] 403 for FREE with upgrade message
- [ ] Filename: BuildACode_Report_{report_ref}.pdf
- [ ] Typecheck passes

### US-019: Share Report Endpoints
**Description:** As a user, I want shareable report links.

**Acceptance Criteria:**
- [ ] POST generates token + public URL
- [ ] GET /shared/reports/:token public read-only
- [ ] DELETE revokes
- [ ] Typecheck passes

### US-020: App Shell - Layout, Header, Sidebar
**Description:** As a user, I want consistent navigation.

**Acceptance Criteria:**
- [ ] Collapsible sidebar + header
- [ ] Header: logo, tier badge (FREE grey / PRO blue), avatar menu
- [ ] Sidebar: Dashboard, Projects, Folders, Supported Codes, Settings
- [ ] Collapses on narrow screens, active route highlighted
- [ ] Tailwind CSS
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-021: Dashboard
**Description:** As a user, I want activity feed and tier status.

**Acceptance Criteria:**
- [ ] Default route (/)
- [ ] Tier card with upgrade CTA for free users
- [ ] Recent 5 analyses with status chips
- [ ] Quick actions: New Project, New Analysis
- [ ] Empty state with CTA
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-022: Projects List Page
**Description:** As a user, I want to see all projects.

**Acceptance Criteria:**
- [ ] /projects paginated, cards with name/description/count/date
- [ ] New Project button, click navigates, empty state
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-023: Create/Edit Project Modal
**Description:** As a user, I want project creation/editing.

**Acceptance Criteria:**
- [ ] Modal: Name, Description, Folder dropdown
- [ ] POST or PATCH, validation, closes on success
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-024: Project Detail - Analysis History
**Description:** As a user, I want project analysis list.

**Acceptance Criteria:**
- [ ] /projects/:id with name, description, analysis table (doc name, type icon, status, score, report_ref, date, actions)
- [ ] New Analysis opens wizard, empty state
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-025: Wizard Step 1 - Upload + Details
**Description:** As a user, I want to upload and provide context.

**Acceptance Criteria:**
- [ ] Full-screen wizard, drag-drop (.pdf/.png/.jpg/.jpeg/.tif/.tiff)
- [ ] Preview, filename, size, page count on select
- [ ] Tier check: > 5 pages (free) shows upgrade CTA, disables Next
- [ ] Optional description + page numbers
- [ ] Tier info display, Next disabled until file valid
- [ ] Presigned URL upload
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-026: Wizard Step 2 - Region + Codes
**Description:** As a user, I want region and code selection with limits.

**Acceptance Criteria:**
- [ ] Region cards with flags, loads codes on select
- [ ] Checkboxes with recommended badges
- [ ] FREE: max 3, extras show lock + upgrade tooltip
- [ ] "Don't see your code?" opens request modal
- [ ] Next disabled until >= 1 selected
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-027: Wizard Step 3 - Review + Submit
**Description:** As a user, I want to review before submitting.

**Acceptance Criteria:**
- [ ] Summary of all selections, time estimate
- [ ] Submit button with tier context ("X of 2 free remaining")
- [ ] Back preserves, submit calls API, handles 403
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-028: Processing Screen
**Description:** As a user, I want live progress.

**Acceptance Criteria:**
- [ ] Timeline: Uploading, Classifying, Analysing (X of Y), Validating, Generating
- [ ] Spinner + elapsed for active, checkmark for complete
- [ ] Polls /status every 5s
- [ ] Auto-redirect on COMPLETED, error + retry on FAILED
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-029: Report Layout - Header, Score, Quick-Nav
**Description:** As a user, I want professional report layout.

**Acceptance Criteria:**
- [ ] Three-panel: left (score donut, status stamp, breakdown), centre (findings), right (quick-nav)
- [ ] Header: report_ref, project, date, PASS/CONDITIONAL/FAIL stamp, Report/Plan toggle, Share + Export
- [ ] Export: Pro downloads, Free shows upgrade CTA
- [ ] Responsive stacking
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-030: Finding Cards with Categories and Confidence
**Description:** As a user, I want grouped, confidence-scored findings.

**Acceptance Criteria:**
- [ ] Grouped by category headers
- [ ] Cards: code_ref, status badge, confidence badge (HIGH green/MEDIUM amber/LOW red dashed), Required vs As Shown, page ref, recommendation callout
- [ ] Critical: red border, LOW confidence: dashed + "Verify manually"
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-031: Quick-Nav Sidebar + Filtering
**Description:** As a user, I want to filter and jump to findings.

**Acceptance Criteria:**
- [ ] Colour-coded dots + code_ref list, click scrolls
- [ ] Filter tabs: All/Critical/Warning/Compliant/Not Assessed
- [ ] Search by code_ref or keyword
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-032: Original Plan Viewer
**Description:** As a user, I want to view uploaded documents.

**Acceptance Criteria:**
- [ ] Plan toggle replaces centre with viewer (react-pdf for PDF, image viewer for images)
- [ ] Page nav + zoom, "View Page" links from findings
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-033: Worker Setup - BullMQ Consumer
**Description:** As a developer, I need queue infrastructure.

**Acceptance Criteria:**
- [ ] Connects to Railway Redis, listens on 'analysis-processing'
- [ ] On job: sets CLASSIFYING + started_at
- [ ] On failure: FAILED, retries 3x (30s/60s/120s backoff), 10min timeout
- [ ] Typecheck passes

### US-034: Pipeline - Document Normalisation
**Description:** As a developer, I need file normalisation.

**Acceptance Criteria:**
- [ ] Fetch from Buckets, PDF to 300 DPI PNGs + text, images to PNG, TIFF split
- [ ] Store pages in Buckets under analysis prefix
- [ ] Updates current_stage
- [ ] Typecheck passes

### US-035: Pipeline - Page Classification
**Description:** As a developer, I need page type detection.

**Acceptance Criteria:**
- [ ] Each page to Gemini with classification prompt
- [ ] Returns page_type, description, scale_detected
- [ ] Updates current_stage
- [ ] Typecheck passes

### US-036: Pipeline - Matrix Analysis
**Description:** As a developer, I need the core code x page analysis loop.

**Acceptance Criteria:**
- [ ] Fetch PUBLISHED CodeRequirements for selected codes
- [ ] Build matrix: requirement x matching pages
- [ ] Construct prompts from requirement fields
- [ ] Gemini calls with image + prompt, parse JSON response
- [ ] Parallel batches (max 10 concurrent)
- [ ] Progressive total_checks update
- [ ] Typecheck passes

### US-037: Pipeline - Cross-Validation + Scoring
**Description:** As a developer, I need validation and scoring.

**Acceptance Criteria:**
- [ ] Cross-page comparison, conflict flagging
- [ ] Deduplication keeping highest confidence
- [ ] Score calculation, overall_status assignment
- [ ] Count fields populated
- [ ] Typecheck passes

### US-038: Pipeline - Recommendations + Completion
**Description:** As a developer, I need final recommendations and save.

**Acceptance Criteria:**
- [ ] Non-compliant findings to Gemini for coordinated recommendations
- [ ] Category assignment, sort_order (Critical first, by category)
- [ ] Save all Findings, set COMPLETED + completed_at
- [ ] Typecheck passes

### US-039: Analysis Creation - Queue Dispatch
**Description:** As a developer, I need job dispatch on analysis creation.

**Acceptance Criteria:**
- [ ] POST analysis enqueues BullMQ job { analysisId }
- [ ] After DB insert + tier validation
- [ ] Queue failure: set FAILED, return 500
- [ ] Typecheck passes

### US-040: Admin Route Protection
**Description:** As a developer, I need admin-only routes.

**Acceptance Criteria:**
- [ ] Middleware checks role=ADMIN on /api/admin/* and /admin/*
- [ ] 403 for non-admin
- [ ] Logto RBAC "admin" role configured
- [ ] Typecheck passes

### US-041: Admin - Code List + Create
**Description:** As an admin, I want to manage building codes.

**Acceptance Criteria:**
- [ ] /admin/codes lists all codes: name, region, version, status chip, requirement count
- [ ] "Add Code" form: name, region, code_id, version, description -> DRAFT
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-042: Admin - AI Requirement Extraction
**Description:** As an admin, I want AI-extracted requirements from code PDFs.

**Acceptance Criteria:**
- [ ] Upload PDF button, stores in Buckets
- [ ] "Extract" triggers Gemini extraction
- [ ] Saves draft CodeRequirements
- [ ] Progress: "X requirements found"
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-043: Admin - Requirement Review + Edit
**Description:** As an admin, I want to verify extracted requirements.

**Acceptance Criteria:**
- [ ] Table: code_ref, title, category, status
- [ ] Edit form with all fields including JSON editors for thresholds/exceptions
- [ ] Verify button, Delete button, Bulk "Verify All"
- [ ] Status filter
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-044: Admin - Publish Code
**Description:** As an admin, I want to publish verified codes.

**Acceptance Criteria:**
- [ ] Publish button (disabled if 0 verified), confirmation dialog
- [ ] Generates embeddings, sets PUBLISHED/ACTIVE, records published_at/by
- [ ] Deprecate button for old versions
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-045: Admin - Code Request Triage
**Description:** As an admin, I want to manage user requests.

**Acceptance Criteria:**
- [ ] /admin/code-requests grouped by code_name with request counts, sorted by count
- [ ] Detail: user info, description, notes, status dropdown
- [ ] Links to resolved_code_id when published
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-046: User - Code Request Form
**Description:** As a user, I want to request missing codes.

**Acceptance Criteria:**
- [ ] Accessible from wizard Step 2 and /codes page
- [ ] Modal: Code Name, Region, Description, Reference URL
- [ ] Success confirmation message
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-047: Supported Codes Page + My Requests
**Description:** As a user, I want to browse codes and track requests.

**Acceptance Criteria:**
- [ ] /codes lists ACTIVE codes by region
- [ ] "Request a Code" button
- [ ] "My Requests" tab: request list with status chips
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-048: Folder Sidebar Integration
**Description:** As a user, I want folders in the sidebar.

**Acceptance Criteria:**
- [ ] Expandable folders section, click filters projects
- [ ] New Folder inline, rename/delete via menu
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-049: Keyboard Shortcuts
**Description:** As a power user, I want shortcuts.

**Acceptance Criteria:**
- [ ] N/search/F/E/? shortcuts, only when no input focused
- [ ] ? overlay
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

## 14. Non-Goals
- No Stripe in MVP (Pro tier manually assigned)
- No team collaboration (single-user)
- No custom code upload by users (admin-managed)
- No Chat with Docs
- No mobile-native app
- No revision tracking
- No notifications in MVP
- No DXF/IFC in MVP
- No auto code selection
- No real-time collaboration

---

## 15. Phased Roadmap

### MVP: Full platform with PDF/image support, code x page pipeline, tiered pricing, admin code management, user code requests, professional reports.
### V1.1: DXF/DWG support, dual-source validation, Stripe billing, email notifications.
### V1.2: IFC/BIM support, ground-truth anchoring, more regions, team collaboration.
### Future: Chat with Docs, revision tracking, custom code upload, mobile apps, API access.

---

## 16. Technical Considerations
- Gemini 2.5 Flash Preview configured via VISION_MODEL env var
- Logto handles all auth UI + RBAC for admin role
- Railway internal networking for low latency
- Presigned URLs for direct upload, page count server-side
- BullMQ with exponential backoff retry
- pgvector ready for Chat with Docs
- Railway-native CI/CD
- react-pdf / PDF.js for viewer
- @react-pdf/renderer or puppeteer for export
- WCAG 2.1 AA target
- BAC-YYYY-NNNNN via atomic DB sequence
- 10 concurrent vision calls per batch
- Building code licensing verification per jurisdiction

---

## 17. Success Metrics

| Metric | Target |
|--------|--------|
| Completion Rate | > 95% |
| Processing Time | < 3 min |
| 30-day Retention | > 40% |
| Free to Pro Conversion | > 15% |
| Export Rate (Pro) | > 60% |
| Error Rate | < 2% |

Quality: Measurement accuracy, code matching precision, confidence calibration, false positive rate, NOT_ASSESSED rate.

---

## 18. Glossary
IBC (International Building Code), IRC (International Residential Code), NCC (National Construction Code), DXF (Drawing Exchange Format), IFC (Industry Foundation Classes), BIM (Building Information Modelling), CodeRequirement (structured checkable requirement), Code x Page Matrix (analysis approach), report_ref (BAC-YYYY-NNNNN), Logto (auth platform), Railway (infrastructure), OIDC (auth protocol), RBAC (role-based access), pgvector (vector search extension).
