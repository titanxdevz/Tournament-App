<div align="center">
  <h1 style="color: #6C5CE7; font-family: 'Outfit', sans-serif; font-weight: 800; border-bottom: none; margin-bottom: 5px;">🏆 92LR Tournament Platform</h1>
  <p style="font-size: 1.2rem; color: #57606F; font-weight: 400; max-width: 600px; margin-top: 0;">
    An enterprise-grade, real-time tournament platform featuring automatic OCR screenshot verification, modular wallet ledgers, and cross-platform architecture.
  </p>

  <div>
    <img src="https://img.shields.io/badge/Stack-Flutter%20%7C%20Fastify%20%7C%20Next.js-6C5CE7?style=for-the-badge" alt="Tech Stack" />
    <img src="https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Redis-2D3436?style=for-the-badge" alt="Database Stack" />
    <img src="https://img.shields.io/badge/Pipeline-BullMQ%20%7C%20Sharp%20%7C%20OCR-00CEC9?style=for-the-badge" alt="Pipeline Stack" />
  </div>
</div>

<hr style="border: 0; border-top: 1px solid #DFE4EA; margin: 30px 0;" />

## 🗺️ System Architecture

Our architecture follows a modular, feature-first approach with distinct boundaries between client frontends, backend business logic, asynchronous task queues, and persistent storage layers.

```mermaid
graph TD
    %% Clients
    UserApp["📱 Flutter User App<br/>(Riverpod / Dio / WebSockets)"] 
    AdminPanel["💻 Next.js Admin Dashboard<br/>(React Query / Shadcn UI)"]
    MarketingSite["🌐 Marketing Website<br/>(Vanilla HTML/CSS/JS)"]

    %% Core Services
    Backend["⚡ Fastify backend API<br/>(Node.js / TypeScript / Prisma)"]
    
    %% Workers & Engines
    QueueEngine["🐂 BullMQ Task Queue<br/>(Redis Backed Async Workers)"]
    OCRPipeline["👁️ Intelligent OCR Engine<br/>(Vision API / Sharp / Levenshtein)"]
    
    %% Databases
    Postgres[("🐘 PostgreSQL<br/>(Core Ledger & Entities)")]
    RedisDB[("🔴 Redis Cache<br/>(Sessions, OTP, Queue Stores)")]

    %% Connections
    MarketingSite -.-> UserApp
    UserApp <-->|REST API / WebSockets| Backend
    AdminPanel <-->|REST API / WebSockets| Backend
    
    Backend <-->|Prisma Client| Postgres
    Backend <-->|Redis Clients| RedisDB
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

<hr style="border: 0; border-top: 1px solid #DFE4EA; margin: 30px 0;" />

## 📦 Project Structure

The codebase is organized into four standalone service directories at the root, maintaining complete separation of concerns:

```
.
├── Website/               # Static SEO-optimized promotional & marketing site
├── admin_panel/           # Next.js 15 Web interface for platform operations & OCR review
├── backend/               # Fastify REST API, WebSocket server, and BullMQ worker suite
└── user_app/              # Flutter mobile app for players (Android, iOS, Web)
```

### Module Design Philosophy

| Directory | Primary Tech | Role | Design Paradigm |
| :--- | :--- | :--- | :--- |
| **`backend`** | Fastify, TypeScript, Prisma, BullMQ, Redis | API Core, Asynchronous worker queue, Data validation | Modular Routing, Repository/Service Pattern |
| **`user_app`** | Flutter, Riverpod, Dio, Hive | Mobile client, real-time alerts, match room access | Clean Architecture, Feature-First structure |
| **`admin_panel`** | Next.js 15, TailwindCSS, Shadcn, React Query | Back-office management, UTR validation, OCR review | App Router, Server-Side Optimization |
| **`Website`** | HTML5, CSS3, Vanilla JavaScript | Landing page, download page, legal compliance | Responsive styling, zero-dependency layout |

<hr style="border: 0; border-top: 1px solid #DFE4EA; margin: 30px 0;" />

## ⚙️ Core Technical Logic & Modules

### 1. 💳 Double-Entry Multi-Balance Ledger
Rather than using a single numerical wallet column, our wallet database model uses **sub-accounts** to prevent bonus abuse and isolate user flows.
* **Database Ledger**: Tracked in [Prisma Schema](file:///c:/Users/royal/OneDrive/Documents/Xentronix/backend/prisma/schema.prisma#L104-L116) through `winningBalance`, `depositBalance`, `bonusBalance`, `lockedBalance`, and `refundBalance`.
* **UPI Intent Gateway**: Generates interactive UPI QR codes (Minimum ₹15) and validates Unique Transaction References (UTR).
* **Protection Logic**: Deducts entry fees prioritizing `bonusBalance` first, followed by `depositBalance` and `refundBalance`, leaving `winningBalance` intact for user withdrawals.

### 2. 👁️ Asynchronous OCR Results Verification Pipeline
To automate match verification without admin bottlenecking, we built a hybrid OCR processing engine located in [ocrService.ts](file:///c:/Users/royal/OneDrive/Documents/Xentronix/backend/src/services/ocrService.ts):
```
[User Screenshot] ➔ [Sharp (WebP 1080p)] ➔ [Laplacian Blur Check] ➔ [Google Vision / Tesseract fallback]
                                                                                     │
[Database Update] 🗲 ➔ [Consolidator] 🗦 [Fuzzy Name Match (Levenshtein >= 0.70)] 🗶───┘
```
* **Quality Guard**: Sharp downsamples screenshots to WebP. Laplacian variance determines blur levels; low resolution or blurry screenshots are rejected instantly.
* **Fuzzy Engine**: Extracted player names are run against database registrations. Matches utilize **Levenshtein Distance** with a threshold of $\ge 0.70$ (scores below $0.85$ flag warning flags on the admin panel).
* **Consolidation**: Eliminates conflicts across overlapping screenshots, resolving ranking disputes dynamically based on confidence parameters.

### 3. ⏱️ Real-Time Sockets & BullMQ Queues
* **BullMQ Queue Management**: Processes background jobs (Daily check-ins, auto-refunds on cancelled lobbies, push notification dispatches) asynchronously without clogging the main HTTP event loop.
* **WebSockets (Socket.io)**: Synchronizes real-time balance updates, instant notifications, room code release timers, and live bracket changes straight to clients.

<hr style="border: 0; border-top: 1px solid #DFE4EA; margin: 30px 0;" />

## 🚀 Setup & Installation

Ensure you have **Node.js LTS**, **Flutter SDK**, and **PostgreSQL / Redis** active before deployment.

### 🔌 Backend
1. Navigate to directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Populate variables in `.env` (referencing `.env.example`):
   ```env
   DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
   REDIS_URL="redis://localhost:6379"
   JWT_SECRET="your-secure-secret-key"
   ```
4. Sync database & generate Client:
   ```bash
   npx prisma migrate dev
   ```
5. Spin up developer server:
   ```bash
   npm run dev
   ```

### 💻 Admin Panel
1. Navigate to directory:
   ```bash
   cd admin_panel
   ```
2. Install dependencies and compile local bundle:
   ```bash
   npm install
   npm run build
   ```
3. Spin up dashboard:
   ```bash
   npm run dev
   ```

### 📱 User Application (Flutter)
1. Navigate to directory:
   ```bash
   cd user_app
   ```
2. Pull Flutter packages:
   ```bash
   flutter pub get
   ```
3. Run target simulator (ensure emulator is active):
   ```bash
   flutter run
   ```

### 🌐 Marketing Website
1. Navigate to directory:
   ```bash
   cd Website
   ```
2. Serve index file directly using any lightweight server:
   ```bash
   npx serve .
   ```
