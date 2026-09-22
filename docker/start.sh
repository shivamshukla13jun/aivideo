#!/usr/bin/env bash
# Single-container supervisor: runs Suwayomi-Server + Next.js standalone
# and forwards shutdown signals to both.
set -euo pipefail

SUWAYOMI_PORT="${SUWAYOMI_PORT:-4567}"
JAR="$(ls /opt/suwayomi/*.jar | head -n 1)"

mkdir -p /home/suwayomi/.local/share/Tachidesk

echo "[start] Suwayomi-Server -> 0.0.0.0:${SUWAYOMI_PORT} (jar: ${JAR})"
# -Duser.home: Java reads the data dir from user.home (passwd entry /root
# otherwise); must point at the mounted volume path.
java ${JAVA_OPTS:-} \
  -Duser.home=/home/suwayomi \
  -Dsuwayomi.tachidesk.config.server.ip="${SUWAYOMI_BIND_IP:-0.0.0.0}" \
  -Dsuwayomi.tachidesk.config.server.port="${SUWAYOMI_PORT}" \
  -Dsuwayomi.tachidesk.config.server.webUISubpath="${SUWAYOMI_WEBUI_SUBPATH:-/suwayomi}" \
  -jar "${JAR}" &
SUWA_PID=$!

echo "[start] Next.js -> 0.0.0.0:${PORT:-3000}"
cd /app
node server.js &
NODE_PID=$!

shutdown() {
  echo "[start] shutting down..."
  kill -TERM "${NODE_PID}" "${SUWA_PID}" 2>/dev/null || true
}
trap shutdown TERM INT

# Exit when either process dies, then stop the other one.
wait -n "${SUWA_PID}" "${NODE_PID}" || true
shutdown
wait "${SUWA_PID}" "${NODE_PID}" 2>/dev/null || true
