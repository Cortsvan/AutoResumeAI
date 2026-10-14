# AutoResumeAI

**AutoResumeAI** is an intelligent, conversational resume studio that helps professionals elevate their resumes, tailor their experience to job descriptions, and create ATS-optimized resumes from scratch—**without compromising original typography, spacing, or document layout**.

Unlike traditional tools that convert documents to lossy HTML or plain text, AutoResumeAI edits native **OpenXML packages (`.docx`)** at the character-run level, preserving margins, columns, custom fonts, tab-stops, and tables with pixel precision.

---

## Table of Contents

- [Key Features](#key-features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Security & Global Spending Protection](#security--global-spending-protection)
- [User Registration & Quota System](#user-registration--quota-system)
- [Privacy Policy & Terms of Service](#privacy-policy--terms-of-service)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Database Setup (Supabase)](#database-setup-supabase)
- [Running Locally](#running-locally)
- [Production Deployment](#production-deployment)
- [Administration & Scripts](#administration--scripts)
- [Verification & Automated Tests](#verification--automated-tests)

---

## Key Features

1. **DOCX Preservation Pipeline**:
   - Directly inspects and rewrites native OpenXML structures (`word/document.xml`, character runs, headers, footers).
   - Replaces text within granular `<w:t>` character runs while keeping parent run styles (`<w:rPr>`), tabs (`<w:tab/>`), line breaks (`<w:br/>`), and table geometries intact.
   - The user's original uploaded file is stored as an **immutable master copy**; all AI modifications occur on isolated working drafts.

2. **Conversational AI Coaching & Suggestion Engine**:
   - Replaces passive verbs with high-impact action verbs and quantifies business accomplishments.
   - Delivers atomic, reviewable suggestions with side-by-side or inline word diffs (visualizing exact additions and deletions).
   - Full user autonomy: **Accept**, **Edit & Accept**, or **Reject** suggestions individually, or **Accept All**.

3. **Job Description Tailoring**:
   - Paste any target job description to instantly analyze match strength and identify missing keywords.
   - Generates targeted bullet points reflecting evidenced experience without hallucinating false credentials.
   - Create separate, dedicated resume variants for different applications while keeping the master resume intact.

4. **Creation from Scratch & ATS Templates**:
   - Three built-in, ATS-friendly layouts: **Classic**, **Modern**, and **Compact**.
   - Generates clean, standard `.docx` files with accurate tab-stops, bullet hierarchies, and standard typography.
   - Flexible dual mode: interactive form builder or natural language conversational builder.

5. **In-Browser Document Preview & Export**:
   - Instant visual rendering of native `.docx` files directly in the browser via `docx-preview`.
   - Full version history checkpoints with one-click undo/redo for all accepted edits.
   - Export standard, genuine `.docx` files ready for direct employer submission or ATS scanning.
---

## Architecture & Tech Stack

```
AutoResumeAI/
├── api/                          # Vercel Serverless Function entrypoint
├── src/                          # React + Vite Client Application
│   ├── app/                      # Reactive store, Supabase client & global state
│   ├── components/
│   │   ├── chat/                 # Chat panel, suggestion cards, diff inspectors
│   │   ├── landing/              # Interactive hero, live demo sandbox, how-it-works
│   │   ├── layout/               # Partitioned sidebar, mobile navigation
│   │   ├── modals/               # Auth, Upload, Tailor, Redesign, Terms, Privacy
│   │   ├── preview/              # DOCX viewer, run-level diff tracker, structured editor
│   │   └── ui/                   # Reusable buttons, badges, modals, toast alerts
│   ├── pages/                    # LandingPage, WorkspacePage, AdminDashboard
│   └── services/                 # IndexedDB client, API service layer, chat orchestrator
├── server/                       # Node.js + Express Hardened API Server
│   ├── src/
│   │   ├── config/               # App configuration, rate limits, spending thresholds
│   │   ├── controllers/          # Controllers for chat, documents, and admin dashboard
│   │   ├── middleware/           # Rate limiting, auth verification, quota guard, spending guard
│   │   ├── services/
│   │   │   ├── ai/               # OpenRouter / OpenAI / Anthropic clients & validation
│   │   │   ├── documents/        # OpenXML DOM parsing, paragraph walker, run-level diff patcher
│   │   │   └── resumes/          # Template generator & ATS structure heuristics
│   │   └── validators/           # Strict Zod payload validation schemas
│   └── scripts/
│       ├── makeAdmin.js          # CLI script to promote a user to administrator
│       ├── securityAudit.js      # 14-point automated security & defense test suite
│       └── smoke.js              # DOCX OpenXML roundtrip integrity verification
├── shared/                       # Pure shared algorithms (word-level textDiff)
├── vercel.json                   # Vercel build routing and serverless function rewrites
└── README.md
```

- **Frontend**: React 19, Vite, Tailwind CSS, `@supabase/supabase-js`, `docx-preview`, `idb` (IndexedDB).
- **Backend**: Node.js, Express 5, `@xmldom/xmldom`, `jszip`, `docx`, `helmet`, `express-rate-limit`, `zod`.
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security, Secure JWTs).
- **AI Integration**: OpenRouter (default: `deepseek/deepseek-v4.1-flash`), OpenAI-compatible providers, or Anthropic.

---

## Security & Global Spending Protection

To prevent runaway billing and API overages, AutoResumeAI incorporates a **three-tier defensive guardrail architecture**:

```
[ Incoming AI Request ]
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 1: User-Level Quotas                                  │
│ - Standard Users: 10 requests / 24-hr UTC window            │
│ - Max Output Tokens: 1,500 tokens per suggestion            │
│ - Admins / Unlimited Accounts: Daily personal limit bypassed│
└─────────────────────────────────────────────────────────────┘
          │ (Quota OK)
          ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 2: Universal Global Spending Guard (Server-Side)        │
│ - Applies to ALL users, INCLUDING Admins & Unlimited tiers │
│ - Total Budget: $5.00 (configurable via GLOBAL_BUDGET_USD)  │
│ - Shutoff Threshold: $4.00 (via GLOBAL_THRESHOLD_USD)       │
│ - Emergency Reserve: $1.00 (via GLOBAL_RESERVED_USD)        │
│ - Shuts off paid calls when usage reaches threshold or if  │
│   billing data cannot be verified.                         │
└─────────────────────────────────────────────────────────────┘
          │ (Budget OK)
          ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 3: Upstream Provider Hard Limit (OpenRouter Dashboard) │
│ - Real balance credit limits enforced on OpenRouter account │
│ - Zero risk of unexpected overdrafts                        │
└─────────────────────────────────────────────────────────────┘
```

### Provider-Side Hard Limit Configuration
In addition to internal server guards, set a hard credit limit directly in your [OpenRouter Account Settings](https://openrouter.ai/settings):
1. Navigate to **OpenRouter Dashboard > Billing**.
2. Set a **Credit Limit** matching your intended expenditure (e.g., $5.00).
3. AutoResumeAI will track usage internally up to your threshold ($4.00), keeping an extra reserve before the provider ceiling is ever reached.

---

## User Registration & Quota System

### Registration Workflow
The registration modal requires:
- **First Name** (`first_name`)
- **Last Name** (`last_name`)
- **Email** (`email`)
- **Password** (min. 6 characters)
- **Confirm Password** (client-validated password matching)

When a user signs up:
1. Supabase Auth creates the secure credentials in `auth.users`.
2. The database trigger `on_auth_user_created` automatically inserts a corresponding profile into `public.profiles` populated with their first name, last name, and computed full name.
3. The user is assigned the `standard` role with a default quota of **10 AI transformations per UTC day**.

### Account Roles & Tiers
| Role / Flag | Daily AI Limit | Global Spending Guard | Local Data Isolation |
|---|---|---|---|
| **Standard User** | 10 requests / day (resets 00:00 UTC) | Enforced | Isolated by user ID |
| **Unlimited User** | Unlimited personal requests | Enforced | Isolated by user ID |
| **Administrator** | Unlimited personal requests | Enforced | Isolated by user ID |

---

## Privacy Policy & Terms of Service

Both **Terms of Service** and **Privacy Policy** are accessible directly in the application via modal dialogs in the Landing Page footer, Settings menu, and Registration form.

### Document Ownership & Terms
- **100% User Ownership**: Users retain full copyright and ownership over all uploaded resumes, job descriptions, and generated variants. AutoResumeAI asserts no ownership or intellectual property rights over user documents.
- **Advisory AI**: All AI suggestions, keyword match evaluations, and phrasing updates are advisory recommendations. The user maintains final review and editing authority.
- **Fair Use**: Scripted scraping, bot abuse, and credential sharing are strictly disallowed.

### Privacy Safeguards
- **Local-First Architecture**: Resumes, version checkpoints, drafts, and conversation histories are stored directly in the user's browser **IndexedDB** database. No resumes are stored in a persistent remote database.
- **Account Data Isolation**: If multiple individuals share a computer or browser, signing into different accounts isolates the IndexedDB storage per user ID.
- **Volatile In-Memory Processing**: When documents are uploaded for structure inspection or XML diffing, they are processed strictly in server RAM and immediately discarded. No user files are saved to server disks.
- **No Model Training**: Resume text transmitted to OpenRouter is processed under transient, zero-retention policies and is **never used to train public foundation models**.

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher (tested on Node v20 and v24)
- **npm**: `v9.0.0` or higher
- **Supabase Account**: Free project tier on [supabase.com](https://supabase.com) (for authentication & user quotas)
- **OpenRouter API Key** *(Optional)*: For live AI suggestion generation; without this, the application operates in **Demo Mode**.

---

## Environment Configuration

### 1. Frontend Configuration (`.env`)
Create a `.env` file in the project root directory:

```bash
# Supabase Frontend Configuration (Publishable / Anon Key)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-anon-key

# API Server URL (leave empty for same-origin, or set for custom backend)
# IMPORTANT: Remote hosts (like Railway) must include https://
VITE_API_BASE_URL=http://localhost:8787
```

### 2. Backend Configuration (`server/.env`)
Create a `server/.env` file:

```bash
PORT=8787
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

# AI Provider Configuration (OpenRouter recommended)
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash

# Supabase Backend Configuration (Secret / Service Role Key - Never expose to client)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-secret-service-role-key

# Universal Global AI Spending Protection
GLOBAL_BUDGET_USD=5.00
GLOBAL_THRESHOLD_USD=4.00
GLOBAL_RESERVED_USD=1.00

# User Quotas & Token Capacities
DEFAULT_DAILY_REQUEST_LIMIT=10
MAX_OUTPUT_TOKENS=8000

# File Upload Limit
MAX_UPLOAD_MB=5
```

> **Security Note**: Never commit `.env` or `server/.env` files to source control. They are ignored by default in `.gitignore`.

---

## Database Setup (Supabase)

Setting up the database takes under two minutes using the Supabase Web Console:

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard) and open your project.
2. Click **SQL Editor** in the left navigation sidebar.
3. Paste and run your project database schema SQL script.
4. Promote your own registered administrator account in the SQL Editor:
   ```sql
   SELECT public.make_admin('your-registered-email@example.com');
   ```

### What this sets up:
- `public.profiles`: User details (`email`, `first_name`, `last_name`, `role`, `account_status`, `is_unlimited`, `daily_limit`).
- `public.daily_usage`: Tracks daily API calls and cost per user account.
- `public.ai_usage_logs`: Request-level token, model, and cost logging.
- `public.global_budget`: Universal ledger tracking global spending, thresholds, and inflight reserve.
- `public.admin_audit_logs`: Immutable audit trails for all administrative actions.
- `public.resumes` & `public.conversations`: User cloud document and chat history storage.
- `public.handle_new_user()`: Automated trigger creating a profile whenever a new user registers.
- **Row Level Security (RLS) & SQL Grants**: Enforces that users can only read and write their own data, while service roles handle administrative quota and budget operations. Sensitive RPC functions are revoked from client execution.

---

## Running Locally

### Install Dependencies
```bash
# Install workspace dependencies for both frontend and backend
npm install
```

### Start Development Server
```bash
npm run dev
```
This runs both servers concurrently:
- **Vite Web Application**: [http://localhost:5173](http://localhost:5173)
- **Express Backend API**: [http://localhost:8787](http://localhost:8787)

To run them in dedicated terminal windows:
```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev:web
```

---

## Production Deployment

### Option 1: Frontend on Vercel + Backend on Railway (Recommended)

This split architecture gives you instant global CDN delivery for the React app on Vercel with a resilient, persistent Node.js environment for OpenXML document processing and OpenRouter API calls on Railway.

#### 1. Deploy the Backend to Railway
1. Push your repository to GitHub.
2. In Railway, click **New Project** > **Deploy from GitHub repo**.
3. Set the **Root Directory** to `server` (or leave root with start command `npm start --workspace server`).
4. In Railway **Variables**, configure:
   - `PORT`: `8787` (or Railway default)
   - `NODE_ENV`: `production`
   - `CLIENT_ORIGIN`: `https://your-app.vercel.app` *(your Vercel production domain)*
   - `OPENROUTER_API_KEY`: `your_openrouter_api_key`
   - `OPENROUTER_MODEL`: `deepseek/deepseek-v4.1-flash`
   - `SUPABASE_URL`: `https://your-project.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your_supabase_secret_service_role_key`
   - `GLOBAL_BUDGET_USD`: `5.00`
   - `GLOBAL_THRESHOLD_USD`: `4.00`
   - `GLOBAL_RESERVED_USD`: `1.00`
5. Note your public Railway domain: `https://your-backend.up.railway.app`.

#### 2. Deploy the Frontend to Vercel
1. In Vercel, click **Add New...** > **Project** and import your GitHub repository.
2. Configure project settings:
   - **Root Directory**: `./` *(default root)*
   - **Framework Preset**: **Vite**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `your-supabase-publishable-anon-key`
   - `VITE_API_BASE_URL`: `https://your-backend.up.railway.app` *(must include `https://`, no trailing slash)*
4. Click **Deploy**.

---

### Option 2: Single-Instance Node.js Server

You can also host both the static frontend and the API server together on a single VPS, Docker container, or cloud host:

1. **Build the Frontend**:
   ```bash
   npm run build
   ```
2. **Start the Production Server**:
   ```bash
   npm start
   ```
The Express backend automatically serves the pre-built static bundle from `dist/` and hosts the API endpoints on port `8787` (or your configured `PORT`).

---

## Administration & Scripts

### Promote a User to Administrator
To grant an account administrator privileges and unlimited personal requests:

```bash
npm run make-admin --workspace server user@example.com
```

*Note: The user must register an account on the website first before being promoted.*

### Automated Smoke Tests
To verify DOCX OpenXML DOM manipulation, run-level diffing, and template generation:

```bash
npm run smoke --workspace server
```

### Security & Spending Guard Audit
To execute the automated 14-point security and spending protection suite:

```bash
npm run test:security --workspace server
```
This tests:
- Spending guard threshold cutoff ($4.00 limit enforcement)
- Reserve balance defense ($1.00 buffer preservation)
- Malformed OpenXML & ZIP bomb rejection
- Path traversal & payload overflow resistance
- Quota bypass prevention and role escalation defense

---

## Verification & Technical Boundaries

- **Strictly DOCX**: PDF format conversion is intentionally excluded. Reverse-converting PDFs produces distorted columns, scrambled tabular data, and lost font metrics. By focusing exclusively on OpenXML DOCX, AutoResumeAI preserves exact typographic formatting.
- **True Desktop Word Compatibility**: Browser previews via `docx-preview` display the document DOM, but Microsoft Word calculates local typography based on installed OS printer drivers and local font metrics. The exported `.docx` document is always the authoritative source of truth.

---

## License & Copyright

© 2026 AutoResumeAI. All rights reserved.

This project and its source code are provided for viewing and educational purposes only. You may not copy, modify, distribute, or use any part of this codebase for commercial or personal projects without explicit permission.
