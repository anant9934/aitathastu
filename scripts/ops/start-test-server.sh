#!/usr/bin/env sh
# Dev server on the local test database and local Redis emulator (never production stores, see P4-26).
#   sh scripts/ops/start-test-server.sh [port]
cd "$(dirname "$0")/../.." || exit 1
export NEXT_DIST_DIR=.next-test
export DATABASE_URL=postgres://postgres:phase1@127.0.0.1:54399/tathastu_test
export DATABASE_MODE=postgres DATABASE_TRANSPORT=tcp
export UPSTASH_REDIS_REST_URL=http://127.0.0.1:18079 UPSTASH_REDIS_REST_TOKEN=phase1token
export APP_BASE_URL=http://localhost:${1:-3100}
exec npx next dev -p "${1:-3100}"
