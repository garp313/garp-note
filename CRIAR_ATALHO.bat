@echo off
chcp 65001 >nul
title Garp Note - Criar Atalho

REM Pega o diretorio onde este .bat esta rodando (o proprio projeto)
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
echo  Pasta do projeto detectada:
echo  %PROJETO%
echo.

REM Cria o .vbs que inicia tudo sem abrir janela de terminal
echo Set ws = CreateObject("WScript.Shell") > "%VBS%"
echo ws.CurrentDirectory = "%PROJETO%" >> "%VBS%"
echo ws.Run "cmd /c cd /d ""%PROJETO%"" && timeout /t 3 /nobreak >nul && start http://localhost:3000", 0, False >> "%VBS%"
echo ws.Run "cmd /c cd /d ""%PROJETO%"" && npm run dev", 0, False >> "%VBS%"

REM Cria o atalho via PowerShell
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
    echo  ==========================================
    echo   Atalho criado com sucesso!
    echo  ==========================================
    echo.
    echo   Icone "Garp Note" na area de trabalho.
    echo   Duplo clique para abrir o app!
    echo.
) else (
    echo.
    echo   [ERRO] Clique com botao direito e escolha
    echo   "Executar como Administrador".
    echo.
)
pause
