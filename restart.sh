#!/bin/bash

echo "停止正在运行的服务器进程（如果有）..."
pkill -f "node server.js" || true

echo "安装依赖..."
npm install express body-parser

echo "确保数据目录存在..."
mkdir -p data

echo "启动服务器..."
node server.js 