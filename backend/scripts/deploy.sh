#!/bin/bash
# Builds the frontend and (re)starts Cwenda as a LaunchAgent on port 5300.
# It starts at login and restarts if it crashes. Re-run after code changes.
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "Don't use sudo: Cwenda runs as your user. Run plain: npm run deploy" >&2
  exit 1
fi

BACKEND="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(dirname "$BACKEND")"
LABEL=com.cwenda.server
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/Cwenda"
PORT=5300
NODE="$(command -v node)" || { echo "node not found on PATH" >&2; exit 1; }

case "$ROOT" in
  "$HOME/Desktop"/*|"$HOME/Documents"/*|"$HOME/Downloads"/*)
    echo "Cwenda is in $ROOT. macOS blocks background apps from that folder; move the project (e.g. to ~/Cwenda) first." >&2
    exit 1 ;;
esac

echo "Building frontend..."
(cd "$ROOT/frontend" && npm run build --silent)

mkdir -p "$LOG_DIR" "$(dirname "$PLIST")"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>index.js</string></array>
  <key>WorkingDirectory</key><string>$BACKEND</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>$PORT</string>
    <key>NODE_ENV</key><string>production</string>
    <key>PATH</key><string>$HOME/.local/bin:$(dirname "$NODE"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/server.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/server.log</string>
</dict>
</plist>
PLIST
plutil -lint "$PLIST" >/dev/null

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
# bootout returns before the old instance is fully gone; bootstrap then fails with error 5.
for _ in $(seq 1 20); do launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1 || break; sleep 0.5; done
for attempt in 1 2 3 4 5; do
  launchctl bootstrap "gui/$UID" "$PLIST" 2>/dev/null && break
  [ "$attempt" -eq 5 ] && { launchctl bootstrap "gui/$UID" "$PLIST"; exit 1; }  # last try shows the error
  sleep 1
done

for _ in $(seq 1 30); do
  if curl -fs -o /dev/null "http://localhost:$PORT/api/session"; then
    echo "Cwenda is running at http://localhost:$PORT (logs: npm run logs)"
    exit 0
  fi
  sleep 0.5
done
echo "Started, but http://localhost:$PORT isn't answering yet. Check: npm run logs" >&2
exit 1
