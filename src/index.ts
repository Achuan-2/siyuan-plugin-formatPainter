import {
    Plugin,
    getFrontend,
    getBackend,
    fetchPost,
    IModel,
    Protyle,
    IProtyle,
    Toolbar
} from "siyuan";

import { IMenuItem } from "siyuan/types";




export default class PluginSample extends Plugin {
    private isMobile: boolean;
    private formatPainterEnable = false;
    private formatData: { datatype: string, style: string } | null = null;
    private protyle: IProtyle;

    // 添加工具栏按钮
    updateProtyleToolbar(toolbar: Array<string | IMenuItem>) {
        toolbar.push(
            {
                name: "format-painter",
                icon: "iconFormat",
                tipPosition: "n",
                tip: this.i18n.tips,
                click: (protyle: Protyle) => {
                    this.protyle = protyle.protyle;

                    if (!this.formatPainterEnable) {
                        const selectedInfo = this.getSelectedParentHtml();
                        if (selectedInfo) {
                            this.formatData = {
                                datatype: selectedInfo.datatype,
                                style: selectedInfo.style
                            };

                        }
                        else {
                            this.formatData = null;
                            // console.log("选中无样式文字");
                        }
                        this.formatPainterEnable = true;
                        document.body.dataset.formatPainterEnable = "true";
                        // console.log(this.formatData);
                        fetchPost("/api/notification/pushMsg", { "msg": this.i18n.enable, "timeout": 7000 });

                        ///v dock indicator worker
                        const indicator = document.querySelector(".siyuan-plugin-formatPainter_brush_indicator");
                        if (indicator) {
                            (indicator as HTMLElement).style.display = "flex";
                        }
                        ///^ dock indicator worker

                        // 关闭toolbar
                        this.protyle.toolbar.range.collapse(true);
                        // 选择所有具有 .protyle-toolbar 类的元素
                        const toolbarElements = document.querySelectorAll('.protyle-toolbar');
                        // 遍历选中的元素
                        toolbarElements.forEach(element => {
                            // 检查元素是否没有 .fn__none 类
                            if (!element.classList.contains("fn__none")) {
                                // 如果没有 .fn__none 类，则添加它
                                element.classList.add("fn__none");
                            }
                        });


                    }
                }
            }
        );
        return toolbar;
    }
    onload() {

        document.addEventListener('mouseup', (event) => {
            if (this.formatPainterEnable) {
                const selection = window.getSelection();
                let hasmath = false;
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const selectedText = range.toString();
                    if (selectedText) {
                        const startBlockElement = hasClosestBlock(range.startContainer);
                        if (range.endContainer.nodeType !== 3 && (range.endContainer as HTMLElement).tagName === "DIV" && range.endOffset === 0) {
                            // 三选中段落块时，rangeEnd 会在下一个块
                            if ((range.endContainer as HTMLElement).classList.contains("protyle-attr") && startBlockElement) {
                                // 三击在悬浮层中会选择到 attr https://github.com/siyuan-note/siyuan/issues/4636
                                // 需要获取可编辑元素，使用 previousElementSibling 的话会 https://github.com/siyuan-note/siyuan/issues/9714
                                setLastNodeRange(getContenteditableElement(startBlockElement), range, false);
                            }
                        }
                        this.protyle.toolbar.range = range;  // 更改选区
                        // console.log(this.protyle.toolbar.range.toString());
                        // Apply the stored format to the selected text
                        // 如果都为空
                        this.protyle.toolbar.setInlineMark(this.protyle, "clear", "range");
                        // this.protyle.toolbar.setInlineMark(this.protyle, "text", "range");
                        if (!this.formatData) {
                            return;
                        }
                        if (this.formatData.datatype) {
                            // console.log(this.formatData.datatype);


                            // this.protyle.toolbar.setInlineMark(this.protyle, this.formatData.datatype, "range");
                            // 检查是否包含 "inline-math"
                            if (this.formatData.datatype.includes("inline-math")) {
                                // 单独设置 "inline-math" 样式
                                this.protyle.toolbar.setInlineMark(this.protyle, "inline-math", "range", {
                                    type: "inline-math",
                                });
                                hasmath = true;
                            }
                            const otherTypes = this.formatData.datatype.replace(/\b(inline-math|block-ref|a|text)\b/g, "").trim();
                            if (otherTypes) {
                                this.protyle.toolbar.setInlineMark(this.protyle, otherTypes, "range");
                            }
                        }
                        if (this.formatData.style) {
                            // this.protyle.toolbar.setInlineMark(this.protyle, "text", "range", { "type": "style1", "color": this.formatData.style });
                            // console.log(backgroundColor, color, fontSize, textShadow);
                            let type = "text";
                            if (hasmath) {
                                // 数学公式加颜色有bug
                                type = "inline-math";
                                return;
                            }
                            const { backgroundColor, color, fontSize, textShadow, webkitTextStroke, webkitTextFillColor } = parseStyle(this.formatData.style);
                            if (backgroundColor) {
                                this.protyle.toolbar.setInlineMark(this.protyle, type, "range", {
                                    "type": "backgroundColor",
                                    "color": backgroundColor
                                });
                            }

                            if (color) {
                                this.protyle.toolbar.setInlineMark(this.protyle, type, "range", {
                                    "type": "color",
                                    "color": color
                                });
                            }

                            if (fontSize) {
                                this.protyle.toolbar.setInlineMark(this.protyle, type, "range", {
                                    "type": "fontSize",
                                    "color": fontSize
                                });
                            }
                            if (textShadow) {
                                this.protyle.toolbar.setInlineMark(this.protyle, type, "range", {
                                    "type": "style4", //投影效果
                                    "color": textShadow
                                });
                            }
                            if (webkitTextStroke) {
                                this.protyle.toolbar.setInlineMark(this.protyle, type, "range", {
                                    "type": "style2", //镂空效果
                                    "color": webkitTextStroke
                                });
                            }
                        }

                        // console.log("Format applied to selected text");
                        // 修改这部分:删除之前的collapse代码,改用以下代码设置光标位置
                        this.protyle.toolbar.range.collapse(false); // false表示折叠到末尾
                        
                        // 工具栏关闭
                        this.protyle.toolbar.element.classList.add("fn__none");

                    }
                }
            }
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                if (this.formatPainterEnable) {
                    // 阻止事件冒泡和默认行为
                    event.stopPropagation();
                    event.preventDefault();
                    
                    this.formatPainterEnable = false;
                    document.body.dataset.formatPainterEnable = "false";
                    this.formatData = null;
                    fetchPost("/api/notification/pushMsg", { "msg": this.i18n.disable, "timeout": 7000 });

                    ///v dock indicator worker
                    const indicator = document.querySelector(".siyuan-plugin-formatPainter_brush_indicator");
                    if (indicator) {
                        (indicator as HTMLElement).style.display = "none";
                    }
                    ///^ dock indicator worker

                    // 确保取消所有选择
                    window.getSelection()?.removeAllRanges();
                }
            }
        }, true); // 添加 true 参数使用事件捕获阶段


        const hasClosestByAttribute = (element: Node, attr: string, value: string | null, top = false) => {
            if (!element) {
                return false;
            }
            if (element.nodeType === 3) {
                element = element.parentElement;
            }
            let e = element as HTMLElement;
            let isClosest = false;
            while (e && !isClosest && (top ? e.tagName !== "BODY" : !e.classList.contains("protyle-wysiwyg"))) {
                if (typeof value === "string" && e.getAttribute(attr)?.split(" ").includes(value)) {
                    isClosest = true;
                } else if (typeof value !== "string" && e.hasAttribute(attr)) {
                    isClosest = true;
                } else {
                    e = e.parentElement;
                }
            }
            return isClosest && e;
        };
        const hasClosestBlock = (element: Node) => {
            const nodeElement = hasClosestByAttribute(element, "data-node-id", null);
            if (nodeElement && nodeElement.tagName !== "BUTTON" && nodeElement.getAttribute("data-type")?.startsWith("Node")) {
                return nodeElement;
            }
            return false;
        };
        const getContenteditableElement = (element: Element) => {
            if (!element || (element.getAttribute("contenteditable") === "true") && !element.classList.contains("protyle-wysiwyg")) {
                return element;
            }
            return element.querySelector('[contenteditable="true"]');
        };
        const setLastNodeRange = (editElement: Element, range: Range, setStart = true) => {
            if (!editElement) {
                return range;
            }
            let lastNode = editElement.lastChild as Element;
            while (lastNode && lastNode.nodeType !== 3) {
                if (lastNode.nodeType !== 3 && lastNode.tagName === "BR") {
                    // 防止单元格中 ⇧↓ 全部选中
                    return range;
                }
                // 最后一个为多种行内元素嵌套
                lastNode = lastNode.lastChild as Element;
            }
            if (!lastNode) {
                range.selectNodeContents(editElement);
                return range;
            }
            if (setStart) {
                range.setStart(lastNode, lastNode.textContent.length);
            } else {
                range.setEnd(lastNode, lastNode.textContent.length);
            }
            return range;
        };
        function parseStyle(styleString) {
            const styles = styleString.split(';').filter(s => s.trim() !== '');
            const styleObject = {};

            styles.forEach(style => {
                const [property, value] = style.split(':').map(s => s.trim());
                styleObject[property] = value;
            });

            return {
                backgroundColor: styleObject['background-color'],
                color: styleObject['color'],
                fontSize: styleObject['font-size'],
                textShadow: styleObject['text-shadow'],
                webkitTextStroke: styleObject['-webkit-text-stroke'],
                webkitTextFillColor: styleObject['-webkit-text-fill-color']
            };
        }


        console.log(this.i18n.helloPlugin);
    }
    getSelectedParentHtml() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            let selectedNode = range.startContainer;
            const endNode = range.endContainer;

            // 检查 endNode 的 previousSibling
            if (endNode.previousSibling && endNode.previousSibling.nodeType === Node.ELEMENT_NODE) {
                const previousSibling = endNode.previousSibling;
                if (previousSibling.tagName.toLowerCase() === "span" && previousSibling.classList.contains("render-node")) {
                    selectedNode = previousSibling;
                }
            }

            let parentElement = selectedNode.nodeType === Node.TEXT_NODE ? selectedNode.parentNode : selectedNode;
            while (parentElement && !parentElement.hasAttribute("data-type")) {
                parentElement = parentElement.parentElement;
            }

            if (parentElement && parentElement.tagName.toLowerCase() === "span") {
                const result = {
                    html: parentElement.outerHTML,
                    datatype: parentElement.getAttribute("data-type"),
                    style: parentElement.getAttribute("style")
                };
                // 清空选区
                selection.removeAllRanges();
                return result;
            }
        }
        // 清空选区
        selection.removeAllRanges();
        return null;
    }
    addDockBrushModeIndicator() {
        const indicator = document.createElement("div");
        indicator.classList.add("siyuan-plugin-formatPainter_brush_indicator", "status__counter", "toolbar__item", "ariaLabel", "blink-animation");
        indicator.innerHTML = `<svg class="icon"><use xlink:href="#iconFormat"></use></svg>`;
        this.addStatusBar({
            element: indicator,
        });
        // indicator添加aria - label
        indicator.setAttribute("aria-label", this.i18n.closeTips);
        indicator.style.display = "none";

        const style = document.createElement('style');
        style.textContent = `
            @keyframes blink {
                0% { opacity: 1; }
                50% { opacity: 0.2; }
                100% { opacity: 1; }
            }
            .blink-animation {
                animation: blink 1s infinite;
            }
        `;
        document.head.appendChild(style);

        indicator.addEventListener('click', () => {
            this.toggleFormatPainter();
        });
    }

    toggleFormatPainter() {
        if (this.formatPainterEnable) {
            fetchPost("/api/notification/pushMsg", { "msg": this.i18n.disable, "timeout": 7000 });
            document.body.dataset.formatPainterEnable = "false";
        } else {
            fetchPost("/api/notification/pushMsg", { "msg": this.i18n.enable, "timeout": 7000 });
            document.body.dataset.formatPainterEnable = "true";
        }
        this.formatPainterEnable = !this.formatPainterEnable;
        const indicator = document.querySelector(".siyuan-plugin-formatPainter_brush_indicator");
        if (indicator) {
            (indicator as HTMLElement).style.display = this.formatPainterEnable ? "flex" : "none";
        }
    }


    onLayoutReady() {
        this.addDockBrushModeIndicator();
    }

    onunload() {
        console.log(this.i18n.byePlugin);
    }

    uninstall() {
        console.log("uninstall");
    }


}