# Restart Dev Server Script
# แก้ไข API Route 404 Error

Write-Host "`n🔄 Restarting Dev Server..." -ForegroundColor Cyan
Write-Host "=" * 80

# Step 1: Kill Node.js processes
Write-Host "`n📌 Step 1: Killing Node.js processes..." -ForegroundColor Yellow
try {
    $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        $nodeProcesses | Stop-Process -Force
        Write-Host "✅ Killed $($nodeProcesses.Count) Node.js process(es)" -ForegroundColor Green
    } else {
        Write-Host "✅ No Node.js processes running" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Warning: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 2: Remove .next cache
Write-Host "`n📌 Step 2: Removing .next cache folder..." -ForegroundColor Yellow
if (Test-Path ".next") {
    try {
        Remove-Item -Recurse -Force .next
        Write-Host "✅ Removed .next cache folder" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error removing .next: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Please manually delete the .next folder" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ .next folder doesn't exist" -ForegroundColor Green
}

# Step 3: Build project
Write-Host "`n📌 Step 3: Building project..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray
try {
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Build completed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
        Write-Host "   Output: $buildOutput" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error during build: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Instructions for starting dev server
Write-Host "`n📌 Step 4: Ready to start dev server" -ForegroundColor Yellow
Write-Host "=" * 80
Write-Host "`n✅ All steps completed successfully!" -ForegroundColor Green
Write-Host "`nTo start the dev server, run:" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor White
Write-Host "`nOr run this command now:" -ForegroundColor Cyan
Write-Host "   .\restart-dev-server.ps1 -StartServer" -ForegroundColor White
Write-Host ""

# Optional: Start dev server if -StartServer flag is provided
param(
    [switch]$StartServer
)

if ($StartServer) {
    Write-Host "`n🚀 Starting dev server..." -ForegroundColor Cyan
    npm run dev
}
