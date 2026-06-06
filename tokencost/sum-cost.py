#!/usr/bin/env python3
import csv
from collections import defaultdict
from pathlib import Path

csv_path = Path(__file__).parent / "cost.csv"

total = 0.0
by_branch = defaultdict(lambda: {"cost": 0.0, "sessions": 0})

with csv_path.open() as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            cost = float(row["total_cost_usd"])
        except ValueError:
            continue
        branch = row["git_branch"] or "(none)"
        total += cost
        by_branch[branch]["cost"] += cost
        by_branch[branch]["sessions"] += 1

rows = sorted(by_branch.items(), key=lambda kv: kv[1]["cost"], reverse=True)
branch_w = max(len("branch"), max(len(b) for b, _ in rows))

print(f"{'branch':<{branch_w}}  {'sessions':>8}  {'cost':>10}")
print(f"{'-' * branch_w}  {'-' * 8}  {'-' * 10}")
for branch, stats in rows:
    print(f"{branch:<{branch_w}}  {stats['sessions']:>8}  ${stats['cost']:>9.2f}")
print(f"{'-' * branch_w}  {'-' * 8}  {'-' * 10}")
print(f"{'TOTAL':<{branch_w}}  {sum(s['sessions'] for s in by_branch.values()):>8}  ${total:>9.2f}")
