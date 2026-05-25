# Start local development server
# Required: Node.js / npx (npm install -g serve, or just npx serve)
Set-Location $PSScriptRoot
Write-Host "Starting local server at http://localhost:3000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
npx serve .
