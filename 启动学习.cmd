@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo 需要 Python 3。也可以直接打开“四级轻学-直接打开.html”。
  pause
  exit /b 1
)
python start.py --lan
pause
