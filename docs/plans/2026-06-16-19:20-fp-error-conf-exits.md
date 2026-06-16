# Add Error/Confirmation Message Exits to function-point-count.md

## Context

MIS examples §2.6.1 + Part 2 guidance Rules 16-19(a) require **one dedicated X for error/confirmation messages** per functional process — separate from any data Exit. Every FP with a Write that can fail must carry this Exit; platform-generated CRUD errors are not "free" — they are within the FUR scope (permission sets + object tab implicitly include standard platform error behaviour) and are NOT excluded by §2.6.3 (which only applies to messages the FUR does not require the software to process at all, e.g. OS printer errors).

FP4 is unchanged: `bcm_ImportResult` bundles success counts + failure data as a single object of interest; the existing X covers all of this per §2.6.2.

Net change: **14 FPs × +1 CFP = 119 → 133 CFP, X 30 → 44.**

---

## Change 1 — Add strategy note to §1 Measurement Strategy

File: `docs/economics/function-point-count.md`

Add a new subsection **1.4 Error/Confirmation Messages** immediately after the existing §1.3 Data Groups block:

```
### 1.4 Error/Confirmation Messages

Per Part 2 guidance on Rules 16-19(a): one Exit is identified per functional process for all error/confirmation messages from all possible causes according to the FUR. Platform-generated CRUD errors (validation failures, DML exceptions surfaced to the user) are within the FUR scope — they are implied by the permission sets and object-tab definitions that form the FUR and are not excluded by §2.6.3. Every functional process that performs a Write therefore carries one additional Exit for error/confirmation messages, separate from any data Exit.

Exception: FP4 (Import) — `bcm_ImportResult` bundles success counts and failure data as a single object of interest; the existing Exit covers both the data and the error indication per §2.6.2.
```

---

## Change 2 — Detail table additions (14 FPs)

For each FP below, add one row at the end of its data movement table:

| #   | Movement                              | Type | Data Group | Notes                                                                         |
| --- | ------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------- |
| N   | Send error/confirmation message to UI | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

Where N = (previous last row number + 1).

| FP   | New row # | Size change |
| ---- | --------- | ----------- |
| FP5  | 5         | 4 → 5 CFP   |
| FP6  | 9         | 8 → 9 CFP   |
| FP9  | 4         | 3 → 4 CFP   |
| FP11 | 4         | 3 → 4 CFP   |
| FP12 | 5         | 4 → 5 CFP   |
| FP16 | 4         | 3 → 4 CFP   |
| FP18 | 4         | 3 → 4 CFP   |
| FP19 | 5         | 4 → 5 CFP   |
| FP20 | 6         | 5 → 6 CFP   |
| FP21 | 5         | 4 → 5 CFP   |
| FP25 | 4         | 3 → 4 CFP   |
| FP27 | 4         | 3 → 4 CFP   |
| FP28 | 5         | 4 → 5 CFP   |
| FP30 | 4         | 3 → 4 CFP   |

---

## Change 3 — Summary table (§5)

Updated rows (X column +1, CFP +1 each):

| FP   | E   | X   | R   | W   | CFP |
| ---- | --- | --- | --- | --- | --- |
| FP5  | 1   | 2   | 1   | 1   | 5   |
| FP6  | 1   | 2   | 2   | 4   | 9   |
| FP9  | 1   | 2   | 0   | 1   | 4   |
| FP11 | 1   | 2   | 0   | 1   | 4   |
| FP12 | 1   | 2   | 1   | 1   | 5   |
| FP16 | 1   | 2   | 0   | 1   | 4   |
| FP18 | 1   | 2   | 0   | 1   | 4   |
| FP19 | 1   | 2   | 1   | 1   | 5   |
| FP20 | 1   | 2   | 2   | 1   | 6   |
| FP21 | 1   | 2   | 1   | 1   | 5   |
| FP25 | 1   | 2   | 0   | 1   | 4   |
| FP27 | 1   | 2   | 0   | 1   | 4   |
| FP28 | 1   | 2   | 1   | 1   | 5   |
| FP30 | 1   | 2   | 0   | 1   | 4   |

**Total row: E 30, X 44, R 36, W 23, CFP 133**

Footer: `**Total COSMIC Functional Size: 133 CFP**`

Step-7 closeout note: update total reference 119 → 133 CFP. The FP1+FP2+FP3+FP29+FP30 = 19 CFP sub-total is unchanged (read-only FPs, no error/conf X added).

---

## Verification

- §1.4 paragraph present in Measurement Strategy section
- 14 FP tables each have a new last row: type X, data group "—", note cites §2.6.1
- FP4 table unchanged (still 11 rows, 11 CFP)
- All read-only FPs (FP1–FP3, FP7–FP8, FP10, FP13–FP15, FP17, FP22–FP24, FP26, FP29) unchanged
- Summary table X column sums to 44, CFP sums to 133
- Footer reads 133 CFP
