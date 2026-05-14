@echo off
chcp 65001 >nul
title Garp Note - Atualizador

echo.
echo ╔══════════════════════════════════════════╗
echo ║        Garp Note  -  Atualizador         ║
echo ╚══════════════════════════════════════════╝
echo.

REM Pasta onde este .bat está rodando
set "BATDIR=%~dp0"
REM Remove barra final
if "%BATDIR:~-1%"=="\" set "BATDIR=%BATDIR:~0,-1%"

REM Destino final do projeto
set "DESTINO=C:\Users\tevoc\Documents\CadernoClaudeFix"

REM Procura o zip na pasta Downloads
set "ZIP=%USERPROFILE%\Downloads\noteflow-corrigido.zip"

echo Verificando arquivo de atualização...
if not exist "%ZIP%" (
    echo.
    echo  [ERRO] Arquivo não encontrado:
    echo         %ZIP%
    echo.
    echo  Baixe o arquivo "noteflow-corrigido.zip" para a
    echo  pasta Downloads e tente novamente.
    echo.
    pause
    exit /b 1
)

echo  Arquivo encontrado: %ZIP%
echo.

REM Cria destino se não existir
if not exist "%DESTINO%" (
    echo  Criando pasta de destino...
    mkdir "%DESTINO%"
)

echo  Extraindo arquivos...
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%TEMP%\garpnote_upd' -Force"

if errorlevel 1 (
    echo.
    echo  [ERRO] Falha ao extrair o zip.
    pause
    exit /b 1
)

echo  Copiando para o projeto...
robocopy "%TEMP%\garpnote_upd\noteflow-fixed" "%DESTINO%" /E /XD node_modules .git /NFL /NDL /NJH /NJS

REM Limpa temporário
rmdir /s /q "%TEMP%\garpnote_upd" 2>nul

REM Move este próprio .bat atualizado para o destino também
copy /Y "%TEMP%\garpnote_upd\ATUALIZAR.bat" "%DESTINO%\ATUALIZAR.bat" 2>nul

echo.
echo ╔══════════════════════════════════════════╗
echo ║        Atualização concluída!  ✓         ║
echo ╚══════════════════════════════════════════╝
echo.
echo  Projeto atualizado em:
echo  %DESTINO%
echo.
echo  Para rodar o app:
echo    cd %DESTINO%
echo    npm run dev
echo.

REM Pergunta se quer abrir a pasta
set /p ABRIR=" Deseja abrir a pasta do projeto? (s/n): "
if /i "%ABRIR%"=="s" explorer "%DESTINO%"

echo.
pause
