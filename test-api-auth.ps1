# API 프록시 헤더 전달 테스트

Write-Host "================================" -ForegroundColor Cyan
Write-Host "API 프록시 인증 테스트" -ForegroundColor Cyan  
Write-Host "================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3002"
$adminPassword = "admin123"

# 테스트 1: 올바른 비밀번호
Write-Host "`n[TEST 1] notify - 올바른 비밀번호" -ForegroundColor Yellow
$headers = @{
    "Content-Type" = "application/json"
    "x-admin-password" = $adminPassword
}
$body = '{"type":"EXPIRY_D2","user_ids":[1]}'

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/vault/notify" -Method POST -Headers $headers -Body $body
    Write-Host "SUCCESS: 인증 통과" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# 테스트 2: 잘못된 비밀번호
Write-Host "`n[TEST 2] notify - 잘못된 비밀번호" -ForegroundColor Yellow
$wrongHeaders = @{
    "Content-Type" = "application/json"
    "x-admin-password" = "wrongpass"
}

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/vault/notify" -Method POST -Headers $wrongHeaders -Body $body
    Write-Host "FAILED: 잘못된 비밀번호로 성공" -ForegroundColor Red
} catch {
    Write-Host "SUCCESS: 401 반환됨" -ForegroundColor Green
}

# 테스트 3: 헤더 없음
Write-Host "`n[TEST 3] notify - 헤더 없음" -ForegroundColor Yellow
$noAuthHeaders = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/vault/notify" -Method POST -Headers $noAuthHeaders -Body $body
    Write-Host "FAILED: 헤더 없이 성공" -ForegroundColor Red
} catch {
    Write-Host "SUCCESS: 401 반환됨" -ForegroundColor Green
}

# 테스트 4: 공개 API
Write-Host "`n[TEST 4] status - 공개 API" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/vault/status?user_id=1" -Method GET
    Write-Host "SUCCESS: 공개 API 정상" -ForegroundColor Green
} catch {
    Write-Host "FAILED: 공개 API 실패" -ForegroundColor Red
}

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "테스트 완료" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
