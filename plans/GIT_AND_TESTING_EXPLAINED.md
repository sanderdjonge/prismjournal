# Git and Testing Infrastructure Explained

> **For:** PrismJournal Project  
> **Audience:** Novice-friendly explanation

---

## 1. Git and Version Control

### What is Git?

Git is like a "save game" system for your code. Every time you make a commit, Git takes a snapshot of all your files at that moment. You can always go back to any previous snapshot.

### Is Code Being Automatically Committed?

**NO.** Git does NOT automatically commit your code. Here's how it works:

1. **You must manually commit** - You decide when to save a snapshot
2. **You must manually push** - You decide when to send your commits to a remote server

### Where Does the Code Go?

When you push code, it goes to a **remote repository**. This is typically:
- **GitHub** (most common - what this project uses)
- **GitLab**
- **Bitbucket**

### How to Verify Your Git Setup

Open a terminal in your project folder and run these commands:

```bash
# Check if Git is initialized
git status

# See where your code would be pushed to
git remote -v

# See your commit history
git log --oneline -10
```

**Expected output for `git remote -v`:**
```
origin  https://github.com/YOUR_USERNAME/PrismJournal.git (fetch)
origin  https://github.com/YOUR_USERNAME/PrismJournal.git (push)
```

If you see `origin` pointing to a GitHub URL, that's where your code goes when you push.

### The Git Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR COMPUTER                                │
│                                                                  │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐               │
│   │ Working  │ --> │ Staging  │ --> │ Local    │               │
│   │ Directory│     │ Area     │     │ Repo     │               │
│   │          │     │          │     │          │               │
│   │ Edit     │ git │ git      │ git │ Saved    │               │
│   │ files    │ add │ commit   │     │ locally  │               │
│   └──────────┘     └──────────┘     └──────────┘               │
│                                         │                        │
│                                         │ git push               │
│                                         ▼                        │
└─────────────────────────────────────────────────────────────────┘
                                          │
                                          │ Internet
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GITHUB SERVERS                               │
│                                                                  │
│   ┌──────────────────────────────────────────────────┐          │
│   │              Remote Repository                    │          │
│   │                                                   │          │
│   │   - Stores all commits                            │          │
│   │   - Runs CI/CD tests automatically                │          │
│   │   - Allows collaboration with others              │          │
│   └──────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### What is GitHub Actions (CI/CD)?

GitHub Actions is a **robot** that watches your repository. When you push code, it automatically:

1. **Wakes up** - Detects new code was pushed
2. **Sets up a clean computer** - Creates a fresh Ubuntu Linux machine
3. **Installs your app** - Downloads Node.js, npm packages, etc.
4. **Runs tests** - Executes all your tests
5. **Reports results** - Tells you if everything passed or failed

**Important:** GitHub Actions runs AFTER you push. It does NOT push code for you.

---

## 2. Testing Infrastructure Explained

### Overview

Your project has **two types of tests** in **two different folders**:

| Test Type | Folder | Tool | What It Tests |
|-----------|--------|------|---------------|
| Unit Tests | `src/__tests__/` | Vitest | Individual functions and logic |
| E2E Tests | `e2e/` | Playwright | Full user journeys in a browser |

### How Testing Works - Simple Explanation

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL DEVELOPMENT                            │
│                     (Your Machine)                               │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Unit Tests (Vitest)                         │   │
│   │                                                          │   │
│   │   npm run test                                           │   │
│   │                                                          │   │
│   │   - Tests individual functions                           │   │
│   │   - Very fast (milliseconds)                             │   │
│   │   - No browser needed                                     │   │
│   │   - No database needed                                    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              E2E Tests (Playwright)                      │   │
│   │                                                          │   │
│   │   npm run test:e2e                                       │   │
│   │                                                          │   │
│   │   - Opens a real browser (Chromium)                      │   │
│   │   - Clicks buttons, fills forms                          │   │
│   │   - Tests like a real user                               │   │
│   │   - Needs a running app + database                       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Unit Tests (Vitest)

**Location:** `src/__tests__/lib/`

**Files:**
- `analytics.test.ts` - Tests analytics calculations
- `rate-limit.test.ts` - Tests rate limiting logic
- `validations.test.ts` - Tests input validation schemas

**How to run locally:**
```bash
npm run test
```

**What happens:**
1. Vitest reads all `*.test.ts` files
2. Runs each test function
3. Reports pass/fail for each test
4. Shows code coverage (how much of your code is tested)

### E2E Tests (Playwright)

**Location:** `e2e/`

**Files:**
- `auth.spec.ts` - Tests login, register, logout
- `dashboard.spec.ts` - Tests dashboard widgets and navigation
- `journal.spec.ts` - Tests trade journal functionality

**How to run locally:**
```bash
# First, make sure your app is running
npm run dev

# In another terminal, run E2E tests
npm run test:e2e
```

**What happens:**
1. Playwright opens a headless browser (no visible window)
2. Navigates to your app at `http://localhost:3000`
3. Simulates user actions (click, type, scroll)
4. Verifies the page responds correctly
5. Takes screenshots if tests fail

### GitHub Actions CI/CD Pipeline

When you push code to GitHub, the workflow in `.github/workflows/test.yml` runs automatically:

```
┌─────────────────────────────────────────────────────────────────┐
│                  GITHUB ACTIONS PIPELINE                         │
│                                                                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│   │  Job 1:      │  │  Job 2:      │  │  Job 3:      │         │
│   │  Unit Tests  │  │  E2E Tests   │  │  Lint        │         │
│   │              │  │              │  │              │         │
│   │  - Vitest    │  │  - Playwright│  │  - ESLint    │         │
│   │  - Fast      │  │  - Browser   │  │  - Code      │         │
│   │  - No DB     │  │  - PostgreSQL│  │    style     │         │
│   └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│   ┌──────────────┐                                              │
│   │  Job 4:      │                                              │
│   │  Type Check  │                                              │
│   │              │                                              │
│   │  - TypeScript│                                              │
│   │  - No errors │                                              │
│   └──────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The E2E Test Docker Setup

For E2E tests in GitHub Actions, a **PostgreSQL Docker container** is started:

```yaml
# From .github/workflows/test.yml
services:
  postgres:
    image: postgres:15        # Uses official PostgreSQL Docker image
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: prism_test
    ports:
      - 5432:5432
```

**What this means:**
- GitHub Actions automatically creates a temporary PostgreSQL database
- This database ONLY exists during the test run
- It's destroyed after tests complete
- Your real database is NOT affected

### Is This GitLab?

**No.** This project uses **GitHub**, not GitLab.

| Feature | GitHub | GitLab |
|---------|--------|--------|
| CI/CD | GitHub Actions | GitLab CI |
| Config file | `.github/workflows/*.yml` | `.gitlab-ci.yml` |
| Hosting | Microsoft | GitLab Inc. |

Your project has `.github/workflows/test.yml`, which is the GitHub format.

---

## 3. Summary

### Git
- **NOT automatic** - You must manually commit and push
- **Your code goes to** - The remote repository shown in `git remote -v`
- **Verify with** - `git status` and `git remote -v`

### Testing
- **Two types** - Unit tests (Vitest) and E2E tests (Playwright)
- **Run locally** - `npm run test` and `npm run test:e2e`
- **CI/CD** - GitHub Actions runs tests automatically when you push
- **Docker** - Only used for temporary PostgreSQL in E2E tests on CI
- **Not GitLab** - This is GitHub with GitHub Actions

---

## 4. Quick Reference Commands

```bash
# Check Git status
git status

# See where code would be pushed
git remote -v

# Run unit tests locally
npm run test

# Run E2E tests locally (requires running app)
npm run test:e2e

# Run linting
npm run lint

# Run type checking
npx tsc --noEmit
```
