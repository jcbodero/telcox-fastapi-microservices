$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$logsDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

$python = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    $python = "python"
}

# Keep this map aligned with ui/lib/serviceApi.js for local development.
$services = @(
    @{ Name = "customer_service"; Port = 8001 },
    @{ Name = "onboarding_service"; Port = 8002 },
    @{ Name = "payment_service"; Port = 8003 },
    @{ Name = "provisioning_service"; Port = 8004 },
    @{ Name = "notification_service"; Port = 8005 },
    @{ Name = "billing_service"; Port = 8006 },
    @{ Name = "audit_service"; Port = 8007 },
    @{ Name = "service_status_service"; Port = 8008 },
    @{ Name = "catalog_service"; Port = 8009 }
)

function Get-ListeningPidsForPort {
    param([int]$Port)

    $lines = netstat -ano | Select-String ":$Port\s+.*LISTENING"
    foreach ($line in $lines) {
        $parts = ($line.ToString().Trim() -split "\s+")
        if ($parts.Count -ge 5) {
            [int]$parts[-1]
        }
    }
}

function Stop-LocalPythonListeners {
    param([array]$Ports)

    $pids = @()
    foreach ($port in $Ports) {
        $pids += Get-ListeningPidsForPort -Port $port
    }

    foreach ($processId in ($pids | Sort-Object -Unique)) {
        if ($processId -eq 0) {
            continue
        }

        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if (-not $process) {
            continue
        }

        if ($process.ProcessName -match "^(python|python3|uvicorn)$") {
            Write-Host "Stopping local $($process.ProcessName) process PID $processId"
            try {
                Stop-Process -Id $processId -Force -ErrorAction Stop
            } catch {
                Write-Host "Could not stop PID ${processId}: $($_.Exception.Message)"
            }
        } else {
            Write-Host "Skipping PID $processId ($($process.ProcessName)); it is not a local Python/Uvicorn service"
        }
    }
}

$ports = $services | ForEach-Object { $_.Port }
Stop-LocalPythonListeners -Ports $ports
Start-Sleep -Seconds 2

foreach ($service in $services) {
    $module = "services.$($service.Name).main:app"
    $port = $service.Port
    $env:PORT = $port
    $env:SERVICE_PORT = $port

    $stdout = Join-Path $logsDir "$($service.Name).out.log"
    $stderr = Join-Path $logsDir "$($service.Name).err.log"

    Start-Process `
        -FilePath $python `
        -ArgumentList "-m uvicorn $module --reload --host 127.0.0.1 --port $port" `
        -WorkingDirectory $root `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -WindowStyle Hidden

    Write-Host "Started $($service.Name) on http://localhost:$port"
}

Write-Host ""
Write-Host "Logs: $logsDir"
Write-Host "Re-run this script to restart local Python/Uvicorn services."
