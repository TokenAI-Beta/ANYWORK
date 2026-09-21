@echo off
rem DSH-ANYWORK 团队工作台 - 应用模式启动（独立窗口/无浏览器地址栏）
rem 用法：双击即可；若服务在别的机器，把下面的地址改成对应 IP。
setlocal
set URL=http://192.168.0.171:8080
set CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
start "" "%CHROME%" --app=%URL% --app-window-size=1500,950
