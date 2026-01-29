# E-Mail Kategorisierung System - Architektur

## 1. System-Architektur (Textdiagramm)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL PLATFORM                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────┐    ┌──────────────────────────────────┐  │
│  │         NEXT.JS APP              │    │       VERCEL CRON JOBS           │  │
│  │         (apps/web)               │    │                                   │  │
│  │                                  │    │  ┌─────────────────────────────┐  │  │
│  │  ┌────────────────────────────┐  │    │  │  /api/cron/process-emails   │  │  │
│  │  │    React + shadcn/ui       │  │    │  │  Runs every 5 minutes       │  │  │
│  │  │                            │  │    │  └─────────────────────────────┘  │  │
│  │  │  - Dashboard               │  │    │                                   │  │
│  │  │  - Provider Connect        │  │    └──────────────┬───────────────────┘  │
│  │  │  - Category Config         │  │                   │                      │
│  │  │  - Label Mapping           │  │                   │                      │
│  │  │  - Audit Log               │  │                   ▼                      │
│  │  │  - Review Queue            │  │    ┌──────────────────────────────────┐  │
│  │  └────────────────────────────┘  │    │       API ROUTES (Next.js)       │  │
│  │                                  │    │       (apps/web/app/api)          │  │
│  │  ┌────────────────────────────┐  │    │                                   │  │
│  │  │    API Routes (Next.js)    │◄─┼────┤  - /api/auth/[provider]          │  │
│  │  │                            │  │    │  - /api/connections               │  │
│  │  │  - OAuth Callbacks         │  │    │  - /api/categories                │  │
│  │  │  - CRUD Operations         │  │    │  - /api/rules                     │  │
│  │  │  - Webhook Handlers        │  │    │  - /api/labels                    │  │
│  │  └────────────────────────────┘  │    │  - /api/emails/process            │  │
│  │                                  │    │  - /api/audit                      │  │
│  └──────────────────────────────────┘    └──────────────┬───────────────────┘  │
│                                                          │                      │
└──────────────────────────────────────────────────────────┼──────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────────┐   │
│  │   NEON POSTGRES   │  │  GMAIL API        │  │   MICROSOFT GRAPH API     │   │
│  │   (Free Tier)     │  │  (OAuth 2.0)      │  │   (OAuth 2.0)             │   │
│  │                   │  │                   │  │                           │   │
│  │  - users          │  │  - messages.list  │  │  - messages               │   │
│  │  - connections    │  │  - messages.get   │  │  - categories             │   │
│  │  - oauth_tokens   │  │  - labels.modify  │  │  - folders                │   │
│  │  - categories     │  │  - labels.create  │  │                           │   │
│  │  - rules          │  │                   │  │                           │   │
│  │  - processed_msgs │  └───────────────────┘  └───────────────────────────┘   │
│  │  - label_mappings │                                                          │
│  │  - audit_log      │  ┌───────────────────┐  ┌───────────────────────────┐   │
│  │                   │  │   STRATO IMAP     │  │   LLM API (Optional)      │   │
│  └───────────────────┘  │   (IMAP/SSL)      │  │   (OpenAI/Anthropic)      │   │
│                         │                   │  │                           │   │
│                         │  - FETCH          │  │  - Classification         │   │
│                         │  - STORE (flags)  │  │  - Confidence scoring     │   │
│                         │  - COPY/MOVE      │  │                           │   │
│                         └───────────────────┘  └───────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Datenfluss

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EMAIL PROCESSING FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

1. TRIGGER (Vercel Cron - every 5 min)
   │
   ▼
2. FETCH CONNECTIONS
   │  - Query active connections from DB
   │  - Decrypt OAuth tokens / IMAP credentials
   │
   ▼
3. FOR EACH CONNECTION:
   │
   ├──► GMAIL
   │    │  - Use Gmail API messages.list (after: lastProcessedAt)
   │    │  - Fetch message metadata + snippet
   │    └──► Continue to Step 4
   │
   ├──► OUTLOOK
   │    │  - Use Microsoft Graph /messages (filter: receivedDateTime)
   │    │  - Fetch message metadata + bodyPreview
   │    └──► Continue to Step 4
   │
   └──► STRATO (IMAP)
        │  - Connect via IMAP
        │  - SEARCH UNSEEN or SINCE date
        │  - FETCH envelope + snippet
        └──► Continue to Step 4

4. DEDUPLICATION CHECK
   │  - Check processed_messages table
   │  - Skip if message_id already processed
   │
   ▼
5. CLASSIFICATION
   │
   ├──► RULE-BASED (Primary)
   │    │  - Check keyword rules
   │    │  - Check regex patterns
   │    │  - Check sender rules
   │    └──► If match with high confidence → Step 6
   │
   └──► LLM-BASED (Optional, if enabled)
        │  - Build prompt with email context
        │  - Call LLM API
        │  - Parse structured response
        └──► Continue to Step 6

6. CONFIDENCE EVALUATION
   │
   ├──► confidence >= 0.80
   │    └──► Apply final category label
   │
   ├──► confidence 0.60-0.79
   │    └──► Apply REVIEW label + log suggested category
   │
   └──► confidence < 0.60
        └──► Apply REVIEW label only

7. LABEL APPLICATION
   │
   ├──► GMAIL
   │    │  - Lookup label_id from label_mappings
   │    │  - Call messages.modify (addLabelIds)
   │    │  - Create label if not exists
   │    │
   ├──► OUTLOOK
   │    │  - Lookup category from label_mappings
   │    │  - Call PATCH /messages/{id} (categories)
   │    │  - OR move to folder
   │    │
   └──► STRATO (IMAP)
        │  - Set IMAP keywords (flags)
        │  - OR COPY to category folder
        │

8. PERSIST RESULT
   │  - Insert into processed_messages
   │  - Insert into audit_log
   │
   ▼
9. UPDATE CONNECTION
   │  - Update lastProcessedAt
   │  - Update statistics
   │
   ▼
10. COMPLETE
    │  - Log processing summary
    └──► Wait for next cron trigger
```

## 3. Komponenten-Interaktion

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        COMPONENT INTERACTION DIAGRAM                             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌────────────────┐     ┌─────────────────┐     ┌─────────────────────────────────┐
│   Frontend     │────►│   API Routes    │────►│   Provider Connectors           │
│   (React)      │     │   (Next.js)     │     │                                 │
└────────────────┘     └─────────────────┘     │  ┌───────────────────────────┐  │
        │                      │               │  │   GmailConnector          │  │
        │                      │               │  │   - fetchMessages()       │  │
        ▼                      ▼               │  │   - applyLabel()          │  │
┌────────────────┐     ┌─────────────────┐     │  │   - createLabel()         │  │
│   shadcn/ui    │     │   Services      │     │  └───────────────────────────┘  │
│   Components   │     │                 │     │                                 │
│                │     │  ┌───────────┐  │     │  ┌───────────────────────────┐  │
│  - Card        │     │  │ AuthSvc   │  │     │  │   OutlookConnector        │  │
│  - Table       │     │  │ EmailSvc  │  │     │  │   - fetchMessages()       │  │
│  - Dialog      │     │  │ ClassSvc  │  │     │  │   - applyCategory()       │  │
│  - Form        │     │  │ LabelSvc  │  │     │  │   - moveToFolder()        │  │
│  - Badge       │     │  │ AuditSvc  │  │     │  └───────────────────────────┘  │
│  - Toast       │     │  └───────────┘  │     │                                 │
│  - Tabs        │     │                 │     │  ┌───────────────────────────┐  │
│                │     └─────────────────┘     │  │   IMAPConnector (Strato)  │  │
└────────────────┘             │               │  │   - fetchMessages()       │  │
                               │               │  │   - setFlags()            │  │
                               ▼               │  │   - copyToFolder()        │  │
                       ┌─────────────────┐     │  └───────────────────────────┘  │
                       │   Database      │     │                                 │
                       │   (Prisma)      │     └─────────────────────────────────┘
                       │                 │                     │
                       │  - CRUD ops     │                     │
                       │  - Transactions │                     ▼
                       │  - Migrations   │     ┌─────────────────────────────────┐
                       └─────────────────┘     │   Classification Engine         │
                               │               │                                 │
                               │               │  ┌───────────────────────────┐  │
                               ▼               │  │   RuleBasedClassifier     │  │
                       ┌─────────────────┐     │  │   - keywords              │  │
                       │   Neon Postgres │     │  │   - regex patterns        │  │
                       │   (Free Tier)   │     │  │   - sender rules          │  │
                       └─────────────────┘     │  └───────────────────────────┘  │
                                               │                                 │
                                               │  ┌───────────────────────────┐  │
                                               │  │   LLMClassifier           │  │
                                               │  │   - OpenAI adapter        │  │
                                               │  │   - Anthropic adapter     │  │
                                               │  │   - Prompt templates      │  │
                                               │  └───────────────────────────┘  │
                                               │                                 │
                                               └─────────────────────────────────┘
```

## 4. Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY LAYERS                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

Layer 1: Transport Security
├── HTTPS everywhere (Vercel enforced)
├── TLS 1.3 for IMAP connections
└── Secure WebSocket for real-time updates

Layer 2: Authentication
├── OAuth 2.0 for Gmail/Outlook (minimal scopes)
├── App-specific passwords for IMAP
├── Session-based auth for admin UI
└── CRON_SECRET for scheduled jobs

Layer 3: Authorization
├── User-scoped data access
├── Connection ownership verification
└── Rate limiting per user

Layer 4: Data Protection
├── AES-256-GCM encryption for tokens at rest
├── Encryption key from env (ENCRYPTION_KEY)
├── No email body storage (only metadata)
└── Automatic token refresh before expiry

Layer 5: API Security
├── CSRF protection
├── Input validation (Zod schemas)
├── SQL injection prevention (Prisma)
└── XSS prevention (React default)
```

## 5. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           VERCEL DEPLOYMENT                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

Repository (GitHub)
│
├── .github/
│   └── workflows/
│       └── backup-cron.yml  (Fallback if Vercel Cron limits reached)
│
├── apps/
│   └── web/                 (Next.js App - deployed to Vercel)
│       ├── app/
│       │   ├── api/         (API Routes - Serverless Functions)
│       │   ├── (dashboard)/ (App Router pages)
│       │   └── ...
│       ├── components/      (shadcn/ui components)
│       └── vercel.json      (Cron configuration)
│
├── packages/
│   └── shared/              (Shared types/utils - bundled)
│
└── prisma/
    └── schema.prisma        (Database schema)

Vercel Project Settings:
├── Framework: Next.js
├── Build Command: cd apps/web && npm run build
├── Output Directory: apps/web/.next
├── Install Command: npm install
└── Root Directory: / (monorepo root)

Environment Variables (Vercel Dashboard):
├── DATABASE_URL          (Neon connection string)
├── DIRECT_URL            (Neon direct connection)
├── ENCRYPTION_KEY        (32-byte hex for AES-256)
├── GOOGLE_CLIENT_ID
├── GOOGLE_CLIENT_SECRET
├── MICROSOFT_CLIENT_ID
├── MICROSOFT_CLIENT_SECRET
├── CRON_SECRET           (Vercel cron auth)
├── NEXTAUTH_SECRET       (Session encryption)
├── NEXTAUTH_URL          (Production URL)
├── LLM_API_KEY           (Optional: OpenAI/Anthropic)
└── LLM_PROVIDER          (Optional: openai/anthropic)
```

## 6. Database Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE ENTITIES                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

users                     connections               oauth_tokens
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ id (PK)         │───┐   │ id (PK)         │───┐   │ id (PK)         │
│ email           │   │   │ user_id (FK)    │   │   │ connection_id   │
│ name            │   └──►│ provider        │   └──►│ access_token*   │
│ created_at      │       │ email           │       │ refresh_token*  │
│ updated_at      │       │ status          │       │ expires_at      │
└─────────────────┘       │ last_sync       │       │ scope           │
                          │ settings (JSON) │       └─────────────────┘
                          └─────────────────┘       * = encrypted

categories                rules                     label_mappings
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ id (PK)         │───┐   │ id (PK)         │       │ id (PK)         │
│ user_id (FK)    │   │   │ category_id(FK) │◄──────│ category_id(FK) │
│ name            │   └──►│ type            │       │ connection_id   │
│ internal_code   │       │ pattern         │       │ provider_label  │
│ color           │       │ priority        │       │ label_type      │
│ is_system       │       │ is_active       │       │ created_at      │
│ created_at      │       └─────────────────┘       └─────────────────┘
└─────────────────┘

processed_messages        audit_log
┌─────────────────┐       ┌─────────────────┐
│ id (PK)         │       │ id (PK)         │
│ connection_id   │       │ user_id (FK)    │
│ message_id      │       │ action          │
│ thread_id       │       │ entity_type     │
│ category_id     │       │ entity_id       │
│ confidence      │       │ details (JSON)  │
│ label_applied   │       │ ip_address      │
│ classified_at   │       │ created_at      │
│ rationale       │       └─────────────────┘
└─────────────────┘
```
