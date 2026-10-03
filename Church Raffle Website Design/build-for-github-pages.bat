@echo off
cd /d "%~dp0"

echo Installing dependencies...
call npm install

echo Building the production site...
call npm run build

echo.
echo SUCCESS: The production website files were created in the dist folder.
echo.
echo Next steps on GitHub:
echo 1. Push this project to GitHub.
echo 2. Go to Repository -> Settings -> Pages.
echo 3. Set Source to "Deploy from a branch".
echo 4. Choose the branch with the dist files.
echo 5. Use the /root folder if uploading dist contents directly.
echo.
echo Your live site will be:
echo https://hotfog12356.github.io/CHURCH-RAFFLE/
echo.
pause
