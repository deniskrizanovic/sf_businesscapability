# Project Rules

## Salesforce Metadata — Never Hand-Write XML

**Never write or edit `*-meta.xml` files directly.** Always invoke the matching skill first.

| Metadata type | Skill to invoke |
|---|---|
| Custom Object | `generating-custom-object` |
| Custom Field | `generating-custom-field` |
| Validation Rule | `generating-validation-rule` |
| FlexiPage / Lightning Page | `generating-flexipage` |
| Custom Tab | `generating-custom-tab` |
| Permission Set | `generating-permission-set` |
| Lightning App | `generating-custom-application` |
| Custom Object (tab) | `generating-custom-tab` |

If no skill exists for the metadata type, state that explicitly and ask before proceeding.

**Why:** Hand-written Salesforce XML causes deployment failures due to strict XSD element ordering, deprecated elements per API version, and org-specific values (e.g. FlexiPage template names). The skills encode the correct patterns.

## Spec Files — Accepted Coverage Markers

Every `> Tested by:` line in `docs/specs/` must use one of these three forms. `not yet covered` and `UI only` are banned.

| Marker | When to use |
|---|---|
| `> Tested by: ClassName.methodName` | Apex or e2e test exists and passes |
| `> Tested by: ClassName.methodName (not yet written — see docs/handoff/<file>.md)` | Method name agreed, test not written yet; handoff doc must exist |
| `> Deferred: <one-line reason>` | Consciously skipped (platform-enforced, out of scope) |
