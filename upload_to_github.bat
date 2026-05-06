@echo off
chcp 65001 >nul
echo ========================================
echo   TraceMap - 上传到 GitHub
echo ========================================
echo.

cd /d D:\wangzhan\Camera\app

:: 1. 初始化 Git 仓库
echo [1/3] 初始化 Git 仓库...
git init
echo.

:: 2. 暂存所有文件
echo [2/3] 添加所有文件（这一步可能较慢，因为 node_modules 很大）...
git add -A
echo.

:: 3. 创建初始提交
echo [3/3] 创建初始提交...
git commit -m "Initial commit: 迹影地图 TraceMap v2 - 本地照片地图日记 App"
echo.

echo ========================================
echo   本地仓库已准备好！
echo.
echo   接下来请手动操作：
echo.
echo   1. 打开浏览器访问 https://github.com/new
echo   2. Repository name 填: TraceMap
echo   3. 选择 Public（公开）
echo   4. 不要勾选 "Add a README file"
echo   5. 点击 "Create repository"
echo   6. 复制弹出的两条命令，类似：
echo.
echo      git remote add origin https://github.com/你的用户名/TraceMap.git
echo      git branch -M main
echo      git push -u origin main
echo.
echo   然后在当前命令行窗口粘贴运行即可。
echo ========================================
pause
