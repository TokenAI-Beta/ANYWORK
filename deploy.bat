@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   DSH-ANYWORK 一键部署（Windows + Docker Desktop）
echo ============================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [X] 没有检测到 Docker。
  echo     请先安装 Docker Desktop（装完后启动它，等托盘鲸鱼图标变绿）：
  echo     https://www.docker.com/products/docker-desktop/
  start https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [X] Docker Desktop 还没启动（或还在启动中）。
  echo     请打开 Docker Desktop，等状态显示 Running 后，重新双击本脚本。
  pause
  exit /b 1
)

if not exist .env (
  copy /y .env.example .env >nul
  echo [i] 已生成配置文件 .env，马上用记事本打开，请填好这两行后保存（Ctrl+S）：
  echo.
  echo       ANYWORK_HOST=192.168.0.81:8080    ^(按这台电脑实际的局域网 IP:8080 填^)
  echo       DEEPSEEK_API_KEY=sk-你的真key
  echo.
  echo     其他项默认即可；建议顺便设一个 ANYWORK_ADMIN_PASSWORD。
  echo.
  notepad .env
  echo.
  echo [i] 保存关掉记事本后，再双击一次本脚本，即开始正式部署。
  pause
  exit /b 0
)

findstr /c:"在这里填" .env >nul 2>nul
if not errorlevel 1 (
  echo [!] 提醒：.env 里的 DEEPSEEK_API_KEY 看起来还是示例文案，没有替换成你的真 key。
  echo     按任意键仍继续；建议先编辑 .env 填好后再来。
  pause
)

echo [i] 开始构建并启动（首次约 15~30 分钟，请保持网络畅通；风扇变响、进度慢都属正常）...
echo.
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo [X] 部署失败 —— 请把上面的报错内容截图发给管理员。
  pause
  exit /b 1
)

echo.
echo [OK] 部署完成！
echo      本机访问：     http://localhost:8080
echo      局域网访问：   http://192.168.0.81:8080
echo      管理员账号：   见 .env（默认用户名 boss）
echo.
start http://localhost:8080
pause
