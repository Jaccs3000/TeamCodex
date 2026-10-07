@echo off
setlocal
cd /d "%~dp0"
set "BACKEND=http://127.0.0.1:1455/"
set "FRONTEND=http://127.0.0.1:5173/"

rem Inicia el backend sólo si aún no responde.
curl.exe --silent --fail "%BACKEND%" >nul 2>&1
if errorlevel 1 start "AI Dev Studio Backend" /min cmd.exe /c "node server.mjs"

rem Inicia Vite sólo si aún no responde.
curl.exe --silent --fail "%FRONTEND%" >nul 2>&1
if errorlevel 1 start "AI Dev Studio Frontend" /min cmd.exe /c "node_modules\.bin\vite.cmd --host 127.0.0.1 --port 5173 --strictPort"

rem Espera hasta 40 segundos a que ambos servicios queden listos.
set "BACKEND_OK="
set "FRONTEND_OK="
for /L %%i in (1,1,40) do (
    if not defined BACKEND_OK (
        curl.exe --silent --fail "%BACKEND%" >nul 2>&1 && set "BACKEND_OK=1"
    )
    if not defined FRONTEND_OK (
        curl.exe --silent --fail "%FRONTEND%" >nul 2>&1 && set "FRONTEND_OK=1"
    )
    if defined BACKEND_OK if defined FRONTEND_OK goto :openChrome
    timeout /t 1 /nobreak >nul
)

echo No se pudo iniciar backend o frontend. Verifica Node.js, las dependencias y los puertos 1455 y 5173.
pause
exit /b 1

:openChrome
set "URL=%FRONTEND%"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --new-tab "%URL%"
    exit /b 0
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --new-tab "%URL%"
    exit /b 0
)
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --new-tab "%URL%"
    exit /b 0
)
where chrome.exe >nul 2>&1
if not errorlevel 1 (
    start "" chrome.exe --new-tab "%URL%"
    exit /b 0
)
echo No encontré Google Chrome. Abre esta dirección manualmente: %URL%
pause
exit /b 1
