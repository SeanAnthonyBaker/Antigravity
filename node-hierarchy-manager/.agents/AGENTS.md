# Project Operational Rules & Safety Protocols

## 1. Safety & Security Guardrails
- **Credential Protection**: Never log, display, or hardcode API keys, secrets, JWT bearer tokens, or `.env` file contents in transcripts, artifacts, or source code.
- **Destructive Command Prevention**: Never execute irreversible destructive commands (e.g. `rm -rf`, `git reset --hard HEAD~10`, `DROP DATABASE`) without prior explicit confirmation.
- **Sandboxed Execution**: Always run test suites and untrusted automation scripts within isolated sandbox environments or using `--dry-run` flags where applicable.
- **Workspace Boundary Enforcement**: Strictly restrict file reads and writes to the project workspace root. Do not modify system-level directories or parent file systems.

## 2. Code Formatting & Quality Standards
- **TypeScript / JavaScript Standards**:
  - Enforce ESLint and Prettier formatting rules across all `.ts`, `.tsx`, and `.js` files.
  - Require strict type annotations; avoid `any` unless explicitly justified.
  - Prefer `async` / `await` over raw nested Promise chaining.
- **Python Standards**:
  - Adhere to PEP 8 style guidelines with Black / Ruff formatting.
  - Require strict type hints (`typing`) on all public function signatures.
- **Documentation Standards**:
  - Preserve all existing comments and docstrings when modifying files.
  - Include JSDoc / docstrings on newly created modules, classes, and exported functions.

## 3. Automated Verification Mandate
- Run project test suites (`npm test` / `pytest`) and linters before declaring any refactoring or feature implementation complete.
- Resolve all compiler and linter warnings prior to finalizing walkthrough artifacts.

## 4. Deliverable Format Policy
- All comprehensive explanations, architectural guides, and formal answers must be delivered in professional PDF format compiled via ReportLab.
