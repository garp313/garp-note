@echo off
chcp 65001 >nul
title Garp Note - Criar Atalho

set "PROJETO=%~dp0"
if "%PROJETO:~-1%"=="\" set "PROJETO=%PROJETO:~0,-1%"

set "ATALHO=%USERPROFILE%\Desktop\Garp Note.lnk"
set "VBS=%PROJETO%\iniciar.vbs"
set "ICONE=%PROJETO%\garpnote.ico"
set "PS=%TEMP%\atalho_garp.ps1"

echo.
echo ==========================================
echo   Garp Note  -  Criar Atalho
echo ==========================================
echo.

REM Cria o .vbs: libera porta 3000, inicia servidor, abre navegador
echo Set ws = CreateObject("WScript.Shell") > "%VBS%"
echo ws.CurrentDirectory = "%PROJETO%" >> "%VBS%"
echo ws.Run "cmd /c for /f ""tokens=5"" %%a in ('netstat -ano ^| findstr :3000') do taskkill /PID %%a /F >nul 2>&1", 0, True >> "%VBS%"
echo ws.Run "cmd /c cd /d ""%PROJETO%"" && npm run dev", 0, False >> "%VBS%"
echo WScript.Sleep 8000 >> "%VBS%"
echo ws.Run "cmd /c start http://localhost:3000", 0, False >> "%VBS%"

REM Cria o atalho
echo $ws = New-Object -ComObject WScript.Shell > "%PS%"
echo $s = $ws.CreateShortcut("%ATALHO%") >> "%PS%"
echo $s.TargetPath = "wscript.exe" >> "%PS%"
echo $s.Arguments = """%VBS%""" >> "%PS%"
echo $s.WorkingDirectory = "%PROJETO%" >> "%PS%"
echo $s.IconLocation = "%ICONE%,0" >> "%PS%"
echo $s.Description = "Abrir Garp Note" >> "%PS%"
echo $s.Save() >> "%PS%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS%"
del /q "%PS%" 2>nul

if exist "%ATALHO%" (
    echo.
    echo  Atalho criado com sucesso!
    echo  Duplo clique para abrir o Garp Note.
    echo.
) else (
    echo.
    echo  [ERRO] Clique com botao direito e escolha
    echo  "Executar como Administrador".
    echo.
)
pause
