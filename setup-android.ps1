# Sali VPN - one-time Android toolchain setup (JDK 17 + Android SDK) into C:\sali-android.
# Accepts the Google Android SDK license (approved by the project owner).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = 'C:\sali-android'
$jdk = "$root\jdk17"
$sdk = "$root\sdk"
New-Item -ItemType Directory -Force -Path $root, $sdk | Out-Null

if (-not (Test-Path "$jdk\bin\java.exe")) {
  Write-Host 'Downloading JDK 17 (Eclipse Temurin)...'
  $zip = "$root\jdk17.zip"
  Invoke-WebRequest 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile $zip
  Expand-Archive $zip -DestinationPath "$root\jdk-tmp" -Force
  $inner = Get-ChildItem "$root\jdk-tmp" -Directory | Select-Object -First 1
  if (Test-Path $jdk) { Remove-Item $jdk -Recurse -Force }
  Move-Item $inner.FullName $jdk
  Remove-Item "$root\jdk-tmp", $zip -Recurse -Force
}
$env:JAVA_HOME = $jdk
$env:PATH = "$jdk\bin;$env:PATH"

$sdkmanager = "$sdk\cmdline-tools\latest\bin\sdkmanager.bat"
if (-not (Test-Path $sdkmanager)) {
  Write-Host 'Downloading Android command-line tools...'
  $zip = "$root\cmdline-tools.zip"
  Invoke-WebRequest 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' -OutFile $zip
  Expand-Archive $zip -DestinationPath "$root\clt-tmp" -Force
  New-Item -ItemType Directory -Force -Path "$sdk\cmdline-tools" | Out-Null
  if (Test-Path "$sdk\cmdline-tools\latest") { Remove-Item "$sdk\cmdline-tools\latest" -Recurse -Force }
  Move-Item "$root\clt-tmp\cmdline-tools" "$sdk\cmdline-tools\latest"
  Remove-Item "$root\clt-tmp", $zip -Recurse -Force
}

Write-Host 'Accepting Android SDK licenses...'
$yes = ('y' + [Environment]::NewLine) * 50
$yes | & $sdkmanager --sdk_root=$sdk --licenses | Out-Null

Write-Host 'Installing SDK packages (platform 35, build-tools 35, NDK 28, CMake)...'
& $sdkmanager --sdk_root=$sdk 'platform-tools' 'platforms;android-35' 'build-tools;35.0.0' 'ndk;28.2.13676358' 'cmake;3.22.1'
if ($LASTEXITCODE -ne 0) { throw "sdkmanager failed with $LASTEXITCODE" }
Write-Host 'Android toolchain ready.'
