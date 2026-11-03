@echo off
rem Sali VPN - build the Android APK (release, arm64).
rem Gradle/CMake fail on Cyrillic paths, so the project is mirrored to C:\sali-build first.
setlocal
set SRC=%~dp0
set DST=C:\sali-build
if exist C:\sali-jdk17 set JAVA_HOME=C:\sali-jdk17
if exist C:\sali-android-sdk set ANDROID_HOME=C:\sali-android-sdk
if defined JAVA_HOME set PATH=%JAVA_HOME%\bin;%PATH%

echo [1/4] Copying project to %DST% ...
robocopy "%SRC%." "%DST%" /MIR /XD node_modules .git build .gradle .expo .wrangler /XF *.apk /NFL /NDL /NJH /NJS /NP
if errorlevel 8 goto :fail

echo [2/4] Installing dependencies ...
cd /d "%DST%"
call npm install || goto :fail
call npm run build --workspace=packages/types || goto :fail

echo [3/4] Building release APK ...
cd /d "%DST%\apps\mobile\android"
call gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a || goto :fail

echo [4/4] Copying APK ...
if not exist "%SRC%apps\mobile\dist" mkdir "%SRC%apps\mobile\dist"
copy /Y "%DST%\apps\mobile\android\app\build\outputs\apk\release\app-release.apk" "%SRC%apps\mobile\dist\sali-vpn-0.3.0.apk" >nul || goto :fail
echo.
echo Done: %SRC%apps\mobile\dist\sali-vpn-0.3.0.apk
pause
exit /b 0

:fail
echo.
echo Build failed - see the error above.
pause
exit /b 1
