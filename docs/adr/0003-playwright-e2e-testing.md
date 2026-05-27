# ADR 0003: Playwright for E2E testing

We use Playwright to test the application against a deployed Salesforce org.
Playwright authenticates as a real user and exercises the Lightning UI directly,
covering permission boundary enforcement, validation rule error messages, and
(once built) the SVG diagram interactions — things Apex unit tests cannot reach.

## Considered Options

**UTAM (UI Test Automation Model)** was the primary alternative. UTAM is Salesforce's own
open-source E2E framework and understands Lightning component selectors natively.
It was rejected because it requires Page Objects authored in a Salesforce-specific
JSON format, adds a dedicated compilation step, and — at this project's scale —
imposes more framework overhead than it saves. Playwright's standard CSS/ARIA
selectors are sufficient for Lightning Experience, and the ecosystem (debugging,
tracing, parallel runs) is significantly more mature.

**No E2E framework** is the current state. The risk is that permission set enforcement,
validation rule error messages, and drag-drop interactions are only tested by Apex
unit tests and manual verification. As the LWC diagram grows in complexity (SVG layout,
drag-drop state machine, tag colorisation) that gap becomes unacceptable.

## Consequences

- A `tests/e2e/` directory is added to the repo alongside `force-app/`
- Playwright authenticates via a stored session or environment-variable credentials
  against a named org (initially `home-denispoc`)
- Tests are run manually by developers (`npx playwright test`); CI integration is
  the intended end state but is out of scope for the initial implementation
- Coverage starts against already-deployed pages (Map record page, Capability record
  page, permission set enforcement) and extends to LWC components as they land in
  Steps 6–8
