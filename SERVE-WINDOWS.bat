@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 goto usepython
start "" "http://127.0.0.1:8000"
py -3 -m http.server 8000 --bind 127.0.0.1
goto end
:usepython
where python >nul 2>&1
if errorlevel 1 goto direct
start "" "http://127.0.0.1:8000"
python -m http.server 8000 --bind 127.0.0.1
goto end
:direct
echo Python is not installed. Opening the game directly instead.
start "" "%~dp0index.html"
pause
:end
