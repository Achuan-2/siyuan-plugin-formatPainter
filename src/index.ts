import {
    Plugin,
    showMessage,
    Dialog,
    getFrontend,
    getBackend,
    Protyle
} from "siyuan";
import "@/index.scss";

import SettingPannel from "@/libs/setting-panel.svelte";
import { appendBlock, deleteBlock, setBlockAttrs } from "./api";

const STORAGE_NAME = "menu-config";
const zeroWhite = "​"

let addFloatLayer
export default class PluginMemo extends Plugin {

    private isMobile: boolean;

    // 添加工具栏按钮
    updateProtyleToolbar(toolbar: Array<string | IMenuItem>) {
        toolbar.push(
            {
                name: "footnote",
                icon: "iconInfo",
                tipPosition: "n",
                tip: this.i18n.tips,
                click: (protyle: Protyle) => {
                    this.protyle = protyle.protyle;
                    addMemoBlock(this.protyle);
                }
            }
        );
        return toolbar;
    }

    async onload() {
        this.data[STORAGE_NAME] = { readonlyText: "Readonly" };

        console.log("loading plugin-sample", this.i18n);
        addFloatLayer = this.addFloatLayer

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        // 图标的制作参见帮助文档
        console.log(this.i18n.helloPlugin);
        this.eventBus.on("open-menu-blockref",this.deleteMemo)
        this.addCommand({
            langKey:"addMemo",
            hotkey:"",
            langText:"add memo",
            editorCallback:(protyle:any)=>{
                addMemoBlock(protyle)
            }
        })
    }

    onLayoutReady() {
        this.loadData(STORAGE_NAME);
        console.log(`frontend: ${getFrontend()}; backend: ${getBackend()}`);
    }

    onunload() {
        console.log(this.i18n.byePlugin);
        showMessage("Goodbye SiYuan Plugin");
        console.log("onunload");
    }

    /**
     * A custom setting pannel provided by svelte
     */
    openDIYSetting(): void {
        let dialog = new Dialog({
            title: "SettingPannel",
            content: `<div id="SettingPanel"></div>`,
            width: "600px",
            destroyCallback: (options) => {
                console.log("destroyCallback", options);
                //You'd better destroy the component when the dialog is closed
                pannel.$destroy();
            }
        });
        let pannel = new SettingPannel({
            target: dialog.element.querySelector("#SettingPanel"),
        });
    }

    private deleteMemo({ detail }: any){
        // console.log(detail)
        if(detail.element && detail.element.style.cssText.indexOf("memo")!=-1){
           detail.menu.addItem({
            icon: "iconTrashcan",
            label: "删除 Memo",
            click: () => {
                deleteBlock(detail.element.getAttribute("data-id"));
                detail.element.outerHTML = detail.element.innerText
            }
        });
        }
    }
}


async function addMemoBlock(protyle: IProtyle) {
    // TODO: 选择是末尾添加还是添加到指定文档后面
    // const DocumentId = protyle.block.id
    const DocumentId = "20241118003530-etccqfd"
    // 选中的文本添加下划线
    // protyle.toolbar.setInlineMark(protyle, "u", "range");

    // 添加脚注
    document.execCommand('copy')
    const selection= await navigator.clipboard.readText();
    let back = await appendBlock("markdown",`
>> ${selection}
>> 
> 
> ${zeroWhite}
`, DocumentId)
    let newBlockId = back[0].doOperations[0].id

    
    const { x, y } = protyle.toolbar.range.getClientRects()[0]
    let range = protyle.toolbar.range;

    //
    const str = ""
    const textNode = document.createTextNode(str);
    // 将范围的起始点和结束点都移动到选中文本的末尾
    range.collapse(false);
    protyle.toolbar.range.insertNode(textNode);
    protyle.toolbar.range.setEndAfter(textNode);
    protyle.toolbar.range.setStartBefore(textNode);

    // 添加块引，同时添加上标样式
    protyle.toolbar.setInlineMark(protyle, "block-ref sup", "range", {
        type: "id",
        color:`${newBlockId+zeroWhite+""+zeroWhite+"注"}`
    });

    // 关闭工具栏
    protyle.toolbar.element.classList.add("fn__none")
    // saveViaTransaction(memoELement)
    addFloatLayer({
        ids: [newBlockId],
        defIds: [],
        x: x,
        y: y-70
    });
}

export function saveViaTransaction(protyleElem) {
    let protyle:HTMLElement
    if (protyleElem!=null){
        protyle = protyleElem
    }
    if (protyle === null)
        protyle = document.querySelector(".card__block.fn__flex-1.protyle:not(.fn__none) .protyle-wysiwyg.protyle-wysiwyg--attr")
    if (protyle === null)
        protyle = document.querySelector('.fn__flex-1.protyle:not(.fn__none) .protyle-wysiwyg.protyle-wysiwyg--attr') //需要获取到当前正在编辑的 protyle
    let e = document.createEvent('HTMLEvents')
    e.initEvent('input', true, false)
    protyle.dispatchEvent(e)
  }
