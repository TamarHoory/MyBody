@echo off
echo ========================================================
echo Starting MyBody Local Development Server...
echo ========================================================
echo.
echo Please ensure you add "127.0.0.1" to Firebase Authentication Authorized Domains!
echo.
start http://127.0.0.1:8080/
node server.js
pause
