$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$staging = Get-Content -LiteralPath (Join-Path $projectRoot 'wrangler.staging.jsonc') -Raw -Encoding utf8 | ConvertFrom-Json
$production = Get-Content -LiteralPath (Join-Path $projectRoot 'wrangler.jsonc') -Raw -Encoding utf8 | ConvertFrom-Json

if ($staging.name -ne 'zgb-trpg-staging' -or
    $staging.d1_databases[0].database_id -eq $production.d1_databases[0].database_id -or
    $staging.r2_buckets[0].bucket_name -eq $production.r2_buckets[0].bucket_name) {
    throw 'Staging Pages configuration must use its own project, D1, and R2.'
}

Push-Location $projectRoot
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Website build failed.' }
    $deploymentDir = Join-Path $projectRoot ('.tmp/staging-deploy-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $deploymentDir | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'dist') -Destination $deploymentDir -Recurse
    Copy-Item -LiteralPath (Join-Path $projectRoot 'functions') -Destination $deploymentDir -Recurse
    Copy-Item -LiteralPath (Join-Path $projectRoot 'wrangler.staging.jsonc') -Destination (Join-Path $deploymentDir 'wrangler.jsonc')
    $wrangler = Join-Path $projectRoot 'node_modules/.bin/wrangler.cmd'
    Push-Location $deploymentDir
    try {
        & $wrangler pages deploy dist --project-name zgb-trpg-staging --branch staging
        if ($LASTEXITCODE -ne 0) { throw 'Staging Pages deployment failed.' }
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}
