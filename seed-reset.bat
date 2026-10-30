@echo off
REM IntelliApprove - One-Step Clean Demo Data Reset (Windows)
echo Restoring clean IntelliApprove demo evaluation dataset...
if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe seed_reset.py
) else (
    python seed_reset.py
)
pause

