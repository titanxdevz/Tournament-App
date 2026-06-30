# Security Policy

This document defines the security reporting protocols and maintenance schedule for the 92LR Tournament Platform. Ensuring data confidentiality and transactional security is paramount to the platform's operation.

---

## 1. Supported Versions

Security updates are actively backported to the following releases:

| Version | Supported | Security SLA Timeline |
| :--- | :--- | :--- |
| v1.x.x | Yes | Core focus (Development & Staging updates) |
| v0.9.x | Yes | 90 days from official v1.0 release |
| < v0.9.0 | No | Not supported (Upgrade immediately) |

---

## 2. Reporting a Vulnerability

Please do not open public GitHub issues for security vulnerabilities, as this exposes the active system to exploitation before a fix is released.

### Vulnerability Submission Workflow
1. Send an encrypted email to the security response team at `security@titanxdevz.com`.
2. Include the following details in your message:
   - Affected service module (`backend`, `admin_panel`, `user_app`).
   - Description of the vulnerability type (e.g., SQL injection, Remote Code Execution, Privilege Escalation).
   - Proof of Concept (PoC) code, curl requests, or step-by-step reproduction instructions.
   - Potential impact on users or financial ledgers.

### Response SLA (Service Level Agreement)
* **Initial Evaluation**: You will receive an automated acknowledgment within 24 hours of submission, followed by a human confirmation within 3 business days.
* **Triage**: The security team will complete replication and determine severity (CVSS v3.1 score) within 7 business days.
* **Resolution**: High and Critical vulnerabilities are addressed with priority patches within 14 business days. Medium and Low issues are integrated into the standard sprint releases.
* **Coordinated Disclosure**: Public details of fixed vulnerabilities are published on the project wiki after patches are deployed to all client instances.

---

## 3. Core Security Architecture Guidelines

All updates must conform to these security standards:
* **Cryptography**: All user passwords must be hashed using Bcrypt with a salt round parameter of `10`. Sensitive configurations or API credentials must be encrypted at rest using AES-256-GCM.
* **Data Transport**: All traffic must traverse HTTPS/WSS. Cookies containing Session refresh tokens must be flagged `httpOnly`, `secure`, and `sameSite: strict`.
* **Input Sanitization**: Database operations must utilize parameterized queries via Prisma ORM to prevent SQL Injection. HTML payloads must be validated or sanitized using structured schemas before rendering to prevent Cross-Site Scripting (XSS).
* **Ledger Locking**: All transactions mutating wallet balances must acquire transaction-level locks using PostgreSQL database transactions to prevent double-spending or race condition exploits.
