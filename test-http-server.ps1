# Script de test pour le serveur HTTP MCP
# Usage: .\test-http-server.ps1

Write-Host "🧪 Testing MCP HTTP Server..." -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000"

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "✅ Health check passed" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor Gray
    Write-Host "   Version: $($response.version)" -ForegroundColor Gray
    Write-Host "   Organization: $($response.organization)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Discovery
Write-Host "Test 2: MCP Discovery" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/mcp/discovery" -Method GET
    Write-Host "✅ Discovery passed" -ForegroundColor Green
    Write-Host "   Name: $($response.name)" -ForegroundColor Gray
    Write-Host "   Version: $($response.version)" -ForegroundColor Gray
    Write-Host "   Protocol: $($response.protocolVersion)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Discovery failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Initialize
Write-Host "Test 3: MCP Initialize" -ForegroundColor Yellow
try {
    $body = @{
        protocolVersion = "2024-11-05"
        capabilities    = @{
            roots    = @{ listChanged = $true }
            sampling = @{}
        }
        clientInfo      = @{
            name    = "test-client"
            version = "1.0.0"
        }
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/mcp/initialize" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✅ Initialize passed" -ForegroundColor Green
    Write-Host "   Server: $($response.serverInfo.name)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Initialize failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Tools List
Write-Host "Test 4: Tools List" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/mcp/tools/list" -Method GET
    Write-Host "✅ Tools list passed" -ForegroundColor Green
    Write-Host "   Tools count: $($response.tools.Count)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Tools list failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Prompts List
Write-Host "Test 5: Prompts List" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/mcp/prompts/list" -Method GET
    Write-Host "✅ Prompts list passed" -ForegroundColor Green
    Write-Host "   Prompts count: $($response.prompts.Count)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Prompts list failed: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "🎉 All tests completed!" -ForegroundColor Cyan
