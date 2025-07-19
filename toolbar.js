//插件名: 编辑器工具栏/批量编辑的体验优化
//版本: v1.2
//最近更新日期: 2025.7.13
//作者:少侠
//联系方式:572378589

(() => {
    // =============================================================
    //              1. 全局配置中心 (TE_CONFIG) - 用户配置区
    // =============================================================

    const TE_CONFIG = {
        /**
         * 功能总开关
         */
        featureToggles: {
            toolbarEnhancer: true,
            batchEdit: true,
            recentColorButton: true
        },

        /**
         * 功能调试日志开关
         */
        debugToggles: {
            toolbarEnhancer: false,
            batchEdit: false,
            recentColorButton: false
        },

        /**
         * CSS 选择器配置
         */
        CSS: {
            toolbar: '.protyle-toolbar',
            focusedTab: '.layout-tab-bar .item--focus',
            protyleWysiwyg: '.protyle-wysiwyg',
        },

        /**
         * API 路径配置
         */
        API: {
            updateBlock: '/api/block/updateBlock',
            insertBlock: '/api/block/insertBlock',
            deleteBlock: '/api/block/deleteBlock',
        },

        /**
         * 功能特定配置
         */
        FEATURES: {
            // 预留
        }
    };

    // =============================================================
    //                     2. 核心工具 (通常无需修改)
    // =============================================================

    const Logger = {
        log(moduleId, ...args) {
            if (TE_CONFIG.debugToggles[moduleId]) {
                console.log(`[工具编辑器][${moduleId}]`, ...args);
            }
        },
        error(moduleId, ...args) {
            console.error(`[工具编辑器][${moduleId}]`, ...args);
        }
    };

    function waitForElement(selector, timeout = 2000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                const element = document.querySelector(selector);
                if (element) { resolve(element); }
                else if (Date.now() - startTime > timeout) { reject(new Error(`Element "${selector}" not found.`)); }
                else { requestAnimationFrame(check); }
            };
            check();
        });
    }

    function showToast(message, duration = 2000) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background-color: var(--b3-menu-background);
            color: var(--b3-theme-on-background);
            padding: 8px 16px;
            border-radius: 4px;
            z-index: 10001;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            opacity: 0;
            transition: opacity 0.3s ease-out;
            pointer-events: none;
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '1';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    }

    // =============================================================
    //                     3. 功能模块定义区
    // =============================================================

    /**
     * 工具栏增强模块（不含批量编辑和最近颜色按钮）
     */
    const ToolbarEnhancerModule = {
        id: 'toolbarEnhancer',
        name: '工具栏增强',
        get enabled() { return TE_CONFIG.featureToggles[this.id]; },
        log(...args) { Logger.log(this.id, ...args); },
        error(...args) { Logger.error(this.id, ...args); },

        // --- 静态按钮HTML模板 ---
        turnIntoHTML: `
        <div class="HZ-new-turnInto">
            <button class="b3-menu__item" aria-label="段落"><svg><use xlink:href="#iconParagraph"></use></svg></button>
            <button class="b3-menu__item" aria-label="无序列表"><svg><use xlink:href="#iconList"></use></svg></button>
            <button class="b3-menu__item" aria-label="有序列表"><svg><use xlink:href="#iconOrderedList"></use></svg></button>
            <button class="b3-menu__item" aria-label="任务列表"><svg><use xlink:href="#iconCheck"></use></svg></button>
            <button class="b3-menu__item" aria-label="引述"><svg><use xlink:href="#iconQuote"></use></svg></button>
            <button class="b3-menu__item" aria-label="一级标题"><svg><use xlink:href="#iconH1"></use></svg></button>
            <button class="b3-menu__item" aria-label="二级标题"><svg><use xlink:href="#iconH2"></use></svg></button>
            <button class="b3-menu__item" aria-label="三级标题"><svg><use xlink:href="#iconH3"></use></svg></button>
            <button class="b3-menu__item" aria-label="四级标题"><svg><use xlink:href="#iconH4"></use></svg></button>
            <button class="b3-menu__item" aria-label="五级标题"><svg><use xlink:href="#iconH5"></use></svg></button>
            <button class="b3-menu__item" aria-label="六级标题"><svg><use xlink:href="#iconH6"></use></svg></button>
        </div>
        `,

        // --- Markdown转换规则 ---
        markdownPrefixMap: {
            "段落": "", "一级标题": "# ", "二级标题": "## ", "三级标题": "### ",
            "四级标题": "#### ", "五级标题": "##### ", "六级标题": "###### ",
            "无序列表": "* ", "有序列表": "1. ", "任务列表": "* [ ] ", "引述": "> ",
            "代码块": "```\n",
        },

        // --- 显示规则 ---
        buttonMap: {
            paragraph: ["段落", "一级标题", "二级标题", "三级标题", "其他标题...", "有序列表", "无序列表", "任务列表", "代码块", "引述", "separator-sup", "上标", "下标"],
            heading: ["段落", "引述", "一级标题", "二级标题", "三级标题", "其他标题...", "代码块"],
            list: [],
            Task: [],
            table: []
        },

        CUSTOM_BUTTON_CLASS: 'custom-toolbar-btn',
        processedEditors: new Set(),

        /**
         * 初始化模块
         */
        init() {
            this.log('模块已启动，开始监控编辑器状态...');

            // ====== 注入高亮块样式 ======
            const highlightBlockStyleId = 'custom-highlight-block-style';
            if (!document.getElementById(highlightBlockStyleId)) {
                const style = document.createElement('style');
                style.id = highlightBlockStyleId;
                style.innerHTML = `
                    div[data-subtype="highlight-block"] {
                        background-color: #eaf3ff !important;
                        border: 1px solid #b3d4ff !important;
                        border-radius: 6px !important;
                        padding: 12px 16px 12px 48px !important;
                        margin: 1em 0 !important;
                        position: relative !important;
                    }
                    div[data-subtype="highlight-block"]::before {
                        content: '';
                        position: absolute;
                        left: 16px;
                        top: 13px;
                        width: 20px;
                        height: 20px;
                        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234299E1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cline x1='12' y1='16' x2='12' y2='12'%3E%3C/line%3E%3Cline x1='12' y1='8' x2='12.01' y2='8'%3E%3C/line%3E%3C/svg%3E");
                        background-size: contain;
                        background-repeat: no-repeat;
                    }
                `;
                document.head.appendChild(style);
            }

            this.observeEditor();
            setInterval(() => this.findAndInitializeActiveEditor(), 2000);
            setTimeout(() => this.findAndInitializeActiveEditor(), 500);

            // Close dropdown on outside click
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.custom-toolbar-btn') && !e.target.closest('.custom-toolbar-dropdown-menu')) {
                    document.querySelectorAll('.custom-toolbar-dropdown-menu').forEach(menu => {
                        menu.style.display = 'none';
                    });
                }
            });

            // ====== 插入下拉菜单hover高亮样式 ======
            const dropdownStyle = document.createElement('style');
            dropdownStyle.innerHTML = `
            .custom-toolbar-dropdown-menu .b3-menu__item:hover {
                background: var(--b3-list-background-hover, #e5e6eb) !important;
            }
            `;
            document.head.appendChild(dropdownStyle);

            // ====== 增加编辑器内边距 ======
            const editorPaddingStyleId = 'custom-editor-padding-style';
            if (!document.getElementById(editorPaddingStyleId)) {
                const style = document.createElement('style');
                style.id = editorPaddingStyleId;
                style.innerHTML = `
                    .protyle-wysiwyg {
                        padding-top: 24px !important;
                        padding-bottom: 48px !important;
                    }
                `;
                document.head.appendChild(style);
            }

            // ====== 隐藏原生按钮 ======
            const hideNativeButtonsStyleId = 'custom-hide-native-buttons-style';
            if (!document.getElementById(hideNativeButtonsStyleId)) {
                const style = document.createElement('style');
                style.id = hideNativeButtonsStyleId;
                style.innerHTML = `
                    .protyle-toolbar button[data-type="sup"],
                    .protyle-toolbar button[data-type="sub"],
                    .protyle-toolbar button[data-type="mark"] {
                        display: none !important;
                    }
                `;
                document.head.appendChild(style);
            }

            // ====== 自定义按钮样式 ======
            const customButtonStyleId = 'custom-button-style';
            if (!document.getElementById(customButtonStyleId)) {
                const style = document.createElement('style');
                style.id = customButtonStyleId;
                style.innerHTML = `
                    .protyle-toolbar button.custom-toolbar-btn, .protyle-toolbar .custom-toolbar-btn-group {
                        margin: 0 2px !important;
                    }
                    .protyle-toolbar__item svg {
                        transition: transform 0.2s ease-in-out;
                    }
                    .protyle-toolbar__item.is-active > svg:last-of-type {
                        transform: rotate(180deg);
                    }
                `;
                document.head.appendChild(style);
            }
        },

        /**
         * 监听DOM变化，自动初始化编辑器
         */
        observeEditor() {
            const observer = new MutationObserver(() => {
                this.findAndInitializeActiveEditor();
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        },

        /**
         * 查找当前激活的编辑器并初始化
         */
        findAndInitializeActiveEditor() {
            const focusedTab = document.querySelector(TE_CONFIG.CSS.focusedTab);
            if (!focusedTab) return;
            const tabId = focusedTab.dataset.id;
            if (!tabId) return;
            const activeEditor = document.querySelector(`.protyle[data-id="${tabId}"] ${TE_CONFIG.CSS.protyleWysiwyg}`);
            if (activeEditor) {
                this.initializeToolbarForEditor(activeEditor);
            }
        },

        /**
         * 为编辑器绑定点击事件，动态插入自定义按钮
         */
        initializeToolbarForEditor(editor) {
            if (!editor || this.processedEditors.has(editor)) return;
            this.processedEditors.add(editor);
            this.log('已处理编辑器集合:', this.processedEditors);
            editor.addEventListener('click', (e) => {
                if (e.target.closest(TE_CONFIG.CSS.toolbar)) return;
                setTimeout(() => {
                    const block = e.target.closest('[data-node-id]');
                    if (!block) {
                        this.clearCustomButtons();
                        return;
                    }
                    const type = this.getBlockType(block);
                    if (type) {
                        this.addCustomButtonsToToolbar(type, block);
                    } else {
                        this.clearCustomButtons();
                    }
                }, 50);
            });
        },

        /**
         * 获取块类型
         */
        getBlockType(el) {
            if (!el) return null;

            // 优先检查是否在列表项上下文中
            const parentListItem = el.closest('[data-type="NodeListItem"]');
            if (parentListItem) {
                const isTask = parentListItem.querySelector(':scope > .protyle-action--task');
                return isTask ? 'Task' : 'list';
            }

            // 如果不在列表中，则根据块自身类型判断
            const type = el.getAttribute('data-type');
            if (type === 'NodeTable') return 'table';
            if (type === 'NodeList') return 'list';
            if (type === 'NodeHeading') return 'heading';
            if (type === 'NodeBlockquote') return 'paragraph';
            if (type === 'NodeParagraph') {
                // 这里的 .protyle-action 检查是为了排除非内容的块，如代码块语言指示器
                const prev = el.previousElementSibling;
                if (prev && prev.classList.contains('protyle-action')) {
                    return null;
                }
                return 'paragraph';
            }

            return null;
        },

        /**
         * 清除自定义按钮
         */
        clearCustomButtons() {
            document.querySelectorAll(`.${this.CUSTOM_BUTTON_CLASS}, .custom-toolbar-divider, .custom-appearance-group, .custom-toolbar-btn-group`).forEach(node => node.remove());
        },

        /**
         * 获取静态按钮节点
         */
        getSourceButtons() {
            const container = document.createElement('div');
            container.innerHTML = this.turnIntoHTML;
            return container.querySelectorAll('button');
        },

        /**
         * 向工具栏插入自定义按钮
         */
        addCustomButtonsToToolbar(type, blockEl) {
            const protyleEl = blockEl.closest('.protyle');
            if (!protyleEl) { return; }
            const toolbar = protyleEl.querySelector(TE_CONFIG.CSS.toolbar);
            if (!toolbar) { return; }
            if (toolbar.querySelector(`.${this.CUSTOM_BUTTON_CLASS}, .custom-toolbar-btn-group`) && toolbar.dataset.activeBlockId === blockEl.dataset.nodeId) {
                return;
            }
            this.clearCustomButtons();
            toolbar.dataset.activeBlockId = blockEl.dataset.nodeId;

            // --- 1. 创建所有自定义按钮 ---
            const typeSwitcherBtn = this.createTypeSwitcher(type, blockEl);
            const layoutButton = this.createLayoutButton(blockEl, toolbar);
            const superBlockButtonGroup = this.createSuperBlockButton(blockEl, toolbar);
            const insertTableBtn = this.createInsertTableButton(type, blockEl);

            const createDivider = () => {
                const d = document.createElement('div');
                d.className = 'protyle-toolbar__divider custom-toolbar-divider';
                return d;
            };

            // --- 2. 按照新顺序组装并前置核心按钮 ---
            const startElements = [];
            if (typeSwitcherBtn) {
                startElements.push(typeSwitcherBtn);
                startElements.push(createDivider());
            }
            if (layoutButton) {
                startElements.push(layoutButton);
                startElements.push(createDivider());
            }

            if (startElements.length > 0) {
                toolbar.prepend(...startElements);
            }

            // --- 3. 处理其余按钮 ---

            // C. 外观按钮 (由模块自行管理)
            if (TE_CONFIG.featureToggles.recentColorButton && typeof RecentColorButtonModule !== 'undefined' && RecentColorButtonModule.enabled) {
                RecentColorButtonModule.insertCustomAppearanceButtons(toolbar);
            }

            // D. 超级块按钮 (放到外观按钮组的后面)
            if (superBlockButtonGroup) {
                const appearanceGroup = toolbar.querySelector('.custom-appearance-group');
                if (appearanceGroup) {
                    appearanceGroup.insertAdjacentElement('afterend', superBlockButtonGroup);
                } else { // Fallback
                    const layoutBtn = toolbar.querySelector('[aria-label="布局"]');
                    if (layoutBtn) {
                        layoutBtn.insertAdjacentElement('afterend', superBlockButtonGroup);
                    } else {
                        toolbar.prepend(superBlockButtonGroup);
                    }
                }

                // 在超级块按钮后添加分割线
                const divider = document.createElement('div');
                divider.className = 'protyle-toolbar__divider custom-toolbar-divider';
                superBlockButtonGroup.insertAdjacentElement('afterend', divider);
            }

            // E. 插入表格按钮 (放到删除线按钮后, 无左侧分隔符)
            if (insertTableBtn) {
                const strikeButton = toolbar.querySelector('button[data-type="s"]');
                if (strikeButton) {
                    strikeButton.insertAdjacentElement('afterend', insertTableBtn);
                } else { // Fallback
                    const lastCustomButton = toolbar.querySelector('.custom-toolbar-btn-group') || toolbar.querySelector('[aria-label="布局"]');
                    if (lastCustomButton) {
                        lastCustomButton.insertAdjacentElement('afterend', insertTableBtn);
                    }
                }
            }

            // F. 标记按钮 (右侧加分隔符) - 已根据新需求移除
        },

        createTypeSwitcher(type, blockEl) {
            const toAdd = this.buttonMap[type];
            if (!toAdd || toAdd.length === 0) return null;

            const typeMenuItems = toAdd.map(label => {
                let icon = '#iconParagraph';
                if (label.includes('无序')) icon = '#iconList';
                else if (label.includes('有序')) icon = '#iconOrderedList';
                else if (label.includes('引述')) icon = '#iconQuote';
                else if (label.includes('代码块')) icon = '#iconCode';
                else if (label.includes('一级')) icon = '#iconH1';
                else if (label.includes('二级')) icon = '#iconH2';
                else if (label.includes('三级')) icon = '#iconH3';
                else if (label.includes('四级')) icon = '#iconH4';
                else if (label.includes('五级')) icon = '#iconH5';
                else if (label.includes('六级')) icon = '#iconH6';
                else if (label.includes('上标')) icon = '#iconSup';
                else if (label.includes('下标')) icon = '#iconSub';
                return { label, icon };
            });

            const typeSwitcherBtn = document.createElement('button');
            typeSwitcherBtn.className = 'protyle-toolbar__item b3-tooltips b3-tooltips__n custom-toolbar-btn';
            typeSwitcherBtn.setAttribute('aria-label', '类型切换');
            typeSwitcherBtn.style.cssText = `
                min-width: auto; padding: 0 8px; display: flex; align-items: center;
                gap: 4px; height: 28px;
            `;
            typeSwitcherBtn.innerHTML = `
                <span style="font-size: 16px; font-weight: 500; font-family: 'Times New Roman', serif; line-height: 1;">T</span>
                <svg style="width:12px;height:12px;"><use xlink:href="#iconDown"></use></svg>
            `;

            const dropdown = document.createElement('div');
            dropdown.className = 'custom-toolbar-dropdown-menu';
            dropdown.style.cssText = `
                position: absolute; z-index: 9999; background: var(--b3-menu-background);
                border: 1px solid var(--b3-border-color); border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                padding: 4px 0; display: none; min-width: 180px; max-height: 260px; overflow-y: auto;
            `;

            typeMenuItems.forEach(item => {
                if (item.label === 'separator-sup') {
                    const separator = document.createElement('div');
                    separator.className = 'b3-menu__separator';
                    dropdown.appendChild(separator);
                    return;
                }

                const btn = document.createElement('button');
                btn.className = 'b3-menu__item';
                btn.setAttribute('aria-label', item.label);
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.fontSize = '13px';

                if (item.label === '其他标题...') {
                    btn.innerHTML = `<svg style="margin-right:6px;width:18px;height:18px;"><use xlink:href="${item.icon}"></use></svg>${item.label}<svg class="b3-menu__icon b3-menu__icon--small" style="margin-left:auto;"><use xlink:href="#iconRight"></use></svg>`;

                    const submenu = this.createSubmenu(['四级标题', '五级标题', '六级标题'], blockEl, dropdown);
                    document.body.appendChild(submenu); // 修复：附加到body，而不是按钮

                    let hideTimeout;

                    const showSubmenu = () => {
                        clearTimeout(hideTimeout);
                        document.querySelectorAll('.custom-toolbar-submenu').forEach(sm => {
                            if (sm !== submenu) sm.style.display = 'none';
                        });
                        const parentRect = btn.getBoundingClientRect();
                        submenu.style.display = 'block';
                        submenu.style.left = `${parentRect.right + 2}px`;
                        submenu.style.top = `${parentRect.top}px`;
                    };

                    const hideSubmenu = (delay = 200) => {
                        hideTimeout = setTimeout(() => {
                            submenu.style.display = 'none';
                        }, delay);
                    };

                    btn.addEventListener('mouseenter', showSubmenu);
                    btn.addEventListener('mouseleave', () => hideSubmenu());

                    submenu.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
                    submenu.addEventListener('mouseleave', () => hideSubmenu(0));

                } else {
                    btn.innerHTML = `<svg style="margin-right:6px;width:18px;height:18px;"><use xlink:href="${item.icon}"></use></svg>${item.label}`;
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        dropdown.style.display = 'none';

                        if (item.label === '上标' || item.label === '下标') {
                            this.applySupSub(item.label, blockEl);
                            return;
                        }

                        const toolbar = blockEl.closest('.protyle')?.querySelector(TE_CONFIG.CSS.toolbar);
                        if (toolbar) toolbar.style.display = 'none';

                        // 修正：优先处理在引用块内的转换
                        const parentBlockquote = blockEl.closest('[data-type="NodeBlockquote"]');
                        if (parentBlockquote && item.label !== '引述') {
                            showToast('正在转换引用块...', 1500);
                            const blockId = parentBlockquote.dataset.nodeId;

                            // 获取引用块内所有可编辑区域的文本内容
                            const contentDivs = Array.from(parentBlockquote.querySelectorAll('[contenteditable="true"]'));
                            const content = contentDivs.map(div => div.textContent.trim()).filter(Boolean).join('\\n');

                            const newMarkdown = this.markdownPrefixMap[item.label] + content;

                            try {
                                await fetch(TE_CONFIG.API.insertBlock, {
                                    method: 'POST',
                                    body: JSON.stringify({ dataType: 'markdown', data: newMarkdown, previousID: blockId }),
                                });
                                await new Promise(resolve => setTimeout(resolve, 100)); // 等待DOM更新
                                await fetch(TE_CONFIG.API.deleteBlock, {
                                    method: 'POST',
                                    body: JSON.stringify({ id: blockId }),
                                });
                            } catch (error) {
                                this.error('转换引用块时出错:', error);
                                showToast('转换引用块失败');
                            }
                            return; // 任务结束
                        }

                        // 原有转换逻辑 (处理非引用块或转为引用块的情况)
                        const blockId = blockEl.dataset.nodeId;
                        const prefix = this.markdownPrefixMap[item.label];
                        if (prefix === undefined || !blockId) return;

                        const contentDiv = blockEl.querySelector(`[data-node-id="${blockId}"] [contenteditable="true"]`);
                        if (!contentDiv) return;

                        let currentText = contentDiv.textContent || "";
                        const currentPrefixMatch = currentText.match(/^(\\#+\\s|\\*\\s|\\d+\\.\\s|\\>\\s|\\*\\s\\[\\s\\]\\s)/);
                        if (currentPrefixMatch) {
                            currentText = currentText.substring(currentPrefixMatch[0].length);
                        }

                        const newMarkdown = prefix + currentText;
                        const payload = { "dataType": "markdown", "data": newMarkdown, "id": blockId };

                        try {
                            await fetch(TE_CONFIG.API.updateBlock, { method: 'POST', body: JSON.stringify(payload) });
                        } catch (error) {
                            this.error('发送API请求时出错:', error);
                        }
                    });
                }
                dropdown.appendChild(btn);
            });

            this._setupDropdownInteraction(typeSwitcherBtn, dropdown);

            return typeSwitcherBtn;
        },

        createSubmenu(items, blockEl, mainDropdown) {
            const submenu = document.createElement('div');
            submenu.className = 'custom-toolbar-dropdown-menu custom-toolbar-submenu'; // 添加一个用于选择的类
            submenu.style.position = 'absolute';
            submenu.style.display = 'none';
            submenu.style.minWidth = '120px';
            submenu.style.zIndex = '10000'; // 确保在主菜单之上

            items.forEach(label => {
                const btn = document.createElement('button');
                btn.className = 'b3-menu__item';
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.fontSize = '13px';

                let icon = '';
                if (label === '四级标题') icon = '#iconH4';
                if (label === '五级标题') icon = '#iconH5';
                if (label === '六级标题') icon = '#iconH6';

                btn.innerHTML = `<svg style="margin-right:6px;width:18px;height:18px;"><use xlink:href="${icon}"></use></svg>${label}`;

                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    submenu.style.display = 'none';
                    if (mainDropdown) {
                        mainDropdown.style.display = 'none'; // 修复：关闭主菜单
                    }

                    const prefix = this.markdownPrefixMap[label];
                    const blockId = blockEl.dataset.nodeId;
                    const contentDiv = blockEl.querySelector(`[data-node-id="${blockId}"] [contenteditable="true"]`);
                    if (!prefix || !contentDiv || !blockId) return;

                    let currentText = contentDiv.textContent || "";
                    const currentPrefixMatch = currentText.match(/^(\#+\s|\*\s|\d+\.\s|\>\s|\*\s\[\s\]\s)/);
                    if (currentPrefixMatch) {
                        currentText = currentText.substring(currentPrefixMatch[0].length);
                    }
                    const newMarkdown = prefix + currentText;
                    const payload = { "dataType": "markdown", "data": newMarkdown, "id": blockId };
                    try {
                        await fetch(TE_CONFIG.API.updateBlock, { method: 'POST', body: JSON.stringify(payload) });
                        const toolbar = blockEl.closest('.protyle')?.querySelector(TE_CONFIG.CSS.toolbar);
                        if (toolbar) toolbar.style.display = 'none';
                    } catch (error) { this.error('发送API请求时出错:', error); }
                });
                submenu.appendChild(btn);
            });
            return submenu;
        },

        async applySupSub(type, blockEl) {
            const protyleEl = blockEl.closest('.protyle');
            if (!protyleEl) {
                this.error('无法找到 Protyle 元素');
                return;
            }

            const toolbar = protyleEl.querySelector(TE_CONFIG.CSS.toolbar);
            if (!toolbar) {
                this.error('无法找到工具栏');
                return;
            }

            const dataType = type === '上标' ? 'sup' : 'sub';
            const nativeButton = toolbar.querySelector(`button[data-type="${dataType}"]`);

            if (nativeButton) {
                this.log(`找到并点击原生 ${type} 按钮`);
                nativeButton.click();
            } else {
                this.error(`未找到原生 ${type} 按钮。`);
                showToast(`无法应用 ${type}，未找到对应按钮。`);
            }
        },

        createInsertTableButton(type, blockEl) {
            if (!['paragraph', 'heading', 'list', 'Task'].includes(type)) return null;

            const insertTableBtn = document.createElement('button');
            insertTableBtn.className = 'protyle-toolbar__item b3-tooltips b3-tooltips__n ' + this.CUSTOM_BUTTON_CLASS;
            insertTableBtn.setAttribute('aria-label', '插入表格');
            insertTableBtn.innerHTML = '<svg><use xlink:href="#iconTable"></use></svg>';

            insertTableBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                const toolbar = blockEl.closest('.protyle')?.querySelector(TE_CONFIG.CSS.toolbar);
                if (toolbar) {
                    toolbar.style.display = 'none';
                }

                const editorEl = blockEl.closest(TE_CONFIG.CSS.protyleWysiwyg);
                const contentEl = blockEl.querySelector('[contenteditable="true"]');
                if (editorEl && contentEl) {
                    contentEl.focus();
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(contentEl);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);

                    setTimeout(() => {
                        editorEl.dispatchEvent(new KeyboardEvent('keydown', {
                            key: 'o', code: 'KeyO', ctrlKey: true, bubbles: true,
                            cancelable: true, keyCode: 79, which: 79
                        }));
                    }, 100);
                }
            });
            return insertTableBtn;
        },

        createSuperBlockButton(blockEl, toolbar) {
            const blockId = blockEl.dataset.nodeId;
            if (!blockId) return null;

            const STORAGE_KEY = 'superBlockBgColor';
            const DEFAULT_COLOR = 'var(--b3-font-background3)';

            if (!localStorage.getItem(STORAGE_KEY)) {
                localStorage.setItem(STORAGE_KEY, DEFAULT_COLOR);
            }

            const superBlockBtn = document.createElement('button');
            superBlockBtn.className = 'protyle-toolbar__item b3-tooltips b3-tooltips__n ' + this.CUSTOM_BUTTON_CLASS;
            superBlockBtn.setAttribute('aria-label', '设置高亮背景');
            superBlockBtn.innerHTML = '<svg><use xlink:href="#iconSuper"></use></svg>';

            const dropdown = this.createSuperBlockColorPicker(blockEl, (newColor) => {
                localStorage.setItem(STORAGE_KEY, newColor);
                dropdown.style.display = 'none';
            });

            superBlockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (dropdown.style.display === 'block') {
                    dropdown.style.display = 'none';
                    return;
                }

                document.querySelectorAll('.custom-toolbar-dropdown-menu').forEach(menu => menu.style.display = 'none');

                // 先附加到 DOM 以计算尺寸
                document.body.appendChild(dropdown);
                dropdown.style.visibility = 'hidden';
                dropdown.style.display = 'block';

                const rect = superBlockBtn.getBoundingClientRect();
                const dropdownRect = dropdown.getBoundingClientRect();

                let top = rect.bottom + 2;
                // 如果下方空间不足，且上方空间充足，则在上方显示
                if ((top + dropdownRect.height > window.innerHeight) && (rect.top - dropdownRect.height - 2 > 0)) {
                    top = rect.top - dropdownRect.height - 2;
                }

                dropdown.style.left = rect.left + 'px';
                dropdown.style.top = top + 'px';
                dropdown.style.visibility = 'visible';
            });

            document.addEventListener('click', (e) => {
                if (!superBlockBtn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.style.display = 'none';
                }
            }, true);

            this._setupDropdownInteraction(superBlockBtn, dropdown);

            return superBlockBtn;
        },

        createSuperBlockColorPicker(blockEl, onColorSelected) {
            const dropdown = document.createElement('div');
            dropdown.className = 'custom-toolbar-dropdown-menu';
            dropdown.style.cssText = `
                position: absolute;
                z-index: 9999;
                background: var(--b3-menu-background);
                border: 1px solid var(--b3-border-color);
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                padding: 8px;
                display: none;
                width: 240px;
                height: auto;
            `;

            const colors = [
                'var(--b3-font-background1)', 'var(--b3-font-background2)', 'var(--b3-font-background3)', 'var(--b3-font-background4)',
                'var(--b3-font-background5)', 'var(--b3-font-background6)', 'var(--b3-font-background7)', 'var(--b3-font-background8)',
                'var(--b3-font-background9)', 'var(--b3-font-background10)', 'var(--b3-font-background11)', 'var(--b3-font-background12)',
                'var(--b3-font-background13)', 'transparent'
            ];

            const colorGrid = document.createElement('div');
            colorGrid.style.cssText = 'display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;';

            colors.forEach(color => {
                const colorSquare = document.createElement('button');
                colorSquare.className = 'color__square';
                colorSquare.style.cssText = `
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    border: 1px solid var(--b3-border-color-trans);
                    cursor: pointer;
                    display: inline-block;
                    padding: 0;
                `;
                colorSquare.style.backgroundColor = color;
                if (color === 'transparent') {
                    colorSquare.setAttribute('aria-label', '清除背景');
                    colorSquare.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ff0000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='4' y1='20' x2='20' y2='4'%3E%3C/line%3E%3C/svg%3E")`;
                    colorSquare.style.backgroundSize = '70%';
                    colorSquare.style.backgroundRepeat = 'no-repeat';
                    colorSquare.style.backgroundPosition = 'center';

                }

                colorSquare.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    dropdown.style.display = 'none';

                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = blockEl.outerHTML;
                    const tempBlock = tempDiv.firstChild;
                    if (!tempBlock) return;

                    let style = tempBlock.getAttribute('style') || '';
                    let styleProps = style.split(';').map(s => s.trim()).filter(Boolean);
                    styleProps = styleProps.filter(p => !p.startsWith('background-color'));
                    if (color !== 'transparent') {
                        styleProps.push(`background-color: ${color}`);
                    }

                    if (styleProps.length > 0) {
                        tempBlock.setAttribute('style', styleProps.join('; '));
                    } else {
                        tempBlock.removeAttribute('style');
                    }

                    const payload = { "dataType": "dom", "data": tempBlock.outerHTML, "id": blockEl.dataset.nodeId };
                    try {
                        await fetch(TE_CONFIG.API.updateBlock, { method: 'POST', body: JSON.stringify(payload) });
                        onColorSelected(color);
                    } catch (error) { this.error('设置超级块背景时出错', error); }
                });
                colorGrid.appendChild(colorSquare);
            });

            dropdown.appendChild(colorGrid);
            return dropdown;
        },

        createLayoutButton(blockEl, toolbar) {
            const blockId = blockEl.dataset.nodeId;
            if (!blockId) return null;

            const layoutBtn = document.createElement('button');
            layoutBtn.className = 'protyle-toolbar__item b3-tooltips b3-tooltips__n custom-toolbar-btn';
            layoutBtn.setAttribute('aria-label', '布局');
            layoutBtn.style.cssText = `display: flex; align-items: center; gap: 2px; height: 28px; padding: 0 8px;`;
            layoutBtn.innerHTML = `<svg style="width:16px; height: 16px;"><use xlink:href="#iconAlignLeft"></use></svg><svg style="width:12px;height:12px;"><use xlink:href="#iconDown"></use></svg>`;

            const dropdown = document.createElement('div');
            dropdown.className = 'custom-toolbar-dropdown-menu';
            dropdown.style.cssText = `
                position: absolute;
                z-index: 9999;
                background: var(--b3-menu-background);
                border: 1px solid var(--b3-border-color);
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                padding: 4px 0;
                display: none;
                min-width: 180px;
            `;

            const menuItems = [
                { id: 'alignLeft', label: '居左', icon: '#iconAlignLeft', attrs: { style: 'text-align: left;' } },
                { id: 'alignCenter', label: '居中', icon: '#iconAlignCenter', attrs: { style: 'text-align: center;' } },
                { id: 'alignRight', label: '居右', icon: '#iconAlignRight', attrs: { style: 'text-align: right;' } },
                { id: 'justify', label: '两侧对齐', icon: '#iconMenu', attrs: { style: 'text-align: justify;' } },
                { id: 'separator' },
                { id: 'ltr', label: '从左到右 (LTR)', icon: '#iconLtr', attrs: { direction: 'ltr' } },
                { id: 'rtl', label: '从右到左 (RTL)', icon: '#iconRtl', attrs: { direction: 'rtl' } },
                { id: 'separator' },
                { id: 'clear', label: '清除布局样式', icon: '#iconTrashcan', warning: true, action: 'clear' }
            ];

            menuItems.forEach(item => {
                if (item.id === 'separator') {
                    const separator = document.createElement('div');
                    separator.className = 'b3-menu__separator';
                    dropdown.appendChild(separator);
                    return;
                }

                const btn = document.createElement('button');
                btn.className = 'b3-menu__item';
                if (item.warning) btn.classList.add('b3-menu__item--warning');
                btn.style.cssText = 'display: flex; align-items: center; font-size: 13px;';
                btn.innerHTML = `<svg style="margin-right:6px;width:18px;height:18px;"><use xlink:href="${item.icon}"></use></svg>${item.label}`;

                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    dropdown.style.display = 'none';

                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = blockEl.outerHTML;
                    const tempBlock = tempDiv.firstChild;
                    if (!tempBlock) return;

                    if (item.action === 'clear') {
                        let style = tempBlock.getAttribute('style') || '';
                        let styleProps = style.split(';').map(s => s.trim()).filter(Boolean);
                        styleProps = styleProps.filter(p => !p.startsWith('text-align'));
                        if (styleProps.length > 0) {
                            tempBlock.setAttribute('style', styleProps.join('; '));
                        } else {
                            tempBlock.removeAttribute('style');
                        }
                        tempBlock.removeAttribute('direction');
                    } else if (item.attrs.style) {
                        let style = tempBlock.getAttribute('style') || '';
                        let styleProps = style.split(';').map(s => s.trim()).filter(Boolean);
                        styleProps = styleProps.filter(p => !p.startsWith('text-align'));
                        styleProps.push(item.attrs.style);
                        tempBlock.setAttribute('style', styleProps.join('; '));
                    } else if (item.attrs.direction) {
                        tempBlock.setAttribute('direction', item.attrs.direction);
                    }

                    const payload = { "dataType": "dom", "data": tempBlock.outerHTML, "id": blockId };
                    try {
                        await fetch(TE_CONFIG.API.updateBlock, { method: 'POST', body: JSON.stringify(payload) });
                        if (toolbar) toolbar.style.display = 'none';
                    } catch (error) { this.error('设置布局属性时出错:', error); }
                });
                dropdown.appendChild(btn);
            });

            this._setupDropdownInteraction(layoutBtn, dropdown);

            return layoutBtn;
        },

        _setupDropdownInteraction(button, dropdown) {
            let hoverTimeout;

            button.addEventListener('mouseenter', (e) => {
                hoverTimeout = setTimeout(() => {
                    // Hide all other custom dropdowns and reset their buttons
                    document.querySelectorAll('.custom-toolbar-dropdown-menu').forEach(menu => {
                        if (menu !== dropdown) {
                            menu.style.display = 'none';
                        }
                    });
                    document.querySelectorAll('.protyle-toolbar__item.is-active').forEach(activeBtn => {
                        if (activeBtn !== button) {
                            activeBtn.classList.remove('is-active');
                        }
                    });

                    // Show current dropdown and activate its button
                    const rect = button.getBoundingClientRect();
                    dropdown.style.left = rect.left + 'px';
                    dropdown.style.top = (rect.bottom + 2) + 'px';
                    dropdown.style.display = 'block';
                    button.classList.add('is-active');
                    document.body.appendChild(dropdown);
                }, 500);
            });

            button.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimeout);
                setTimeout(() => {
                    if (!dropdown.matches(':hover')) {
                        dropdown.style.display = 'none';
                        button.classList.remove('is-active');
                    }
                }, 120);
            });

            dropdown.addEventListener('mouseleave', (e) => {
                // 如果鼠标移动到子菜单，则不关闭主菜单
                if (e.relatedTarget && e.relatedTarget.closest('.custom-toolbar-submenu')) {
                    return;
                }
                dropdown.style.display = 'none';
                button.classList.remove('is-active');
            });

            // Ensure clicking an item in the dropdown closes it and resets the button
            dropdown.addEventListener('click', (e) => {
                if (e.target.closest('button')) {
                    dropdown.style.display = 'none';
                    button.classList.remove('is-active');
                }
            });
        },
    };

    /**
     * 批量编辑功能模块
     */
    const BatchEditModule = {
        id: 'batchEdit',
        name: '批量编辑',
        get enabled() { return TE_CONFIG.featureToggles[this.id] !== false; },
        log(...args) { Logger.log(this.id, ...args); },
        error(...args) { Logger.error(this.id, ...args); },

        /**
         * 初始化模块
         */
        init() {
            this.log('批量编辑模块已启动，监听多选与批量工具栏。');
            this.observeMultiSelectToolbar();
            document.addEventListener('mouseup', () => {
                setTimeout(() => {
                    const selectedBlocks = this.getSelectedBlocks();
                    this.log('[多选mouseup] 当前选中块数量:', selectedBlocks.length, selectedBlocks.map(b => b.dataset.nodeId));
                    const focusedTab = document.querySelector(TE_CONFIG.CSS.focusedTab);
                    if (!focusedTab) return;
                    const tabId = focusedTab.dataset.id;
                    if (!tabId) return;
                    const protyle = document.querySelector(`.protyle[data-id="${tabId}"]`);
                    if (!protyle) return;
                    const toolbar = protyle.querySelector(TE_CONFIG.CSS.toolbar);
                    if (!toolbar) return;

                    if (selectedBlocks.length > 1) {
                        let batchToolbar = document.querySelector('.my-batch-toolbar');
                        if (batchToolbar) batchToolbar.remove(); // 强制移除旧的工具栏

                        batchToolbar = document.createElement('div');
                        batchToolbar.className = 'my-batch-toolbar protyle-toolbar';
                        batchToolbar.style.position = 'absolute';
                        batchToolbar.style.zIndex = 9999;
                        batchToolbar.style.display = 'flex';
                        batchToolbar.style.alignItems = 'center';
                        batchToolbar.style.gap = '8px';
                        batchToolbar.style.background = 'var(--b3-toolbar-background, var(--b3-menu-background))';
                        batchToolbar.style.borderRadius = '6px';
                        batchToolbar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
                        batchToolbar.style.padding = '2px 8px';
                        document.body.appendChild(batchToolbar);

                        // 1. 创建并添加颜色按钮
                        if (TE_CONFIG.featureToggles.recentColorButton) {
                            const colorBtn = document.createElement('button');
                            colorBtn.className = 'protyle-toolbar__item b3-tooltips b3-tooltips__n';
                            colorBtn.setAttribute('aria-label', '最近颜色');
                            colorBtn.style.width = '28px';
                            colorBtn.style.height = '28px';
                            colorBtn.style.borderRadius = '4px';
                            colorBtn.style.background = 'var(--b3-menu-background)';
                            colorBtn.style.border = '1px solid var(--b3-border-color)';
                            colorBtn.innerHTML = '<svg style="width:18px;height:18px;"><use xlink:href="#iconFont"></use></svg>';

                            const updateColorBtnAppearance = (lastColor) => {
                                if (!lastColor) return;
                                if (lastColor.type === 'color') {
                                    colorBtn.style.color = lastColor.value;
                                    colorBtn.style.background = '';
                                } else if (lastColor.type === 'backgroundColor') {
                                    colorBtn.style.background = lastColor.value;
                                    colorBtn.style.color = '';
                                } else if (lastColor.type === 'style1' && lastColor.value) {
                                    colorBtn.style.color = lastColor.value.color || '';
                                    colorBtn.style.background = lastColor.value.bg || '';
                                }
                            };

                            const lastColorRaw = localStorage.getItem('recentFontColor');
                            if (lastColorRaw) {
                                try { updateColorBtnAppearance(JSON.parse(lastColorRaw)); } catch (e) { }
                            }

                            colorBtn.onclick = async () => {
                                const selectedBlocks = this.getSelectedBlocks();
                                for (const block of selectedBlocks) {
                                    await this.batchApplyColor(block);
                                }
                                showToast('批量应用颜色完成');
                                const batchToolbar = document.querySelector('.my-batch-toolbar');
                                if (batchToolbar) batchToolbar.remove();
                            };
                            batchToolbar.appendChild(colorBtn);
                        }

                        // 2. 创建并添加其他格式化按钮
                        const buttons = [
                            { label: 'B', 'aria-label': '批量加粗', style: 'font-weight:bold;font-size:15px;', action: 'format', args: ['**'] },
                            { label: 'I', 'aria-label': '批量斜体', style: 'font-style:italic;font-size:15px;', action: 'format', args: ['*'] },
                            { label: 'U', 'aria-label': '批量下划线', style: 'text-decoration:underline;font-size:15px;', action: 'format', args: ['<u>', '</u>'] },
                            { label: 'M', 'aria-label': '批量标记', style: 'background:var(--b3-card-warning-background);color:var(--b3-card-warning-color);font-size:15px;', action: 'format', args: ['mark', 'mark'] },
                            { label: 'C', 'aria-label': '批量清除样式', style: 'font-weight:bold;font-size:15px;', action: 'clear' }
                        ];
                        buttons.forEach(btnDef => {
                            const btn = document.createElement('button');
                            btn.className = 'b3-tooltips b3-tooltips__n multi-batch-btn';
                            if (btnDef.label.startsWith('<svg>')) {
                                btn.innerHTML = btnDef.label;
                            } else {
                                btn.textContent = btnDef.label;
                            }
                            btn.setAttribute('aria-label', btnDef['aria-label']);
                            btn.style.cssText = btnDef.style;
                            btn.onclick = async () => {
                                const selectedBlocks = this.getSelectedBlocks();

                                for (const block of selectedBlocks) {
                                    if (btnDef.action === 'format') {
                                        await this.batchFormatBlock(block, ...btnDef.args);
                                    } else if (btnDef.action === 'clear') {
                                        await this.batchClearStyle(block);
                                    }
                                }
                                showToast(`${btnDef['aria-label']}完成`);
                                const batchToolbar = document.querySelector('.my-batch-toolbar');
                                if (batchToolbar) batchToolbar.remove();
                            };
                            batchToolbar.appendChild(btn);
                        });

                        // 定位到第一个选中块上方
                        const firstBlock = selectedBlocks[0];
                        const protyleEl = firstBlock.closest('.protyle');
                        const blockRect = firstBlock.getBoundingClientRect();
                        const editorRect = protyleEl.getBoundingClientRect();
                        batchToolbar.style.left = (blockRect.left - editorRect.left + editorRect.left) + 'px';
                        batchToolbar.style.top = (blockRect.top - editorRect.top + editorRect.top - batchToolbar.offsetHeight - 4) + 'px';
                        batchToolbar.style.width = 'auto'; // 自适应宽度
                    } else {
                        // 移除自定义批量工具栏
                        const batchToolbar = document.querySelector('.my-batch-toolbar');
                        if (batchToolbar) batchToolbar.remove();
                        this.log('[多选mouseup] 移除my-batch-toolbar');
                    }
                }, 50);
            });
            // ====== 插入多选工具栏定位样式 ======
            const style = document.createElement('style');
            style.innerHTML = `
            .multi-select-toolbar {
                position: absolute !important;
                z-index: 9999 !important;
                left: var(--multi-toolbar-left, 0) !important;
                top: var(--multi-toolbar-top, 0) !important;
                width: var(--multi-toolbar-width, 100%) !important;
            }
            `;
            document.head.appendChild(style);
        },

        /**
         * 批量清除块内联样式
         * @param {HTMLElement} block
         */
        async batchClearStyle(block) {
            if (!block || !block.dataset.nodeId) return;
            const blockId = block.dataset.nodeId;

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = block.outerHTML;
            const tempBlock = tempDiv.firstChild;
            if (!tempBlock) return;

            const spans = Array.from(tempBlock.querySelectorAll('span'));
            const formattingDataTypes = new Set(['strong', 'em', 'u', 's', 'mark', 'sup', 'sub', 'code', 'kbd']);

            spans.forEach(span => {
                // 忽略UI相关的span
                if (span.closest('.protyle-action') || span.dataset.taskStats === 'true' || span.contentEditable === 'false') {
                    return;
                }

                // 1. 移除内联样式（颜色等）
                span.removeAttribute('style');

                // 2. 移除格式化相关的data-type，保留其他如块引等
                if (span.hasAttribute('data-type')) {
                    const currentTypes = span.dataset.type.split(' ');
                    const preservedTypes = currentTypes.filter(type => !formattingDataTypes.has(type));

                    if (preservedTypes.length > 0) {
                        span.dataset.type = preservedTypes.join(' ');
                    } else {
                        span.removeAttribute('data-type');
                    }
                }

                // 3. 如果span不再有任何属性，则解包（将内容释放出来）
                if (span.attributes.length === 0 && span.parentNode) {
                    const fragment = document.createDocumentFragment();
                    while (span.firstChild) {
                        fragment.appendChild(span.firstChild);
                    }
                    span.parentNode.replaceChild(fragment, span);
                }
            });

            const newOuterHTML = tempBlock.outerHTML;
            if (!newOuterHTML) {
                this.error('Failed to generate new outerHTML for block:', blockId);
                return;
            }

            const payload = { "dataType": "dom", "data": newOuterHTML, "id": blockId };
            try {
                await fetch(TE_CONFIG.API.updateBlock, { method: 'POST', body: JSON.stringify(payload) });
            } catch (error) {
                this.error('批量清除样式API出错:', error);
            }
        },

        /**
         * 批量应用最近的颜色
         * @param {HTMLElement} block
         */
        async batchApplyColor(block) {
            if (!block || !block.dataset.nodeId) return;
            const blockId = block.dataset.nodeId;

            const lastColorRaw = localStorage.getItem('recentFontColor');
            if (!lastColorRaw) {
                this.log('没有找到最近使用的颜色');
                return;
            }

            let lastColor;
            try {
                lastColor = JSON.parse(lastColorRaw);
            } catch (e) {
                this.error('解析最近颜色失败', e);
                return;
            }

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = block.outerHTML;
            const tempBlock = tempDiv.firstChild;
            if (!tempBlock) return;

            const contentDivs = tempBlock.querySelectorAll('[contenteditable="true"]');
            if (contentDivs.length === 0) return;

            contentDivs.forEach(contentDiv => {
                if (contentDiv.closest('.hljs')) {
                    return;
                }

                const innerTempDiv = document.createElement('div');
                innerTempDiv.innerHTML = contentDiv.innerHTML;

                let targetSpan;
                if (innerTempDiv.childNodes.length === 1 && innerTempDiv.firstChild.nodeType === Node.ELEMENT_NODE && innerTempDiv.firstChild.tagName === 'SPAN') {
                    targetSpan = innerTempDiv.firstChild;
                } else {
                    targetSpan = document.createElement('span');
                    targetSpan.innerHTML = contentDiv.innerHTML;
                }

                if (lastColor.type === 'color') {
                    targetSpan.style.color = lastColor.value;
                } else if (lastColor.type === 'backgroundColor') {
                    targetSpan.style.backgroundColor = lastColor.value;
                } else if (lastColor.type === 'style1' && lastColor.value) {
                    if (lastColor.value.color) targetSpan.style.color = lastColor.value.color;
                    if (lastColor.value.bg) targetSpan.style.backgroundColor = lastColor.value.bg;
                }

                contentDiv.innerHTML = targetSpan.outerHTML;
            });

            const newOuterHTML = tempBlock.outerHTML;

            const payload = { "dataType": "dom", "data": newOuterHTML, "id": blockId };
            try {
                await fetch(TE_CONFIG.API.updateBlock, { method: 'POST', body: JSON.stringify(payload) });
            } catch (error) { this.error('批量应用颜色API出错:', error); }
        },

        /**
         * 监听多块选择，自动弹出工具栏（预留，兼容原有结构）
         */
        observeMultiSelectToolbar() {
            if (this._multiSelectObserver) return;
            const callback = (mutationsList) => {
                const selectedBlocks = this.getSelectedBlocks();
                this.log('[批量选择检测] 当前选中块数量:', selectedBlocks.length, selectedBlocks.map(b => b.dataset.nodeId));
                if (selectedBlocks.length > 1) {
                    this.log('[批量选择检测] 多选，等待思源原生工具箱自动弹出，不主动触发');
                }
            };
            document.querySelectorAll('.protyle-wysiwyg').forEach(editor => {
                const observer = new MutationObserver(callback);
                observer.observe(editor, {
                    attributes: true,
                    subtree: true,
                    attributeFilter: ['class']
                });
                this._multiSelectObserver = observer;
            });
        },

        /**
         * 获取所有被批量选中的块
         * @returns {HTMLElement[]}
         */
        getSelectedBlocks() {
            return Array.from(document.querySelectorAll('.protyle-wysiwyg--select[data-node-id]'));
        },

        /**
         * 批量格式化块内容
         * @param {HTMLElement} block
         * @param {string} prefix
         * @param {string} suffix
         */
        async batchFormatBlock(block, prefix, suffix) {
            suffix = suffix === undefined ? prefix : suffix;
            if (!block || !block.dataset.nodeId) return;
            const blockId = block.dataset.nodeId;

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = block.outerHTML;
            const tempBlock = tempDiv.firstChild;
            if (!tempBlock) return;

            const contentDivs = tempBlock.querySelectorAll('[contenteditable="true"]');
            if (contentDivs.length === 0) return;

            let newDataType = '';
            if (prefix === '**') {
                newDataType = 'strong';
            } else if (prefix === '*') {
                newDataType = 'em';
            } else if (prefix === '<u>') {
                newDataType = 'u';
            } else if (prefix === 'mark') {
                newDataType = 'mark';
            } else if (prefix.startsWith('<span')) {
                const match = prefix.match(/data-type="([^"]*)"/);
                if (match) newDataType = match[1];
            }

            contentDivs.forEach(contentDiv => {
                if (contentDiv.closest('.hljs')) {
                    return;
                }

                const innerTempDiv = document.createElement('div');
                innerTempDiv.innerHTML = contentDiv.innerHTML;

                let targetSpan;
                if (innerTempDiv.childNodes.length === 1 && innerTempDiv.firstChild.nodeType === Node.ELEMENT_NODE && innerTempDiv.firstChild.tagName === 'SPAN') {
                    targetSpan = innerTempDiv.firstChild;
                } else {
                    targetSpan = document.createElement('span');
                    targetSpan.innerHTML = contentDiv.innerHTML;
                }

                if (newDataType) {
                    const existingTypes = targetSpan.getAttribute('data-type') || '';
                    const typeSet = new Set(existingTypes.split(' ').filter(Boolean));
                    newDataType.split(' ').forEach(t => typeSet.add(t));
                    targetSpan.setAttribute('data-type', Array.from(typeSet).join(' '));
                }

                contentDiv.innerHTML = targetSpan.outerHTML;
            });

            const newOuterHTML = tempBlock.outerHTML;

            const payload = { "dataType": "dom", "data": newOuterHTML, "id": blockId };
            try {
                await fetch(TE_CONFIG.API.updateBlock, { method: 'POST', body: JSON.stringify(payload) });
            } catch (error) { this.error('批量格式化API出错:', error); }
        },
    };

    /**
     * 最近颜色按钮功能模块
     */
    const RecentColorButtonModule = {
        id: 'recentColorButton',
        name: '最近颜色按钮',
        get enabled() { return TE_CONFIG.featureToggles[this.id] !== false; },
        log(...args) { Logger.log(this.id, ...args); },
        error(...args) { Logger.error(this.id, ...args); },

        /**
         * 初始化模块
         */
        init() {
            this.log('最近颜色按钮模块已启动。');
        },

        /**
         * 插入最近颜色按钮到当前toolbar，无论有无原生外观按钮
         */
        insertCustomAppearanceButtons(toolbar) {
            console.log('[RecentColorButtonModule] insertCustomAppearanceButtons调用, toolbar:', toolbar);
            if (toolbar.querySelector('.custom-appearance-group')) {
                console.log('[RecentColorButtonModule] 已存在.custom-appearance-group, 跳过');
                return;
            }
            const nativeBtn = toolbar.querySelector('button[data-type="text"]');
            if (nativeBtn) { // 如果原生外观按钮存在，就隐藏它，避免重复
                nativeBtn.style.display = 'none';
            }

            // 创建自定义按钮组容器
            const group = document.createElement('div');
            group.className = 'custom-appearance-group';
            group.style.display = 'inline-flex';
            group.style.alignItems = 'center';
            group.style.gap = '0';
            const colorBtn = document.createElement('button');
            colorBtn.className = 'protyle-toolbar__item b3-tooltips b3-tooltips__n';
            colorBtn.setAttribute('aria-label', '最近颜色');
            colorBtn.style.width = '28px';
            colorBtn.style.height = '28px';
            colorBtn.style.borderRadius = '4px';
            colorBtn.style.background = 'var(--b3-menu-background)';
            colorBtn.style.border = '1px solid var(--b3-border-color)';
            colorBtn.style.borderTopRightRadius = '0';
            colorBtn.style.borderBottomRightRadius = '0';
            colorBtn.style.marginRight = '0';
            colorBtn.style.borderRight = 'none';
            colorBtn.innerHTML = '<svg style="width:18px;height:18px;"><use xlink:href="#iconFont"></use></svg>';

            // 读取最近颜色
            const lastColorRaw = localStorage.getItem('recentFontColor');
            let lastColor = null;
            if (lastColorRaw) {
                try { lastColor = JSON.parse(lastColorRaw); } catch (e) { lastColor = null; }
            }
            console.log('[RecentColorButtonModule] 读取recentFontColor:', lastColor);
            if (!lastColor) {
                console.log('[RecentColorButtonModule] 没有lastColor, 跳过');
                // return;
            } else {

                if (lastColor.type === 'color') {
                    colorBtn.style.color = lastColor.value;
                    colorBtn.style.background = '';
                }
                if (lastColor.type === 'backgroundColor') {
                    colorBtn.style.background = lastColor.value;
                    colorBtn.style.color = '';
                }
                if (lastColor.type === 'style1' && lastColor.value) {
                    colorBtn.style.color = lastColor.value.color || '';
                    colorBtn.style.background = lastColor.value.bg || '';
                }

            }
            // 点击应用颜色按钮
            colorBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const lastColorRaw = localStorage.getItem('recentFontColor');
                let lastColor = null;
                if (lastColorRaw) {
                    try { lastColor = JSON.parse(lastColorRaw); } catch (e) { lastColor = null; }
                }
                const selInfo = RecentColorButtonModule.getSelectionContent();
                if (!lastColor || !selInfo) return;
                RecentColorButtonModule.applyRecentColorToSelection(lastColor, selInfo);
            });
            // 右键点击最近颜色按钮，仅查看选区内容
            colorBtn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const info = RecentColorButtonModule.getSelectionContent();
                // if (info) {
                //     alert(
                //         '整行文本: ' + info.fullText +
                //         '\\n选中文本: ' + info.selectedText +
                //         '\\n选区HTML: ' + info.selectedHtml +
                //         '\\n整行DOM: ' + info.blockHtml
                //     );
                // } else {
                //     alert('没有有效选区');
                // }
            });
            group.appendChild(colorBtn);
            const triangleBtn = document.createElement('button');
            triangleBtn.className = 'protyle-toolbar__item b3-tooltips b3-tooltips__n';
            triangleBtn.setAttribute('aria-label', ' 外观 Ctrl+Alt+X');
            triangleBtn.style.width = '22px';
            triangleBtn.style.height = '28px';
            triangleBtn.style.display = 'flex';
            triangleBtn.style.alignItems = 'center';
            triangleBtn.style.justifyContent = 'center';
            triangleBtn.style.background = 'var(--b3-menu-background)';
            triangleBtn.style.border = '1px solid var(--b3-border-color)';
            triangleBtn.style.borderTopLeftRadius = '0';
            triangleBtn.style.borderBottomLeftRadius = '0';
            triangleBtn.style.marginLeft = '0';
            triangleBtn.style.borderRadius = '4px';
            triangleBtn.innerHTML = '<svg style="width:12px;height:12px;"><use xlink:href="#iconDown"></use></svg>';
            // 点击三角按钮弹出原生外观弹窗
            triangleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 日志：点击三角按钮
                console.log('[外观三角按钮] 点击事件触发');
                if (nativeBtn) {
                    const style = window.getComputedStyle(nativeBtn);
                    console.log('[外观三角按钮] 原生外观按钮可见性:', {
                        display: style.display,
                        visibility: style.visibility,
                        pointerEvents: style.pointerEvents,
                        opacity: style.opacity
                    });
                    console.log('[外观三角按钮] 原生外观按钮DOM:', nativeBtn.outerHTML);
                    nativeBtn.click();
                    // 监听弹窗内颜色按钮点击
                    setTimeout(() => {
                        const utilPanel = document.querySelector('.protyle-util');
                        if (!utilPanel) return;
                        utilPanel.querySelectorAll('button[data-type="color"],button[data-type="backgroundColor"],button[data-type="style1"]').forEach(btn => {
                            btn.addEventListener('click', function colorBtnClick() {
                                // 捕捉颜色
                                let color = btn.style.color || '';
                                let bg = btn.style.backgroundColor || '';
                                let type = btn.getAttribute('data-type');
                                // 日志：点击前localStorage
                                console.log('[最近颜色按钮] 点击前localStorage:', localStorage.getItem('recentFontColor'));
                                // 存储
                                if (type === 'color' && color) {
                                    colorBtn.style.color = color;
                                    colorBtn.style.background = '';
                                    localStorage.setItem('recentFontColor', JSON.stringify({ type: 'color', value: color }));
                                    console.log('[最近颜色按钮] 选中新颜色:', { type: 'color', value: color });
                                } else if (type === 'backgroundColor' && bg) {
                                    colorBtn.style.background = bg;
                                    colorBtn.style.color = '';
                                    localStorage.setItem('recentFontColor', JSON.stringify({ type: 'backgroundColor', value: bg }));
                                    console.log('[最近颜色按钮] 选中新颜色:', { type: 'backgroundColor', value: bg });
                                } else if (type === 'style1') {
                                    colorBtn.style.color = color;
                                    colorBtn.style.background = bg;
                                    localStorage.setItem('recentFontColor', JSON.stringify({ type: 'style1', value: { color, bg } }));
                                    console.log('[最近颜色按钮] 选中新颜色:', { type: 'style1', value: { color, bg } });
                                }
                                // 日志：点击后localStorage
                                console.log('[最近颜色按钮] 点击后localStorage:', localStorage.getItem('recentFontColor'));
                            }, { once: true });
                        });
                    }, 100);
                } else {
                    console.log('[外观三角按钮] 未找到原生外观按钮');
                }
            });
            group.appendChild(triangleBtn);
            // console.log("group",group)

            // 插入到原生外观按钮前面（如无则插入最前）
            if (nativeBtn && nativeBtn.parentElement) {
                nativeBtn.parentElement.insertBefore(group, nativeBtn);
            } else {
                toolbar.prepend(group);
                // console.log("toolbar",toolbar)

            }
        },

        /**
         * 获取当前选区内容（文本、contentDiv、range等），并详细输出选区在各span内的分布
         */
        getSelectionContent() {
            console.log("执行了getSelectionContent")
            const selection = window.getSelection();
            if (!selection.rangeCount) {
                console.log('[getSelectionContent] 没有选区');
                return null;
            }
            const range = selection.getRangeAt(0);
            console.log("range", range)
            const blockDiv = range.startContainer.parentElement.closest('[data-node-id]');
            console.log("blockDiv", blockDiv)

            const contentDiv = blockDiv ? blockDiv.querySelector('[contenteditable="true"]') : null;
            console.log("contentDiv", contentDiv)
            if (!contentDiv) {
                console.log('[getSelectionContent] 没有找到contentDiv');
                return null;
            }
            // 1. 整行纯文本
            const fullText = contentDiv.textContent;
            // 2. 选中部分文本
            const selectedText = selection.toString();
            // 3. 选区HTML片段
            const fragment = range.cloneContents();
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(fragment);
            const selectedHtml = tempDiv.innerHTML;
            // 4. 整行DOM
            const blockHtml = blockDiv ? blockDiv.outerHTML : '';

            // 5. 选区在各span内的起止位置
            let logArr = [];
            let curPos = 0;
            let selStart = -1, selEnd = -1;
            // 计算选区在整行文本的起止
            function getTextOffset(root, node) {
                let offset = 0;
                function walk(n) {
                    if (n === node) return true;
                    if (n.nodeType === 3) offset += n.textContent.length;
                    else for (let c of n.childNodes) if (walk(c)) return true;
                    return false;
                }
                walk(root);
                return offset;
            }
            if (range.startContainer.nodeType === 3) { // 文本节点
                selStart = getTextOffset(contentDiv, range.startContainer) + range.startOffset;
            } else {
                selStart = 0;
            }
            if (range.endContainer.nodeType === 3) {
                selEnd = getTextOffset(contentDiv, range.endContainer) + range.endOffset;
            } else {
                selEnd = fullText.length;
            }
            let nodeIdx = 0;
            function walkSpans(parent) {
                for (let node of parent.childNodes) {
                    if (node.nodeType === 3) { // 文本
                        let text = node.textContent;
                        let start = curPos, end = curPos + text.length;
                        let overlapStart = Math.max(selStart, start);
                        let overlapEnd = Math.min(selEnd, end);
                        if (overlapStart < overlapEnd) {
                            logArr.push({
                                type: 'text',
                                index: nodeIdx,
                                text,
                                spanStart: start,
                                spanEnd: end,
                                selStart: overlapStart - start,
                                selEnd: overlapEnd - start,
                                selected: text.substring(overlapStart - start, overlapEnd - start),
                                dataType: undefined // 纯文本没有data-type
                            });
                        }
                        curPos = end;
                        nodeIdx++;
                    } else if (node.nodeType === 1 && node.tagName === 'SPAN') {
                        let text = node.textContent;
                        let start = curPos, end = curPos + text.length;
                        let overlapStart = Math.max(selStart, start);
                        let overlapEnd = Math.min(selEnd, end);
                        if (overlapStart < overlapEnd) {
                            logArr.push({
                                type: 'span',
                                index: nodeIdx,
                                text,
                                spanStart: start,
                                spanEnd: end,
                                selStart: overlapStart - start,
                                selEnd: overlapEnd - start,
                                html: node.outerHTML,
                                selected: text.substring(overlapStart - start, overlapEnd - start),
                                dataType: node.getAttribute('data-type') // 读取span的data-type
                            });
                        }
                        curPos = end;
                        nodeIdx++;
                    } else if (node.nodeType === 1) {
                        walkSpans(node);
                    }
                }
            }
            walkSpans(contentDiv);

            // 日志输出
            console.log('[getSelectionContent] 整行文本:', fullText);
            // console.log('[getSelectionContent] 选中文本:', selectedText);
            console.log('[getSelectionContent] 选区HTML:', selectedHtml);
            console.log('[getSelectionContent] 整行DOM:', blockHtml);
            console.log('[getSelectionContent] 选区跨span分布:', logArr);
            logArr.forEach((item, idx) => {
                console.log(`[getSelectionContent] logArr[${idx}] dataType:`, item.dataType, 'selected:', item.selected);
            });

            return { selection, range, contentDiv, selectedText, selectedHtml, fullText, blockHtml, spanSelection: logArr };
        },

        /**
         * 应用最近颜色到选区（统一处理版本）
         */
        async applyRecentColorToSelection(lastColor, selInfo) {
            // 参数验证
            if (!this._validateSelectionParams(lastColor, selInfo)) {
                return;
            }

            const { selection, range, contentDiv, spanSelection: logArr } = selInfo;
            const blockDiv = contentDiv.closest('[data-node-id]');
            const isTable = blockDiv && blockDiv.dataset.type === 'NodeTable';

            if (isTable) {
                this.log('表格内应用颜色 - (精准替换方案)');
                try {
                    if (range.collapsed) {
                        this.log('没有选择文本，不应用颜色');
                        return;
                    }

                    // 关键场景: 选区完整地包含在单个SPAN内的单个文本节点中
                    const isSimpleSpanSelection =
                        logArr.length === 1 &&
                        logArr[0].html && logArr[0].html.includes('<span') &&
                        range.startContainer === range.endContainer &&
                        range.startContainer.nodeType === Node.TEXT_NODE &&
                        range.startContainer.parentNode.tagName === 'SPAN';

                    if (isSimpleSpanSelection) {
                        this.log('处理单SPAN内部分选区');
                        const parentSpan = range.startContainer.parentNode;
                        const textNode = range.startContainer;

                        // 1. 根据选区位置，分割文本
                        const beforeText = textNode.textContent.substring(0, range.startOffset);
                        const selectedText = textNode.textContent.substring(range.startOffset, range.endOffset);
                        const afterText = textNode.textContent.substring(range.endOffset);

                        const fragment = document.createDocumentFragment();

                        // 2. 构建新的节点片段
                        // - 选中前部分 (如果存在)
                        if (beforeText) {
                            const beforeSpan = parentSpan.cloneNode(false); // 浅拷贝，只复制标签和属性
                            beforeSpan.textContent = beforeText;
                            fragment.appendChild(beforeSpan);
                        }
                        // - 选中部分 (应用新样式)
                        const newStyledSpan = document.createElement('span');
                        newStyledSpan.textContent = selectedText;
                        if (lastColor.type === 'color') {
                            newStyledSpan.style.color = lastColor.value;
                        } else if (lastColor.type === 'backgroundColor') {
                            newStyledSpan.style.backgroundColor = lastColor.value;
                        } else if (lastColor.type === 'style1' && lastColor.value) {
                            if (lastColor.value.color) newStyledSpan.style.color = lastColor.value.color;
                            if (lastColor.value.bg) newStyledSpan.style.backgroundColor = lastColor.value.bg;
                        }
                        fragment.appendChild(newStyledSpan);
                        // - 选中后部分 (如果存在)
                        if (afterText) {
                            const afterSpan = parentSpan.cloneNode(false);
                            afterSpan.textContent = afterText;
                            fragment.appendChild(afterSpan);
                        }

                        // 3. 用新构建的片段替换整个旧的span
                        parentSpan.parentNode.replaceChild(fragment, parentSpan);

                    } else {
                        // 回退到我们之前确认的、处理复杂选区或其他情况的逻辑
                        this.log('处理复杂选区或纯文本');
                        const newFragment = document.createDocumentFragment();
                        for (const part of logArr) {
                            let nodeToAppend;
                            if (part.html && part.html.includes('<span')) {
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = part.html;
                                const originalSpan = tempDiv.firstChild;
                                if (originalSpan && originalSpan.nodeType === Node.ELEMENT_NODE) {
                                    originalSpan.textContent = part.selected;
                                    if (lastColor.type === 'color') {
                                        originalSpan.style.color = lastColor.value;
                                        originalSpan.style.backgroundColor = '';
                                    } else if (lastColor.type === 'backgroundColor') {
                                        originalSpan.style.backgroundColor = lastColor.value;
                                        originalSpan.style.color = '';
                                    } else if (lastColor.type === 'style1' && lastColor.value) {
                                        originalSpan.style.color = lastColor.value.color || '';
                                        originalSpan.style.backgroundColor = lastColor.value.bg || '';
                                    }
                                    nodeToAppend = originalSpan;
                                }
                            }
                            if (!nodeToAppend) {
                                const newSpan = document.createElement('span');
                                newSpan.textContent = part.selected;
                                if (lastColor.type === 'color') {
                                    newSpan.style.color = lastColor.value;
                                } else if (lastColor.type === 'backgroundColor') {
                                    newSpan.style.backgroundColor = lastColor.value;
                                } else if (lastColor.type === 'style1' && lastColor.value) {
                                    if (lastColor.value.color) newSpan.style.color = lastColor.value.color;
                                    if (lastColor.value.bg) newSpan.style.backgroundColor = lastColor.value.bg;
                                }
                                nodeToAppend = newSpan;
                            }
                            newFragment.appendChild(nodeToAppend);
                        }
                        range.deleteContents();
                        range.insertNode(newFragment);
                    }

                } catch (e) {
                    this.error('在表格中应用颜色失败:', e);
                    showToast('无法跨单元格或复杂内容应用颜色');
                    return; // 出错时停止执行
                }
            } else {
                console.log('[颜色应用] 开始处理，logArr:', logArr);
                this._applyColorToSelectionByDOM(range, logArr, lastColor);
            }

            // 统一的更新逻辑
            const finalBlockDiv = contentDiv.closest('[data-node-id]');
            const blockId = finalBlockDiv ? finalBlockDiv.dataset.nodeId : null;
            if (blockId) {
                const payload = { "dataType": "dom", "data": finalBlockDiv.outerHTML, "id": blockId };
                try {
                    this.log('准备保存更新, blockId:', blockId);
                    await fetch(TE_CONFIG.API.updateBlock, { method: 'POST', body: JSON.stringify(payload) });
                    this.log('DOM更新成功');
                } catch (error) {
                    this.error('发送API请求时出错:', error);
                }
            }
        },



        /**
         * 在原有DOM结构中替换选中的内容
         */
        _replaceSelectedContentInDOM(range, logArr, lastColor) {
            // 获取选区内的所有节点
            const selectedNodes = this._getSelectedNodes(range);
            console.log('[替换DOM] 选中的节点:', selectedNodes);

            // 处理每个选中的节点
            selectedNodes.forEach(nodeInfo => {
                this._replaceNodeContent(nodeInfo, lastColor);
            });
        },



        /**
         * 通过DOM操作应用颜色到选区
         */
        _applyColorToSelectionByDOM(range, logArr, lastColor) {
            console.log('[DOM处理] 使用logArr信息处理选区:', logArr);

            // 获取包含选区的整行内容
            const contentDiv = range.startContainer.parentElement.closest('[contenteditable="true"]');
            if (!contentDiv) {
                console.log('[DOM处理] 未找到contentDiv');
                return;
            }

            console.log('[DOM处理] 重构整行内容');


            // 获取整行的完整文本
            const fullText = contentDiv.textContent;
            console.log('[重构整行] 整行文本:', fullText);
            // 重构整个contentDiv的内容


            const updatedContentDiv = this._rebuildFullLineContent(contentDiv, fullText, logArr, lastColor);
            return updatedContentDiv
        },


        /**
         * 重建整行内容，包括选中和未选中的部分
         */
        _rebuildFullLineContent(contentDiv, fullText, logArr, lastColor) {
            // 先分析整个contentDiv的DOM结构，获取所有span信息
            const allSpans = [];


            const walker = document.createTreeWalker(
                contentDiv,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                null,
                false
            );

            let currentPos = 0;
            // 提取childNodes为变量并统计
            const childNodes = contentDiv.childNodes;
            console.log('[重建整行] childNodes数量:', childNodes.length);
            console.log('[重建整行] childNodes内容:', Array.from(childNodes).map(node => ({
                nodeType: node.nodeType,
                tagName: node.tagName,
                textContent: node.textContent?.substring(0, 20) + '...'
            })));

            // 直接遍历contentDiv的直接子节点，避免重复
            for (let node of childNodes) {
                if (node.nodeType === 3) { // 文本节点
                    const text = node.textContent;
                    if (text == "") continue;
                    allSpans.push({
                        type: 'text',
                        text: text,
                        start: currentPos,
                        end: currentPos + text.length,
                        dataType: null,
                        html: null
                    });
                    currentPos += text.length;
                } else if (node.nodeType === 1 && node.tagName === 'SPAN') { // span元素
                    const text = node.textContent;
                    if (text == "") continue;
                    allSpans.push({
                        type: 'span',
                        text: text,
                        start: currentPos,
                        end: currentPos + text.length,
                        dataType: node.getAttribute('data-type'),
                        html: node.outerHTML,
                        originalNode: node
                    });
                    currentPos += text.length;
                }
            }

            console.log('[重建整行] 所有span信息:', allSpans);
            contentDiv.innerHTML = '';
            // 按位置排序logArr
            const sortedLogArr = logArr.sort((a, b) => (a.spanStart + a.selStart) - (b.spanStart + b.selStart));

            let result = [];

            // 处理所有span
            allSpans.forEach((spanInfo, spanIndex) => {
                console.log(`[重建整行] 处理span[${spanIndex}]:`, spanInfo);

                // 检查这个span是否与选区有交集
                const overlappingLogs = sortedLogArr.filter(log => {
                    const logStart = log.spanStart + log.selStart;
                    const logEnd = log.spanStart + log.selEnd;
                    return logStart < spanInfo.end && logEnd > spanInfo.start;
                });

                if (overlappingLogs.length > 0) {
                    // 有交集，需要分割处理
                    let spanCurrentPos = spanInfo.start;

                    overlappingLogs.forEach(log => {
                        const logStart = log.spanStart + log.selStart;
                        const logEnd = log.spanStart + log.selEnd;

                        // 添加交集前的文本
                        if (logStart > spanCurrentPos) {
                            const beforeText = spanInfo.text.substring(spanCurrentPos - spanInfo.start, logStart - spanInfo.start);
                            if (beforeText) {
                                if (spanInfo.dataType) {
                                    const span = document.createElement('span');
                                    span.textContent = beforeText;
                                    span.setAttribute('data-type', spanInfo.dataType);
                                    if (spanInfo.html) {
                                        const tempDiv = document.createElement('div');
                                        tempDiv.innerHTML = spanInfo.html;
                                        const originalSpan = tempDiv.querySelector('span');
                                        if (originalSpan && originalSpan.style.cssText.trim()) {
                                            span.style.cssText = originalSpan.style.cssText;
                                        }
                                    }
                                    if (!span.style.cssText.trim()) {
                                        span.style.background = 'transparent';
                                    }
                                    result.push(span);
                                } else {
                                    result.push(document.createTextNode(beforeText));
                                }
                            }
                        }

                        // 添加交集的文本（带颜色）
                        const overlapText = log.selected;
                        if (overlapText) {
                            const span = document.createElement('span');
                            span.textContent = overlapText;
                            if (log.dataType || spanInfo.dataType) {
                                span.setAttribute('data-type', log.dataType || spanInfo.dataType);
                            }

                            // 应用颜色样式
                            if (lastColor.type === 'color') {
                                span.style.color = lastColor.value;
                            } else if (lastColor.type === 'backgroundColor') {
                                span.style.background = lastColor.value;
                            } else if (lastColor.type === 'style1' && lastColor.value) {
                                span.style.color = lastColor.value.color;
                                span.style.background = lastColor.value.bg;
                            }

                            result.push(span);
                        }

                        spanCurrentPos = logEnd;
                    });

                    // 添加交集后的文本
                    if (spanCurrentPos < spanInfo.end) {
                        const afterText = spanInfo.text.substring(spanCurrentPos - spanInfo.start);
                        if (afterText) {
                            if (spanInfo.dataType) {
                                const span = document.createElement('span');
                                span.textContent = afterText;
                                span.setAttribute('data-type', spanInfo.dataType);
                                if (spanInfo.html) {
                                    const tempDiv = document.createElement('div');
                                    tempDiv.innerHTML = spanInfo.html;
                                    const originalSpan = tempDiv.querySelector('span');
                                    if (originalSpan) {
                                        span.style.cssText = originalSpan.style.cssText;
                                    }
                                }
                                if (!span.style.cssText.trim()) {
                                    span.style.background = 'transparent';
                                }
                                result.push(span);
                            } else {
                                result.push(document.createTextNode(afterText));
                            }
                        }
                    }
                } else {
                    // 无交集，保持原有结构
                    if (spanInfo.type === 'span' && spanInfo.dataType) {
                        const span = document.createElement('span');
                        span.textContent = spanInfo.text;
                        span.setAttribute('data-type', spanInfo.dataType);
                        if (spanInfo.html) {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = spanInfo.html;
                            const originalSpan = tempDiv.querySelector('span');
                            if (originalSpan) {
                                span.style.cssText = originalSpan.style.cssText;
                            }
                        }
                        if (!span.style.cssText.trim()) {
                            span.style.background = 'transparent';
                        }
                        result.push(span);
                    } else {
                        result.push(document.createTextNode(spanInfo.text));
                    }
                }
            });

            // 将所有结果添加到contentDiv
            const newHTML = result.map(node => node.outerHTML || node.textContent).join('');
            console.log('[重建整行] 新HTML:', newHTML);
            contentDiv.innerHTML = newHTML;

            console.log('[重建整行] 最终contentDiv内容:', contentDiv.outerHTML);
            return contentDiv
        },

        /**
         * 获取选区内的节点信息
         */
        _getSelectedNodes(range) {
            const nodes = [];
            const walker = document.createTreeWalker(
                range.commonAncestorContainer,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                null,
                false
            );

            let node;
            while (node = walker.nextNode()) {
                if (range.intersectsNode(node)) {
                    const nodeRange = document.createRange();
                    nodeRange.selectNode(node);

                    // 计算与选区的交集
                    const intersection = this._getIntersection(range, nodeRange);
                    if (intersection) {
                        nodes.push({
                            node: node,
                            intersection: intersection,
                            originalText: node.textContent
                        });
                    }
                }
            }

            return nodes;
        },

        /**
         * 计算两个range的交集
         */
        _getIntersection(range1, range2) {
            const start = Math.max(range1.startOffset, range2.startOffset);
            const end = Math.min(range1.endOffset, range2.endOffset);

            if (start < end) {
                return { start, end };
            }
            return null;
        },

        /**
         * 替换节点内容
         */
        _replaceNodeContent(nodeInfo, lastColor) {
            const { node, intersection, originalText } = nodeInfo;

            if (node.nodeType === Node.TEXT_NODE) {
                // 文本节点，需要分割
                this._splitTextNode(node, intersection, lastColor);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // 元素节点，需要处理子节点
                this._processElementNode(node, intersection, lastColor);
            }
        },

        /**
         * 分割文本节点
         */
        _splitTextNode(textNode, intersection, lastColor) {
            const text = textNode.textContent;
            const parent = textNode.parentNode;

            // 创建三个部分：前、中、后
            const beforeText = text.substring(0, intersection.start);
            const selectedText = text.substring(intersection.start, intersection.end);
            const afterText = text.substring(intersection.end);

            // 创建新的文本节点
            const beforeNode = document.createTextNode(beforeText);
            const afterNode = document.createTextNode(afterText);

            // 创建带颜色的span
            const coloredSpan = document.createElement('span');
            coloredSpan.textContent = selectedText;

            // 应用颜色样式
            if (lastColor.type === 'color') {
                coloredSpan.style.color = lastColor.value;
            } else if (lastColor.type === 'backgroundColor') {
                coloredSpan.style.background = lastColor.value;
            } else if (lastColor.type === 'style1' && lastColor.value) {
                coloredSpan.style.color = lastColor.value.color;
                coloredSpan.style.background = lastColor.value.bg;
            }

            // 替换原文本节点
            const fragment = document.createDocumentFragment();
            if (beforeText) fragment.appendChild(beforeNode);
            fragment.appendChild(coloredSpan);
            if (afterText) fragment.appendChild(afterNode);

            parent.replaceChild(fragment, textNode);
        },

        /**
         * 处理元素节点
         */
        _processElementNode(element, intersection, lastColor) {
            // 为元素添加颜色样式
            if (lastColor.type === 'color') {
                element.style.color = lastColor.value;
            } else if (lastColor.type === 'backgroundColor') {
                element.style.background = lastColor.value;
            } else if (lastColor.type === 'style1' && lastColor.value) {
                element.style.color = lastColor.value.color;
                element.style.background = lastColor.value.bg;
            }
        },

        /**
         * 处理完整选区（整行或完整span）
         */
        _applyColorToFullSelection(lastColor, selInfo) {
            const { contentDiv, spanSelection: logArr } = selInfo;

            // 构建选区范围
            // const selRanges = this._buildSelectionRanges(logArr); // 不再使用

            // 处理节点
            // const processed = this._processNodeWithSelection(contentDiv, 0, selRanges, lastColor, ''); // 不再使用

            // 更新内容
            // this._updateContentDiv(contentDiv, processed); // 不再使用

            this.log('完整选区颜色应用完成');
        },

        /**
         * 工具函数：验证选择参数
         */
        _validateSelectionParams(lastColor, selInfo) {
            if (!lastColor || !selInfo) {
                this.log('缺少lastColor或selInfo');
                return false;
            }

            const { selection, range, contentDiv } = selInfo;
            if (!lastColor) {
                this.log('没有lastColor, 跳过');
                return false;
            }
            if (!selection || !range || !contentDiv) {
                this.log('selection/range/contentDiv 缺失');
                return false;
            }

            return true;
        },

    };

    // =============================================================
    //                     4. 模块注册与主引擎
    // =============================================================

    const TE_FEATURE_MODULES = [
        ToolbarEnhancerModule,
        BatchEditModule,
        RecentColorButtonModule,
    ];

    function initializeToolEditorModules() {
        console.log('[工具编辑器] Main engine started. Initializing modules...');
        TE_FEATURE_MODULES.forEach(module => {
            if (module.enabled) {
                if (typeof module.init === 'function') {
                    try { module.init(); }
                    catch (e) { console.error(`[工具编辑器] Failed to initialize module: ${module.name}`, e); }
                }
            } else {
                console.log(`[工具编辑器] Module [${module.name}] is disabled via settings.`);
            }
        });
        console.log('[工具编辑器] All modules processed.');
    }

    setTimeout(initializeToolEditorModules, 1000);

    // 预留：如需暴露全局方法，可在此添加

})();
