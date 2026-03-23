<#
.SYNOPSIS
  Keeps the PC awake - prevents Windows sleep and hibernate.
  Runs silently in the background. Launched automatically by start.bat.
#>

# Load Win32 API to set thread execution state
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class PowerMgmt {
    // ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
}
"@

# Disable sleep / hibernate via power settings (persistent until reboot)
try {
    powercfg /change standby-timeout-ac 0    2>$null
    powercfg /change hibernate-timeout-ac 0  2>$null
    powercfg /change standby-timeout-dc 0    2>$null
} catch {}

$KEEP_AWAKE = [uint32]0x80000007   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED

# Refresh every 55 seconds (Windows timeout granularity is ~1 min)
while ($true) {
    [PowerMgmt]::SetThreadExecutionState($KEEP_AWAKE) | Out-Null
    Start-Sleep -Seconds 55
}
