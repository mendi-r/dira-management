@echo off
cd /d "%~dp0"
del /f ".git\HEAD.lock" 2>nul
del /f ".git\index.lock" 2>nul
del /f ".git\refs\remotes\origin\main.lock" 2>nul
git add -A
git commit -m "feat: realtime sync all pages + RLS isolation fix + useRealtime hook"
git push origin main
pause
