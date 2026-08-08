# KJ-Gold-Appraiser-System
> A full-stack web application for jewelry businesses to generate, track, and print professional gold appraisal certificates.

## 🧭 At a Glance
- **What it is:** A specialized CRUD application for gold appraisal management.
- **What problem it solves:** Automates the manual, error-prone process of calculating gold values and generating formatted PDF certificates.
- **Who uses it:** Jewelry store owners and gold appraisers.
- **Complexity level:** Intermediate.
- **Best way to explore:** Start with `backend/src/server.js` to understand the API surface, then examine `frontend/src/pdf/pdfGenerator.js` for the core business logic.

## 💡 Why This Exists
Before this system, gold appraisers likely relied on manual spreadsheets or paper-based forms to track appraisals, leading to inconsistent certificate formatting and lost historical data. This project centralizes the appraisal workflow into a digital system.

The insight here is the integration of real-time calculation logic with automated PDF generation. By coupling the frontend's calculation utilities (`frontend/src/utils/calculations.js`) with a dedicated PDF rendering engine, the system ensures that the certificate printed for the customer is mathematically consistent with the data stored in the database.

It fits into the "Business Automation" niche, specifically targeting small-to-medium enterprises that require professional-grade documentation without the overhead of enterprise-level ERP software.

## ✨ Key Features
- **Automated PDF Generation** — Converts appraisal data into formatted, printable certificates, reducing manual document drafting time.
- **Role-Based Access Control** — Restricts administrative settings and dashboard access via `backend/src/middleware/auth.js`, ensuring data integrity.
- **Dynamic Appraisal Calculations** — Uses shared utility logic to compute gold values based on purity and weight, minimizing human arithmetic errors.
- **Certificate History Tracking** — Maintains a record of all appraisals, allowing for quick retrieval and re-printing of past documents.
- **Health Monitoring** — Includes a dedicated health check service (`backend/src/services/health.service.js`) to ensure the backend and database connectivity are operational.

## 🏗️ Core Architecture
- **System Design Pattern**: Client-Server (Monolithic backend with a decoupled React frontend).
- **Data Flow**: User inputs appraisal data in `CertificatePage.jsx` → `certificateApi.js` sends POST to `certificate.controller.js` → Data is persisted to the database → PDF is generated via `pdfGenerator.js` for client-side rendering.
- **Key Abstractions**: `Certificate` (the primary domain entity), `Renderer` (the PDF generation logic), and `Middleware` (the security and validation layer).
- **Boundaries & Seams**: The system relies on external database connectivity (SQL) and browser-based PDF printing APIs.

## 🛠️ Tech Stack
- **Languages & Frameworks:** Node.js (Express.js), React.js.
- **Build & Tooling:** Vite (frontend), PM2 (process management via `ecosystem.config.js`), ESLint.
- **Infrastructure:** Docker (containerized backend), Vercel (frontend deployment).
- **External Runtime Requirements:** PostgreSQL (or compatible SQL database), Node.js runtime (v16+).

## 📦 Critical Dependencies
- `express` — The backbone of the backend API; without it, the routing and middleware architecture fails.
- `pdfmake` — The engine for generating PDF documents; essential for the core "Appraisal Certificate" feature.
- `jsonwebtoken` — Handles stateless authentication; critical for securing routes and identifying users.
- `pg` — The PostgreSQL client; required for all database persistence operations.

## 🗂️ Project Structure
```text
/.github            → CI/CD workflows (keep-alive)
/backend            → Node.js/Express API server
/database           → SQL schema and migration scripts
/frontend           → React SPA with Tailwind CSS
```
*Mental Map: To understand this project, think of it as a digital ledger that transforms raw gold weight/purity inputs into formal legal documents.*

## 🔍 Where to Start Reading
**For engineers:**
- `backend/src/server.js` — *The entry point defining the API lifecycle.*
- `backend/src/middleware/auth.js` — *The security gatekeeper for all protected routes.*
- `database/schema.sql` — *The source of truth for the application's data model.*

**For learners:**
- `frontend/src/components/layout/Sidebar.jsx` — *A clean example of component-based UI structure.*
- `frontend/src/utils/calculations.js` — *Pure logic functions that are easy to test and understand.*
- `frontend/src/hooks/useCertificate.js` — *Shows how React hooks bridge the UI and API services.*

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL instance
- `.env` file (configured with `DB_URL`, `JWT_SECRET`)

### Setup
```bash
# Install backend dependencies
cd backend && npm install
# Run database migrations
npm run migrate
# Start the server
npm start
```

### Verify It's Working
Navigate to `http://localhost:3000/health` (or configured port). You should see a JSON response indicating the service is `UP`.

## 🤝 How to Contribute

**Contribution path for first-timers:**
1. **Documentation:** Add JSDoc comments to the `utils` folder.
2. **Low-risk edit:** Update `frontend/src/components/layout/Sidebar.jsx` to add new navigation links.
3. **PR Standard:** Ensure all changes pass local linting and include a description of the business logic impact.

**Testing & linting:**
```bash
# Run linting
npm run lint
```

## 📚 What You'll Learn
- **Full-stack integration:** Connecting a React frontend to an Express backend.
- **PDF Generation:** Programmatically creating documents from JSON data.
- **Middleware patterns:** Implementing authentication and request logging in Node.js.
- **Database Schema Design:** Managing relational data for business entities.

## 🤖 Machine-Readable Metadata [AI-READABLE]
```yaml
repo: chander5383/KJ-Gold-Appraiser-System
description: "Gold appraisal management and certificate generation system."
stars: 0
forks: 0
open_issues: 0
language: "JavaScript"
license: "none"
architecture_pattern: "Client-Server"
entry_point: "backend/src/server.js"
external_dependencies_required: true
test_command: "npm test"
ci_present: true
```

## 📊 Quick Stats [AI-READABLE]
| Metric | Value |
|--------|-------|
| ⭐ Stars | 0 |
| 🍴 Forks | 0 |
| 🐛 Open Issues & PRs | 0 |
| 💬 Primary Language | JavaScript |
| ⚖️ License | N/A |
