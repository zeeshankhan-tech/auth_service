#!/usr/bin/env sh
set -e
BASE="${BASE_URL:-http://localhost:4000}"

echo "=== 1. Health ==="
curl -sf "$BASE/health"
echo ""

EMAIL="docker-e2e-$(date +%s)@test.com"
BODY='{"name":"Docker E2E","email":"'"$EMAIL"'","password":"Str0ngPass!"}'

echo "=== 2. Register ==="
REG=$(curl -sf -X POST "$BASE/api/v1/auth/register" -H "Content-Type: application/json" -d "$BODY")
echo "$REG" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!d.success) process.exit(1); console.log('user:', d.data.user.email);"

ACCESS=$(echo "$REG" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.accessToken")
REFRESH=$(echo "$REG" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.refreshToken")

echo "=== 3. Login ==="
curl -sf -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"'"$EMAIL"'","password":"Str0ngPass!"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).success"

echo "=== 4. Me ==="
curl -sf "$BASE/api/v1/auth/me" -H "Authorization: Bearer $ACCESS" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.user.email"

echo "=== 5. Validate ==="
curl -sf -X POST "$BASE/api/v1/auth/validate" -H "Content-Type: application/json" \
  -d '{"token":"'"$ACCESS"'"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.valid"

echo "=== 6. Refresh ==="
NEW=$(curl -sf -X POST "$BASE/api/v1/auth/refresh" -H "Content-Type: application/json" \
  -d '{"refreshToken":"'"$REFRESH"'"}')
ACCESS2=$(echo "$NEW" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.accessToken")
REFRESH2=$(echo "$NEW" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.refreshToken")
echo "new access token: ok"

echo "=== 7. Replay refresh (expect 401) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/auth/refresh" -H "Content-Type: application/json" \
  -d '{"refreshToken":"'"$REFRESH"'"}')
test "$CODE" = "401" && echo "got 401" || (echo "expected 401 got $CODE"; exit 1)

echo "=== 8. Logout ==="
curl -sf -X POST "$BASE/api/v1/auth/logout" -H "Authorization: Bearer $ACCESS2" \
  -H "Content-Type: application/json" -d '{"refreshToken":"'"$REFRESH2"'"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.success"

echo "=== 9. Me after logout (expect 401) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/auth/me" -H "Authorization: Bearer $ACCESS2")
test "$CODE" = "401" && echo "got 401" || (echo "expected 401 got $CODE"; exit 1)

echo "=== 10. Admin ping (expect 403) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/admin/ping" -H "Authorization: Bearer $ACCESS")
test "$CODE" = "403" && echo "got 403" || (echo "expected 403 got $CODE"; exit 1)

echo "=== ALL E2E CHECKS PASSED ==="
