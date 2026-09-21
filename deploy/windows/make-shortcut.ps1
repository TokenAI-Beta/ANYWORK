# 创建「DSH 团队工作台（应用模式）」桌面快捷方式：独立窗口、专属图标
$ErrorActionPreference = "Stop"
$ws = New-Object -ComObject WScript.Shell
$lnkPath = Join-Path $env:USERPROFILE "Desktop\DSH 团队工作台（应用）.lnk"
$lnk = $ws.CreateShortcut($lnkPath)
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" }
$lnk.TargetPath = $chrome
$lnk.Arguments = "--app=http://127.0.0.1:8080 --app-window-size=1500,950"
$lnk.IconLocation = (Join-Path $env:LOCALAPPDATA "desk-anywork\desk-app\icon.ico")
$lnk.WorkingDirectory = Split-Path $chrome
$lnk.Description = "DSH 团队工作台（独立窗口，等价网页端）"
$lnk.Save()
Write-Host "lnk created:" $lnkPath
