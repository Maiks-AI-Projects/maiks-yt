#!/bin/bash
# deploy.sh - Automatically deploy updates from origin/main

# Configuration
REPO_DIR="/var/projects/maiks-yt"
BRANCH="main"
LOG_FILE="${REPO_DIR}/deploy.log"

# Navigate to the repository
cd "$REPO_DIR" || exit 1

echo "[$(date)] --- Deployment check started ---"

# Fetch latest changes
git fetch origin "$BRANCH"

# Compare local branch with origin branch
COMMITS_AHEAD=$(git rev-list --count "${BRANCH}..origin/${BRANCH}")

if [ "$COMMITS_AHEAD" -gt 0 ]; then
    echo "[$(date)] $COMMITS_AHEAD new commit(s) detected on origin/$BRANCH."
    echo "[$(date)] Pulling changes..."
    
    git pull origin "$BRANCH"
    
    # --- Future logic for Docker rebuild/restart ---
    # echo "[$(date)] Rebuilding Docker containers..."
    # docker-compose up -d --build
    # -----------------------------------------------
    
    echo "[$(date)] Update completed successfully."
else
    echo "[$(date)] No updates found. Local is up to date."
fi

echo "[$(date)] --- Deployment check finished ---"
