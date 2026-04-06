#!/bin/bash
# watch-main.sh - Watch for updates and trigger deploy.sh every 5 minutes

REPO_DIR="/var/projects/maiks-yt"
DEPLOY_SCRIPT="${REPO_DIR}/deploy.sh"
LOG_FILE="${REPO_DIR}/deploy.log"

echo "[$(date)] --- Watcher started ---" >> "$LOG_FILE"

while true; do
    # Execute the deploy script and log its output
    echo "[$(date)] Executing deployment check..." >> "$LOG_FILE"
    bash "$DEPLOY_SCRIPT" >> "$LOG_FILE" 2>&1
    
    # Wait for 5 minutes before the next check
    sleep 300
done
