@echo off
chcp 65001 >nul
title Garp Note - Atualizador

echo.
echo ==========================================
echo   Garp Note  -  Atualizador
echo ==========================================
echo.

REM Pega o diretorio onde este .bat esta rodando
set "PROJETO=%~dp0"
if "%PROJETO:~-1%"=="\" set "PROJETO=%PROJETO:~0,-1%"

echo  Pasta do projeto: %PROJETO%
echo.
echo  Buscando atualizacoes no GitHub...
echo.

cd /d "%PROJETO%"
git pull origin main

if errorlevel 1 (
    echo.
    echo  [ERRO] Nao foi possivel atualizar.
    echo  Verifique sua conexao com a internet.
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Projeto atualizado com sucesso!
echo ==========================================
echo.

set /p RODAR=" Deseja iniciar o Garp Note agora? (s/n): "
if /i "%RODAR%"=="s" (
    start "" wscript.exe "%PROJETO%\iniciar.vbs"
    echo.
    echo  Abrindo Garp Note...
)

echo.
pause
