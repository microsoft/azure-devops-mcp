#!/usr/bin/env pwsh
# ==============================================================================
# Test Docker Container Script
# Tests all HTTP endpoints of the Azure DevOps MCP Server running in Docker
# ==============================================================================

Write-Host "🐳 Testing Azure DevOps MCP Server Docker Container" -ForegroundColor Cyan
Write-Host "=" * 80

$baseUrl = "http://localhost:3000"
$testsPassed = 0
$testsFailed = 0

# Function to test an endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Body = $null,
        [int]$ExpectedStatus = 200
    )
    
    Write-Host "`n📝 Test: $Name" -ForegroundColor Yellow
    Write-Host "   Method: $Method $Url"
    
    try {
        $params = @{
            Uri         = $Url
            Method      = $Method
            TimeoutSec  = 10
            ErrorAction = 'Stop'
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
            $params.ContentType = 'application/json'
        }
        
        $response = Invoke-WebRequest @params
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "   ✅ PASSED - Status: $($response.StatusCode)" -ForegroundColor Green
            
            # Pretty print JSON response
            if ($response.Content) {
                try {
                    $json = $response.Content | ConvertFrom-Json
                    Write-Host "   Response:" -ForegroundColor Gray
                    Write-Host "   $($json | ConvertTo-Json -Depth 3 -Compress)" -ForegroundColor Gray
                }
                catch {
                    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
                }
            }
            
            $script:testsPassed++
            return $true
        }
        else {
            Write-Host "   ❌ FAILED - Expected $ExpectedStatus, got $($response.StatusCode)" -ForegroundColor Red
            $script:testsFailed++
            return $false
        }
    }
    catch {
        Write-Host "   ❌ FAILED - Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:testsFailed++
        return $false
    }
}

# Wait for container to be ready
Write-Host "`n⏳ Waiting for container to be ready..."
$maxRetries = 10
$retries = 0
$ready = $false

while (-not $ready -and $retries -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $ready = $true
            Write-Host "✅ Container is ready!" -ForegroundColor Green
        }
    }
    catch {
        $retries++
        Write-Host "   Attempt $retries/$maxRetries - Container not ready yet..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    Write-Host "❌ Container failed to start after $maxRetries attempts" -ForegroundColor Red
    exit 1
}

# Run tests
Write-Host "`n" + ("=" * 80)
Write-Host "🧪 Running HTTP Endpoint Tests" -ForegroundColor Cyan
Write-Host "=" * 80

# Test 1: Health Check
Test-Endpoint -Name "Health Check" `
    -Method "GET" `
    -Url "$baseUrl/health"

# Test 2: MCP Discovery
Test-Endpoint -Name "MCP Discovery" `
    -Method "GET" `
    -Url "$baseUrl/mcp/discovery"

# Test 3: MCP Initialize
Test-Endpoint -Name "MCP Initialize" `
    -Method "POST" `
    -Url "$baseUrl/mcp/initialize" `
    -Body @{
    protocolVersion = "2024-11-05"
    capabilities    = @{
        roots    = @{
            listChanged = $true
        }
        sampling = @{}
    }
    clientInfo      = @{
        name    = "test-client"
        version = "1.0.0"
    }
}

# Test 4: Tools List
Test-Endpoint -Name "Tools List" `
    -Method "GET" `
    -Url "$baseUrl/mcp/tools/list"

# Test 5: Prompts List
Test-Endpoint -Name "Prompts List" `
    -Method "GET" `
    -Url "$baseUrl/mcp/prompts/list"

# Summary
Write-Host "`n" + ("=" * 80)
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host "=" * 80
Write-Host "✅ Passed: $testsPassed" -ForegroundColor Green
Write-Host "❌ Failed: $testsFailed" -ForegroundColor Red
Write-Host "📈 Total: $($testsPassed + $testsFailed)"

if ($testsFailed -eq 0) {
    Write-Host "`n🎉 All tests passed!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "`n⚠️ Some tests failed!" -ForegroundColor Yellow
    exit 1
}
