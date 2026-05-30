"""
Parse `sf apex run test --result-format json` output from stdin.
Prints two sections for the DoD Apex table:

  === Tests ===
  bcm_CapabilityTagTest: run=5 fail=0

  === Coverage ===
  bcm_CapabilityHandler: 95%

  === Failures ===
  bcm_SomeTest.some_method: System.AssertException: ...

Test classes (*Test*) appear only in the Tests section.
All other bcm_ classes appear only in the Coverage section.
"""
import json
import sys
from collections import defaultdict

data = json.load(sys.stdin)
coverage = data["result"]["coverage"]["coverage"]
tests = data["result"]["tests"]

class_counts = defaultdict(lambda: {"run": 0, "fail": 0})
for t in tests:
    name = t["ApexClass"]["Name"]
    class_counts[name]["run"] += 1
    if t["Outcome"] != "Pass":
        class_counts[name]["fail"] += 1

print("=== Tests ===")
for cls, counts in sorted(class_counts.items()):
    print(f"{cls}: run={counts['run']} fail={counts['fail']}")

print()
print("=== Coverage ===")
for c in coverage:
    name = c["name"]
    if not name.startswith("bcm_") or "Test" in name:
        continue
    total = c["totalLines"]
    covered = sum(1 for v in c["lines"].values() if v == 1)
    pct = round(covered / total * 100) if total > 0 else 0
    print(f"{name}: {pct}%")

print()
print("=== Failures ===")
for t in tests:
    if t["Outcome"] != "Pass":
        print(f"{t['ApexClass']['Name']}.{t['MethodName']}: {t['Message']}")
