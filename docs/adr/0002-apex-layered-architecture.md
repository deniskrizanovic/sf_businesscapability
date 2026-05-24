# Apex Layered Architecture

We use a lightweight four-layer Apex architecture — Trigger → TriggerHandler → Service → Selector — with a separate thin Controller layer for LWC-facing `@AuraEnabled` methods. FFLIB (Apex Enterprise Patterns) was considered and rejected: at three domain objects, the framework overhead exceeds the benefit.

Every artifact carries the `bcm_` prefix: Apex classes, LWC components, objects, fields, and permission sets. This enforces a uniform convention and prevents collision with other org code.

## Layer responsibilities

- **Trigger** — one trigger per object, single line, delegates entirely to TriggerHandler.
- **TriggerHandler** — routes by trigger context; no business logic.
- **Service** — all business logic; throws domain exceptions; no knowledge of LWC or trigger context.
- **Selector** — all SOQL; methods prefixed `select` to signal database hits at a glance.
- **Controller** — thin `@AuraEnabled` surface; delegates to Service; catches exceptions and wraps as `AuraHandledException` at this boundary only.

## LWC conventions

- **`@wire` for reads, imperative for mutations** — wire handles reactivity and caching for data loads; imperative calls give explicit control over mutations, loading state, and error handling.
- **Container/presentational split** — container components own wire calls and Apex interaction; presentational components receive data as properties and communicate only via events. No child component calls Apex directly.
- **One test class per production class** — unit coverage is class-scoped; cross-layer flows are covered in separate integration test classes.

## Considered Options

- **FFLIB** — rejected; Domain/UnitOfWork abstractions are disproportionate for this app's scope.
- **Queries in Service** — rejected; inline SOQL obscures logic flow and prevents reuse.
- **Exceptions caught in Service** — rejected; Service should be LWC-agnostic and reusable from batch/flow contexts.
- **Imperative for all LWC data loads** — rejected; wire is the idiomatic Salesforce approach for reads and handles cache/reactivity automatically.
