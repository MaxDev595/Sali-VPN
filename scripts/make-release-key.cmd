@echo off
rem Sali VPN - create the Android release signing key. Run ONCE.
rem
rem The key is the proof that an APK really comes from Sali. It is stored only on this PC:
rem   %USERPROFILE%\.sali\sali-release.jks         - the key itself
rem   %USERPROFILE%\.sali\keystore.properties      - its password (build-apk.cmd reads it)
rem   %USERPROFILE%\.sali\github-secrets.txt       - values for GitHub Actions secrets
rem Back up the .sali folder (USB drive / password manager). If the key is lost, users will have
rem to reinstall the app; if it leaks, anyone can sign a fake "update".
rem Never put these files in the repository.
setlocal EnableDelayedExpansion
set DIR=%USERPROFILE%\.sali
set JKS=%DIR%\sali-release.jks
set KEYTOOL=keytool
if exist C:\sali-android\jdk17\bin\keytool.exe set KEYTOOL=C:\sali-android\jdk17\bin\keytool.exe

if exist "%JKS%" (
  echo The release key already exists: %JKS%
  echo It must never be replaced. Nothing was changed.
  goto :fingerprint
)
if "%KEYTOOL%"=="keytool" (
  where keytool >nul 2>nul || (
    echo keytool not found. Run build-apk.cmd once ^(it installs JDK 17^) or install a JDK, then run this again.
    pause & exit /b 1
  )
)
if not exist "%DIR%" mkdir "%DIR%"

for /f "delims=" %%p in ('powershell -NoProfile -Command "$b=New-Object byte[] 30; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b) -replace '[+/=]',''"') do set PASS=%%p

"%KEYTOOL%" -genkeypair -v -storetype PKCS12 -keystore "%JKS%" -alias sali -keyalg RSA -keysize 4096 -validity 10000 ^
  -storepass "!PASS!" -keypass "!PASS!" -dname "CN=Sali VPN, O=Sali VPN" || (echo Key creation failed & pause & exit /b 1)

> "%DIR%\keystore.properties" (
  echo storeFile=%JKS:\=/%
  echo storePassword=!PASS!
  echo keyAlias=sali
  echo keyPassword=!PASS!
)
powershell -NoProfile -Command "$b=[Convert]::ToBase64String([IO.File]::ReadAllBytes('%JKS%')); Set-Content -Encoding ascii '%DIR%\github-secrets.txt' ('SALI_KEYSTORE_BASE64=' + $b), 'SALI_KEYSTORE_PASSWORD=!PASS!', 'SALI_KEY_ALIAS=sali'"
icacls "%DIR%" /inheritance:r /grant:r "%USERNAME%:(OI)(CI)F" >nul

echo.
echo Done. Release key: %JKS%
echo.
echo GitHub: Settings - Secrets and variables - Actions - New repository secret.
echo Add the three values from %DIR%\github-secrets.txt, then DELETE that file.

:fingerprint
echo.
echo Certificate SHA-256 fingerprint ^(publish it on salivpn.com so users can verify the APK^):
for /f "tokens=1,* delims==" %%a in ('findstr /B storePassword "%DIR%\keystore.properties"') do (
  "%KEYTOOL%" -list -v -keystore "%JKS%" -alias sali -storepass "%%b" | findstr /C:"SHA256:"
)
pause
