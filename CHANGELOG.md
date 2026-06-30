# Changelog

All notable changes to the 92LR Tournament Platform are tracked in this file. The format conforms to the Keep a Changelog specifications. This project adheres to Semantic Versioning (SemVer 2.0.0).

---

## [1.0.0] - 2026-06-30

### Added
- Created backend API architecture utilizing Fastify, TypeScript, and Prisma.
- Configured PostgreSQL relational models for users, wallets, ledger entries, registrations, match lobbies, tickets, and audit logging.
- Created multi-balance wallet ledger logic that isolates winning, deposit, bonus, locked, and refund balances.
- Created intelligent OCR STANDINGS engine featuring Laplacian blur filters, Google Cloud Vision/Tesseract integrations, and Levenshtein distance similarity matching.
- Configured background worker tasks via BullMQ and Redis queues to run payouts, notifications, and cleanups.
- Created cross-platform client app using Flutter and Riverpod.
- Created administrative dashboard using Next.js 15, TailwindCSS, and React Query.
- Created static marketing and onboarding website.
- Added root-level and backend-level Git ignore files.
- Added contributor configuration guidelines, bug/feature template files, and private vulnerability submission processes.

### Changed
- Configured git remote repository target to https://github.com/titanxdevz/Tournament-App.git.
- Configured commit author configurations to titanxdevz (inkmcontop@gmail.com).

### Fixed
- Resolved node dependencies and build output folders tracking errors by implementing a master .gitignore file.
- Prevented empty uploads folder omission in git tracking by generating a .gitkeep file inside the backend uploads folder.
