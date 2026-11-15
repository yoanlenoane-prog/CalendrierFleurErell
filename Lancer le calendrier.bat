@echo off
title Calendrier des commandes - Arrose
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js n'est pas encore installe sur cet ordinateur.
  echo   La page de telechargement va s'ouvrir : installez la version "LTS",
  echo   puis double-cliquez a nouveau sur "Lancer le calendrier".
  echo.
  start "" "https://nodejs.org/fr/download"
  pause
  exit /b 1
)
node serveur.js
echo.
echo   Le calendrier s'est arrete.
pause
