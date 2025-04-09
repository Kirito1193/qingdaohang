#!/bin/bash

# 安装依赖
echo "安装依赖..."
npm install express body-parser

# 创建数据目录
mkdir -p data

# 启动服务器
echo "启动服务器..."
node server.js 