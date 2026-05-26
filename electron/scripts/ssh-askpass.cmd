@echo off
powershell.exe -NoProfile -NonInteractive -Command "[Console]::Out.Write($env:NIOZY_SSH_PASS)"
