<#
.SYNOPSIS
  Registers MailServer to auto-start on Windows login using Task Scheduler.
  Run this script once as Administrator — then start.bat will launch automatically
  every time you log in, including after a reboot.

.NOTES
  To remove the startup task later:
    Unregister-ScheduledTask -TaskName "MailServer-AutoStart" -Confirm:$false
#>
#Requires -RunAsAdministrator

$taskName    = "MailServer-AutoStart"
$description = "Auto-start the MailServer mail platform on Windows login"
$startBat    = Join-Path (Split-Path $PSScriptRoot -Parent) "start.bat"
$workDir     = Split-Path $startBat -Parent

if (-not (Test-Path $startBat)) {
    Write-Host "[ERROR] start.bat not found at: $startBat" -ForegroundColor Red
    exit 1
}

# Remove any existing registration
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Task runs start.bat minimised, 60s after login (gives Docker Desktop time to start)
$action  = New-ScheduledTaskAction `
    -Execute   "cmd.exe" `
    -Argument  "/c `"$startBat`"" `
    -WorkingDirectory $workDir

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Add 60-second delay so Docker Desktop finishes starting first
$trigger.Delay = "PT60S"

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit      (New-TimeSpan -Hours 0) `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable

$principal = New-ScheduledTaskPrincipal `
    -UserId   $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName   $taskName `
    -Action     $action `
    -Trigger    $trigger `
    -Settings   $settings `
    -Principal  $principal `
    -Description $description `
    -Force | Out-Null

Write-Host ""
Write-Host "  MailServer startup task registered successfully." -ForegroundColor Green
Write-Host ""
Write-Host "  start.bat will run automatically 60 seconds after each login." -ForegroundColor Cyan
Write-Host "  (The 60s delay gives Docker Desktop time to start first.)" -ForegroundColor Gray
Write-Host ""
Write-Host "  To view the task:  taskschd.msc  (look for '$taskName')" -ForegroundColor Gray
Write-Host "  To remove it:      Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false" -ForegroundColor Gray
Write-Host ""
