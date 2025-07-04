@echo off
echo ========================================
echo    JP-Cobrancas - Instalacao
echo ========================================
echo.

echo [1/4] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale o Node.js de: https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js encontrado!

echo.
echo [2/4] Instalando dependencias do backend...
cd backend
npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias!
    pause
    exit /b 1
)
echo Dependencias instaladas com sucesso!

echo.
echo [3/4] Configurando banco de dados...
echo IMPORTANTE: Certifique-se de que o MariaDB/MySQL esteja rodando
echo e execute o script database_config.sql manualmente:
echo mysql -u root -p < ../database_config.sql
echo.

echo [4/4] Iniciando o sistema...
echo.
echo Backend sera iniciado em: http://localhost:3001
echo Frontend: Abra frontend/index.html no navegador
echo.
echo Pressione qualquer tecla para iniciar o backend...
pause >nul

echo Iniciando backend...
npm start 