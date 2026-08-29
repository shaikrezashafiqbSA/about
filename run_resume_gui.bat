@echo off
REM Double-click launcher for the resume builder.
REM Uses the repo's .venv if present, otherwise whatever python is on PATH.
cd /d "%~dp0"
if exist ".venv\Scripts\pythonw.exe" (
    start "" ".venv\Scripts\pythonw.exe" "recall_elicitation\resume_gui.py"
) else (
    start "" pythonw "recall_elicitation\resume_gui.py"
)
