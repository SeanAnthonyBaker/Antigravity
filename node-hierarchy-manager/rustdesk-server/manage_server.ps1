# Native Windows RustDesk Server (hbbs & hbbr) Manager
param (
    [ValidateSet("start", "stop", "status", "key", "setup-startup", "remove-startup")]
    [string]$Action = "status",
    [string]$HostIP = "192.168.1.128"
)

$ServerDir = $PSScriptRoot
if (-not $ServerDir) {
    $ServerDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$HbbsExe = Join-Path $ServerDir "hbbs.exe"
$HbbrExe = Join-Path $ServerDir "hbbr.exe"
$KeyFile = Join-Path $ServerDir "id_ed25519.pub"

switch ($Action) {
    "start" {
        Write-Host ">>> Starting Native Windows RustDesk Server..." -ForegroundColor Cyan
        
        $hbbsProc = Get-Process -Name "hbbs" -ErrorAction SilentlyContinue
        $hbbrProc = Get-Process -Name "hbbr" -ErrorAction SilentlyContinue

        if ($hbbsProc) {
            Write-Host "hbbs is already running (PID: $($hbbsProc.Id))" -ForegroundColor Yellow
        } else {
            $HbbsCmd = "`"$HbbsExe`" -r $HostIP`:21117 -k _"
            $res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine = $HbbsCmd; CurrentDirectory = $ServerDir}
            Write-Host "[OK] hbbs (ID/Rendezvous Server) started (PID: $($res.ProcessId))" -ForegroundColor Green
        }

        if ($hbbrProc) {
            Write-Host "hbbr is already running (PID: $($hbbrProc.Id))" -ForegroundColor Yellow
        } else {
            $HbbrCmd = "`"$HbbrExe`" -k _"
            $res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine = $HbbrCmd; CurrentDirectory = $ServerDir}
            Write-Host "[OK] hbbr (Relay Server) started (PID: $($res.ProcessId))" -ForegroundColor Green
        }

        Start-Sleep -Seconds 1
        & (Join-Path $ServerDir "manage_server.ps1") -Action status
        & (Join-Path $ServerDir "manage_server.ps1") -Action key
    }

    "stop" {
        Write-Host ">>> Stopping Native Windows RustDesk Server..." -ForegroundColor Yellow
        Stop-Process -Name "hbbs" -Force -ErrorAction SilentlyContinue
        Stop-Process -Name "hbbr" -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Stopped hbbs and hbbr processes." -ForegroundColor Green
    }

    "status" {
        Write-Host "`n========================================================" -ForegroundColor Cyan
        Write-Host "  RUSTDESK NATIVE WINDOWS SERVER STATUS" -ForegroundColor Cyan
        Write-Host "========================================================" -ForegroundColor Cyan
        
        $hbbsProc = Get-Process -Name "hbbs" -ErrorAction SilentlyContinue
        $hbbrProc = Get-Process -Name "hbbr" -ErrorAction SilentlyContinue

        if ($hbbsProc) {
            Write-Host "  hbbs (ID Server):    [ RUNNING ] (PID: $($hbbsProc.Id))" -ForegroundColor Green
        } else {
            Write-Host "  hbbs (ID Server):    [ STOPPED ]" -ForegroundColor Red
        }

        if ($hbbrProc) {
            Write-Host "  hbbr (Relay Server): [ RUNNING ] (PID: $($hbbrProc.Id))" -ForegroundColor Green
        } else {
            Write-Host "  hbbr (Relay Server): [ STOPPED ]" -ForegroundColor Red
        }

        Write-Host "`n  Active Listening Ports:" -ForegroundColor Gray
        Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 21115, 21116, 21117, 21118, 21119 } | ForEach-Object {
            Write-Host "  - Port $($_.LocalPort) (TCP) on $($_.LocalAddress)" -ForegroundColor White
        }
        Write-Host "========================================================`n" -ForegroundColor Cyan
    }

    "key" {
        if (Test-Path $KeyFile) {
            $Key = (Get-Content $KeyFile -Raw).Trim()
            Write-Host "========================================================" -ForegroundColor Yellow
            Write-Host "  RUSTDESK CLIENT CONFIGURATION INFO" -ForegroundColor Yellow
            Write-Host "========================================================" -ForegroundColor Yellow
            Write-Host "  ID / Rendezvous Server: $HostIP`:21116" -ForegroundColor White
            Write-Host "  Relay Server:           $HostIP`:21117" -ForegroundColor White
            Write-Host "  API Server:             (leave blank)" -ForegroundColor Gray
            Write-Host "  Public Key:             $Key" -ForegroundColor Green
            Write-Host "========================================================`n" -ForegroundColor Yellow
        } else {
            Write-Host "Key file ($KeyFile) not found. Run 'start' first." -ForegroundColor Red
        }
    }

    "setup-startup" {
        $WshShell = New-Object -ComObject WScript.Shell
        $StartupDir = [Environment]::GetFolderPath("Startup")
        $ShortcutPath = Join-Path $StartupDir "RustDeskServer.lnk"
        $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
        $Shortcut.TargetPath = "powershell.exe"
        $Shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ServerDir\manage_server.ps1`" -Action start"
        $Shortcut.WorkingDirectory = $ServerDir
        $Shortcut.Description = "Auto-start RustDesk Native Server"
        $Shortcut.Save()
        Write-Host "[OK] Windows Auto-Startup Shortcut created at: $ShortcutPath" -ForegroundColor Green
    }

    "remove-startup" {
        $StartupDir = [Environment]::GetFolderPath("Startup")
        $ShortcutPath = Join-Path $StartupDir "RustDeskServer.lnk"
        if (Test-Path $ShortcutPath) {
            Remove-Item $ShortcutPath -Force
            Write-Host "[OK] Removed Windows Auto-Startup Shortcut." -ForegroundColor Green
        }
    }
}
