@echo off
setlocal
rem Light Show - double-click to install (first run), start the dev server and open the browser.
set "ROOT=%~dp0"
set "PORT=5317"
set "URL=http://localhost:%PORT%"

where node >nul 2>&1 || (echo Node.js is not installed. Get it from https://nodejs.org/ & goto :fail)
where npm >nul 2>&1 || (echo npm is not on PATH. Reinstall Node.js from https://nodejs.org/ & goto :fail)

if not exist "%ROOT%node_modules" (
  echo Installing dependencies...
  pushd "%ROOT%"
  call npm install || (popd & echo npm install failed. & goto :fail)
  popd
)

call :port_in_use %PORT% && (echo Port %PORT% is already in use. Close whatever is using it and try again. & goto :fail)

echo Starting Light Show on %URL% ...
start "Light Show dev server" /D "%ROOT%" cmd /k npm run dev

set /a WAITED=0
:wait
call :port_in_use %PORT% && goto :ready
set /a WAITED+=1
if %WAITED% geq 30 (echo The dev server did not start within 30 s. Check the "Light Show dev server" window. & goto :fail)
ping -n 2 127.0.0.1 >nul
goto :wait

:ready
start "" "%URL%"
echo Light Show is running at %URL%. Close the dev server window to stop it.
exit /b 0

:port_in_use
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul
exit /b %errorlevel%

:fail
pause
exit /b 1
