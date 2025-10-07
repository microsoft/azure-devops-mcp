# Script pour démarrer le serveur MCP en mode HTTP
# Usage: .\start-http-server.ps1

Write-Host "🚀 Starting MCP HTTP Server..." -ForegroundColor Cyan
Write-Host ""

# Set environment variables
$env:MCP_TRANSPORT = "http"
$env:PORT = "3000"

# Start the server
Write-Host "📡 Mode: HTTP" -ForegroundColor Green
Write-Host "🔌 Port: 3000" -ForegroundColor Green
Write-Host "🏢 Organization: nexusinno" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

node dist/index.js nexusinno --authentication interactive
