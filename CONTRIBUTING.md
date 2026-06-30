# Contributing Guidelines

This document outlines the contribution standards, development workflow, and coding guidelines for the 92LR Tournament Platform. All developers must adhere to these policies to maintain code quality, security, and repository consistency.

---

## 1. Branching Strategy and Workflows

The repository uses a branch workflow. Direct commits to the `main` branch are restricted. All modifications must be submitted via Pull Requests.

### Branch Naming Conventions
Create descriptive branch names using the following patterns:
* `feature/issue-number-short-description` (for new features or extensions)
* `bugfix/issue-number-short-description` (for defect resolution)
* `hotfix/issue-number-critical-description` (for urgent production fixes)
* `docs/short-description` (for documentation changes)

Examples:
* `feature/102-upi-intent-support`
* `bugfix/89-jwt-refresh-timeout`

### Development Lifecycle
1. Pull the latest commits from the remote `main` branch.
2. Create a local branch conforming to the naming guidelines.
3. Apply changes and write unit tests.
4. Execute code style and automated validation suites locally.
5. Commit files using conventional format guidelines (see Section 2).
6. Push changes to the remote repository and open a Pull Request targeting `main`.

---

## 2. Commit Message Guidelines

Commit messages must follow the Conventional Commits specification. This enables automated changelog generation.

### Format
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types
* `feat`: A new feature addition.
* `fix`: A bug resolution.
* `docs`: Documentation updates.
* `style`: Code style modifications (formatting, white-space, missing semi-colons, no logic change).
* `refactor`: Code changes that neither fix a bug nor add a feature.
* `perf`: Performance optimizations.
* `test`: Adding missing tests or correcting existing tests.
* `chore`: Maintenance modifications, dependencies updates, configuration changes.

### Scopes
Specify the module being modified, such as: `backend`, `admin-panel`, `user-app`, `website`, or `root`.

### Examples
* `feat(backend): add laplacian edge validation to screenshot parsing`
* `fix(user-app): resolve null-pointer crash on wallet history initialization`

---

## 3. Code Style and Quality Standards

All pull requests are evaluated against local syntax rules. Verify your code conforms to these rules before pushing.

### Backend Routing and Services (`/backend`)
* Linting: ESLint config must pass with zero warnings.
* Formatting: Enforced using Prettier. Run `npm run format` to execute formatting.
* Strict Types: JavaScript parameters must avoid `any` declarations. Use TypeScript types and interfaces.
* Input Validation: All HTTP parameters must be validated at the route boundary using Zod schemas.

### Administrative Frontend (`/admin_panel`)
* Framework standards: React components must use functional definitions and hooks.
* Styling: Utilize TailwindCSS utilities. Custom CSS rules are restricted to `app/globals.css`.
* Data Fetching: Utilize React Query hooks to cache server state. Axios instances must use global configuration wrappers.

### Mobile Client (`/user_app`)
* Formatting: Run `flutter format .` to align indentation.
* Static Analysis: Run `flutter analyze` and resolve all diagnostic messages.
* State Management: Implement UI state management using Riverpod. Direct state manipulation inside StatefulWidgets should be avoided.

---

## 4. Testing Requirements

### Unit Testing
* Backend route and logic tests are implemented via Vitest. Ensure tests pass before code commits.
* Run backend tests:
  ```bash
  cd backend
  npm run test
  ```
* Flutter widgets and controllers must pass widget tests:
  ```bash
  cd user_app
  flutter test
  ```

### Database Updates
* Database schema modifications must be completed via Prisma migrations (`prisma migrate dev`).
* Never execute direct DDL mutations on development or production databases.
* Include seed updates in `/backend/prisma/seed.ts` if adding reference records.
