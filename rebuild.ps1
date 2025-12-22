# Docker 전체 재빌드 및 마이그레이션 스크립트
# Usage: .\rebuild.ps1

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Docker Rebuild & Migration" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Step 1: 기존 컨테이너 및 볼륨 제거
Write-Host "`n[1/5] Stopping and removing containers..." -ForegroundColor Yellow
docker compose down -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: docker compose down failed, continuing..." -ForegroundColor Red
}

# Step 2: 이미지 재빌드 (캐시 없이)
Write-Host "`n[2/5] Rebuilding images without cache..." -ForegroundColor Yellow
docker compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker compose build failed" -ForegroundColor Red
    exit 1
}

# Step 3: 컨테이너 시작
Write-Host "`n[3/5] Starting containers..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker compose up failed" -ForegroundColor Red
    exit 1
}

# Step 4: DB 준비 대기
Write-Host "`n[4/5] Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Step 5: DB 마이그레이션 실행
Write-Host "`n[5/5] Running database migration..." -ForegroundColor Yellow
Get-Content "docs\DB_MIGRATION_COMPLETE.sql" | docker exec -i rmarh-db-1 psql -U vault -d vault
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: database migration failed" -ForegroundColor Red
    exit 1
}

# 완료 확인
Write-Host "`n================================" -ForegroundColor Green
Write-Host "Rebuild Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

Write-Host "`nChecking container status..." -ForegroundColor Cyan
docker ps --filter "name=rmarh" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host "`nChecking database tables..." -ForegroundColor Cyan
docker exec rmarh-db-1 psql -U vault -d vault -c "\dt"

Write-Host "`nAPI health check:" -ForegroundColor Cyan
Start-Sleep -Seconds 3
try {
    $response = Invoke-WebRequest -Uri "http://localhost:18000/health" -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "API health check failed: $_" -ForegroundColor Red
}

Write-Host "`n✅ All done! Frontend: http://localhost:3000" -ForegroundColor Green
