$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Get-ChildItem "$root\layouts" -Filter "page*-v*.json" -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem "$root\scripts" -Filter "brackenvale-character-sheet-v*.js" -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem "$root\scripts" -Filter "sheet-components-v*.js" -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem "$root\templates" -Filter "character-sheet-v*.hbs" -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem "$root\styles" -Filter "brackenvale-character-sheet-v*.css" -ErrorAction SilentlyContinue | Remove-Item -Force
Write-Host "Old versioned Brackenvale sheet/layout files removed."
