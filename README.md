# 92LR Tournament Platform - System Specifications & Engineering Documentation

This repository houses the source code and architecture specifications for the 92LR Tournament Platform, an enterprise-grade, real-time gaming tournament administration and participation system. The platform consists of a backend REST and WebSocket API, an administrative console, a cross-platform mobile client, and a promotional landing page.

---

## 1. System Architecture

The 92LR platform follows a distributed, modular design optimized for low-latency state synchronization and transactional reliability.

```mermaid
graph TD
    %% Clients
    UserApp["Flutter User Client (Riverpod, Dio, WebSockets)"] 
    AdminPanel["Next.js Admin Dashboard (React Query, Shadcn UI)"]
    MarketingSite["Marketing Website (HTML, CSS, JS)"]

    %% Core Services
    Backend["Fastify API Server (Node.js, TypeScript, Prisma)"]
    
    %% Workers & Engines
    QueueEngine["BullMQ Task Queue (Redis Backed Async Workers)"]
    OCRPipeline["Intelligent OCR Engine (Vision API, Sharp, Levenshtein)"]
    
    %% Databases
    Postgres[("PostgreSQL Database (Prisma, Core Data Store)")]
    RedisDB[("Redis Cache & Key-Value Store")]

    %% Connections
    MarketingSite -.-> UserApp
    UserApp <-->|REST API / WebSockets| Backend
    AdminPanel <-->|REST API / WebSockets| Backend
    
    Backend <-->|Prisma Client| Postgres
    Backend <-->|Redis Client| RedisDB
    Backend -.->|Jobs Delegation| QueueEngine
    Backend <---> OCRPipeline
    
    QueueEngine <-->|Job State| RedisDB
    QueueEngine -->|Updates| Postgres

    classDef default fill:#F8F9FA,stroke:#D1D8E0,stroke-width:1px;
    classDef client fill:#E8F0FE,stroke:#4285F4,stroke-width:2px;
    classDef core fill:#EBFBEE,stroke:#34A853,stroke-width:2px;
    classDef db fill:#FEF3D6,stroke:#FBBC05,stroke-width:2px;
    
    class UserApp,AdminPanel,MarketingSite client;
    class Backend,QueueEngine,OCRPipeline core;
    class Postgres,RedisDB db;
```

### 1.1 Core Components and Directory Layout
* **`/backend`**: Encapsulates the core API layer, using Fastify for fast HTTP processing and Socket.io for WebSocket state pushing. Business logic is organized using the Service-Repository pattern to ensure testability.
* **`/admin_panel`**: Built with Next.js 15 using the App Router. Responsible for administrative functions such as approving deposit requests, executing withdrawals, managing user statuses, and reviewing OCR stand-in verification logs.
* **`/user_app`**: Built with Flutter. Uses Riverpod for dependency injection and state providers, and Hive for high-performance offline local key-value storage.
* **`/Website`**: A statically compiled, lightweight HTML/CSS site designed to serve download artifacts and index metadata for SEO optimization.

### 1.2 Access Token and Session Refresh Flow
The authentication system uses short-lived JWT access tokens and long-lived HTTP-Only refresh cookies:

```
[Flutter/Admin Client]               [API Gateway (Fastify)]               [Database (PostgreSQL)]
        │                                       │                                     │
        │─── 1. API Call (Invalid Token) ──────►│                                     │
        │◄── 2. Response: HTTP 401 Unauth ──────│                                     │
        │                                       │                                     │
        │─── 3. POST /api/auth/refresh ────────►│                                     │
        │       (Attaches Cookie: refreshToken) │─── 4. Query User Status ───────────►│
        │                                       │◄── 5. User ACTIVE status confirmed ─│
        │                                       │                                     │
        │◄── 6. Response: New Access Token ─────│                                     │
        │                                       │                                     │
        │─── 7. Re-execute Pending API Call ───►│                                     │
```

---

## 2. Technical Component Breakdown

| Module | Primary Libraries / Technologies | Architectural Pattern | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **Backend** | Fastify, TypeScript, Prisma ORM, BullMQ, Socket.io, Sharp, Zod | Layered Service-Repository Pattern | Handles business rules, data mutations, background scheduling, and WebSocket events. |
| **User Mobile Client** | Flutter, Riverpod, Dio, Hive, flutter_secure_storage | Clean Architecture (Feature-First) | Handles client state, secure JWT storage, local caching, and real-time event listeners. |
| **Admin Console** | Next.js 15, React Query, TailwindCSS, Axios, Shadcn UI | Component-Driven App Router | Provides interfaces for manually reviewable workflows (Deposits, Withdrawals, OCR Standings verification). |
| **Marketing Website** | HTML5, CSS3, Vanilla ES6 JavaScript | Single Page, CSS Variables, Responsive Layout | Search engine optimization, client onboarding page, and direct installer distribution. |

---

## 3. Database Schema and Transactions

The database utilizes PostgreSQL, abstracted through Prisma. It maintains strict constraints, foreign keys, and indexes on frequently queried fields to ensure relational integrity and high performance.

### 3.1 Relational Schema Diagram (Summary)

```
[User] ───1:1─── [Wallet] ───1:N─── [Transaction]
   │
   ├───1:N─── [TournamentRegistration] ───N:1─── [Tournament] ───1:1─── [MatchRoom]
   │                                                 │
   ├───1:N─── [PaymentRequest]                       ├───1:N─── [TournamentResult]
   │                                                 └───1:N─── [OcrDraftResult]
   ├───1:N─── [WithdrawalRequest]
   │
   └───1:N─── [SupportTicket] ───1:N─── [SupportMessage]
```

### 3.2 Database Indexes and Performance Optimizations
Prisma configures specific indexes on the PostgreSQL layer to support high-throughput lookups:
* **`User` Table**:
  * `CREATE UNIQUE INDEX "User_email_key" ON "User"("email")` (speeds up authentication checks).
  * `CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode")` (supports sign-up referral validations).
* **`Transaction` Table**:
  * `CREATE INDEX "Transaction_walletId_idx" ON "Transaction"("walletId")` (accelerates user wallet ledger checks).
  * `CREATE INDEX "Transaction_type_status_idx" ON "Transaction"("type", "status")` (supports dashboard transaction analytics).
* **`TournamentRegistration` Table**:
  * `CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_userId_key" ON "TournamentRegistration"("tournamentId", "userId")` (prevents double registrations).
  * `CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_slotNumber_key" ON "TournamentRegistration"("tournamentId", "slotNumber")` (ensures slot numbers are uniquely assigned).

### 3.3 Transaction Isolation and Concurrency Control
All write operations affecting financial ledgers are wrapped in PostgreSQL transaction locks to prevent concurrency errors. For example, during registration processing:
1. A transaction begins with `prisma.$transaction`.
2. The user's wallet is queried and locked.
3. The registration is validated against slot availability.
4. Balance deductions are executed across the prioritized sub-accounts.
5. The registration record is created.
6. The transaction commits. If any step fails (such as another user reserving the last slot simultaneously), the database rolls back all mutations to maintain state consistency.

---

## 4. Raw Business Logic and Algorithms

### 4.1 Multi-Balance Ledger & Entry Fee Deduction Priority
To safeguard deposit and promotional assets, the platform isolates balances and implements a prioritized fee-deduction algorithm.

```
       [Registration Entry Fee]
                  │
                  ▼
         [Is Bonus Balance > 0?] ── Yes ──► [Deduct up to Fee Amount]
                  │
                  No / Remaining Fee
                  ▼
        [Is Deposit Balance > 0?] ── Yes ──► [Deduct up to Fee Amount]
                  │
                  No / Remaining Fee
                  ▼
         [Is Refund Balance > 0?] ── Yes ──► [Deduct up to Fee Amount]
                  │
                  No / Remaining Fee
                  ▼
     [Insufficient Funds Error Raised]
```

#### Balances Definition
* `depositBalance`: Wallet coins credited after an admin approves a manual payment screenshot with a valid, unique UTR.
* `winningBalance`: Cash balance won from completed tournaments. Eligible for withdrawal requests.
* `bonusBalance`: Promotional credits awarded during signup or referral. Non-withdrawable.
* `refundBalance`: Balance returned if a registered tournament is cancelled or refunded by an admin.
* `lockedBalance`: Temporarily locked funds that are currently under review in an active withdrawal request.

---

### 4.2 Intelligent OCR Standings Pipeline
The pipeline handles processing of match results screenshots uploaded by administrators, converting pixel arrays into structured tournament standings:

```
[Standings Image] 
        │
        ▼
[Analyze Quality] (Validate resolution, calculate Laplacian variance for blur check)
        │
        ▼
[Image Pre-processing] (Scale down to 1920x1080, convert to high-contrast WebP)
        │
        ▼
[OCR Text Detection] (Google Cloud Vision API with offline Tesseract.js fallback)
        │
        ▼
[Character Normalization] (Correct transcription errors: 'O'/'0', 'l'/'1', 'S'/'5')
        │
        ▼
[Standings Parsing] (Regular Expressions mapping Rank, Nickname, and Kill counts)
        │
        ▼
[Fuzzy Match to Registrations] (Fuzzy String Similarity via Levenshtein Distance)
        │
        ▼
[Consolidation Engine] (Combine duplicate entries from multiple screenshots)
```

#### Blur Detection (Laplacian Kernel Convolution Filter)
To reject unreadable images before processing, the system convolves the image buffer using a 3x3 Laplacian edge-detection kernel:
$$\mathbf{L} = \begin{bmatrix} 0 & 1 & 0 \\ 1 & -4 & 1 \\ 0 & 1 & 0 \end{bmatrix}$$
The standard deviation of the convolved pixel values determines the image sharpness. If the resulting sharpness factor is below $1.0$, the file is rejected immediately with an HTTP 400 error.

#### Fuzzy Matching Algorithm (Levenshtein Distance Coefficient)
Because in-game names parsed from screenshot frames might contain minor character variations compared to database registrations, the system calculates the string similarity using the Levenshtein Distance:
$$\text{Similarity}(s_1, s_2) = \frac{\max(|s_1|, |s_2|) - \text{Levenshtein}(s_1, s_2)}{\max(|s_1|, |s_2|)}$$
* A match is accepted if $\text{Similarity} \ge 0.70$.
* If $0.70 \le \text{Similarity} < 0.85$, the match is flagged with a confidence warning, requiring review in the administrative dashboard before final payouts are disbursed.

---

### 4.3 Redis Caching Strategy and Cache Invalidation
To minimize expensive database lookups and prevent duplicate actions, the system maintains a structured Redis cache layer.

| Key Pattern | Data Type | Purpose | TTL | Invalidation Trigger |
| :--- | :--- | :--- | :--- | :--- |
| `ocr:hash:<hash>` | String | Tracks processed screenshot MD5 hashes to prevent duplicate OCR submissions | 7 Days | Automated key expiration (TTL) |
| `user:session:<userId>` | String | Holds cached user profile details to speed up JWT validation checkpoints | 1 Hour | User details update / password reset |
| `rate:limit:<ip>` | String | Tracks rate limit counts for API endpoints | 1 Minute | Automated key expiration (TTL) |
| `tournament:detail:<id>` | String | Caches full tournament details for users query endpoints | 10 Minutes | Admin changes status / registration joins |

---

### 4.4 WebSockets and Communication Protocol
Real-time messaging is handled by Socket.io. Clients connect to the default namespace (`/`) and are partitioned into logical rooms based on context.

#### Channel Rooms
* `user:<userId>`: Private channel for user-specific events (e.g., wallet updates, payment request decisions, support updates).
* `tournament:<tournamentId>`: Group channel for participants of a specific tournament (e.g., slot count changes, room credential updates).

#### System Event Schema

##### `wallet:updated` (Sent to `user:<userId>`)
* **Trigger**: A transaction modifies any balance category.
* **Payload**:
  ```json
  {
    "id": "wallet-uuid",
    "userId": "user-uuid",
    "winningBalance": "150.00",
    "depositBalance": "50.00",
    "bonusBalance": "20.00",
    "lockedBalance": "0.00",
    "refundBalance": "0.00"
  }
  ```

##### `room:released` (Sent to `tournament:<tournamentId>`)
* **Trigger**: Admin publishes the lobby room credentials.
* **Payload**:
  ```json
  {
    "tournamentId": "tournament-uuid",
    "roomId": "192830",
    "roomPassword": "secretPassword12",
    "releaseTime": "2026-06-30T18:00:00.000Z"
  }
  ```

##### `ocr:progress:<tournamentId>` (Sent to administrative listeners)
* **Trigger**: Updates the status of the background OCR extraction job.
* **Payload**:
  ```json
  {
    "status": "PROCESSING",
    "progress": 60,
    "message": "Processing screenshot 2 of 3..."
  }
  ```

---

## 5. API Endpoint Specifications

All endpoints are hosted under the prefix `/api`. Admin routes require an authorization header: `Authorization: Bearer <JWT_TOKEN>` where the JWT payload contains `type: 'admin'`.

### 5.1 Authentication Module (`/auth`)

#### `POST /auth/register`
Creates a new user profile. Integrates referral validations.
* **Payload**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123",
    "name": "Jane Doe",
    "referralCode": "optionalReferralCode"
  }
  ```
* **Response (201)**:
  ```json
  {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "name": "Jane Doe",
      "referralCode": "JANE-1234"
    },
    "accessToken": "jwt-access-token"
  }
  ```
* **Details**: Sets an `httpOnly` cookie named `refreshToken` with a 7-day expiration.

#### `POST /auth/login`
Authenticates a user and returns session credentials.
* **Payload**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123"
  }
  ```
* **Response (200)**: Contains user details and `accessToken`.

#### `POST /auth/admin/login`
Authenticates an administrator. Retrieves roles and permissions.
* **Payload**:
  ```json
  {
    "email": "admin@example.com",
    "password": "adminsecurepassword"
  }
  ```
* **Response (200)**: Contains admin model and authorization token valid for 1 hour.

#### `POST /auth/refresh`
Regenerates an access token using the validation cookie.
* **Headers**: Requires `Cookie: refreshToken=<token>`
* **Response (200)**: `{"accessToken": "new-jwt-token"}`

---

### 5.2 Wallet Module (`/wallet`)

#### `POST /wallet/generate-qr`
Generates a UPI link and QR code payload.
* **Payload**: `{"amount": 250}` (Minimum: ₹15)
* **Response (200)**:
  ```json
  {
    "success": true,
    "qrDataUrl": "data:image/png;base64,...",
    "upiLink": "upi://pay?pa=92lr@slc&pn=92LR&am=250&cu=INR&tn=...",
    "upiId": "92lr@slc",
    "amount": 250
  }
  ```

#### `POST /wallet/deposit`
Submits a deposit ticket for review (Requires multipart/form-data).
* **Fields**: `amount` (number), `upiId` (string), `utr` (12-digit string), `file` (Binary Image).
* **Response (210)**: Returns `paymentRequest` database object with state `PENDING`.

#### `POST /wallet/withdraw`
Requests a payout from winningBalance.
* **Payload**: `{"amount": 500, "upiId": "user@upi"}`
* **Response (201)**: Returns `withdrawalRequest`. Deducts ₹500 from `winningBalance` and moves it to `lockedBalance`.

#### `POST /wallet/admin/deposits/:id/verify` (Admin)
Approves or rejects a deposit ticket.
* **Payload**: `{"status": "APPROVED"}` or `{"status": "REJECTED", "rejectionReason": "UTR Invalid"}`
* **Details**: If approved, moves transaction to `COMPLETED` and increases `depositBalance`. Fired websocket events sync the user's mobile client.

---

### 5.3 OCR STANDINGS Module (`/ocr`)

#### `POST /ocr/upload` (Admin)
Uploads multiple screenshots and triggers OCR parsing.
* **Fields**: `tournamentId` (UUID string), `file` (Multipart file stream array).
* **Response (201)**: Returns `draftId` and enqueued worker `jobId`.

#### `POST /ocr/draft/:id/approve` (Admin)
Confirms the matched standings and triggers payouts.
* **Payload**:
  ```json
  {
    "players": [
      {
        "name": "Alpha_Player",
        "uid": "UID-1029",
        "rank": 1,
        "kills": 8,
        "matchedUserId": "user-uuid-1",
        "registrationId": "reg-uuid-1"
      }
    ]
  }
  ```
* **Details**: Resolves within a single transactional unit. Computes payouts per player rank, increments wallets, logs transactions, updates status to `COMPLETED`, and dispatches notifications.

---

## 6. Client Architecture & Dataflows

### 6.1 Flutter Client Dataflow
The Flutter client uses Riverpod for state management, dividing logic into features:
* **Token Storage Lifecycle**: The authorization token is held in `flutter_secure_storage`. If a network call returns an HTTP 401, the client uses a Dio interceptor to request `/api/auth/refresh`. If refresh fails, it redirects to the login screen.
* **WebSockets Integration**: The mobile application establishes connection via `socket.io-client`. It joins rooms scoped to specific tournaments (`tournament:id`) to receive real-time updates for slot count changes and room credentials updates.

### 6.2 Next.js Admin Panel Integration
The Next.js panel provides reactive management screens:
* **State Synchronization**: Uses TanStack Query for cache invalidation. When an admin verifies a payment request, the mutation automatically invalidates the `['deposits', 'pending']` queries, triggering clean UI updates.
* **Standings Review Screen**: Pulls the output from `/api/ocr/draft/:tournamentId`. Displays user profiles alongside their image bounding boxes, allowing the admin to correct fuzzy matched names before final approval.

---

## 7. Developer Onboarding and Deployment

### Environment Variable Configurations

Set up a `.env` file in `/backend` using these properties:
```env
# Database Credentials
DATABASE_URL="postgresql://db_user:db_password@localhost:5432/db_name?schema=public"

# Redis Server Configuration
REDIS_URL="redis://localhost:6379"

# Token Secret Key
JWT_SECRET="use-a-highly-secure-jwt-passphrase-string"

# Merchant UPI Gateway Details
MERCHANT_UPI="92lr@slc"

# Cloudinary Integration
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"

# Runtime Environment
NODE_ENV="development"
```

### Setup Sequence

#### 1. Database Provisioning
Run migrations to build database tables and indexes:
```bash
cd backend
npm install
npx prisma migrate dev
```

#### 2. Service Launch

##### Backend Server & Background Workers:
```bash
cd backend
npm run dev
```

##### Next.js Admin Panel:
```bash
cd admin_panel
npm install
npm run dev
```

##### Flutter Client (iOS/Android Emulators):
Ensure your emulator is running, then execute:
```bash
cd user_app
flutter pub get
flutter run
```

##### Marketing Site:
Serve the static asset directory:
```bash
cd Website
npx serve .
```
