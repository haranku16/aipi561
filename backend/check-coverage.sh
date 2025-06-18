#!/bin/bash

# Run tests with coverage
echo "Running tests with coverage..."
deno test --allow-net --allow-env --env-file=.env --allow-read --allow-run --allow-sys --allow-import --unstable-kv --parallel --coverage=cov/

# Generate coverage output and extract percentages
echo "Generating coverage summary..."
COVERAGE_OUTPUT=$(deno coverage cov/)

# Extract line and branch coverage percentages from the "All files" row
COVERAGE_LINE=$(echo "$COVERAGE_OUTPUT" | grep -E "All files" | awk '{gsub(/[^0-9.]/, "", $2); gsub(/[^0-9.]/, "", $4); print $2, $4}')
BRANCH_COVERAGE=$(echo $COVERAGE_LINE | awk '{print $1}')
LINE_COVERAGE=$(echo $COVERAGE_LINE | awk '{print $2}')

echo "Line coverage: ${LINE_COVERAGE}%"
echo "Branch coverage: ${BRANCH_COVERAGE}%"

# Check if coverage meets thresholds
if (( $(echo "$LINE_COVERAGE < 80" | bc -l) )); then
    echo "❌ Line coverage (${LINE_COVERAGE}%) is below the required 80%"
    exit 1
fi

if (( $(echo "$BRANCH_COVERAGE < 70" | bc -l) )); then
    echo "❌ Branch coverage (${BRANCH_COVERAGE}%) is below the required 70%"
    exit 1
fi

echo "✅ Coverage thresholds met: Line coverage ${LINE_COVERAGE}%, Branch coverage ${BRANCH_COVERAGE}%"

# Generate HTML report
echo "Generating HTML coverage report..."
deno coverage --lcov --html cov/ --output=cov-html

echo "Coverage report generated in cov-html/ directory" 