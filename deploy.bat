@echo off
echo ========================================================
echo Installing Firebase CLI... (This may take a minute)
echo ========================================================
call npm install -g firebase-tools
echo.
echo ========================================================
echo Step 1 of 2: Logging in to Google
echo ========================================================
echo A browser window will open now. Please log in with your Google account.
echo Once it says "Success", you can close the browser and return to this window.
call firebase login
echo.
echo ========================================================
echo Step 2 of 2: Deploying to the web!
echo ========================================================
call firebase deploy --only hosting
echo.
echo ========================================================
echo Deployment Complete!
echo Your permanent link is listed above as "Hosting URL".
echo ========================================================
pause
