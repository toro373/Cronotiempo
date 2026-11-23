@echo off
setlocal
pushd "%~dp0"
if not defined PORT set PORT=8000
where.exe node >nul 2>nul
if not errorlevel 1 (
  echo Iniciando Cronotempo con Node.js...
  node "%~dp0server.js"
) else (
  where.exe powershell.exe >nul 2>nul
  if errorlevel 1 (
    echo No se encontro Node.js ni Windows PowerShell.
    echo En Windows, PowerShell normalmente ya esta incluido.
    echo Como alternativa, usa la extension Live Server de VS Code.
    pause
    exit /b 1
  )
  echo Node.js no esta instalado. Iniciando con Windows PowerShell...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %PORT%
)
if errorlevel 1 (
  echo.
  echo No se pudo iniciar el servidor. Comprueba si el puerto %PORT% ya esta en uso.
)
popd
pause
