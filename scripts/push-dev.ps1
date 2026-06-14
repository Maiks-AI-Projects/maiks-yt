param(
  [Parameter(Mandatory = $true)]
  [string] $Message,

  [string] $Server = "codex-server-1",
  [string] $ServerProject = "/var/projects/maiks-yt-dev",
  [string] $ServerContainer = "maiks-yt-dev",
  [switch] $SkipTypecheck,
  [switch] $SkipServerPull,
  [switch] $SkipServerPackageBuild
)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [string] $Title,
    [scriptblock] $Command
  )

  Write-Host "==> $Title"
  & $Command
}

$branch = (git branch --show-current).Trim()
if ($branch -ne "main") {
  throw "Expected local branch 'main', but current branch is '$branch'."
}

$status = git status --short
if (-not $status) {
  throw "No local changes to commit."
}

if (-not $SkipTypecheck) {
  Run-Step "Typechecking web app" {
    corepack pnpm --filter "@maiks-yt/web" typecheck
  }
}

Run-Step "Staging local changes" {
  git add -A
}

Run-Step "Committing local changes" {
  git commit -m $Message
}

Run-Step "Pushing main" {
  git push origin main
}

Run-Step "Mirroring main to dev" {
  git push origin main:dev
}

if (-not $SkipServerPull) {
  Run-Step "Pulling dev on server" {
    ssh $Server "cd '$ServerProject' && git pull --ff-only origin dev && git status --short"
  }

  if (-not $SkipServerPackageBuild) {
    Run-Step "Building shared packages on server" {
      ssh $Server "docker exec $ServerContainer sh -lc 'pnpm --filter @maiks-yt/config --filter @maiks-yt/database --filter @maiks-yt/domain --filter @maiks-yt/events --filter @maiks-yt/integrations --filter @maiks-yt/testing --filter @maiks-yt/themes --filter @maiks-yt/ui build'"
    }
  }
}

Run-Step "Done" {
  git status --short
}
