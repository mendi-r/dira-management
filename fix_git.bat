@echo off
cd /d "%~dp0"
del /f ".git\HEAD.lock" 2>nul
del /f ".git\index.lock" 2>nul
del /f ".git\refs\remotes\origin\main.lock" 2>nul
git add -A
git commit -m "fix: RLS owner isolation + realtime sync" --allow-empty
git push origin main
pause
