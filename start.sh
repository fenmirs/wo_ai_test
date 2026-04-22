#!/bin/bash

# API Test UI 启动脚本

echo "=========================================="
echo "  API Test UI - 启动脚本"
echo "=========================================="
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到 Node.js"
    echo "请先安装 Node.js 16 或更高版本"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js 版本: $(node --version)"
echo "✓ npm 版本: $(npm --version)"
echo ""

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✓ 依赖安装完成"
    echo ""
fi

# 启动应用
echo "正在启动 API Test UI..."
echo ""
echo "提示: 关闭此窗口将停止应用"
echo "=========================================="
echo ""

npm run dev