/**
 * @fileoverview 导航站前端交互脚本
 * @description 提供链接管理、搜索和用户界面交互功能
 */

(function() {
    'use strict';

    // DOM元素
    const elements = {
        linksContainer: document.getElementById('linksContainer'),
        searchInput: document.getElementById('searchInput'),
        btnSearch: document.getElementById('btnSearch'),
        btnShowAddModal: document.getElementById('btnShowAddModal'),
        btnCheckSite: document.getElementById('btnCheckSite'),
        btnClear: document.getElementById('btnClear'),
        btnSettings: document.getElementById('btnSettings'),
        navTabs: document.querySelectorAll('.nav-tab'),
        addLinkModal: document.getElementById('addLinkModal'),
        editLinkModal: document.getElementById('editLinkModal'),
        addCategoryModal: document.getElementById('addCategoryModal'),
        editCategoryModal: document.getElementById('editCategoryModal'), // 添加编辑分类模态框引用
        manageCategoriesModal: document.getElementById('manageCategoriesModal'), // 添加管理分类模态框引用
        passwordModal: document.getElementById('passwordModal'),
        settingsModal: document.getElementById('settingsModal'),
        addLinkForm: document.getElementById('addLinkForm'),
        editLinkForm: document.getElementById('editLinkForm'),
        addCategoryForm: document.getElementById('addCategoryForm'),
        editCategoryForm: document.getElementById('editCategoryForm'), // 添加编辑分类表单引用
        passwordForm: document.getElementById('passwordForm'),
        changePasswordForm: document.getElementById('changePasswordForm'),
        categorySelect: document.getElementById('categorySelect'),
        categoryType: document.getElementById('categoryType'),
        existingCategoryGroup: document.getElementById('existingCategoryGroup'),
        newCategoryGroup: document.getElementById('newCategoryGroup'),
        newCategoryName: document.getElementById('newCategoryName'),
        closeButtons: document.querySelectorAll('.close'),
        settingsTabs: document.querySelectorAll('.settings-tab')
    };

    // 全局状态
    const state = {
        links: { categories: [] },
        currentTab: 'site',
        searchQuery: '',
        selectedCategory: null,
        pendingAction: null,
        isAuthenticated: false,
        authTimeout: null,
        authToken: null,
        tokenExpiresAt: null
    };

    /**
     * @function init
     * @description 初始化应用
     */
    function init() {
        setupEventListeners();
        fetchLinks();
        updateClock();
        setInterval(updateClock, 1000);
        
        // 检查localStorage中是否有保存的令牌
        const savedToken = localStorage.getItem('authToken');
        const savedTokenExpiry = localStorage.getItem('tokenExpiresAt');
        
        if (savedToken && savedTokenExpiry && Number(savedTokenExpiry) > Date.now()) {
            // 如果令牌有效，恢复登录状态
            state.isAuthenticated = true;
            state.authToken = savedToken;
            state.tokenExpiresAt = Number(savedTokenExpiry);
            
            // 设置新的过期计时器
            const timeUntilExpiry = state.tokenExpiresAt - Date.now();
            state.authTimeout = setTimeout(() => {
                state.isAuthenticated = false;
                state.authToken = null;
                localStorage.removeItem('authToken');
                localStorage.removeItem('tokenExpiresAt');
            }, timeUntilExpiry);
        }
    }

    /**
     * @function fetchLinks
     * @description 从API获取链接数据
     */
    function fetchLinks() {
        fetch('/api/links')
            .then(response => response.json())
            .then(data => {
                state.links = data;
                renderCategorySidebar(); // 渲染分类侧边栏
                renderLinks();
                updateCategorySelect();
            })
            .catch(error => {
                console.error('获取链接失败:', error);
                showNotification('获取链接失败，请刷新页面重试', 'error');
            });
    }

    /**
     * @function renderCategorySidebar
     * @description 渲染左侧分类导航栏
     */
    function renderCategorySidebar() {
        // 创建分类导航侧边栏
        const sidebar = document.createElement('div');
        sidebar.className = 'category-sidebar';
        
        // 添加分类标题
        sidebar.innerHTML = '<div class="category-title">快速导航</div>';
        
        // 创建分类导航列表
        const categoryNav = document.createElement('div');
        categoryNav.className = 'category-nav';
        
        // 添加"全部"选项
        const allItem = document.createElement('div');
        allItem.className = 'category-item' + (state.selectedCategory === null ? ' active' : '');
        allItem.innerHTML = '<a href="javascript:void(0)">全部</a>';
        allItem.addEventListener('click', () => {
            state.selectedCategory = null;
            updateActiveCategoryItem();
            renderLinks();
        });
        categoryNav.appendChild(allItem);
        
        // 添加所有分类
        state.links.categories.forEach(category => {
            if (category.links.length > 0) { // 只显示有链接的分类
                const categoryItem = document.createElement('div');
                categoryItem.className = 'category-item' + (state.selectedCategory === category.id ? ' active' : '');
                categoryItem.dataset.category = category.id;
                categoryItem.innerHTML = `<a href="javascript:void(0)">${category.name}</a>`;
                categoryItem.addEventListener('click', () => {
                    state.selectedCategory = category.id;
                    updateActiveCategoryItem();
                    renderLinks();
                });
                categoryNav.appendChild(categoryItem);
            }
        });
        
        sidebar.appendChild(categoryNav);
        
        // 创建或更新主内容区域
        let mainContent = document.querySelector('.main-content');
        if (!mainContent) {
            mainContent = document.createElement('div');
            mainContent.className = 'main-content';
            elements.linksContainer.parentNode.insertBefore(mainContent, elements.linksContainer);
            
            // 创建链接内容区域
            const linksContent = document.createElement('div');
            linksContent.className = 'links-content';
            linksContent.appendChild(elements.linksContainer);
            
            mainContent.innerHTML = '';
            mainContent.appendChild(sidebar);
            mainContent.appendChild(linksContent);
        } else {
            // 只更新侧边栏
            const existingSidebar = mainContent.querySelector('.category-sidebar');
            if (existingSidebar) {
                mainContent.replaceChild(sidebar, existingSidebar);
            } else {
                mainContent.insertBefore(sidebar, mainContent.firstChild);
            }
        }
    }
    
    /**
     * @function updateActiveCategoryItem
     * @description 更新当前活动的分类项
     */
    function updateActiveCategoryItem() {
        document.querySelectorAll('.category-item').forEach(item => {
            if ((state.selectedCategory === null && !item.dataset.category) || 
                (item.dataset.category === state.selectedCategory)) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * @function renderLinks
     * @description 渲染链接到页面
     */
    function renderLinks() {
        const { links, currentTab, searchQuery, selectedCategory } = state;
        const container = elements.linksContainer;
        container.innerHTML = '';

        // 如果没有分类，显示提示信息
        if (links.categories.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无链接，点击右下角按钮添加新链接</div>';
            return;
        }

        // 创建单一网格布局
        const linksGrid = document.createElement('div');
        linksGrid.className = 'links-grid';
        container.appendChild(linksGrid);

        // 筛选并准备所有链接
        let allLinks = [];
        
        links.categories.forEach(category => {
            // 如果选择了特定分类，只显示该分类的链接
            if (selectedCategory && category.id !== selectedCategory) {
                return;
            }
            
            // 过滤搜索结果
            const filteredLinks = category.links.filter(link => {
                if (searchQuery) {
                    return link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           link.url.toLowerCase().includes(searchQuery.toLowerCase());
                }
                return true;
            });
            
            // 添加分类信息到链接
            filteredLinks.forEach(link => {
                allLinks.push({
                    ...link,
                    categoryId: category.id,
                    categoryName: category.name
                });
            });
        });

        // 如果没有符合条件的链接，显示提示
        if (allLinks.length === 0) {
            if (selectedCategory) {
                container.innerHTML = '<div class="empty-state">该分类下暂无链接</div>';
            } else if (searchQuery) {
                container.innerHTML = '<div class="empty-state">没有找到匹配的链接</div>';
            } else {
                container.innerHTML = '<div class="empty-state">暂无链接，点击右下角按钮添加新链接</div>';
            }
            return;
        }

        // 渲染所有链接到网格中
        allLinks.forEach(link => {
            const linkCard = document.createElement('div');
            linkCard.className = 'link-card';
            linkCard.dataset.id = link.id;
            linkCard.dataset.category = link.categoryId;
            linkCard.innerHTML = `
                <button class="edit-link" title="编辑链接">
                    <i class="fas fa-edit"></i>
                </button>
                <a href="${link.url}" target="_blank">${link.title}</a>
                <button class="delete-link" data-category="${link.categoryId}" data-link="${link.id}" title="删除链接">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // 添加点击事件用于编辑链接
            linkCard.addEventListener('click', function(e) {
                // 如果点击的是删除按钮或链接本身，不触发编辑
                if (e.target.closest('.delete-link') || e.target.closest('a')) {
                    return;
                }
                
                handleEditLinkClick(link);
            });
            
            linksGrid.appendChild(linkCard);
        });

        // 添加删除链接的事件监听
        document.querySelectorAll('.delete-link').forEach(button => {
            button.addEventListener('click', handleDeleteLink);
        });
        
        // 添加编辑链接按钮的事件监听
        document.querySelectorAll('.edit-link').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡到卡片
                const linkCard = e.target.closest('.link-card');
                const linkId = linkCard.dataset.id;
                const categoryId = linkCard.dataset.category;
                
                // 找到对应的链接数据
                const category = state.links.categories.find(cat => cat.id === categoryId);
                if (category) {
                    const link = category.links.find(l => l.id === linkId);
                    if (link) {
                        handleEditLinkClick({
                            ...link,
                            categoryId,
                            categoryName: category.name
                        });
                    }
                }
            });
        });
    }

    /**
     * @function updateCategorySelect
     * @description 更新分类选择下拉框
     */
    function updateCategorySelect() {
        const select = elements.categorySelect;
        select.innerHTML = '';

        state.links.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            select.appendChild(option);
        });
    }

    /**
     * @function setupEventListeners
     * @description 设置各种事件监听器
     */
    function setupEventListeners() {
        // 搜索功能
        elements.searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
        elements.btnSearch.addEventListener('click', handleSearch);

        // 导航标签切换
        elements.navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                elements.navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.currentTab = tab.dataset.tab;
                
                // 如果不是站内搜索，则打开对应的搜索引擎
                if (state.currentTab !== 'site') {
                    const searchQuery = elements.searchInput.value.trim();
                    if (searchQuery) {
                        let searchUrl;
                        if (state.currentTab === 'baidu') {
                            searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(searchQuery)}`;
                        } else if (state.currentTab === 'must') {
                            searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}`;
                        }
                        window.open(searchUrl, '_blank');
                    }
                }
            });
        });

        // 模态框相关
        elements.btnShowAddModal.addEventListener('click', function() {
            // 在显示添加链接表单前需要验证身份
            verifyPassword(() => {
                elements.addLinkForm.reset();
                updateCategorySelect();

                // 重置分类选项
                elements.categoryType.value = 'existing';
                elements.existingCategoryGroup.style.display = 'block';
                elements.newCategoryGroup.style.display = 'none';

                elements.addLinkModal.style.display = 'block';
                elements.addLinkModal.classList.add('active');
                
                // 添加延迟确保过渡效果正常
                setTimeout(() => {
                    const modalContent = elements.addLinkModal.querySelector('.modal-content');
                    if (modalContent) {
                        modalContent.style.transform = 'translateY(0)';
                        modalContent.style.opacity = '1';
                    }
                    
                    // 聚焦标题输入框
                    elements.linkTitle.focus();
                }, 10);
            });
        });

        // 分类类型切换
        elements.categoryType.addEventListener('change', function() {
            if (this.value === 'existing') {
                elements.existingCategoryGroup.style.display = 'block';
                elements.newCategoryGroup.style.display = 'none';
                elements.categorySelect.setAttribute('required', 'required');
                elements.newCategoryName.removeAttribute('required');
            } else {
                elements.existingCategoryGroup.style.display = 'none';
                elements.newCategoryGroup.style.display = 'block';
                elements.categorySelect.removeAttribute('required');
                elements.newCategoryName.setAttribute('required', 'required');
            }
        });

        elements.closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                closeModal(modal);
            });
        });

        // 点击模态框外部关闭
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                closeModal(e.target);
            }
        });

        // 表单提交
        elements.addLinkForm.addEventListener('submit', handleAddLink);
        elements.editLinkForm.addEventListener('submit', handleEditLink);
        elements.addCategoryForm.addEventListener('submit', handleAddCategory);
        elements.passwordForm.addEventListener('submit', handlePasswordSubmit);
        elements.changePasswordForm.addEventListener('submit', handleChangePassword);

        // 检测站点可访问性
        elements.btnCheckSite.addEventListener('click', checkSitesAccessibility);
        elements.btnClear.addEventListener('click', clearAccessibilityStatus);

        // 设置按钮点击事件
        elements.btnSettings.addEventListener('click', function() {
            verifyPassword(() => {
                showSettingsModal();
            });
        });

        // 添加分类按钮点击事件
        document.getElementById('btnAddCategory')?.addEventListener('click', function() {
            verifyPassword(() => {
                showAddCategoryModal();
            });
        });

        // 设置选项卡切换
        elements.settingsTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // 移除所有选项卡的活动状态
                elements.settingsTabs.forEach(t => t.classList.remove('active'));
                // 为当前选项卡添加活动状态
                this.classList.add('active');
                
                // 隐藏所有内容面板
                document.querySelectorAll('.settings-pane').forEach(pane => {
                    pane.classList.remove('active');
                });
                
                // 显示对应的内容面板
                const tabName = this.dataset.tab;
                document.getElementById(`${tabName}Pane`).classList.add('active');
                
                // 如果是分类管理标签，加载分类列表
                if (tabName === 'category') {
                    loadCategoriesList('settingsCategoriesList');
                }
            });
        });
    }

    /**
     * @function handleSearch
     * @description 处理搜索功能
     */
    function handleSearch() {
        const query = elements.searchInput.value.trim();
        state.searchQuery = query;

        // 如果是站内搜索
        if (state.currentTab === 'site') {
            renderLinks();
        } else {
            // 如果是外部搜索引擎
            let searchUrl;
            if (state.currentTab === 'baidu') {
                searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
            } else if (state.currentTab === 'must') {
                searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
            }
            window.open(searchUrl, '_blank');
        }
    }

    /**
     * @function createCategoryId
     * @description 根据分类名称创建一个合法的分类ID
     * @param {string} name - 分类名称
     * @returns {string} 生成的分类ID
     */
    function createCategoryId(name) {
        // 将分类名称转换为拼音或英文等合法ID（这里简化处理）
        // 去除所有非字母数字字符，转小写
        let id = name.toLowerCase()
                     .replace(/[^a-z0-9]/g, '')
                     .slice(0, 20); // 限制长度
        
        // 确保ID不重复
        let counter = 1;
        let baseId = id;
        while (state.links.categories.some(cat => cat.id === id)) {
            id = `${baseId}${counter}`;
            counter++;
        }
        
        return id || 'category' + Date.now(); // 如果生成的ID为空，使用时间戳
    }

    /**
     * @function addNewCategory
     * @description 添加新分类
     * @param {string} name - 分类名称
     * @returns {Promise<Object>} 包含新分类信息的Promise
     */
    function addNewCategory(name) {
        const id = createCategoryId(name);
        
        return fetch('/api/categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.authToken}`
            },
            body: JSON.stringify({ id, name })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        });
    }

    /**
     * @function handleAddLink
     * @description 处理添加新链接
     * @param {Event} e - 表单提交事件
     */
    function handleAddLink(e) {
        e.preventDefault();

        const title = document.getElementById('linkTitle').value.trim();
        const url = document.getElementById('linkUrl').value.trim();
        const categoryType = elements.categoryType.value;

        // 验证URL格式
        if (!url.match(/^https?:\/\/.+\..+/)) {
            showNotification('请输入有效的URL地址，以http://或https://开头', 'error');
            return;
        }

        // 根据选择的分类类型处理
        let categoryPromise;
        
        if (categoryType === 'existing') {
            // 使用现有分类
            const categoryId = elements.categorySelect.value;
            categoryPromise = Promise.resolve({ id: categoryId });
        } else {
            // 创建新分类
            const newCategoryName = elements.newCategoryName.value.trim();
            
            if (!newCategoryName) {
                showNotification('请输入分类名称', 'error');
                return;
            }
            
            categoryPromise = addNewCategory(newCategoryName);
        }

        // 处理分类后添加链接
        categoryPromise
            .then(category => {
                return fetch('/api/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.authToken}`
                    },
                    body: JSON.stringify({
                        categoryId: category.id,
                        title,
                        url
                    })
                });
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => Promise.reject(err));
                }
                return response.json();
            })
            .then(data => {
                // 重置表单并关闭模态框
                elements.addLinkForm.reset();
                // 重置分类选择器状态
                elements.categoryType.value = 'existing';
                elements.existingCategoryGroup.style.display = 'block';
                elements.newCategoryGroup.style.display = 'none';
                
                elements.addLinkModal.style.display = 'none';
                
                // 刷新链接列表和分类侧边栏
                fetchLinks();
                showNotification('链接添加成功', 'success');
            })
            .catch(error => {
                console.error('添加链接失败:', error);
                showNotification(error.error || '添加链接失败，请重试', 'error');
            });
    }

    /**
     * @function handleAddCategory
     * @description 处理添加新分类
     * @param {Event} e - 表单提交事件
     */
    function handleAddCategory(e) {
        e.preventDefault();

        const id = document.getElementById('categoryId').value.trim();
        const name = document.getElementById('categoryName').value.trim();

        // 验证ID格式（只允许字母、数字和下划线）
        if (!id.match(/^[a-zA-Z0-9_]+$/)) {
            showNotification('分类ID只能包含字母、数字和下划线', 'error');
            return;
        }

        fetch('/api/categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.authToken}`
            },
            body: JSON.stringify({ id, name })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        })
        .then(data => {
            // 重置表单并关闭模态框
            elements.addCategoryForm.reset();
            elements.addCategoryModal.style.display = 'none';
            
            // 刷新链接列表和分类侧边栏
            fetchLinks();
            showNotification('分类添加成功', 'success');
        })
        .catch(error => {
            console.error('添加分类失败:', error);
            showNotification(error.error || '添加分类失败，请重试', 'error');
        });
    }

    /**
     * @function handleDeleteLink
     * @description 处理删除链接
     * @param {Event} e - 点击事件
     */
    function handleDeleteLink(e) {
        e.stopPropagation();
        
        // 获取链接信息
        const button = e.target.closest('.delete-link');
        const categoryId = button.dataset.category;
        const linkId = button.dataset.link;
        
        // 安全确认
        if (!confirm('确定要删除这个链接吗？')) {
            return;
        }
        
        // 调用API删除链接
        fetch(`/api/links/${categoryId}/${linkId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${state.authToken}`
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        })
        .then(data => {
            // 刷新链接列表和分类侧边栏
            fetchLinks();
            showNotification('链接删除成功', 'success');
        })
        .catch(error => {
            console.error('删除链接失败:', error);
            showNotification(error.error || '删除链接失败，请重试', 'error');
        });
    }

    /**
     * @function checkSitesAccessibility
     * @description 检查所有网站链接的可访问性
     */
    function checkSitesAccessibility() {
        // 收集所有链接URL
        const allUrls = [];
        // 创建URL映射，用于解决URL比较问题
        const urlToCardMap = new Map();
        
        state.links.categories.forEach(category => {
            category.links.forEach(link => {
                allUrls.push(link.url);
            });
        });
        
        if (allUrls.length === 0) {
            showNotification('暂无链接可以检测', 'error');
            return;
        }
        
        // 显示加载状态
        document.getElementById('btnCheckSite').innerHTML = '<span class="loader"></span> 检测中...';
        document.getElementById('btnCheckSite').disabled = true;
        
        // 为所有链接先添加加载动画
        document.querySelectorAll('.link-card').forEach(card => {
            const linkElement = card.querySelector('a');
            if (linkElement) {
                // 移除之前可能存在的状态
                card.classList.remove('status-success', 'status-error', 'status-loading');
                card.classList.add('status-loading');
                
                // 保留原有文本内容并添加加载图标
                const originalText = linkElement.textContent.replace(/\s*✓\s*|\s*✗\s*|\s*\.\.\.\s*/g, '').trim();
                linkElement.innerHTML = `${originalText} <span class="loader" style="width: 10px; height: 10px; margin-left: 5px;"></span>`;
                linkElement.title = '检测中...';
                
                // 添加到URL映射
                const href = linkElement.getAttribute('href');
                if (href) {
                    urlToCardMap.set(href, { card, linkElement });
                }
            }
        });
        
        console.log("开始检测链接...", allUrls);
        
        // 调用API检查链接可访问性
        fetch('/api/check-links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ urls: allUrls })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('检测请求失败');
            }
            return response.json();
        })
        .then(data => {
            if (data.results) {
                console.log("API返回结果:", data.results);
                
                // 更新链接卡片状态
                data.results.forEach(result => {
                    const { url, isAccessible } = result;
                    console.log(`处理URL: ${url}, 可访问: ${isAccessible}`);
                    
                    // 查找对应的卡片和链接元素
                    const elemInfo = urlToCardMap.get(url);
                    if (elemInfo) {
                        const { card, linkElement } = elemInfo;
                        // 移除加载状态
                        card.classList.remove('status-loading');
                        
                        // 添加新的状态类
                        if (isAccessible) {
                            card.classList.add('status-success');
                            
                            // 添加状态图标 - 可访问
                            let originalText = linkElement.textContent.replace(/\s*✓\s*|\s*✗\s*|\s*\.\.\.\s*/g, '').trim();
                            linkElement.innerHTML = `${originalText} <span style="display: inline-block; margin-left: 5px; font-weight: bold; color: #4caf50; font-size: 16px;">✓</span>`;
                            linkElement.title = '可访问';
                        } else {
                            card.classList.add('status-error');
                            
                            // 添加状态图标 - 不可访问
                            let originalText = linkElement.textContent.replace(/\s*✓\s*|\s*✗\s*|\s*\.\.\.\s*/g, '').trim();
                            linkElement.innerHTML = `${originalText} <span style="display: inline-block; margin-left: 5px; font-weight: bold; color: #ff0000; font-size: 16px;">✗</span>`;
                            linkElement.title = '无法访问';
                        }
                    } else {
                        console.warn(`未找到匹配的URL元素: ${url}`);
                        
                        // 备选方案：尝试用其他方式查找
                        document.querySelectorAll('.link-card a').forEach(a => {
                            const hrefAttr = a.getAttribute('href');
                            // 尝试多种匹配方式
                            if (hrefAttr === url || a.href === url || 
                                hrefAttr.endsWith(url) || url.endsWith(hrefAttr)) {
                                const card = a.closest('.link-card');
                                if (card) {
                                    // 移除加载状态
                                    card.classList.remove('status-loading');
                                    
                                    if (isAccessible) {
                                        card.classList.add('status-success');
                                        let originalText = a.textContent.replace(/\s*✓\s*|\s*✗\s*|\s*\.\.\.\s*/g, '').trim();
                                        a.innerHTML = `${originalText} <span style="display: inline-block; margin-left: 5px; font-weight: bold; color: #4caf50; font-size: 16px;">✓</span>`;
                                        a.title = '可访问';
                                    } else {
                                        card.classList.add('status-error');
                                        let originalText = a.textContent.replace(/\s*✓\s*|\s*✗\s*|\s*\.\.\.\s*/g, '').trim();
                                        a.innerHTML = `${originalText} <span style="display: inline-block; margin-left: 5px; font-weight: bold; color: #ff0000; font-size: 16px;">✗</span>`;
                                        a.title = '无法访问';
                                    }
                                }
                            }
                        });
                    }
                });
                
                // 清除所有未处理的加载状态
                document.querySelectorAll('.link-card.status-loading').forEach(card => {
                    card.classList.remove('status-loading');
                    const a = card.querySelector('a');
                    if (a) {
                        const originalText = a.textContent.replace(/\s*✓\s*|\s*✗\s*|\s*\.\.\.\s*/g, '').trim();
                        a.textContent = originalText;
                    }
                });
                
                showNotification('链接可访问性检测完成', 'success');
            } else {
                showNotification('检测结果无效', 'error');
                clearAllLoadingStatus();
            }
        })
        .catch(error => {
            console.error('检测失败:', error);
            showNotification('检测失败: ' + error.message, 'error');
            clearAllLoadingStatus();
        })
        .finally(() => {
            // 恢复按钮状态
            document.getElementById('btnCheckSite').innerHTML = '检测是否可以访问';
            document.getElementById('btnCheckSite').disabled = false;
        });
    }

    /**
     * @function clearAllLoadingStatus
     * @description 清除所有加载状态
     */
    function clearAllLoadingStatus() {
        document.querySelectorAll('.link-card').forEach(card => {
            card.classList.remove('status-loading');
            const linkElement = card.querySelector('a');
            if (linkElement) {
                const originalText = linkElement.textContent.replace(/\s*✓\s*|\s*✗\s*|\s*\.\.\.\s*/g, '').trim();
                linkElement.textContent = originalText;
                linkElement.title = '';
            }
        });
    }

    /**
     * @function clearAccessibilityStatus
     * @description 清除链接可访问性状态显示
     */
    function clearAccessibilityStatus() {
        document.querySelectorAll('.link-card').forEach(card => {
            // 移除状态类
            card.classList.remove('status-success', 'status-error', 'status-loading');
            
            // 移除链接中的状态图标
            const linkElement = card.querySelector('a');
            if (linkElement) {
                // 移除状态图标，只保留文本内容
                const linkText = linkElement.textContent.replace(/\s*✓\s*|\s*✗\s*|\s*\.\.\.\s*/g, '').trim();
                linkElement.textContent = linkText;
                linkElement.title = '';
            }
        });
        
        showNotification('已清除所有检测结果', 'success');
    }

    /**
     * @function showNotification
     * @description 显示通知消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (success/error)
     */
    function showNotification(message, type) {
        // 先移除已有的通知
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 创建新通知
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);
        
        // 重要修复：添加延时强制触发渲染并添加show类
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // 3秒后自动关闭
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * @function closeModal
     * @description 关闭模态框
     * @param {HTMLElement} modal - 要关闭的模态框元素
     */
    function closeModal(modal) {
        if (!modal) return;
        
        // 首先设置过渡效果
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.transform = 'translateY(30px)';
            modalContent.style.opacity = '0';
        }
        
        // 设置短暂延迟后再隐藏模态框
        setTimeout(() => {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }, 300);
    }

    /**
     * @function handleEditLinkClick
     * @description 处理编辑链接的点击事件
     * @param {Object} link - 链接对象
     */
    function handleEditLinkClick(link) {
        // 在显示编辑表单前验证身份
        verifyPassword(() => {
            // 设置表单值
            document.getElementById('editLinkId').value = link.id;
            document.getElementById('linkCategoryId').value = link.categoryId;
            document.getElementById('editLinkTitle').value = link.title;
            document.getElementById('editLinkUrl').value = link.url;
            
            // 填充分类下拉框
            const editCategorySelect = document.getElementById('editCategorySelect');
            editCategorySelect.innerHTML = '';
            state.links.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                option.selected = category.id === link.categoryId;
                editCategorySelect.appendChild(option);
            });
            
            // 显示模态框
            elements.editLinkModal.style.display = 'block';
            elements.editLinkModal.classList.add('active');
            
            // 添加延迟确保过渡效果正常
            setTimeout(() => {
                const modalContent = elements.editLinkModal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.style.transform = 'translateY(0)';
                    modalContent.style.opacity = '1';
                }
                
                // 聚焦标题输入框
                document.getElementById('editLinkTitle').focus();
            }, 10);
        });
    }

    /**
     * @function handleEditLink
     * @description 处理编辑链接表单提交
     * @param {Event} e - 表单提交事件
     */
    function handleEditLink(e) {
        e.preventDefault();
        
        const linkId = document.getElementById('editLinkId').value;
        const originalCategoryId = document.getElementById('linkCategoryId').value;
        const newCategoryId = document.getElementById('editCategorySelect').value;
        const title = document.getElementById('editLinkTitle').value.trim();
        const url = document.getElementById('editLinkUrl').value.trim();
        
        // 验证URL格式
        if (!url.match(/^https?:\/\/.+\..+/)) {
            showNotification('请输入有效的URL地址，以http://或https://开头', 'error');
            return;
        }
        
        // 判断是否更改了分类
        if (originalCategoryId !== newCategoryId) {
            // 分类已更改 - 需要从原分类删除链接，并添加到新分类
            moveLink(linkId, originalCategoryId, newCategoryId, title, url);
        } else {
            // 分类未更改 - 只更新链接信息
            updateLink(linkId, originalCategoryId, title, url);
        }
    }

    /**
     * @function updateLink
     * @description 更新链接信息（不改变分类）
     * @param {string} linkId - 链接ID
     * @param {string} categoryId - 分类ID
     * @param {string} title - 新标题
     * @param {string} url - 新URL
     */
    function updateLink(linkId, categoryId, title, url) {
        // 调用API更新链接
        fetch(`/api/links/${categoryId}/${linkId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.authToken}`
            },
            body: JSON.stringify({ title, url })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        })
        .then(data => {
            // 关闭模态框
            closeModal(elements.editLinkModal);
            
            // 刷新链接列表
            fetchLinks();
            showNotification('链接更新成功', 'success');
        })
        .catch(error => {
            console.error('更新链接失败:', error);
            showNotification(error.error || '更新链接失败，请重试', 'error');
        });
    }

    /**
     * @function moveLink
     * @description 移动链接到不同分类
     * @param {string} linkId - 链接ID
     * @param {string} oldCategoryId - 原分类ID
     * @param {string} newCategoryId - 新分类ID
     * @param {string} title - 链接标题
     * @param {string} url - 链接URL
     */
    function moveLink(linkId, oldCategoryId, newCategoryId, title, url) {
        // 调用API移动链接
        fetch(`/api/links/move`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.authToken}`
            },
            body: JSON.stringify({ 
                linkId, 
                oldCategoryId, 
                newCategoryId, 
                title, 
                url 
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        })
        .then(data => {
            // 关闭模态框
            closeModal(elements.editLinkModal);
            
            // 刷新链接列表
            fetchLinks();
            showNotification('链接已移动到新分类', 'success');
        })
        .catch(error => {
            console.error('移动链接失败:', error);
            showNotification(error.error || '移动链接失败，请重试', 'error');
        });
    }

    /**
     * @function verifyPassword
     * @description 验证管理员密码
     * @param {Function} callback - 验证成功后的回调函数
     */
    function verifyPassword(callback) {
        // 如果已经通过验证且没有超时，直接执行回调
        if (state.isAuthenticated && state.authToken && state.tokenExpiresAt > Date.now()) {
            return callback();
        }
        
        // 存储待执行的操作
        state.pendingAction = callback;
        
        // 显示密码模态框
        elements.passwordModal.style.display = 'block';
        elements.passwordModal.classList.add('active');
        
        // 添加延迟确保过渡效果正常
        setTimeout(() => {
            const modalContent = elements.passwordModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.transform = 'translateY(0)';
                modalContent.style.opacity = '1';
            }
            
            // 重置密码输入框并聚焦
            document.getElementById('adminPassword').value = '';
            document.getElementById('adminPassword').focus();
        }, 10);
    }

    /**
     * @function handlePasswordSubmit
     * @description 处理密码提交
     * @param {Event} e - 表单提交事件
     */
    function handlePasswordSubmit(e) {
        e.preventDefault();
        
        const password = document.getElementById('adminPassword').value;
        
        // 调用API验证密码而不是本地验证
        fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 验证成功，保存令牌
                state.isAuthenticated = true;
                state.authToken = data.token;
                state.tokenExpiresAt = data.expiresAt;
                
                // 保存到本地存储以便页面刷新后恢复
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('tokenExpiresAt', data.expiresAt);
                
                // 设置验证有效期计时器
                if (state.authTimeout) {
                    clearTimeout(state.authTimeout);
                }
                
                const timeUntilExpiry = data.expiresAt - Date.now();
                state.authTimeout = setTimeout(() => {
                    state.isAuthenticated = false;
                    state.authToken = null;
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('tokenExpiresAt');
                }, timeUntilExpiry);
                
                // 关闭密码模态框
                closeModal(elements.passwordModal);
                
                // 执行之前保存的操作
                if (state.pendingAction) {
                    const callback = state.pendingAction;
                    state.pendingAction = null;
                    callback();
                }
                
                showNotification('验证成功', 'success');
            } else {
                showNotification('密码错误，请重试', 'error');
            }
        })
        .catch(error => {
            console.error('验证失败:', error);
            showNotification('验证失败，请稍后重试', 'error');
        });
    }

    /**
     * @function showSettingsModal
     * @description 显示设置模态框
     */
    function showSettingsModal() {
        // 重置表单
        document.getElementById('changePasswordForm').reset();
        
        // 使用requestAnimationFrame确保在下一帧执行DOM操作，减少页面卡顿
        requestAnimationFrame(() => {
            elements.settingsModal.style.display = 'block';
            elements.settingsModal.classList.add('active');
            
            const modalContent = elements.settingsModal.querySelector('.modal-content');
            if (modalContent) {
                // 使用transform而不是opacity，更好的性能
                modalContent.style.transform = 'translateY(0)';
            }
            
            // 初始选中的标签下的内容面板初始化
            const activeTab = document.querySelector('.settings-tab.active');
            if (activeTab && activeTab.dataset.tab === 'category') {
                // 延迟加载分类列表，避免阻塞UI渲染
                setTimeout(() => {
                    loadCategoriesList('settingsCategoriesList');
                }, 50);
            }
        });
    }
    
    /**
     * @function handleChangePassword
     * @description 处理密码修改
     * @param {Event} e - 表单提交事件
     */
    function handleChangePassword(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // 验证新密码是否满足要求
        if (newPassword.length < 6) {
            showNotification('新密码至少需要6个字符', 'error');
            return;
        }
        
        // 验证新密码是否与当前密码相同
        if (newPassword === currentPassword) {
            showNotification('新密码不能与当前密码相同', 'error');
            return;
        }
        
        // 验证两次输入的密码是否一致
        if (newPassword !== confirmPassword) {
            showNotification('两次输入的密码不一致', 'error');
            return;
        }
        
        try {
            // 调用API更新密码
            fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.authToken}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    token: state.authToken
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => Promise.reject(err));
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    showNotification('密码修改成功', 'success');
                    closeModal(elements.settingsModal);
                } else {
                    showNotification('密码修改失败', 'error');
                }
            })
            .catch(error => {
                console.error('修改密码失败:', error);
                showNotification('修改密码失败，请重试', 'error');
            });
        } catch (error) {
            console.error('修改密码失败:', error);
            showNotification('修改密码失败，请重试', 'error');
        }
    }

    /**
     * @function updateClock
     * @description 更新显示的时间
     */
    function updateClock() {
        const now = new Date();
        // 获取当前日期
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const dateString = `${year}-${month}-${day}`;
        
        // 获取当前时间
        const hours = fillZero(now.getHours());
        const minutes = fillZero(now.getMinutes());
        const seconds = fillZero(now.getSeconds());
        const timeString = `${hours}:${minutes}:${seconds}`;

        //拼接日期和时间
        const dateTimeString = `${dateString} ${timeString}`;
        
        const timeDisplay = document.getElementById('dangqiansj');
        if (timeDisplay) {
            timeDisplay.textContent = dateTimeString;
        }
    }

    /**
     * @function fillZero
     * @description 数字补零
     * @param {number} num - 需要补零的数字
     * @returns {string} 补零后的字符串
     */
    function fillZero(num) {
        return num < 10 ? '0' + num : '' + num;
    }

    // 在页面加载完成后初始化应用
    document.addEventListener('DOMContentLoaded', function() {
        init();
        
        // 检查重复ID
        checkDuplicateIds();
        
        // 添加分类管理按钮
        addCategoryManagementButtons();
        
        // 添加分类表单提交事件
        document.getElementById('addCategoryForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const categoryName = document.getElementById('newCategoryTitle').value;
            addCategory(categoryName);
        });
        
        // 编辑分类表单提交事件
        document.getElementById('editCategoryForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const categoryId = document.getElementById('editCategoryId').value;
            const categoryName = document.getElementById('editCategoryTitle').value;
            updateCategory(categoryId, categoryName);
        });
        
        // 测试分类管理功能
        testCategoryManagement();
        
        // 初始化壁纸功能
        initWallpaperFeature();
    });

    /**
     * 分类管理相关功能
     */

    // 添加管理分类按钮到侧边栏
    function addCategoryManagementButtons() {
        const categoryContainer = document.querySelector('.categories');
        if (!categoryContainer) return;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'category-actions';
        
        actionsDiv.innerHTML = `
            <button class="manage-categories-btn">管理分类</button>
            <button class="add-category-btn">添加分类</button>
        `;
        
        categoryContainer.appendChild(actionsDiv);
        
        // 绑定事件
        document.querySelector('.manage-categories-btn').addEventListener('click', showManageCategoriesModal);
        document.querySelector('.add-category-btn').addEventListener('click', showAddCategoryModal);
    }

    /**
     * 显示添加分类的模态框
     */
    function showAddCategoryModal() {
        verifyPassword(() => {
            // 首先关闭系统设置模态框
            closeModal(elements.settingsModal);
            
            // 重置表单
            document.getElementById('addCategoryForm').reset();
            
            // 显示添加分类模态框
            document.getElementById('addCategoryModal').style.display = 'block';
            document.getElementById('addCategoryModal').classList.add('active');
            
            // 添加延迟确保过渡效果正常
            setTimeout(() => {
                const modalContent = document.getElementById('addCategoryModal').querySelector('.modal-content');
                if (modalContent) {
                    modalContent.style.transform = 'translateY(0)';
                    modalContent.style.opacity = '1';
                }
                
                // 聚焦分类名称输入框
                document.getElementById('newCategoryTitle').focus();
            }, 10);
        });
    }

    /**
     * 显示编辑分类的模态框
     * @param {string} categoryId - 分类ID
     * @param {string} categoryName - 分类名称
     */
    function showEditCategoryModal(categoryId, categoryName) {
        // 先关闭设置模态框
        closeModal(elements.settingsModal);
        
        // 设置表单数据
        document.getElementById('editCategoryId').value = categoryId;
        document.getElementById('editCategoryTitle').value = categoryName;
        
        // 获取模态框元素
        const editCategoryModal = document.getElementById('editCategoryModal');
        
        // 显示模态框
        editCategoryModal.style.display = 'block';
        editCategoryModal.classList.add('active');
        
        // 添加延迟确保过渡效果正常
        setTimeout(() => {
            const modalContent = editCategoryModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.transform = 'translateY(0)';
                modalContent.style.opacity = '1';
            }
            
            // 聚焦到输入框
            document.getElementById('editCategoryTitle').focus();
        }, 10);
        
        // 验证用户权限
        verifyPassword(() => {
            // 确保表单提交事件只被绑定一次
            const editCategoryForm = document.getElementById('editCategoryForm');
            editCategoryForm.removeEventListener('submit', handleEditCategorySubmit);
            editCategoryForm.addEventListener('submit', handleEditCategorySubmit);
        });
    }
    
    /**
     * @function handleEditCategorySubmit
     * @description 处理编辑分类表单提交
     * @param {Event} e - 提交事件
     */
    function handleEditCategorySubmit(e) {
        e.preventDefault();
        
        const categoryId = document.getElementById('editCategoryId').value;
        const categoryName = document.getElementById('editCategoryTitle').value.trim();
        
        updateCategory(categoryId, categoryName);
    }

    /**
     * 显示管理分类的模态框
     */
    function showManageCategoriesModal() {
        verifyPassword(() => {
            // 使用requestAnimationFrame确保在下一帧执行DOM操作，减少页面卡顿
            requestAnimationFrame(() => {
                elements.manageCategoriesModal.style.display = 'block';
                elements.manageCategoriesModal.classList.add('active');
                
                const modalContent = elements.manageCategoriesModal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.style.transform = 'translateY(0)';
                }
                
                // 延迟加载分类列表，避免阻塞UI渲染
                setTimeout(() => {
                    loadCategoriesList('manageCategoriesList');
                }, 50);
            });
        });
    }

    /**
     * 加载分类列表到管理模态框
     * @param {string} containerId - 分类列表容器的ID，默认为settingsCategoriesList
     */
    function loadCategoriesList(containerId = 'settingsCategoriesList') {
        console.log('开始加载分类列表到容器:', containerId);
        
        // 获取分类容器
        const categoriesListContainer = document.getElementById(containerId);
        
        if (!categoriesListContainer) {
            console.error('找不到分类列表容器:', containerId);
            return;
        }
        
        // 清空现有内容
        categoriesListContainer.innerHTML = '';
        
        // 使用API获取分类数据
        fetch('/api/links')
            .then(response => response.json())
            .then(data => {
                const categories = data.categories || [];
                
                if (categories.length === 0) {
                    categoriesListContainer.innerHTML = '<p class="no-categories-message">暂无分类数据</p>';
                    return;
                }
                
                // 使用文档片段，减少DOM重排次数
                const fragment = document.createDocumentFragment();
                
                // 为每个分类创建一个管理项
                categories.forEach(category => {
                    const categoryItem = document.createElement('div');
                    categoryItem.className = 'category-item';
                    categoryItem.dataset.id = category.id;
                    
                    categoryItem.innerHTML = `
                        <div class="category-info">
                            <span class="category-name">${category.name}</span>
                            <span class="category-count">${category.links.length} 个链接</span>
                        </div>
                        <div class="category-actions">
                            <button class="btn-edit" data-id="${category.id}" data-name="${category.name}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete" data-id="${category.id}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    `;
                    
                    // 添加到文档片段而不是直接添加到DOM
                    fragment.appendChild(categoryItem);
                });
                
                // 批量添加到DOM，只触发一次重排
                categoriesListContainer.appendChild(fragment);
                
                // 使用事件委托而不是为每个按钮单独添加事件监听器
                categoriesListContainer.addEventListener('click', function(e) {
                    // 查找最近的按钮祖先元素
                    const button = e.target.closest('button');
                    if (!button) return; // 如果点击的不是按钮区域，直接返回
                    
                    const categoryId = button.dataset.id;
                    
                    if (button.classList.contains('btn-edit')) {
                        const categoryName = button.dataset.name;
                        
                        // 如果是在管理分类模态框中点击的编辑按钮，先关闭该模态框
                        if (containerId === 'manageCategoriesList') {
                            closeModal(elements.manageCategoriesModal);
                        }
                        
                        showEditCategoryModal(categoryId, categoryName);
                    } else if (button.classList.contains('btn-delete')) {
                        // 如果用户确认删除，根据模态框来源关闭相应模态框
                        if (confirm('确定要删除这个分类吗？所有该分类下的链接也将被删除。')) {
                            // 如果是在设置面板中的分类管理点击的，关闭设置模态框
                            if (containerId === 'settingsCategoriesList') {
                                closeModal(elements.settingsModal);
                            } 
                            // 如果是在单独的管理分类模态框中点击的，关闭该模态框
                            else if (containerId === 'manageCategoriesList') {
                                closeModal(elements.manageCategoriesModal);
                            }
                            
                            deleteCategory(categoryId);
                        }
                    }
                });
            })
            .catch(error => {
                console.error('加载分类数据失败:', error);
                categoriesListContainer.innerHTML = '<p class="error-message">加载分类数据失败，请重试</p>';
            });
    }

    /**
     * 获取所有分类
     * @returns {Array} 分类数组
     */
    function getAllCategories() {
        // 从localStorage获取分类
        const categories = JSON.parse(localStorage.getItem('categories')) || [];
        return categories;
    }

    /**
     * 添加新分类
     * @param {string} categoryName - 分类名称
     */
    function addCategory(categoryName) {
        // 验证分类名称
        if (!categoryName.trim()) {
            showNotification('分类名称不能为空', 'error');
            return;
        }
        
        // 创建分类ID
        const categoryId = createCategoryId(categoryName.trim());
        
        // 调用API添加分类
        fetch('/api/categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.authToken}`
            },
            body: JSON.stringify({
                id: categoryId,
                name: categoryName.trim()
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        })
        .then(data => {
            // 刷新链接列表和分类侧边栏
            fetchLinks();
            
            // 关闭模态框
            closeModal(elements.addCategoryModal);
            
            showNotification('分类添加成功', 'success');
        })
        .catch(error => {
            console.error('添加分类失败:', error);
            showNotification(error.error || '添加分类失败，请重试', 'error');
        });
    }

    /**
     * 更新分类
     * @param {string} categoryId - 分类ID
     * @param {string} categoryName - 新的分类名称
     */
    function updateCategory(categoryId, categoryName) {
        // 验证分类名称
        if (!categoryName.trim()) {
            showNotification('分类名称不能为空', 'error');
            return;
        }
        
        // 调用API更新分类
        fetch(`/api/categories/${categoryId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.authToken}`
            },
            body: JSON.stringify({
                name: categoryName.trim()
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        })
        .then(data => {
            // 刷新链接列表和分类侧边栏
            fetchLinks();
            
            // 关闭模态框
            closeModal(elements.editCategoryModal);
            
            showNotification('分类更新成功', 'success');
        })
        .catch(error => {
            console.error('更新分类失败:', error);
            showNotification(error.error || '更新分类失败，请重试', 'error');
        });
    }

    /**
     * 删除分类
     * @param {string} categoryId - 分类ID
     */
    function deleteCategory(categoryId) {
        fetch(`/api/categories/${categoryId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${state.authToken}`
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        })
        .then(data => {
            // 刷新链接列表和分类侧边栏
            fetchLinks();
            showNotification('分类删除成功', 'success');
        })
        .catch(error => {
            console.error('删除分类失败:', error);
            showNotification(error.error || '删除分类失败，请重试', 'error');
        });
    }

    /**
     * 更新链接的分类名称
     * @param {string} categoryId - 分类ID
     * @param {string} newCategoryName - 新的分类名称
     */
    function updateLinkCategoryNames(categoryId, newCategoryName) {
        // 这个函数在服务器端会自动处理，不需要单独实现
        // 由于链接数据现在从服务器获取，所以不需要手动更新本地数据
    }

    /**
     * 壁纸设置相关功能
     */
    let wallpapers = JSON.parse(localStorage.getItem('wallpapers') || '[]');
    let currentWallpaper = localStorage.getItem('currentWallpaper') || '';

    /**
     * @function initWallpaperFeature
     * @description 初始化壁纸功能
     */
    function initWallpaperFeature() {
        // 初始化壁纸数据
        loadWallpapersFromServer();
        
        // 打开壁纸设置模态框
        const openWallpaperModalBtn = document.getElementById('openWallpaperModal');
        const wallpaperBtn = document.querySelector('.wallpaper-btn');
        
        if (openWallpaperModalBtn) {
            openWallpaperModalBtn.addEventListener('click', () => {
                verifyPassword(() => {
                    openWallpaperModal();
                });
            });
        }
        
        // 添加额外的壁纸按钮监听器
        if (wallpaperBtn) {
            wallpaperBtn.addEventListener('click', () => {
                verifyPassword(() => {
                    openWallpaperModal();
                });
            });
        }
        
        // 关闭壁纸模态框
        const closeWallpaperBtn = document.querySelector('#wallpaperModal .close');
        if (closeWallpaperBtn) {
            closeWallpaperBtn.addEventListener('click', () => {
                closeModal(document.getElementById('wallpaperModal'));
            });
        }
        
        // 初始化选项卡切换
        const wallpaperTabs = document.querySelectorAll('.wallpaper-tab');
        if (wallpaperTabs.length > 0) {
            wallpaperTabs.forEach(tab => {
                tab.addEventListener('click', function() {
                    // 添加标签切换动画效果
                    const activePane = document.querySelector('.wallpaper-tab-pane.active');
                    if (activePane) {
                        activePane.style.animation = 'fadeOut 0.3s forwards';
                        setTimeout(() => {
                            activePane.classList.remove('active');
                            activePane.style.animation = '';
                            
                            // 切换到新标签
                            wallpaperTabs.forEach(t => t.classList.remove('active'));
                            this.classList.add('active');
                            
                            // 显示对应的面板
                            const tabId = this.dataset.tab;
                            const newPane = document.getElementById(`${tabId}Pane`);
                            newPane.classList.add('active');
                            newPane.style.animation = 'fadeIn 0.5s forwards';
                        }, 300);
                    } else {
                        // 移除所有选项卡的active类
                        wallpaperTabs.forEach(t => t.classList.remove('active'));
                        // 添加当前选项卡的active类
                        this.classList.add('active');
                        
                        // 隐藏所有面板
                        document.querySelectorAll('.wallpaper-tab-pane').forEach(pane => {
                            pane.classList.remove('active');
                        });
                        
                        // 显示对应的面板
                        const tabId = this.dataset.tab;
                        document.getElementById(`${tabId}Pane`).classList.add('active');
                    }
                });
            });
        }
        
        // 本地图片上传按钮
        const selectFileBtn = document.getElementById('selectFileBtn');
        const wallpaperFile = document.getElementById('wallpaperFile');
        const wallpaperPreview = document.getElementById('wallpaperPreview');
        
        if (selectFileBtn && wallpaperFile) {
            selectFileBtn.addEventListener('click', () => {
                wallpaperFile.click();
            });
            
            wallpaperFile.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    // 显示加载状态
                    showNotification('正在处理图片...', 'success');
                    
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        // 显示预览
                        wallpaperPreview.src = e.target.result;
                        wallpaperPreview.style.display = 'block';
                        
                        // 优雅淡入效果
                        wallpaperPreview.style.opacity = '0';
                        setTimeout(() => {
                            wallpaperPreview.style.transition = 'opacity 0.5s ease';
                            wallpaperPreview.style.opacity = '1';
                        }, 10);
                        
                        // 保存壁纸到服务器
                        uploadWallpaperToServer(e.target.result, file.name);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        // 在线图片链接获取按钮
        const fetchUrlBtn = document.getElementById('fetchUrlBtn');
        const wallpaperUrl = document.getElementById('wallpaperUrl');
        
        if (fetchUrlBtn && wallpaperUrl) {
            fetchUrlBtn.addEventListener('click', () => {
                const url = wallpaperUrl.value.trim();
                if (!url) {
                    showNotification('请输入有效的图片URL', 'error');
                    return;
                }
                
                // 显示加载状态
                showNotification('正在获取在线图片...', 'success');
                
                // 预加载图片确保能够加载
                const tempImg = new Image();
                tempImg.onload = function() {
                    // 使用提供的URL作为壁纸
                    saveWallpaper(url);
                    
                    // 显示预览
                    wallpaperPreview.src = url;
                    wallpaperPreview.style.display = 'block';
                    
                    // 优雅淡入效果
                    wallpaperPreview.style.opacity = '0';
                    setTimeout(() => {
                        wallpaperPreview.style.transition = 'opacity 0.5s ease';
                        wallpaperPreview.style.opacity = '1';
                    }, 10);
                    
                    // 切换到上传标签页显示预览
                    document.querySelectorAll('.wallpaper-tab').forEach(tab => {
                        tab.classList.remove('active');
                    });
                    document.querySelector('.wallpaper-tab[data-tab="upload"]').classList.add('active');
                    
                    document.querySelectorAll('.wallpaper-tab-pane').forEach(pane => {
                        pane.classList.remove('active');
                    });
                    document.getElementById('uploadPane').classList.add('active');
                    
                    showNotification('在线图片已设置为壁纸', 'success');
                };
                
                tempImg.onerror = function() {
                    showNotification('无法加载此图片，请检查URL是否有效', 'error');
                };
                
                tempImg.src = url;
            });
        }
        
        // 清除当前壁纸
        const clearCurrentWallpaperBtn = document.getElementById('clearCurrentWallpaper');
        if (clearCurrentWallpaperBtn) {
            clearCurrentWallpaperBtn.addEventListener('click', () => {
                // 添加确认弹窗
                if (confirm('确定要恢复默认背景吗？')) {
                    document.body.style.backgroundImage = '';
                    document.body.style.backgroundColor = '';
                    currentWallpaper = '';
                    localStorage.removeItem('currentWallpaper');
                    updateWallpaperHistory();
                    showNotification('已恢复默认背景', 'success');
                }
            });
        }
        
        // 清除所有壁纸
        const clearAllWallpapersBtn = document.getElementById('clearAllWallpapers');
        if (clearAllWallpapersBtn) {
            clearAllWallpapersBtn.addEventListener('click', () => {
                if (confirm('确定要删除所有壁纸吗？此操作不可恢复。')) {
                    // 删除所有服务器壁纸
                    wallpapers.forEach(wallpaper => {
                        if (!wallpaper.startsWith('http')) {
                            // 只删除保存在服务器上的壁纸
                            const filename = wallpaper.split('/').pop();
                            deleteWallpaperFromServer(filename);
                        }
                    });
                    
                    // 清空本地数据
                    wallpapers = [];
                    localStorage.removeItem('wallpapers');
                    
                    // 清除当前壁纸
                    document.body.style.backgroundImage = '';
                    document.body.style.backgroundColor = '';
                    currentWallpaper = '';
                    localStorage.removeItem('currentWallpaper');
                    
                    // 更新UI
                    updateWallpaperHistory();
                    showNotification('已清除所有壁纸', 'success');
                }
            });
        }
        
        // 更新壁纸历史
        updateWallpaperHistory();
    }

    /**
     * @function loadWallpapersFromServer
     * @description 从服务器加载壁纸
     */
    function loadWallpapersFromServer() {
        console.log('正在从服务器加载壁纸...');
        fetch('/api/wallpapers')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('壁纸加载成功:', data);
                if (data.wallpapers) {
                    // 合并服务器壁纸与本地存储的壁纸
                    const localWallpapers = JSON.parse(localStorage.getItem('wallpapers') || '[]');
                    
                    // 过滤重复的壁纸
                    const serverWallpapers = data.wallpapers.filter(
                        url => !localWallpapers.includes(url)
                    );
                    
                    wallpapers = [...localWallpapers, ...serverWallpapers];
                    localStorage.setItem('wallpapers', JSON.stringify(wallpapers));
                    
                    // 应用当前壁纸
                    currentWallpaper = localStorage.getItem('currentWallpaper') || '';
                    if (currentWallpaper) {
                        applyCurrentWallpaper();
                    }
                    
                    // 更新UI
                    updateWallpaperHistory();
                }
            })
            .catch(error => {
                console.error('加载壁纸失败:', error);
                // 使用本地存储的壁纸
                wallpapers = JSON.parse(localStorage.getItem('wallpapers') || '[]');
                currentWallpaper = localStorage.getItem('currentWallpaper') || '';
                if (currentWallpaper) {
                    applyCurrentWallpaper();
                }
                updateWallpaperHistory();
            });
    }

    /**
     * @function openWallpaperModal
     * @description 打开壁纸设置模态框
     */
    function openWallpaperModal() {
        // 首先关闭系统设置模态框
        closeModal(elements.settingsModal);
        
        const wallpaperModal = document.getElementById('wallpaperModal');
        wallpaperModal.style.display = 'block';
        
        // 添加淡入动画
        setTimeout(() => {
            wallpaperModal.classList.add('active');
        }, 10);
        
        // 更新壁纸历史
        updateWallpaperHistory();
    }

    /**
     * @function uploadWallpaperToServer
     * @description 上传壁纸到服务器
     * @param {string} imageData - Base64编码的图片数据
     * @param {string} fileName - 文件名（可选）
     */
    function uploadWallpaperToServer(imageData, fileName) {
        // 检查图片大小
        const estimatedSize = Math.ceil((imageData.length * 3) / 4);
        if (estimatedSize > 10 * 1024 * 1024) { // 10MB
            showNotification('图片过大，请选择小于10MB的图片', 'error');
            return;
        }

        showNotification('正在上传壁纸...', 'success');
        
        fetch('/api/wallpapers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                imageData, 
                fileName: fileName ? sanitizeFileName(fileName) : null 
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // 使用服务器返回的URL
                saveWallpaper(data.wallpaperUrl);
                showNotification('壁纸已上传并应用', 'success');
            } else {
                showNotification(data.error || '上传壁纸失败', 'error');
            }
        })
        .catch(error => {
            console.error('上传壁纸失败:', error);
            // 尝试作为本地壁纸保存
            if (imageData.startsWith('data:image/')) {
                saveWallpaper(imageData);
                showNotification('无法上传到服务器，已保存为本地壁纸', 'error');
            } else {
                showNotification('上传壁纸失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * @function sanitizeFileName
     * @description 清理文件名，去除不安全字符
     * @param {string} fileName - 原始文件名
     * @returns {string} 清理后的文件名
     */
    function sanitizeFileName(fileName) {
        // 移除路径分隔符和其他不安全字符
        return fileName.replace(/[/\\?%*:|"<>]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 100); // 限制文件名长度
    }

    /**
     * @function deleteWallpaperFromServer
     * @description 从服务器删除壁纸
     * @param {string} filename - 壁纸文件名
     */
    function deleteWallpaperFromServer(filename) {
        if (!filename) return;
        
        fetch(`/api/wallpapers/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log(`壁纸 ${filename} 已从服务器删除`);
            } else {
                console.error(`删除壁纸 ${filename} 失败:`, data.error);
            }
        })
        .catch(error => {
            console.error(`删除壁纸 ${filename} 失败:`, error);
        });
    }

    /**
     * @function saveWallpaper
     * @description 保存壁纸
     * @param {string} wallpaperData - 壁纸URL或Base64数据
     */
    function saveWallpaper(wallpaperData) {
        // 保存到本地存储
        if (!wallpapers.includes(wallpaperData)) {
            wallpapers.push(wallpaperData);
            localStorage.setItem('wallpapers', JSON.stringify(wallpapers));
        }
        
        // 设置为当前壁纸
        currentWallpaper = wallpaperData;
        localStorage.setItem('currentWallpaper', currentWallpaper);
        
        // 应用壁纸
        applyCurrentWallpaper();
        
        // 更新壁纸历史
        updateWallpaperHistory();
        
        showNotification('壁纸已保存并应用', 'success');
    }

    /**
     * @function applyCurrentWallpaper
     * @description 应用当前壁纸到页面背景
     */
    function applyCurrentWallpaper() {
        if (currentWallpaper) {
            document.body.style.backgroundImage = `url(${currentWallpaper})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
            document.body.classList.add('has-wallpaper');
        } else {
            // 恢复默认背景
            document.body.style.backgroundImage = '';
            document.body.style.backgroundColor = '';
            document.body.classList.remove('has-wallpaper');
        }
    }

    /**
     * @function updateWallpaperHistory
     * @description 更新壁纸历史列表
     */
    function updateWallpaperHistory() {
        const wallpaperHistoryGrid = document.getElementById('wallpaperHistoryGrid');
        if (!wallpaperHistoryGrid) return;
        
        // 清空历史容器
        wallpaperHistoryGrid.innerHTML = '';
        
        // 如果没有历史壁纸
        if (wallpapers.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-message';
            emptyMsg.innerHTML = '<i class="fas fa-image" style="font-size: 48px; opacity: 0.3; margin-bottom: 15px;"></i><br>暂无历史壁纸';
            wallpaperHistoryGrid.appendChild(emptyMsg);
            return;
        }
        
        // 添加历史壁纸项
        wallpapers.forEach((wallpaperData, index) => {
            const wallpaperItem = document.createElement('div');
            wallpaperItem.className = 'wallpaper-item';
            if (wallpaperData === currentWallpaper) {
                wallpaperItem.classList.add('active');
            }
            
            const img = document.createElement('img');
            img.src = wallpaperData;
            img.alt = `壁纸 ${index + 1}`;
            img.loading = 'lazy'; // 使用懒加载提高性能
            
            // 添加删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止冒泡，避免触发壁纸项的点击事件
                
                // 添加删除动画
                wallpaperItem.style.animation = 'fadeOut 0.3s forwards';
                
                // 延迟删除操作以配合动画
                setTimeout(() => {
                    // 如果是服务器上的壁纸，从服务器删除
                    if (wallpaperData.startsWith('/images/wallpapers/')) {
                        const filename = wallpaperData.split('/').pop();
                        deleteWallpaperFromServer(filename);
                    }
                    
                    // 从列表中删除
                    wallpapers = wallpapers.filter(item => item !== wallpaperData);
                    localStorage.setItem('wallpapers', JSON.stringify(wallpapers));
                    
                    // 如果删除的是当前壁纸，则清除当前壁纸
                    if (wallpaperData === currentWallpaper) {
                        currentWallpaper = '';
                        localStorage.removeItem('currentWallpaper');
                        document.body.style.backgroundImage = '';
                        document.body.style.backgroundColor = '';
                        document.body.classList.remove('has-wallpaper');
                    }
                    
                    // 更新历史显示
                    updateWallpaperHistory();
                    showNotification('壁纸已删除', 'success');
                }, 300);
            });
            
            wallpaperItem.appendChild(img);
            wallpaperItem.appendChild(deleteBtn);
            
            // 点击选择壁纸
            wallpaperItem.addEventListener('click', () => {
                // 显示加载状态
                showNotification('正在应用壁纸...', 'success');
                
                // 添加高亮动画
                const activeItems = document.querySelectorAll('.wallpaper-item.active');
                activeItems.forEach(item => item.classList.remove('active'));
                
                // 添加淡入动画
                wallpaperItem.classList.add('active');
                wallpaperItem.style.animation = 'pulse 0.5s';
                setTimeout(() => {
                    wallpaperItem.style.animation = '';
                }, 500);
                
                currentWallpaper = wallpaperData;
                localStorage.setItem('currentWallpaper', currentWallpaper);
                applyCurrentWallpaper();
                updateWallpaperHistory(); // 更新选中状态
                showNotification('壁纸已应用', 'success');
            });
            
            // 添加淡入动画
            wallpaperItem.style.opacity = '0';
            wallpaperItem.style.transform = 'translateY(20px)';
            
            wallpaperHistoryGrid.appendChild(wallpaperItem);
            
            // 错开显示每个壁纸，创造瀑布流效果
            setTimeout(() => {
                wallpaperItem.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                wallpaperItem.style.opacity = '1';
                wallpaperItem.style.transform = 'translateY(0)';
            }, index * 50);
        });
    }

    /**
     * @function testCategoryManagement
     * @description 测试分类管理相关元素是否存在
     */
    function testCategoryManagement() {
        console.log('测试分类管理功能...');
        
        const categoryPane = document.getElementById('categoryPane');
        console.log('分类管理面板存在:', !!categoryPane);
        
        const btnAddCategory = document.getElementById('btnAddCategory');
        console.log('添加分类按钮存在:', !!btnAddCategory);
        
        const categoriesList = document.getElementById('settingsCategoriesList');
        console.log('分类列表容器存在:', !!categoriesList);
        
        const settingsTab = document.querySelector('.settings-tab[data-tab="category"]');
        console.log('分类管理标签存在:', !!settingsTab);
        
        // 尝试修复问题：确保分类管理面板是可见的
        document.querySelectorAll('.settings-tab').forEach(tab => {
            // 为标签按钮添加明确的点击处理函数
            tab.onclick = function() {
                console.log('点击标签:', tab.dataset.tab);
                
                // 移除所有标签的活动状态
                document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // 隐藏所有面板
                document.querySelectorAll('.settings-pane').forEach(pane => pane.classList.remove('active'));
                
                // 显示对应面板
                const paneId = tab.dataset.tab + 'Pane';
                const pane = document.getElementById(paneId);
                if (pane) {
                    pane.classList.add('active');
                    console.log('激活面板:', paneId);
                    
                    // 如果是分类面板，加载分类列表
                    if (tab.dataset.tab === 'category') {
                        loadCategoriesList('settingsCategoriesList');
                    }
                } else {
                    console.error('找不到面板:', paneId);
                }
            };
        });
    }

    /**
     * 检查页面中是否存在重复ID
     */
    function checkDuplicateIds() {
        console.log('开始检查页面中是否存在重复ID...');
        
        const allElements = document.querySelectorAll('[id]');
        const idCounts = {};
        
        allElements.forEach(el => {
            const id = el.id;
            if (idCounts[id]) {
                idCounts[id]++;
                console.error('发现重复ID:', id, '出现了', idCounts[id], '次');
                console.error('重复ID元素:', el);
            } else {
                idCounts[id] = 1;
            }
        });
        
        // 检查特定ID
        const settingsCategoriesListElements = document.querySelectorAll('#settingsCategoriesList');
        console.log('settingsCategoriesList元素数量:', settingsCategoriesListElements.length);
        settingsCategoriesListElements.forEach(el => {
            console.log('- settingsCategoriesList元素:', el);
        });
        
        const manageCategoriesListElements = document.querySelectorAll('#manageCategoriesList');
        console.log('manageCategoriesList元素数量:', manageCategoriesListElements.length);
        manageCategoriesListElements.forEach(el => {
            console.log('- manageCategoriesList元素:', el);
        });
        
        console.log('重复ID检查完毕');
    }
})(); 