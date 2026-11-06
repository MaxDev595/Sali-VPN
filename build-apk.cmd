@echo off
rem Sali VPN - build the Android APK (release, arm64).
rem Gradle/CMake fail on Cyrillic paths, so the project is mirrored to C:\sali-build first.
rem Full output goes to build-apk.log next to this file.
setlocal
set SRC=%~dp0
set LOG=%~dp0build-apk.log
if "%~1"=="run" goto :run
title Sali VPN - APK build
echo Building Sali VPN APK... first run also installs JDK and Android SDK (20-40 minutes).
echo Log: %LOG%
call "%~f0" run > "%LOG%" 2>&1
if errorlevel 1 (echo. & echo BUILD FAILED - see build-apk.log) else (echo. & echo DONE: %SRC%apps\mobile\dist\sali-vpn-0.5.0.apk)
pause
exit /b

:run
set DST=C:\sali-build
if not exist C:\sali-android\sdk\platforms\android-35 (
  echo [0/4] Installing JDK 17 and Android SDK into C:\sali-android ...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SRC%setup-android.ps1" || exit /b 1
)
set JAVA_HOME=C:\sali-android\jdk17
set ANDROID_HOME=C:\sali-android\sdk
if defined ANDROID_HOME set ANDROID_SDK_ROOT=%ANDROID_HOME%
if defined JAVA_HOME set PATH=%JAVA_HOME%\bin;%PATH%
echo JAVA_HOME=%JAVA_HOME%
echo ANDROID_HOME=%ANDROID_HOME%

echo [1/4] Copying project to %DST% ...
robocopy "%SRC%." "%DST%" /MIR /XD node_modules .git build .gradle .cxx .expo .wrangler dist /XF *.apk *.zip build-apk.log /NFL /NDL /NJH /NJS /NP
if errorlevel 8 exit /b 1

echo [2/4] Installing dependencies ...
cd /d "%DST%"
call npm install --no-audit --no-fund || exit /b 1
call npm run build --workspace=packages/types || exit /b 1

echo [3/4] Building release APK ...
if exist "%ANDROID_HOME%" (echo sdk.dir=%ANDROID_HOME:\=/%> "%DST%\apps\mobile\android\local.properties")
cd /d "%DST%\apps\mobile"
set OUT=%TEMP%\sali-rnbundle
set SALI_PREBUILT_BUNDLE=%OUT%
if not exist "%OUT%\assets" mkdir "%OUT%\assets"
if not exist "%OUT%\res" mkdir "%OUT%\res"
for /f "delims=" %%i in ('node -p "require.resolve('expo/bin/cli')"') do set EXPO_CLI=%%i
for /f "delims=" %%i in ('node -p "require.resolve('expo-router/entry')"') do set ENTRY=%%i
for /f "delims=" %%i in ('node -p "require('path').dirname(require.resolve('react-native/package.json'))"') do set RN=%%i
set NODE_PATH=%DST%\apps\mobile\node_modules;%DST%\node_modules
echo Bundling JS ...
call node "%EXPO_CLI%" export:embed --platform android --dev false --reset-cache --entry-file "%ENTRY%" --bundle-output "%TEMP%\sali-index.android.js" --assets-dest "%OUT%\res" || exit /b 1
"%RN%\sdks\hermesc\win64-bin\hermesc.exe" -emit-binary -O -max-diagnostic-width=80 -out "%OUT%\assets\index.android.bundle" "%TEMP%\sali-index.android.js" || exit /b 1
cd /d "%DST%\apps\mobile\android"
call gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon -I "%DST%\scripts\use-prebuilt-mobile-bundle.gradle" || exit /b 1

echo [4/4] Copying APK ...
if not exist "%SRC%apps\mobile\dist" mkdir "%SRC%apps\mobile\dist"
copy /Y "%DST%\apps\mobile\android\app\build\outputs\apk\release\app-arm64-v8a-release.apk" "%SRC%apps\mobile\dist\sali-vpn-0.5.0.apk" || exit /b 1
echo BUILD OK
exit /b 0
