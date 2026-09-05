#Requires -Version 5.1
<#
.SYNOPSIS
    Package the userscript into a versioned zip for distribution.

.DESCRIPTION
    Reads the @version from dist/broken-binding-se-ext.user.js and writes
    dist/broken-binding-se-ext-<version>.zip containing that userscript.
    The .user.js sits at the root of the zip, which is what Greasemonkey,
    Tampermonkey and Violentmonkey expect when installing from a package.

.PARAMETER Build
    Rebuild the userscript from src first (requires Python 3 on PATH).
    Without this switch, whatever is already in dist/ is packaged.

.EXAMPLE
    .\build\package.ps1
    Packages the current dist/broken-binding-se-ext.user.js.

.EXAMPLE
    .\build\package.ps1 -Build
    Rebuilds the userscript from src, then packages it.
#>
[CmdletBinding()]
param(
    [switch]$Build
)

$ErrorActionPreference = 'Stop'

# This script lives in <repo>\build, so the repo root is its parent.
$root   = Split-Path -Parent $PSScriptRoot
$dist   = Join-Path $root 'dist'
$userJs = Join-Path $dist 'broken-binding-se-ext.user.js'

if ($Build) {
    Write-Host 'Rebuilding userscript from src...' -ForegroundColor Cyan
    $py = Get-Command python3 -ErrorAction SilentlyContinue
    if (-not $py) { $py = Get-Command python -ErrorAction SilentlyContinue }
    if (-not $py) {
        throw 'Python 3 was not found on PATH, so -Build cannot run. Install Python, or build with "npm run build:user".'
    }
    & $py.Source (Join-Path $root 'build\build_user.py')
    if ($LASTEXITCODE -ne 0) { throw "build_user.py exited with code $LASTEXITCODE." }
}

if (-not (Test-Path -LiteralPath $userJs)) {
    throw "Built userscript not found:`n  $userJs`nBuild it first: run this script with -Build, or 'npm run build:user'."
}

# Pull @version out of the ==UserScript== metadata block.
$version = $null
foreach ($line in Get-Content -LiteralPath $userJs) {
    if ($line -match '==/UserScript==') { break }          # stop at end of metadata
    if ($line -match '^\s*//\s*@version\s+(\S+)') { $version = $Matches[1]; break }
}
if (-not $version) { throw "Could not find an @version line in $userJs." }

$zipName = "broken-binding-se-ext-$version.zip"
$zipPath = Join-Path $dist $zipName

if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }

# Compress-Archive stores the file by its leaf name at the zip root (no folder).
Compress-Archive -LiteralPath $userJs -DestinationPath $zipPath -CompressionLevel Optimal

$kb = [math]::Round((Get-Item -LiteralPath $zipPath).Length / 1KB, 1)
Write-Host "Packaged v$version -> dist\$zipName ($kb KB)" -ForegroundColor Green
