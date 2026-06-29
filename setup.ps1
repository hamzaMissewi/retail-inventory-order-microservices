Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Retail Platform - Setup Script (Windows)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "Installing dependencies..." -ForegroundColor Yellow
$services = @("shared", "product-service", "order-service", "customer-service", "notification-service", "api-gateway", "scripts")
foreach ($dir in $services) {
    Write-Host "  → $dir"
    Push-Location $dir
    npm install --silent 2>$null
    Pop-Location
}

Write-Host ""
Write-Host "Creating shared module symlinks..." -ForegroundColor Yellow
$targets = @("product-service", "order-service", "customer-service", "notification-service", "api-gateway")
$root = Get-Location
foreach ($s in $targets) {
    $target = Join-Path $root "$s\shared"
    if (-not (Test-Path $target)) {
        $source = Join-Path $root "shared"
        New-Item -Path $target -ItemType Junction -Target $source | Out-Null
        Write-Host "  ✓ $s/shared" -ForegroundColor Green
    } else {
        Write-Host "  - $s/shared (exists)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Quick Start:" -ForegroundColor White
Write-Host "    docker-compose up --build"
Write-Host ""
Write-Host "  Seed Demo Data:" -ForegroundColor White
Write-Host "    node scripts/seed-demo.js"
Write-Host ""
Write-Host "  Run Demo:" -ForegroundColor White
Write-Host "    node scripts/linkedin-demo.js"
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
