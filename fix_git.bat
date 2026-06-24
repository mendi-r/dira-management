@echo off
cd /d "%~dp0"
del /f ".git\HEAD.lock" 2>nul
del /f ".git\index.lock" 2>nul
del /f ".git\refs\remotes\origin\main.lock" 2>nul
git add src\pages\Dirot.jsx
git commit -m "feat: status_vaad + luch_shanah + hearot_chozeh in Dirot"
git push origin main
pause
