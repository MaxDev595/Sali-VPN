@echo off
rem Sali VPN - build the Android app and start it on a connected phone (USB debugging) or emulator.
rem Usage: run from the project folder. Builds with build-apk.cmd, then installs and launches via adb.
setlocal
set ROOT=%~dp0..
call "%ROOT%\build-apk.cmd" || exit /b 1
set ADB=C:\sali-android\sdk\platform-tools\adb.exe
if not exist "%ADB%" set ADB=adb
"%ADB%" start-server >nul 2>&1
for /f "skip=1 tokens=1,2" %%a in ('"%ADB%" devices') do if "%%b"=="device" set DEVICE=%%a
if not defined DEVICE (
  echo.
  echo APK is ready: %ROOT%\apps\mobile\dist\sali-vpn-0.5.0.apk
  echo No phone or emulator found. Connect an Android phone with USB debugging and run this again,
  echo or copy the APK to the phone and open it.
  pause
  exit /b 0
)
echo Installing on %DEVICE% ...
"%ADB%" -s %DEVICE% install -r "%ROOT%\apps\mobile\dist\sali-vpn-0.5.0.apk" || (pause & exit /b 1)
"%ADB%" -s %DEVICE% shell monkey -p app.sali.vpn -c android.intent.category.LAUNCHER 1 >nul
echo Sali VPN is running on %DEVICE%.
pause
