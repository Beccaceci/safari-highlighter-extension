#!/bin/bash
# Helper script to open test page in Safari
TEST_PAGE="$(cd "$(dirname "$0")" && pwd)/test/test-page.html"
echo "Opening Safari with test page: $TEST_PAGE"
open -a Safari "$TEST_PAGE"
