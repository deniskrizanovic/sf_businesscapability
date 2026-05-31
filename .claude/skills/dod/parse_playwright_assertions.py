"""
Extract test name -> expect() assertion pairs from a Playwright TypeScript spec file.

Usage: python3 parse_playwright_assertions.py <spec_file>

Output format:
  # parsed N tests, M assertions
  describe: <describe title>
  test: <test title>
    expect: <expect call>
  ...

Warnings:
  ⚠ test "<title>" has await calls but 0 assertions found
"""

import re
import sys


def extract_string_arg(line: str, keyword: str) -> str:
    """Extract the first quoted string argument after `keyword(`."""
    pattern = rf"{keyword}\s*\(\s*(['\"`])(.*?)\1"
    m = re.search(pattern, line)
    return m.group(2) if m else ""


def parse_spec(path: str):
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()

    results: list[dict] = []  # {describe, test, expects: list[str], awaits: int}
    current_describe = ""
    current_test: dict | None = None
    depth = 0  # brace depth since start of current test body

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Detect describe block
        if re.search(r'\btest\.describe\s*\(', stripped):
            current_describe = extract_string_arg(stripped, r"test\.describe")

        # Detect test() start
        elif re.search(r'\btest\s*\(', stripped) and not re.search(r'test\.(describe|beforeAll|beforeEach|afterAll|afterEach)', stripped):
            if current_test is not None:
                results.append(current_test)
            title = extract_string_arg(stripped, r"test")
            current_test = {
                "describe": current_describe,
                "test": title,
                "expects": [],
                "awaits": 0,
            }
            depth = stripped.count("{") - stripped.count("}")

        elif current_test is not None:
            # Track brace depth
            depth += stripped.count("{") - stripped.count("}")

            # Count await lines (heuristic: any await inside a test body)
            if "await " in stripped:
                current_test["awaits"] += 1

            # Collect expect() calls — capture from `expect(` to end of statement
            if "expect(" in stripped:
                # Grab from expect( to end of line (may be chained: expect(...).toBeVisible())
                m = re.search(r'(expect\(.*)', stripped)
                if m:
                    current_test["expects"].append(m.group(1).rstrip(";").strip())

            # Test body ended
            if depth <= 0:
                results.append(current_test)
                current_test = None
                depth = 0

        i += 1

    if current_test is not None:
        results.append(current_test)

    return results


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 parse_playwright_assertions.py <spec_file>", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    try:
        results = parse_spec(path)
    except FileNotFoundError:
        print(f"Error: file not found: {path}", file=sys.stderr)
        sys.exit(1)

    total_tests = len(results)
    total_expects = sum(len(r["expects"]) for r in results)
    print(f"# parsed {total_tests} tests, {total_expects} assertions")
    print()

    current_describe = None
    for r in results:
        if r["describe"] != current_describe:
            current_describe = r["describe"]
            print(f"describe: {current_describe}")

        print(f"  test: {r['test']}")
        for exp in r["expects"]:
            print(f"    expect: {exp}")

        if r["awaits"] > 0 and len(r["expects"]) == 0:
            print(f"    ⚠ has {r['awaits']} await call(s) but 0 assertions found")

    print()


if __name__ == "__main__":
    main()
