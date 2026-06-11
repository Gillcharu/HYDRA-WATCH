#!/bin/bash
# Run verification CI suite — use in GitHub Actions or pre-release
set -e
cd "$(dirname "$0")/.."
python3 -m pytest tests/test_verification.py -v --tb=short
echo "Verification CI passed."
