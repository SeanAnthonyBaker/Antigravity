@echo off
:: Batch file to install RustDesk Client and Server as Windows Services with Admin Elevation
NET SESSION >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Requesting Administrator Privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   INSTALLING RUSTDESK CLIENT AND SERVER WINDOWS SERVICES
echo ========================================================

echo [1/2] Installing RustDesk Client as Windows Service...
"C:\Users\seanb\AppData\Local\rustdesk\rustdesk.exe" --silent-install
timeout /t 3 /nobreak >nul

echo [2/2] Launching RustDesk Server Windows Service Setup...
start "" "%~dp0rustdesk-server\RustDeskServer.Setup.exe"

echo ========================================================
echo   INSTALLATION INITIATED
echo ========================================================
pause
