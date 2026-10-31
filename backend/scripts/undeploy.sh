#!/bin/bash
# Stops the Cwenda LaunchAgent and removes it, so it no longer starts at login.
set -uo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "Don't use sudo: Cwenda runs as your user. Run plain: npm run undeploy" >&2
  exit 1
fi
LABEL=com.cwenda.server
launchctl bootout "gui/$UID/$LABEL" 2>/dev/null && echo "Stopped." || echo "Was not running."
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
