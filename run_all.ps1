$ErrorActionPreference = "Stop"

$services = @(
    @{ Name = "customer_service"; Port = 8001 },
    @{ Name = "catalog_service"; Port = 8002 },
    @{ Name = "service_status_service"; Port = 8003 },
    @{ Name = "provisioning_service"; Port = 8004 },
    @{ Name = "billing_service"; Port = 8005 },
    @{ Name = "payment_service"; Port = 8006 },
    @{ Name = "notification_service"; Port = 8007 },
    @{ Name = "onboarding_service"; Port = 8008 },
    @{ Name = "audit_service"; Port = 8009 }
)

foreach ($service in $services) {
    $module = "services.$($service.Name).main:app"
    Start-Process `
        -FilePath "python" `
        -ArgumentList "-m uvicorn $module --reload --port $($service.Port)" `
        -WorkingDirectory $PSScriptRoot `
        -WindowStyle Hidden
    Write-Host "Started $($service.Name) on http://localhost:$($service.Port)"
}
