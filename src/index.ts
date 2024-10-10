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


const STORAGE_NAME = "menu-config";

export default class PluginSample extends Plugin {
    private isMobile: boolean;
    private formatPainterEnable = false;
    private formatData: { datatype: string, style: string } | null = null;
    private protyle: IProtyle;
    onload() {
        this.data[STORAGE_NAME] = { readonlyText: "Readonly" };
        this.protyleOptions = {
            toolbar: ["block-ref",
                "a",
                "|",
                "text",
                "strong",
                "em",
                "u",
                "s",
                "mark",
                "sup",
                "sub",
                "clear",
                "|",
                "code",
                "kbd",
                "tag",
                "inline-math",
                "inline-memo",
                "|",
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
                            document.body.dataset.formatPainterEnable ="true";
                            // console.log(this.formatData);
                            fetchPost("/api/notification/pushErrMsg", { "msg": this.i18n.enable, "timeout": 7000 });
                            this.protyle.toolbar.range.collapse(true);
                            // 关闭toolbar
                            // 选择所有具有 .protyle-toolbar 类的元素
                            const toolbarElements = document.querySelectorAll('.protyle-toolbar');

                            // 遍历选中的元素
                            toolbarElements.forEach(element => {
                                // 检查元素是否没有 .fn__none 类
                                if (!element.classList.contains('fn__none')) {
                                    // 如果没有 .fn__none 类，则添加它
                                    element.classList.add('fn__none');
                                }
                            });


                        }
                    }
                }
            ],
        };

        document.addEventListener('mouseup', (event) => {
            if (this.formatPainterEnable) {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const selectedText = range.toString();
                    if (selectedText) {

                        this.protyle.toolbar.range = range;  // 更改选区
                        // console.log(this.protyle.toolbar.range.toString());
                        // Apply the stored format to the selected text
                        // 如果都为空
                        this.protyle.toolbar.setInlineMark(this.protyle, "clear", "range");
                        if (this.formatData.datatype) {
                            this.protyle.toolbar.setInlineMark(this.protyle, this.formatData.datatype, "range");
                        }
                        if (this.formatData.style) {
                            // this.protyle.toolbar.setInlineMark(this.protyle, "text", "range", { "type": "style1", "color": this.formatData.style });
                            const { backgroundColor, color, fontSize, textShadow, webkitTextStroke, webkitTextFillColor} = parseStyle(this.formatData.style);
                            // console.log(backgroundColor, color, fontSize, textShadow);

                            if (backgroundColor) {
                                this.protyle.toolbar.setInlineMark(this.protyle, "text", "range", {
                                    "type": "backgroundColor",
                                    "color": backgroundColor
                                });
                            }

                            if (color) {
                                this.protyle.toolbar.setInlineMark(this.protyle, "text", "range", {
                                    "type": "color",
                                    "color": color
                                });
                            }

                            if (fontSize) {
                                this.protyle.toolbar.setInlineMark(this.protyle, "text", "range", {
                                    "type": "fontSize",
                                    "color": fontSize
                                });
                            }
                            if (textShadow) {
                                this.protyle.toolbar.setInlineMark(this.protyle, "text", "range", {
                                    "type": "style4", //投影效果
                                    "color": textShadow 
                                });
                            }
                            if (webkitTextStroke) {
                                this.protyle.toolbar.setInlineMark(this.protyle, "text", "range", {
                                    "type": "style2", //镂空效果
                                    "color": webkitTextStroke
                                });
                            }
                        }

                        // console.log("Format applied to selected text");
                        // 清空选区
                        selection.removeAllRanges();
                    }
                }
            }
        });
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
        document.addEventListener('keydown', (event) => {
            if (event.key === "Escape") {
                if (this.formatPainterEnable) {
                    this.formatPainterEnable = false;
                    document.body.dataset.formatPainterEnable = "false";
                    this.formatData = null;
                    document.body.style.cursor = "auto"; // 恢复默认光标
                    fetchPost("/api/notification/pushMsg", { "msg": this.i18n.disable, "timeout": 7000 });
                }
            }
        });

        console.log(this.i18n.helloPlugin);
    }

    getSelectedParentHtml() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const selectedNode = range.startContainer;
            const startNode = selectedNode.nodeType === Node.TEXT_NODE ? selectedNode.parentNode : selectedNode;
            let parentElement = selectedNode.parentElement;
            while (parentElement && !parentElement.hasAttribute("data-type")) {
                parentElement = parentElement.parentElement;
            }
            if (parentElement.tagName.toLowerCase() === "span") {
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

    onLayoutReady() {
    }

    onunload() {
        console.log(this.i18n.byePlugin);
    }

    uninstall() {
        console.log("uninstall");
    }
}
