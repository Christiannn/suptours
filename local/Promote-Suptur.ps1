<#
.SYNOPSIS
    Promotes one branch to the next: develop -> staging -> main.

.DESCRIPTION
    Promotion is a fast-forward push and nothing else:

        git push origin origin/develop:refs/heads/staging

    No checkout, no merge, no working-tree churn — and because the resulting
    commit is byte-identical to the one CI already tested on develop, its green
    checks carry over to staging and main for free.

    This matters more than it looks. If you promote with GitHub's merge button
    instead, staging gains a merge commit that develop does not have. The next
    promotion is then no longer a fast-forward, the branches drift apart, and
    every promotion after that is a merge with conflicts to resolve. Keeping
    all three branches on literally the same commit is what keeps this simple.

    The corollary: never commit directly to staging or main. If an emergency
    forces it, merge it straight back down to develop or the next promotion
    will be refused.

.EXAMPLE
    .\Promote-Suptur.ps1 -To staging
    .\Promote-Suptur.ps1 -To main
    .\Promote-Suptur.ps1 -To main -Yes
#>
param(
    [Parameter(Mandatory)][ValidateSet('staging', 'main')][string]$To,
    [switch]$Yes,
    [switch]$NoTag
)

. "$PSScriptRoot\Common.ps1"

$from = if ($To -eq 'staging') { 'develop' } else { 'staging' }
$repo = (Resolve-Path "$PSScriptRoot\..").Path

Push-Location $repo
try {
    Write-Host "Fetching..." -ForegroundColor Cyan
    & git fetch --quiet --prune --tags origin
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed." }

    foreach ($branch in @($from, $To)) {
        & git rev-parse --verify --quiet "origin/$branch" > $null
        if ($LASTEXITCODE -ne 0) {
            throw "origin/$branch does not exist. Create it before promoting."
        }
    }

    $fromSha = (& git rev-parse --short "origin/$from").Trim()
    $toSha = (& git rev-parse --short "origin/$To").Trim()

    if ($fromSha -eq $toSha) {
        Write-Host "origin/$To is already at $fromSha — nothing to promote." -ForegroundColor Green
        exit 0
    }

    # Catch a non-fast-forward here rather than letting the server reject it,
    # so the message explains what actually went wrong.
    & git merge-base --is-ancestor "origin/$To" "origin/$from"
    if ($LASTEXITCODE -ne 0) {
        $extra = & git log --oneline "origin/$from..origin/$To"
        Write-Host ""
        Write-Host "  Cannot promote: origin/$To has commits that origin/$from does not." -ForegroundColor Red
        Write-Host ""
        $extra | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        Write-Host ""
        Write-Host "  Something was committed directly to '$To'. Nothing is lost, but the" -ForegroundColor Yellow
        Write-Host "  branches have diverged and a fast-forward is no longer possible." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Merge it back down first, then promote again:" -ForegroundColor Yellow
        Write-Host "    git checkout develop && git merge origin/$To && git push origin develop" -ForegroundColor Yellow
        Write-Host ""
        throw "Promotion refused: origin/$To is not an ancestor of origin/$from."
    }

    $commits = & git log --oneline "origin/$To..origin/$from"
    $count = ($commits | Measure-Object).Count

    Write-Host ""
    Write-Host "  Promoting $from -> $To" -ForegroundColor Cyan
    Write-Host "  $toSha..$fromSha  ($count commit$(if ($count -ne 1) { 's' }))" -ForegroundColor Cyan
    Write-Host ""
    $commits | ForEach-Object { Write-Host "    $_" }
    Write-Host ""

    if ($To -eq 'main') {
        Write-Host "  This is what goes live on https://suptur.dk." -ForegroundColor Yellow
        Write-Host "  It does NOT deploy by itself — run Deploy-Suptur.ps1 -Env production after." -ForegroundColor Yellow
        Write-Host ""
    }

    if (-not $Yes) {
        $typed = Read-Host "  Type '$To' to promote"
        if ($typed -ne $To) { throw "Aborted: expected '$To', got '$typed'." }
    }

    # The push itself. No --force anywhere: if this would not be a
    # fast-forward, the server refuses it, which is the safety net behind the
    # local check above.
    & git push origin "origin/${from}:refs/heads/$To"
    if ($LASTEXITCODE -ne 0) { throw "git push failed." }

    Write-Host ""
    Write-Host "  origin/$To is now at $fromSha" -ForegroundColor Green

    # Tag production promotions, so a rollback target has a name you can say
    # out loud and `deploy.sh --ref v...` can reach.
    if ($To -eq 'main' -and -not $NoTag) {
        $date = Get-Date -Format 'yyyy.MM.dd'
        $n = 1
        while (& git rev-parse --verify --quiet "refs/tags/v$date-$n") { $n++ }
        $tag = "v$date-$n"
        & git tag -a $tag "origin/main" -m "Release $tag"
        & git push --quiet origin $tag
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Tagged $tag" -ForegroundColor Green
        } else {
            Write-Host "  Tag $tag could not be pushed — promote succeeded regardless." -ForegroundColor Yellow
        }
    }

    Write-Host ""
    if ($To -eq 'staging') {
        Write-Host "  Next:  .\Deploy-Suptur.ps1 -Env staging" -ForegroundColor Cyan
    } else {
        Write-Host "  Next:  .\Deploy-Suptur.ps1 -Env production" -ForegroundColor Cyan
    }
    Write-Host ""
}
finally {
    Pop-Location
}
