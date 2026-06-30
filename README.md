# 92LR Tournament Platform - System Specifications & Documentation

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

### Module Distribution

* **`/backend`**: The core API service built with Fastify, handling HTTP routing, WebSocket client connections, JWT authentication, and executing background workers via BullMQ.
* **`/admin_panel`**: An administrative dashboard built using Next.js (App Router), enabling tournament creators to configure brackets, verify manual payment requests, and review OCR-generated standings drafts.
* **`/user_app`**: A mobile application built in Flutter, enabling players to register, manage wallets, inspect tournament brackets, join lobby rooms, and view match outcomes.
* **`/Website`**: A static, high-performance landing page used for marketing, client acquisition, and app distribution.

---

## 2. Technical Component Breakdown

| Module | Primary Libraries / Technologies | Architectural Pattern | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **Backend** | Fastify, TypeScript, Prisma ORM, BullMQ, Socket.io, Sharp, Zod | Layered Service-Repository Pattern | Handles business rules, data mutations, background scheduling, and WebSocket events. |
| **User Mobile Client** | Flutter, Riverpod, Dio, Hive, flutter_secure_storage | Clean Architecture (Feature-First) | Handles client state, secure JWT storage, local caching, and real-time event listeners. |
| **Admin Console** | Next.js 15, React Query, TailwindCSS, Axios, Shadcn UI | Component-Driven App Router | Provides interfaces for manually reviewable workflows (Deposits, Withdrawals, OCR Standings verification). |
| **Marketing Website** | HTML5, CSS3, Vanilla ES6 JavaScript | Single Page, CSS Variables, Responsive Layout | Search engine optimization, client onboarding page, and direct installer distribution. |

---

## 3. Database Schema Specification

The database utilizes PostgreSQL, abstracted through Prisma. It maintains strict constraints, foreign keys, and indexes on frequently queried fields to ensure relational integrity and high performance.

### Enums
* `UserStatus`: `ACTIVE`, `BANNED`, `SUSPENDED`
* `TransactionType`: `DEPOSIT`, `WITHDRAWAL`, `WINNINGS`, `REFUND`, `JOIN_FEE`, `BONUS`, `REFERRAL_BONUS`
* `TransactionStatus`: `PENDING`, `APPROVED`, `REJECTED`, `FAILED`, `COMPLETED`
* `PaymentStatus`: `PENDING`, `APPROVED`, `REJECTED`
* `TournamentStatus`: `DRAFT`, `UPCOMING`, `LIVE`, `COMPLETED`, `CANCELLED`
* `RegistrationStatus`: `REGISTERED`, `REFUNDED`, `CANCELLED`
* `MatchRoomStatus`: `WAITING`, `RELEASED`, `IN_PROGRESS`, `FINISHED`
* `TicketStatus`: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
* `SenderType`: `USER`, `ADMIN`
* `ActorType`: `USER`, `ADMIN`, `SYSTEM`
* `OcrStatus`: `PENDING`, `PROCESSING`, `SUCCESS`, `FAILED`, `APPROVED`, `REJECTED`

### Relational Schema Diagram (Summary)

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

### Table Definitions and Indexes

The relational schema is configured in [schema.prisma](file:///c:/Users/royal/OneDrive/Documents/Xentronix/backend/prisma/schema.prisma):
* **`User`**: Tracks user identities, passwords hashed using Bcrypt, and referral links. Indexed on `email` and `referralCode` to accelerate authentication and signup validations.
* **`Wallet`**: Implements five distinct balances to prevent deposit/bonus mixing (refer to Section 4.1).
* **`Transaction`**: Immutable ledger records mapping to a User's Wallet. Indexed on `walletId` and composite `(type, status)` to speed up transaction history retrieval.
* **`PaymentRequest`**: Tracks manual UPI deposits containing UTR (Unique Transaction Reference) values and screenshots uploaded to Cloudinary. UTR is marked unique to prevent duplicate deposit claims.
* **`TournamentRegistration`**: Prevents duplicate slot bookings through a composite unique constraint: `@@unique([tournamentId, userId])` and `@@unique([tournamentId, slotNumber])`.
* **`OcrDraftResult`**: Holds parsed screenshot arrays and fuzzy-matched user profiles pending admin approval.

---

## 4. Raw Business Logic and Algorithms

### 4.1 Multi-Balance Ledger & Entry Fee Deduction Priority
To safeguard deposit and promotional assets, the platform isolates balances and implements a prioritised fee-deduction algorithm.

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

* **Balances**:
  * `depositBalance`: User funds loaded via manual UPI verification.
  * `winningBalance`: Tournament prize money. Eligible for withdrawal request.
  * `bonusBalance`: Promotional sign-up or referral rewards. Non-withdrawable.
  * `refundBalance`: Staged registration entries returned from cancelled tournaments.
  * `lockedBalance`: Funds frozen during processing of an active withdrawal request.
* **Transaction Safety**: All wallet adjustments are encapsulated in ACID-compliant Prisma transactions (`prisma.$transaction`) to prevent race conditions during concurrent tournament registrations.

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

### 4.3 Distributed Task Processing (BullMQ & Redis)
The backend decouples blocking actions using BullMQ workers connected to Redis:
* **`prizes-queue`**: Processed in `workers.ts`. Distributes winning balances transactionally to users, records matching results, creates ledgers, and sends notifications.
* **`ocr-queue`**: Downloads screenshot buffers from Cloudinary, executes sharpness evaluations, calls OCR engines, matches registration IDs, and saves results draft with WebSocket status broadcasts.
* **`notifications-queue`**: Handles FCM notifications delivery asynchronously.

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
