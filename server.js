/**
 * @fileoverview 导航站后端服务器
 * @description 提供API接口用于获取、添加和删除导航链接
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件设置 - 增加请求体大小限制
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 确保壁纸目录存在
const wallpaperDir = path.join(__dirname, 'public', 'images', 'wallpapers');
if (!fs.existsSync(wallpaperDir)){
    fs.mkdirSync(wallpaperDir, { recursive: true });
}

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'data', 'links.json');
const AUTH_FILE = path.join(__dirname, 'data', 'auth.json');

// 确保数据目录存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// 初始化数据文件（如果不存在）
if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
        categories: [
            {
                id: "demo",
                name: "演示",
                links: [
                    { id: "1", title: "Demo", url: "https://example.com" },
                    { id: "2", title: "Demo2", url: "https://example2.com" }
                ]
            },
            {
                id: "work",
                name: "工作",
                links: [
                    { id: "3", title: "OA", url: "https://oa-example.com" }
                ]
            }
        ]
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
}

// 初始化认证文件（如果不存在）
if (!fs.existsSync(AUTH_FILE)) {
    // 默认管理员密码 "admin123"，使用SHA256哈希和随机盐值加密
    const defaultSalt = crypto.randomBytes(16).toString('hex');
    const defaultPasswordHash = crypto.createHash('sha256').update('admin123' + defaultSalt).digest('hex');
    
    const authData = {
        passwordHash: defaultPasswordHash,
        salt: defaultSalt
    };
    
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));
}

/**
 * @function getLinks
 * @description 从JSON文件读取链接数据
 * @returns {Object} 链接数据对象
 */
function getLinks() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('读取链接数据失败:', err);
        return { categories: [] };
    }
}

/**
 * @function saveLinks
 * @description 将链接数据保存到JSON文件
 * @param {Object} data - 要保存的链接数据
 * @returns {boolean} 是否保存成功
 */
function saveLinks(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error('保存链接数据失败:', err);
        return false;
    }
}

/**
 * @function getAuthData
 * @description 获取认证数据
 * @returns {Object} 认证数据对象
 */
function getAuthData() {
    try {
        const data = fs.readFileSync(AUTH_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('读取认证数据失败:', err);
        return null;
    }
}

/**
 * @function checkUrlAccessibility
 * @description 检查URL是否可访问
 * @param {string} url - 要检查的URL
 * @returns {Promise<boolean>} 返回链接是否可访问的Promise
 */
function checkUrlAccessibility(url) {
    return new Promise((resolve) => {
        try {
            const protocol = url.startsWith('https') ? https : http;
            const req = protocol.get(url, { timeout: 5000 }, (res) => {
                // 状态码在200-399范围内视为可访问
                const statusCode = res.statusCode;
                resolve(statusCode >= 200 && statusCode < 400);
                req.destroy(); // 结束请求
            });

            req.on('error', () => {
                resolve(false);
            });

            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        } catch (error) {
            resolve(false);
        }
    });
}

/**
 * @function verifyPassword
 * @description 验证密码是否正确
 * @param {string} password - 要验证的密码
 * @returns {boolean} 密码是否正确
 */
function verifyPassword(password) {
    const authData = getAuthData();
    if (!authData) return false;
    
    const { passwordHash, salt } = authData;
    const inputHash = crypto.createHash('sha256').update(password + salt).digest('hex');
    
    return inputHash === passwordHash;
}

/**
 * @function updatePassword
 * @description 更新管理员密码
 * @param {string} newPassword - 新密码
 * @returns {boolean} 是否更新成功
 */
function updatePassword(newPassword) {
    try {
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = crypto.createHash('sha256').update(newPassword + salt).digest('hex');
        
        const authData = {
            passwordHash,
            salt
        };
        
        fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));
        return true;
    } catch (err) {
        console.error('更新密码失败:', err);
        return false;
    }
}

// API路由

/**
 * 验证管理员密码
 */
app.post('/api/auth/verify', (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({ error: '密码不能为空' });
    }
    
    const isValid = verifyPassword(password);
    
    if (isValid) {
        // 生成一个临时令牌，有效期30分钟
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 30 * 60 * 1000; // 30分钟后过期
        
        // 在真实应用中，应该使用Redis或其他存储方式来存储令牌
        // 这里为了简单，我们使用内存存储
        app.locals.authToken = {
            token,
            expiresAt
        };
        
        res.json({ success: true, token, expiresAt });
    } else {
        res.status(401).json({ error: '密码错误' });
    }
});

/**
 * 修改管理员密码
 */
app.post('/api/auth/change-password', (req, res) => {
    const { currentPassword, newPassword, token } = req.body;
    
    // 验证令牌
    if (!validateToken(token)) {
        return res.status(401).json({ error: '未授权，请先验证身份' });
    }
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: '当前密码和新密码都不能为空' });
    }
    
    // 验证当前密码
    if (!verifyPassword(currentPassword)) {
        return res.status(401).json({ error: '当前密码错误' });
    }
    
    // 更新密码
    if (updatePassword(newPassword)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: '密码更新失败' });
    }
});

/**
 * 验证令牌是否有效
 * @param {string} token - 授权令牌
 * @returns {boolean} 令牌是否有效
 */
function validateToken(token) {
    const authToken = app.locals.authToken;
    
    if (!authToken || authToken.token !== token || Date.now() > authToken.expiresAt) {
        return false;
    }
    
    return true;
}

/**
 * 授权中间件
 */
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token || !validateToken(token)) {
        return res.status(401).json({ error: '未授权，请先验证身份' });
    }
    
    next();
}

/**
 * 获取所有链接数据
 */
app.get('/api/links', (req, res) => {
    const data = getLinks();
    res.json(data);
});

/**
 * 添加新链接 (需要授权)
 */
app.post('/api/links', authMiddleware, (req, res) => {
    const { categoryId, title, url } = req.body;
    
    if (!categoryId || !title || !url) {
        return res.status(400).json({ error: '分类ID、标题和URL都是必需的' });
    }
    
    const data = getLinks();
    const category = data.categories.find(cat => cat.id === categoryId);
    
    if (!category) {
        return res.status(404).json({ error: '找不到指定的分类' });
    }
    
    const newLink = {
        id: Date.now().toString(),
        title,
        url
    };
    
    category.links.push(newLink);
    saveLinks(data);
    
    res.status(201).json(newLink);
});

/**
 * 添加新分类 (需要授权)
 */
app.post('/api/categories', authMiddleware, (req, res) => {
    const { id, name } = req.body;
    
    if (!id || !name) {
        return res.status(400).json({ error: 'ID和名称都是必需的' });
    }
    
    const data = getLinks();
    
    // 检查分类ID是否已存在
    if (data.categories.some(cat => cat.id === id)) {
        return res.status(400).json({ error: '分类ID已存在' });
    }
    
    const newCategory = {
        id,
        name,
        links: []
    };
    
    data.categories.push(newCategory);
    saveLinks(data);
    
    res.status(201).json(newCategory);
});

/**
 * 删除链接 (需要授权)
 */
app.delete('/api/links/:categoryId/:linkId', authMiddleware, (req, res) => {
    const { categoryId, linkId } = req.params;
    
    const data = getLinks();
    const category = data.categories.find(cat => cat.id === categoryId);
    
    if (!category) {
        return res.status(404).json({ error: '找不到指定的分类' });
    }
    
    const linkIndex = category.links.findIndex(link => link.id === linkId);
    
    if (linkIndex === -1) {
        return res.status(404).json({ error: '找不到指定的链接' });
    }
    
    category.links.splice(linkIndex, 1);
    saveLinks(data);
    
    res.json({ success: true });
});

/**
 * 删除分类 (需要授权)
 */
app.delete('/api/categories/:categoryId', authMiddleware, (req, res) => {
    const { categoryId } = req.params;
    
    const data = getLinks();
    const categoryIndex = data.categories.findIndex(cat => cat.id === categoryId);
    
    if (categoryIndex === -1) {
        return res.status(404).json({ error: '找不到指定的分类' });
    }
    
    data.categories.splice(categoryIndex, 1);
    saveLinks(data);
    
    res.json({ success: true });
});

/**
 * @api {post} /api/check-links 检查多个链接是否可访问
 * @description 检查提供的链接列表是否都可以访问
 */
app.post('/api/check-links', async (req, res) => {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: "请提供有效的链接列表" });
    }
    
    try {
        // 并行检查所有URL
        const results = await Promise.all(
            urls.map(async (url) => {
                const isAccessible = await checkUrlAccessibility(url);
                return { url, isAccessible };
            })
        );
        
        res.json({ results });
    } catch (error) {
        console.error('检查链接可访问性失败:', error);
        res.status(500).json({ error: "检查链接失败" });
    }
});

/**
 * 上传壁纸图片
 */
app.post('/api/wallpapers', (req, res) => {
    const { imageData, fileName } = req.body;
    
    if (!imageData) {
        return res.status(400).json({ error: '未提供图片数据' });
    }
    
    try {
        let base64Data;
        let fileExtension;
        let uniqueFileName;
        
        // 处理图片数据
        if (imageData.startsWith('data:image/')) {
            // 处理Base64数据URI
            const matches = imageData.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
            if (!matches) {
                return res.status(400).json({ error: '无效的图片数据格式' });
            }
            
            fileExtension = matches[1];
            base64Data = matches[2];
            uniqueFileName = `wallpaper_${Date.now()}.${fileExtension}`;
            
            // 使用提供的文件名或生成唯一的文件名
            const savedFileName = fileName ? `wallpaper_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '')}` : uniqueFileName;
            const filePath = path.join(wallpaperDir, savedFileName);
            
            // 将Base64数据写入文件
            fs.writeFileSync(filePath, base64Data, 'base64');
            
            // 返回壁纸URL
            const wallpaperUrl = `/images/wallpapers/${savedFileName}`;
            res.json({ 
                success: true, 
                wallpaperUrl,
                isExternalUrl: false
            });
        } else if (imageData.startsWith('http')) {
            // 处理URL，返回URL不做保存
            return res.json({ 
                success: true, 
                wallpaperUrl: imageData,
                isExternalUrl: true
            });
        } else {
            return res.status(400).json({ error: '不支持的图片数据格式' });
        }
    } catch (error) {
        console.error('保存壁纸失败:', error);
        res.status(500).json({ error: '保存壁纸失败：' + error.message });
    }
});

/**
 * 获取所有壁纸
 */
app.get('/api/wallpapers', (req, res) => {
    try {
        // 检查壁纸目录是否存在
        if (!fs.existsSync(wallpaperDir)) {
            fs.mkdirSync(wallpaperDir, { recursive: true });
            return res.json({ wallpapers: [] });
        }
        
        // 读取目录中的文件
        const files = fs.readdirSync(wallpaperDir)
            .filter(file => {
                // 只返回图片文件
                const ext = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
            });
        
        // 转换为URL格式
        const wallpapers = files.map(file => `/images/wallpapers/${file}`);
        
        res.json({ wallpapers });
    } catch (error) {
        console.error('获取壁纸列表失败:', error);
        res.status(500).json({ error: '获取壁纸列表失败：' + error.message });
    }
});

/**
 * 删除壁纸
 */
app.delete('/api/wallpapers/:filename', (req, res) => {
    const { filename } = req.params;
    
    if (!filename) {
        return res.status(400).json({ error: '未指定文件名' });
    }
    
    try {
        // 确保文件名不包含路径分隔符，防止目录遍历攻击
        const safeFilename = path.basename(filename);
        if (safeFilename !== filename) {
            return res.status(400).json({ error: '无效的文件名' });
        }
        
        const filePath = path.join(wallpaperDir, safeFilename);
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            console.warn(`尝试删除不存在的文件: ${filePath}`);
            return res.json({ success: true, message: '文件不存在或已被删除' });
        }
        
        // 删除文件
        fs.unlinkSync(filePath);
        
        res.json({ success: true });
    } catch (error) {
        console.error('删除壁纸失败:', error);
        res.status(500).json({ error: '删除壁纸失败：' + error.message });
    }
});

/**
 * 修改已有链接 (需要授权)
 */
app.put('/api/links/:categoryId/:linkId', authMiddleware, (req, res) => {
    const { categoryId, linkId } = req.params;
    const { title, url } = req.body;
    
    if (!title || !url) {
        return res.status(400).json({ error: '标题和URL都是必需的' });
    }
    
    const data = getLinks();
    const category = data.categories.find(cat => cat.id === categoryId);
    
    if (!category) {
        return res.status(404).json({ error: '找不到指定的分类' });
    }
    
    const link = category.links.find(link => link.id === linkId);
    
    if (!link) {
        return res.status(404).json({ error: '找不到指定的链接' });
    }
    
    // 验证URL格式
    if (!url.match(/^https?:\/\/.+\..+/)) {
        return res.status(400).json({ error: '请输入有效的URL地址' });
    }
    
    // 更新链接信息
    link.title = title;
    link.url = url;
    
    saveLinks(data);
    
    res.json({ success: true, link });
});

/**
 * 移动链接到新分类 (需要授权)
 */
app.post('/api/links/move', authMiddleware, (req, res) => {
    const { linkId, oldCategoryId, newCategoryId, title, url } = req.body;
    
    if (!linkId || !oldCategoryId || !newCategoryId || !title || !url) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 验证URL格式
    if (!url.match(/^https?:\/\/.+\..+/)) {
        return res.status(400).json({ error: '请输入有效的URL地址' });
    }
    
    const data = getLinks();
    
    // 查找原分类
    const oldCategory = data.categories.find(cat => cat.id === oldCategoryId);
    if (!oldCategory) {
        return res.status(404).json({ error: '找不到原始分类' });
    }
    
    // 查找新分类
    const newCategory = data.categories.find(cat => cat.id === newCategoryId);
    if (!newCategory) {
        return res.status(404).json({ error: '找不到目标分类' });
    }
    
    // 查找要移动的链接
    const linkIndex = oldCategory.links.findIndex(link => link.id === linkId);
    if (linkIndex === -1) {
        return res.status(404).json({ error: '找不到指定的链接' });
    }
    
    // 从旧分类中删除链接
    const movedLink = { ...oldCategory.links[linkIndex] };
    oldCategory.links.splice(linkIndex, 1);
    
    // 更新链接信息
    movedLink.title = title;
    movedLink.url = url;
    
    // 将链接添加到新分类
    newCategory.links.push(movedLink);
    
    // 保存更改
    saveLinks(data);
    
    res.json({ success: true, link: movedLink });
});

/**
 * 更新分类 (需要授权)
 */
app.put('/api/categories/:categoryId', authMiddleware, (req, res) => {
    const { categoryId } = req.params;
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: '分类名称不能为空' });
    }
    
    const data = getLinks();
    const category = data.categories.find(cat => cat.id === categoryId);
    
    if (!category) {
        return res.status(404).json({ error: '找不到指定的分类' });
    }
    
    // 检查是否存在同名分类（排除当前分类）
    const existingSameNameCategory = data.categories.find(cat => 
        cat.id !== categoryId && cat.name === name);
    
    if (existingSameNameCategory) {
        return res.status(400).json({ error: '已存在同名分类' });
    }
    
    // 更新分类名称
    category.name = name;
    saveLinks(data);
    
    res.json({ success: true, category });
});

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
}); 