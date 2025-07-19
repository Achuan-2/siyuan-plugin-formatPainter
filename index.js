(()=>{"use strict";var __webpack_modules__={"./src/index.ts":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{eval(`{__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ PluginSample)
/* harmony export */ });
/* harmony import */ var siyuan__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! siyuan */ "siyuan");
/* harmony import */ var siyuan__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(siyuan__WEBPACK_IMPORTED_MODULE_0__);

class PluginSample extends siyuan__WEBPACK_IMPORTED_MODULE_0__.Plugin {
  constructor() {
    super(...arguments);
    this.formatPainterEnable = false;
    this.formatData = null;
  }
  // \u6DFB\u52A0\u5DE5\u5177\u680F\u6309\u94AE
  updateProtyleToolbar(toolbar) {
    toolbar.push(
      {
        name: "format-painter",
        icon: "iconFormat",
        tipPosition: "n",
        tip: this.i18n.tips,
        click: (protyle) => {
          this.protyle = protyle.protyle;
          if (!this.formatPainterEnable) {
            const selectedInfo = this.getSelectedParentHtml();
            if (selectedInfo) {
              this.formatData = {
                datatype: selectedInfo.datatype,
                style: selectedInfo.style
              };
            } else {
              this.formatData = null;
            }
            this.formatPainterEnable = true;
            document.body.dataset.formatPainterEnable = "true";
            (0,siyuan__WEBPACK_IMPORTED_MODULE_0__.fetchPost)("/api/notification/pushMsg", { "msg": this.i18n.enable, "timeout": 7e3 });
            const indicator = document.querySelector(".siyuan-plugin-formatPainter_brush_indicator");
            if (indicator) {
              indicator.style.display = "flex";
            }
            this.protyle.toolbar.range.collapse(true);
            const toolbarElements = document.querySelectorAll(".protyle-toolbar");
            toolbarElements.forEach((element) => {
              if (!element.classList.contains("fn__none")) {
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
    document.addEventListener("mouseup", (event) => {
      if (this.formatPainterEnable) {
        const selection = window.getSelection();
        let hasmath = false;
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          if (selectedText) {
            const startBlockElement = hasClosestBlock(range.startContainer);
            if (range.endContainer.nodeType !== 3 && range.endContainer.tagName === "DIV" && range.endOffset === 0) {
              if (range.endContainer.classList.contains("protyle-attr") && startBlockElement) {
                setLastNodeRange(getContenteditableElement(startBlockElement), range, false);
              }
            }
            this.protyle.toolbar.range = range;
            this.protyle.toolbar.setInlineMark(this.protyle, "clear", "range");
            if (!this.formatData) {
              this.protyle.toolbar.range.collapse(false);
              this.protyle.toolbar.element.classList.add("fn__none");
              return;
            }
            if (this.formatData.datatype) {
              if (this.formatData.datatype.includes("inline-math")) {
                this.protyle.toolbar.setInlineMark(this.protyle, "inline-math", "range", {
                  type: "inline-math"
                });
                hasmath = true;
              }
              const otherTypes = this.formatData.datatype.replace(/\\b(inline-math|block-ref|a|text)\\b/g, "").trim();
              if (otherTypes) {
                this.protyle.toolbar.setInlineMark(this.protyle, otherTypes, "range");
              }
            }
            if (this.formatData.style) {
              let type = "text";
              if (hasmath) {
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
                  "type": "style4",
                  //\u6295\u5F71\u6548\u679C
                  "color": textShadow
                });
              }
              if (webkitTextStroke) {
                this.protyle.toolbar.setInlineMark(this.protyle, type, "range", {
                  "type": "style2",
                  //\u9542\u7A7A\u6548\u679C
                  "color": webkitTextStroke
                });
              }
            }
            this.protyle.toolbar.range.collapse(false);
            this.protyle.toolbar.element.classList.add("fn__none");
          }
        }
      }
    });
    document.addEventListener("keydown", (event) => {
      var _a;
      if (event.key === "Escape") {
        if (this.formatPainterEnable) {
          event.stopPropagation();
          event.preventDefault();
          this.formatPainterEnable = false;
          document.body.dataset.formatPainterEnable = "false";
          this.formatData = null;
          (0,siyuan__WEBPACK_IMPORTED_MODULE_0__.fetchPost)("/api/notification/pushMsg", { "msg": this.i18n.disable, "timeout": 7e3 });
          const indicator = document.querySelector(".siyuan-plugin-formatPainter_brush_indicator");
          if (indicator) {
            indicator.style.display = "none";
          }
          (_a = window.getSelection()) == null ? void 0 : _a.removeAllRanges();
        }
      }
    }, true);
    const hasClosestByAttribute = (element, attr, value, top = false) => {
      var _a;
      if (!element) {
        return false;
      }
      if (element.nodeType === 3) {
        element = element.parentElement;
      }
      let e = element;
      let isClosest = false;
      while (e && !isClosest && (top ? e.tagName !== "BODY" : !e.classList.contains("protyle-wysiwyg"))) {
        if (typeof value === "string" && ((_a = e.getAttribute(attr)) == null ? void 0 : _a.split(" ").includes(value))) {
          isClosest = true;
        } else if (typeof value !== "string" && e.hasAttribute(attr)) {
          isClosest = true;
        } else {
          e = e.parentElement;
        }
      }
      return isClosest && e;
    };
    const hasClosestBlock = (element) => {
      var _a;
      const nodeElement = hasClosestByAttribute(element, "data-node-id", null);
      if (nodeElement && nodeElement.tagName !== "BUTTON" && ((_a = nodeElement.getAttribute("data-type")) == null ? void 0 : _a.startsWith("Node"))) {
        return nodeElement;
      }
      return false;
    };
    const getContenteditableElement = (element) => {
      if (!element || element.getAttribute("contenteditable") === "true" && !element.classList.contains("protyle-wysiwyg")) {
        return element;
      }
      return element.querySelector('[contenteditable="true"]');
    };
    const setLastNodeRange = (editElement, range, setStart = true) => {
      if (!editElement) {
        return range;
      }
      let lastNode = editElement.lastChild;
      while (lastNode && lastNode.nodeType !== 3) {
        if (lastNode.nodeType !== 3 && lastNode.tagName === "BR") {
          return range;
        }
        lastNode = lastNode.lastChild;
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
      const styles = styleString.split(";").filter((s) => s.trim() !== "");
      const styleObject = {};
      styles.forEach((style) => {
        const [property, value] = style.split(":").map((s) => s.trim());
        styleObject[property] = value;
      });
      return {
        backgroundColor: styleObject["background-color"],
        color: styleObject["color"],
        fontSize: styleObject["font-size"],
        textShadow: styleObject["text-shadow"],
        webkitTextStroke: styleObject["-webkit-text-stroke"],
        webkitTextFillColor: styleObject["-webkit-text-fill-color"]
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
        selection.removeAllRanges();
        return result;
      }
    }
    selection.removeAllRanges();
    return null;
  }
  addDockBrushModeIndicator() {
    const indicator = document.createElement("div");
    indicator.classList.add("siyuan-plugin-formatPainter_brush_indicator", "status__counter", "toolbar__item", "ariaLabel", "blink-animation");
    indicator.innerHTML = \`<svg class="icon"><use xlink:href="#iconFormat"></use></svg>\`;
    this.addStatusBar({
      element: indicator
    });
    indicator.setAttribute("aria-label", this.i18n.closeTips);
    indicator.style.display = "none";
    const style = document.createElement("style");
    style.textContent = \`
            @keyframes blink {
                0% { opacity: 1; }
                50% { opacity: 0.2; }
                100% { opacity: 1; }
            }
            .blink-animation {
                animation: blink 1s infinite;
            }
        \`;
    document.head.appendChild(style);
    indicator.addEventListener("click", () => {
      this.toggleFormatPainter();
    });
  }
  toggleFormatPainter() {
    if (this.formatPainterEnable) {
      (0,siyuan__WEBPACK_IMPORTED_MODULE_0__.fetchPost)("/api/notification/pushMsg", { "msg": this.i18n.disable, "timeout": 7e3 });
      document.body.dataset.formatPainterEnable = "false";
    } else {
      (0,siyuan__WEBPACK_IMPORTED_MODULE_0__.fetchPost)("/api/notification/pushMsg", { "msg": this.i18n.enable, "timeout": 7e3 });
      document.body.dataset.formatPainterEnable = "true";
    }
    this.formatPainterEnable = !this.formatPainterEnable;
    const indicator = document.querySelector(".siyuan-plugin-formatPainter_brush_indicator");
    if (indicator) {
      indicator.style.display = this.formatPainterEnable ? "flex" : "none";
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


//# sourceURL=webpack://test_quote/./src/index.ts?
}`)},siyuan:e=>{e.exports=require("siyuan")}},__webpack_module_cache__={};function __webpack_require__(e){var t=__webpack_module_cache__[e];if(t!==void 0)return t.exports;var n=__webpack_module_cache__[e]={exports:{}};return __webpack_modules__[e](n,n.exports,__webpack_require__),n.exports}__webpack_require__.n=e=>{var t=e&&e.__esModule?()=>e.default:()=>e;return __webpack_require__.d(t,{a:t}),t},__webpack_require__.d=(e,t)=>{for(var n in t)__webpack_require__.o(t,n)&&!__webpack_require__.o(e,n)&&Object.defineProperty(e,n,{enumerable:!0,get:t[n]})},__webpack_require__.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),__webpack_require__.r=e=>{typeof Symbol<"u"&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})};var __webpack_exports__=__webpack_require__("./src/index.ts");module.exports=__webpack_exports__})();
