$WshShell = New-Object -ComObject WScript.Shell
$appDir = "$env:LOCALAPPDATA\pc_cleaner\app-1.0.5"
$exePath = "$appDir\PC Cleaner.exe"

$shortcuts = @(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\PC Cleaner.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Muhammad Raihan\PC Cleaner.lnk",
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "PC Cleaner.lnk")
)

foreach ($scPath in $shortcuts) {
    $dir = [System.IO.Path]::GetDirectoryName($scPath)
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
    $sc = $WshShell.CreateShortcut($scPath)
    $sc.TargetPath = $exePath
    $sc.WorkingDirectory = $appDir
    $sc.IconLocation = "$exePath,0"
    $sc.Description = "PC Cleaner"
    $sc.Save()
    Write-Output "Repaired: $scPath"
}

try {
    ie4uinit.exe -show
} catch {}
