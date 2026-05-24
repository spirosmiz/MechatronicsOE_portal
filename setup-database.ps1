$pgBin  = 'C:\Program Files\PostgreSQL\18\bin'
$pgData = 'C:\Program Files\PostgreSQL\18\data'
$hba    = "$pgData\pg_hba.conf"
$svc    = 'postgresql-x64-18'
$newPwd = 'Mechatroniqs2024!'

Write-Host '=== Step 1: Patch pg_hba.conf to trust ===' -ForegroundColor Cyan
Copy-Item $hba "$hba.bak" -Force
(Get-Content $hba) -replace 'scram-sha-256','trust' | Set-Content $hba -Encoding utf8

Write-Host '=== Step 2: Restart PostgreSQL ===' -ForegroundColor Cyan
Restart-Service -Name $svc -Force
Start-Sleep -Seconds 3

Write-Host '=== Step 3: Set password + create DB ===' -ForegroundColor Cyan
$env:PGPASSWORD = ''
$psql = "$pgBin\psql.exe"
& $psql -U postgres -c "ALTER USER postgres WITH PASSWORD '$newPwd';"
& $psql -U postgres -c 'CREATE DATABASE mechatroniqs_portal;'

Write-Host '=== Step 4: Restore secure auth ===' -ForegroundColor Cyan
Copy-Item "$hba.bak" $hba -Force
Restart-Service -Name $svc -Force
Start-Sleep -Seconds 2

Write-Host '=== Done ===' -ForegroundColor Green
Write-Host "New postgres password : $newPwd"
Write-Host 'DATABASE_URL for .env:'
Write-Host "postgresql://postgres:$newPwd@localhost:5432/mechatroniqs_portal" -ForegroundColor Yellow
