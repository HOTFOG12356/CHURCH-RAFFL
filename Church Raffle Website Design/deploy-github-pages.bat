@echo off
cd /d "%~dp0"

echo Installing dependencies...
call npm install

echo Building production site...
call npm run build

echo.
echo Build finished. The website files are in the dist folder.
echo Upload the contents of the dist folder to your GitHub Pages repo.
echo.
echo Example repo name: CHURCH-RAFFLE

echo Your GitHub Pages URL will look like:
echo https://hotfog12356.github.io/CHURCH-RAFFLE/
echo.
pause
