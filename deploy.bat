@echo off
echo Instalando Firebase CLI...
npm install -g firebase-tools
echo.
echo Fazendo login no Firebase (isso pode abrir uma janela do navegador)...
firebase login
echo.
echo Fazendo deploy do projeto...
firebase deploy
echo.
echo Deploy concluido! Verifique o site em https://cinefy-bf0f6.web.app
pause