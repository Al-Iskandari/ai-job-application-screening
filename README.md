# 🤖 AI Job Application Screening System

An AI-powered document screening platform that evaluates job application documents (CVs and Case Study Project Report) using Google Gemini, Supabase, and Zilliz Vector DB.  
The system automatically parses uploaded PDF documents, stores and retrieves vector embeddings, and runs evaluation tasks asynchronously through a Redis-backed worker queue.

---

## 🧭 Features

- 🧾 Upload & parse PDF documents (including scanned files)  
- 🤖 Evaluate candidates using Gemini AI  
- 📦 File storage via Supabase  
- 🔍 Vector similarity search via Zilliz Cloud (Milvus)  
- ⚙️ Job queue management via BullMQ + Redis  
- 🔐 Secure authentication via Firebase Auth  
- 🐳 Full Dockerized development environment  
- 🚀 Ready for deployment on AWS (EC2 / ECS / ECR)

---

## 🧰 Technologies Used

| Category | Technology / Service | Purpose |
|-----------|----------------------|----------|
| **Backend** | Node.js + Express (TypeScript) | REST API server |
| **Worker Queue** | BullMQ + Redis | Background job & task queue |
| **Database & Storage** | Supabase | Candidate data + file storage |
| **Vector Database** | Zilliz Cloud (Milvus) | Document embeddings |
| **AI Model** | Google Gemini API (`@google/genai`) | Intelligent evaluation |
| **Auth** | Firebase Auth (client) + Firebase Admin (server) | Secure user authentication |
| **Frontend** | Static HTML + Alpine.js + TailwindCSS | Lightweight UI |
| **Containerization** | Docker + Docker Compose | Portable development & deployment |
| **Deployment** | AWS EC2 (Free Tier) | Hosting backend services |

---

## ⚙️ Installation Guide

### 🪶 Prerequisites

Ensure you have these installed:
- **Node.js** ≥ 18
- **npm** ≥ 9
- **Docker** & **Docker Compose**
- **Git**

### 🧱 1. Clone the Repository

```bash
git clone https://github.com/Al-Iskandari/ai-job-application-screening.git
cd ai-job-application-screening
```

### ⚙️ 2. Copy Environment Variables

Create your environment file:

```bash
cp .env.example .env
```

Edit .env and fill in your keys:

```bash
PORT=4000
NODE_ENV=development
# NODE_ENV=production

# Firebase service account JSON path (or base64 encoded)
FIREBASE_SERVICE_ACCOUNT_JSON_PATH=./firebaseAcount.json
FIREBASE_PROJECT_ID=project-id

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_role_key
# Google (PaLM / Gemini)
GOOGLE_API_KEY=google-api-key
GOOGLE_PROJECT_ID=project-id
GOOGLE_REGION=us-central1

# Zilliz Cloud
ZILLIZ_API_KEY=zilliz-api-key
ZILLIZ_BASE_URL=https://......serverless.aws-eu-central-1.cloud.zilliz.com

# Redis for BullMQ
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis-password

# Optional internal JWT secret
JWT_SECRET=jwt-screet

# Max file size
MAX_UPLOAD_BYTES=10485760  # 10MB
```
### 🧩 3. Install Dependencies
```bash
npm install
```
### 4. Run Locally (Development)

Run the API and worker simultaneously:
```bash
npm run dev
```

Access:

[API:http://localhost:4000](http://localhost:4000)
[Frontend: http://localhost:4000](http://localhost:4000)

### 🐳 5. Run via Docker

Build and start all services (Express, Redis, Worker):
```bash
npm run docker:build
npm run docker:up
```
To stop and remove containers:
```bash
npm run docker:down
```
Check logs:
```bash
npm run docker:logs
```

## 🧪 6. Usage Instructions
1. Sign In with Google
    * Firebase Auth handles login via Google popup.
    * No custom login UI required.

2. Upload Resume / CV
    * Supported formats: .pdf only
    * Large PDFs automatically handled in chunks.

3. Processing & Evaluation
    * The file is uploaded to Supabase Storage.
    * A worker pulls the job from Redis and:
    * Parses the document.
    * Embeds vectors into Zilliz.
    * Sends content to Gemini for evaluation.
    * Stores structured results in Supabase.

4. View Results
    * The frontend polls /api/result/:candidate_id.
    * Once processed, the analysis appears in the dashboard.

## 🧯 7. Error Handling

The system gracefully handles:

* Empty or invalid PDF uploads
* Image-based (scanned) PDFs
* Irrelevant or unsupported file extensions
* Supabase / Zilliz / Gemini downtime
* Quota or rate-limit exceed
* Frontend offline or page refresh during upload
* Worker / Redis connection errors


## 🧩 Project Structure
```bash
docker-compose.yml
Dockerfile
package.json
package-lock.json
tsconfig.json
smartmenu-63146-aa95fca1f3f7.json
src/
├── api/
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── errorHandler.ts
|   └── routes.ts
├── config/
│   └── index.ts
├── services/
│   ├── evaluator.ts
│   ├── firebaseOld.ts
│   ├── geminiClient.ts
│   ├── queue.ts
│   ├── supabase.ts
│   └── zillizClient.ts
├── utils/
│   ├── pdf.ts
│   ├── PipelineStagesHandler.ts
│   ├── resilienceHelper.ts
│   ├── validators.ts
├── script/
│   └── loadSystemDocs.ts
├── server.ts           # Main Express server
├── worker.ts           # Background job processor
public/
├── data/
│   ├── case_study.pdf
│   ├── job_description.pdf
│   ├── rubric_cv.pdf
│   └── rubric_project.pdf
└── index.html         # Frontend UI (Alpine.js + Tailwind)
```

## 🧾 License

This project is licensed under the Apache 2.0 License.

## 💬 Contact

For collaboration or support, reach out via:
📧 <iskandar.jn23@gmail.com>
🌐 [iskandarjn.my.id](https://iskandarjn.my.id)