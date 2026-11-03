@echo off
rem Sali VPN - fix the broken Sali-VPN-Mobile submodule and push everything to GitHub.
setlocal
cd /d "%~dp0"
if not exist .github\workflows mkdir .github\workflows
copy /Y ci\android-apk.yml .github\workflows\android-apk.yml >nul
git rm -r --cached Sali-VPN-Mobile >nul 2>&1
findstr /x /c:"Sali-VPN-Mobile/" .gitignore >nul || echo Sali-VPN-Mobile/>> .gitignore
findstr /x /c:"build-apk.log" .gitignore >nul || echo build-apk.log>> .gitignore
git add -A
git commit -m "Fix Cloudflare build (remove Sali-VPN-Mobile gitlink), add GitHub APK build"
git pull --rebase origin main
git push origin main
echo.
echo Done. APK build: https://github.com/MaxDev595/Sali-VPN/actions
pause
