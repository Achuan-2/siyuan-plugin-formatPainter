import {
    Dialog,
    Menu,
    Plugin,
    Protyle,
    fetchPost,
    type IProtyle,
} from "siyuan";
import type { IMenuItem } from "siyuan/types";

import { updateBlock } from "./api";
import "./index.css";

type PainterMode = "inline" | "heading" | "block";

interface BlockStyle {
    backgroundColor?: string;
    color?: string;
}

interface FormatPainterStyle {
    backgroundColor?: string;
    color?: string;
    fontSize?: string;
    shadow?: boolean;
    hollow?: boolean;
}

interface FormatPainterSnapshot {
    styles: FormatPainterStyle;
    types: string[];
}

interface FormatPainterSegment {
    styles: FormatPainterStyle;
    types: string[];
}

interface InlineMarkOption {
    type: string;
    color?: string;
}

type FormatPainterToolbar = IProtyle["toolbar"] & {
    applyFormatPainter?: (protyle: IProtyle, snapshot: FormatPainterSnapshot) => boolean;
    setInlineMark: (
        protyle: IProtyle,
        type: string,
        action: "range" | "toolbar",
        textObj?: InlineMarkOption,
    ) => unknown;
};

interface InlineFormat {
    kind: "inline";
    snapshot: FormatPainterSnapshot;
}

interface HeadingFormat {
    kind: "heading";
    blockType: "NodeHeading" | "NodeParagraph";
    subtype?: string;
    blockStyle: BlockStyle;
}

interface BlockFormat {
    kind: "block";
    blockStyle: BlockStyle;
}

type FormatData = InlineFormat | HeadingFormat | BlockFormat;

interface FormatPreset {
    id: string;
    name: string;
    createdAt: number;
    format: FormatData;
}

interface SourceSnapshot {
    inline: InlineFormat | null;
    blockElement: HTMLElement | null;
    range: Range | null;
}

const PRESET_FILE = "format-painter-presets.json";
const ICON_ID = "iconFormatPainterBrush";
const FORMAT_PAINTER_TYPES = ["strong", "em", "u", "s", "mark", "sup", "sub", "code", "kbd"];

export default class FormatPainterPlugin extends Plugin {
    private formatPainterEnable = false;
    private formatData: FormatData | null = null;
    private protyle: IProtyle | null = null;
    private sourceSnapshot: SourceSnapshot | null = null;
    private presets: FormatPreset[] = [];
    private applyingBlock = false;
    private indicator: HTMLElement | null = null;
    private indicatorStyle: HTMLStyleElement | null = null;

    private readonly editorClickHandler = (event: CustomEvent<{
        protyle: IProtyle;
        event: MouseEvent;
    }>) => {
        void this.handleEditorClick(event.detail.event, event.detail.protyle);
    };

    private readonly toolbarMouseDownHandler = (event: MouseEvent) => {
        const target = event.target as Element | null;
        const button = target?.closest('button[data-type="format-painter"]') as HTMLButtonElement | null;
        if (!button?.closest(".protyle-toolbar")) {
            return;
        }
        // Match SiYuan's native FormatPainter button: preserve the selection and
        // prevent the global click handler from immediately removing the menu.
        event.preventDefault();
        button.dataset.menu = "true";
    };

    private readonly keydownHandler = (event: KeyboardEvent) => {
        if (event.key !== "Escape" || !this.formatPainterEnable) {
            return;
        }
        event.stopPropagation();
        event.preventDefault();
        this.disableFormatPainter();
    };

    updateProtyleToolbar(toolbar: Array<string | IMenuItem>) {
        toolbar.push({
            name: "format-painter",
            icon: ICON_ID,
            tipPosition: "n",
            tip: this.i18n.tips,
            click: (protyle: Protyle) => {
                this.protyle = protyle.protyle;
                this.sourceSnapshot = this.captureSourceSnapshot();
                this.openPainterMenu();
            },
        });
        return toolbar;
    }

    async onload() {
        this.addIcons(`
            <symbol id="${ICON_ID}" viewBox="0 0 1024 1024">
                <path d="M701.248 177.6l175.104-113.024 83.456 114.88-131.136 162.304-127.424-164.16z m-133.376-61.568c51.264 6.976 300.608 346.624 294.272 384.704s-145.536 143.68-145.536 143.68L400.64 238.592s116.032-129.6 167.232-122.56zM370.368 288.448l305.024 396.672-187.136 272L65.664 359.04s83.776-3.84 153.536-24.32c45.632-13.504 151.232-46.272 151.168-46.272z" fill="currentColor"/>
            </symbol>
        `);

        const savedPresets = await this.loadData(PRESET_FILE);
        if (Array.isArray(savedPresets)) {
            this.presets = savedPresets
                .map((preset) => this.normalizePreset(preset))
                .filter((preset): preset is FormatPreset => Boolean(preset));
        }

        this.eventBus.on("click-editorcontent", this.editorClickHandler);
        document.addEventListener("mousedown", this.toolbarMouseDownHandler, true);
        document.addEventListener("keydown", this.keydownHandler, true);
        document.body.dataset.formatPainterEnable = "false";
    }

    onLayoutReady() {
        this.addDockBrushModeIndicator();
    }

    onunload() {
        this.eventBus.off("click-editorcontent", this.editorClickHandler);
        document.removeEventListener("mousedown", this.toolbarMouseDownHandler, true);
        document.removeEventListener("keydown", this.keydownHandler, true);
        delete document.body.dataset.formatPainterEnable;
        this.indicatorStyle?.remove();
    }

    private openPainterMenu() {
        const button = this.protyle?.toolbar.element.querySelector(
            'button[data-type="format-painter"]',
        ) as HTMLButtonElement | null;
        button?.setAttribute("data-menu", "true");

        // Follow SiYuan's native FormatPainter.ts menu lifecycle. Avoid a named
        // Menu here because the shared global menu may retain its previous name.
        window.siyuan.menus.menu.remove();
        const menu = new Menu();
        const activeMode = this.formatData?.kind;

        menu.addItem({
            icon: "iconFont",
            label: this.i18n.inlinePainter,
            current: activeMode === "inline" && this.formatPainterEnable,
            click: () => this.activateFromSource("inline"),
        });
        menu.addItem({
            icon: "iconHeadings",
            label: this.i18n.headingPainter,
            current: activeMode === "heading" && this.formatPainterEnable,
            click: () => this.activateFromSource("heading"),
        });
        menu.addItem({
            icon: "iconParagraph",
            label: this.i18n.blockPainter,
            current: activeMode === "block" && this.formatPainterEnable,
            click: () => this.activateFromSource("block"),
        });
        menu.addSeparator();
        const source = this.sourceSnapshot;
        const savePresetItems = [
            ...(this.formatData ? [{
                icon: ICON_ID,
                label: this.i18n.activePainterFormat,
                click: () => {
                    void this.saveFormatAsPreset(this.formatData);
                },
            }] : []),
            {
                icon: "iconFont",
                label: this.i18n.inlinePainter,
                disabled: !source?.inline,
                click: () => {
                    void this.saveSourceAsPreset("inline");
                },
            },
            {
                icon: "iconHeadings",
                label: this.i18n.headingPainter,
                disabled: !this.isHeadingSourceBlock(source?.blockElement),
                click: () => {
                    void this.saveSourceAsPreset("heading");
                },
            },
            {
                icon: "iconParagraph",
                label: this.i18n.blockPainter,
                disabled: !source?.blockElement,
                click: () => {
                    void this.saveSourceAsPreset("block");
                },
            },
        ];
        menu.addItem({
            icon: "iconSave",
            label: this.i18n.savePreset,
            disabled: savePresetItems.every((item) => item.disabled),
            type: "submenu",
            submenu: savePresetItems,
        });

        if (this.presets.length > 0) {
            menu.addItem({
                icon: "iconHistory",
                label: this.i18n.usePreset,
                type: "submenu",
                submenu: this.presets.map((preset) => ({
                    icon: this.getModeIcon(preset.format.kind),
                    label: `${this.getModeLabel(preset.format.kind)} · ${preset.name}`,
                    click: () => this.activatePreset(preset),
                })),
            });
            menu.addItem({
                icon: "iconTrashcan",
                label: this.i18n.deletePreset,
                type: "submenu",
                submenu: this.presets.map((preset) => ({
                    icon: "iconTrashcan",
                    label: `${this.getModeLabel(preset.format.kind)} · ${preset.name}`,
                    click: () => this.confirmDeletePreset(preset),
                })),
            });
        } else {
            menu.addItem({
                icon: "iconHistory",
                label: this.i18n.noPresets,
                disabled: true,
            });
        }

        const rect = button?.getBoundingClientRect();
        menu.open({
            x: rect?.left ?? window.innerWidth / 2,
            y: rect?.bottom ?? window.innerHeight / 2,
            h: rect?.height,
        });
    }

    private activateFromSource(mode: PainterMode) {
        const format = this.createFormatFromSource(mode, true);
        if (format) {
            this.enableFormatPainter(format);
        }
    }

    private createFormatFromSource(mode: PainterMode, showError: boolean): FormatData | null {
        const source = this.sourceSnapshot;
        if (mode === "inline") {
            if (!source?.inline && showError) {
                this.notify(this.i18n.selectInlineSource);
            }
            return source?.inline ?? null;
        }
        if (mode === "heading") {
            const sourceBlock = source?.blockElement;
            if (!this.isHeadingSourceBlock(sourceBlock)) {
                if (showError) {
                    this.notify(this.i18n.selectHeadingSource);
                }
                return null;
            }
            const blockType = sourceBlock.dataset.type === "NodeHeading" ? "NodeHeading" : "NodeParagraph";
            const subtype = blockType === "NodeHeading" ? sourceBlock.dataset.subtype : undefined;
            if (blockType === "NodeHeading" && (!subtype || !/^h[1-6]$/.test(subtype))) {
                if (showError) {
                    this.notify(this.i18n.selectHeadingSource);
                }
                return null;
            }
            return {
                kind: "heading",
                blockType,
                subtype,
                blockStyle: this.captureBlockStyle(sourceBlock),
            };
        }
        if (!source?.blockElement) {
            if (showError) {
                this.notify(this.i18n.selectBlockSource);
            }
            return null;
        }
        return {
            kind: "block",
            blockStyle: this.captureBlockStyle(source.blockElement),
        };
    }

    private async activatePreset(preset: FormatPreset) {
        const format = this.cloneFormat(preset.format);
        const source = this.sourceSnapshot;
        let applied = false;

        try {
            if (format.kind === "inline") {
                applied = this.applyInlineFormat(format, source?.range ?? undefined);
            } else if (format.kind === "heading") {
                if (source?.blockElement) {
                    applied = await this.applyHeadingFormat(source.blockElement, format);
                }
            } else if (source?.blockElement) {
                applied = await this.applyBlockFormat(source.blockElement, format);
            }
        } catch (error) {
            console.error("[Format Painter] Failed to apply preset", error);
            this.notify(this.i18n.applyFailed);
            return;
        }

        if (!applied) {
            if (format.kind === "inline") {
                this.notify(this.i18n.selectInlineSource);
            } else if (!source?.blockElement) {
                this.notify(this.i18n.selectBlockSource);
            }
            return;
        }
        this.enableFormatPainter(format);
    }

    private enableFormatPainter(format: FormatData) {
        this.formatData = format;
        this.formatPainterEnable = true;
        document.body.dataset.formatPainterEnable = "true";
        this.updateIndicator();
        this.closeInlineToolbar();
        window.getSelection()?.removeAllRanges();
        this.notify(`${this.getModeLabel(format.kind)}：${this.i18n.enable}`);
    }

    private disableFormatPainter() {
        this.formatPainterEnable = false;
        this.formatData = null;
        this.sourceSnapshot = null;
        document.body.dataset.formatPainterEnable = "false";
        this.updateIndicator();
        window.getSelection()?.removeAllRanges();
        this.notify(this.i18n.disable);
    }

    private async handleEditorClick(event: MouseEvent, targetProtyle: IProtyle) {
        if (!this.formatPainterEnable || !this.formatData || targetProtyle.disabled) {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (!target?.closest(".protyle-wysiwyg")) {
            return;
        }

        if (this.formatData.kind === "inline") {
            this.applyInlineFormat(this.formatData, undefined, targetProtyle);
            return;
        }

        if (this.applyingBlock) {
            return;
        }
        const blockElement = target.closest(
            '[data-node-id][data-type^="Node"]',
        ) as HTMLElement | null;
        if (!blockElement) {
            return;
        }

        this.applyingBlock = true;
        try {
            if (this.formatData.kind === "heading") {
                await this.applyHeadingFormat(blockElement, this.formatData);
            } else {
                await this.applyBlockFormat(blockElement, this.formatData);
            }
        } catch (error) {
            console.error("[Format Painter] Failed to apply block format", error);
            this.notify(this.i18n.applyFailed);
        } finally {
            this.applyingBlock = false;
        }
    }

    private applyInlineFormat(
        format: InlineFormat,
        targetRange?: Range,
        targetProtyle: IProtyle | null = this.protyle,
    ) {
        if (!targetProtyle) {
            return false;
        }
        let range = targetRange?.cloneRange();
        if (!range) {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                return false;
            }
            range = selection.getRangeAt(0);
        }
        const selectedText = range.toString();
        if (!selectedText) {
            return false;
        }

        const toolbar = targetProtyle.toolbar as FormatPainterToolbar;
        toolbar.range = range;

        // Use the target editor's toolbar, just like SiYuan's global FormatPainterController.
        // This keeps the painter shared while allowing it to paint across tabs and floating editors.
        const applied = typeof toolbar.applyFormatPainter === "function"
            ? toolbar.applyFormatPainter(targetProtyle, format.snapshot)
            : this.applyLegacyInlineFormat(targetProtyle, toolbar, format.snapshot);
        if (applied) {
            toolbar.element.classList.add("fn__none");
            return true;
        }
        return false;
    }

    /** SiYuan < 3.8 fallback using the public inline-mark API used by this plugin historically. */
    private applyLegacyInlineFormat(
        protyle: IProtyle,
        toolbar: FormatPainterToolbar,
        snapshot: FormatPainterSnapshot,
    ) {
        const applyMark = (type: string, textObj?: InlineMarkOption) => {
            toolbar.setInlineMark(protyle, type, "range", textObj);
        };

        applyMark("clear");
        snapshot.types.forEach((type) => applyMark(type));
        if (snapshot.styles.backgroundColor) {
            applyMark("text", { type: "backgroundColor", color: snapshot.styles.backgroundColor });
        }
        if (snapshot.styles.color) {
            applyMark("text", { type: "color", color: snapshot.styles.color });
        }
        if (snapshot.styles.fontSize) {
            applyMark("text", { type: "fontSize", color: snapshot.styles.fontSize });
        }
        if (snapshot.styles.shadow) {
            applyMark("text", { type: "style4" });
        }
        if (snapshot.styles.hollow) {
            applyMark("text", { type: "style2" });
        }
        return true;
    }

    private async applyHeadingFormat(target: HTMLElement, format: HeadingFormat) {
        if (!["NodeParagraph", "NodeHeading"].includes(target.dataset.type ?? "")) {
            this.notify(this.i18n.headingTargetInvalid);
            return false;
        }

        const clone = target.cloneNode(true) as HTMLElement;
        clone.classList.remove("p", "h1", "h2", "h3", "h4", "h5", "h6");
        if (format.blockType === "NodeHeading" && format.subtype) {
            clone.dataset.type = "NodeHeading";
            clone.dataset.subtype = format.subtype;
            clone.classList.add(format.subtype);
        } else {
            clone.dataset.type = "NodeParagraph";
            delete clone.dataset.subtype;
            clone.classList.add("p");
        }
        this.replaceBlockStyle(clone, format.blockStyle);
        await updateBlock("dom", clone.outerHTML, target.dataset.nodeId);
        return true;
    }

    private async applyBlockFormat(target: HTMLElement, format: BlockFormat) {
        const clone = target.cloneNode(true) as HTMLElement;
        this.replaceBlockStyle(clone, format.blockStyle);
        await updateBlock("dom", clone.outerHTML, target.dataset.nodeId);
        return true;
    }

    private captureSourceSnapshot(): SourceSnapshot {
        const range = this.getCurrentRange();
        if (!range) {
            return { inline: null, blockElement: null, range: null };
        }

        const blockElement = this.findClosestBlock(range.startContainer);
        return {
            inline: range.collapsed ? null : this.captureInlineFormat(range),
            blockElement,
            range: range.cloneRange(),
        };
    }

    private getCurrentRange() {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
            return selection.getRangeAt(0).cloneRange();
        }
        return this.protyle?.toolbar.range?.cloneRange() ?? null;
    }

    private captureInlineFormat(range: Range): InlineFormat | null {
        const rootElement = this.protyle?.wysiwyg.element;
        if (!rootElement || !rootElement.contains(range.startContainer) || !rootElement.contains(range.endContainer)) {
            return null;
        }

        const segments: FormatPainterSegment[] = [];
        const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
        let textNode = walker.nextNode() as Text | null;
        while (textNode) {
            if (range.intersectsNode(textNode)) {
                const start = range.startContainer === textNode ? range.startOffset : 0;
                const end = range.endContainer === textNode ? range.endOffset : textNode.data.length;
                const selectedText = textNode.data.substring(start, end).split("\u200b").join("");
                if (start < end && selectedText) {
                    const editableElement = this.getFormatPainterEditableElement(textNode);
                    if (editableElement) {
                        const segment = this.getFormatPainterSegment(textNode, editableElement);
                        if (segment) {
                            segments.push(segment);
                        }
                    }
                }
            }
            textNode = walker.nextNode() as Text | null;
        }

        const snapshot = this.getCommonFormatPainterSnapshot(segments);
        return snapshot ? { kind: "inline", snapshot } : null;
    }

    /** Mirrors SiYuan's FormatPainter.ts getSegment(). */
    private getFormatPainterSegment(textNode: Text, editableElement: Element): FormatPainterSegment | null {
        const types: string[] = [];
        const styles: FormatPainterStyle = {};
        let element = textNode.parentElement;
        while (element && editableElement.contains(element)) {
            const elementTypes = (element.getAttribute("data-type") || "").split(" ").filter(Boolean);
            types.push(...elementTypes);
            if (elementTypes.includes("inline-math")) {
                return null;
            }
            if (elementTypes.includes("text")) {
                styles.backgroundColor ||= element.style.backgroundColor || undefined;
                styles.color ||= element.style.color || undefined;
                styles.fontSize ||= element.style.fontSize || undefined;
                styles.shadow ||= Boolean(element.style.textShadow) || undefined;
                styles.hollow ||= Boolean(element.style.webkitTextStroke) || undefined;
            }
            if (element === editableElement) {
                break;
            }
            element = element.parentElement;
        }
        return {
            styles,
            types: [...new Set(types)].filter((type) => FORMAT_PAINTER_TYPES.includes(type)),
        };
    }

    /** Mirrors formatPainterCore.ts: only formats common to every selected segment are copied. */
    private getCommonFormatPainterSnapshot(segments: FormatPainterSegment[]): FormatPainterSnapshot | null {
        if (segments.length === 0) {
            return null;
        }
        const styles: FormatPainterStyle = {};
        const keys: Array<keyof FormatPainterStyle> = [
            "backgroundColor",
            "color",
            "fontSize",
            "shadow",
            "hollow",
        ];
        keys.forEach((key) => {
            const value = segments[0].styles[key];
            if (value && segments.every((segment) => segment.styles[key] === value)) {
                (styles as Record<keyof FormatPainterStyle, string | boolean>)[key] = value;
            }
        });
        return {
            styles,
            types: FORMAT_PAINTER_TYPES.filter((type) =>
                segments.every((segment) => segment.types.includes(type))),
        };
    }

    private getFormatPainterEditableElement(textNode: Text): Element | null {
        const blockElement = this.findClosestBlock(textNode);
        if (!blockElement || ["NodeCodeBlock", "NodeAttributeView"].includes(blockElement.dataset.type ?? "")) {
            return null;
        }
        const embedElement = blockElement.closest('[data-type="NodeBlockQueryEmbed"]');
        if (embedElement && embedElement !== blockElement) {
            return null;
        }
        if (blockElement.dataset.type === "NodeTable") {
            return textNode.parentElement?.closest("th, td") ?? null;
        }
        const editableElement = this.getContenteditableElement(blockElement);
        return editableElement?.contains(textNode) ? editableElement : null;
    }

    private captureBlockStyle(element: HTMLElement): BlockStyle {
        return {
            backgroundColor: element.style.backgroundColor || undefined,
            color: element.style.color || undefined,
        };
    }

    private replaceBlockStyle(element: HTMLElement, blockStyle: BlockStyle) {
        element.style.removeProperty("background-color");
        element.style.removeProperty("color");
        if (blockStyle.backgroundColor) {
            element.style.backgroundColor = blockStyle.backgroundColor;
        }
        if (blockStyle.color) {
            element.style.color = blockStyle.color;
        }
        if (!element.style.cssText) {
            element.removeAttribute("style");
        }
    }

    private isHeadingSourceBlock(element?: HTMLElement | null) {
        return Boolean(element?.dataset.type?.startsWith("Node"));
    }

    private findClosestBlock(node: Node): HTMLElement | null {
        const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement;
        const block = element?.closest('[data-node-id][data-type^="Node"]') as HTMLElement | null;
        return block?.tagName === "BUTTON" ? null : block;
    }

    private getContenteditableElement(element: Element) {
        if (element.getAttribute("contenteditable") === "true" && !element.classList.contains("protyle-wysiwyg")) {
            return element;
        }
        return element.querySelector('[contenteditable="true"]');
    }

    private async saveSourceAsPreset(mode: PainterMode) {
        const format = this.createFormatFromSource(mode, true);
        if (format) {
            await this.saveFormatAsPreset(format);
        }
    }

    private async saveFormatAsPreset(format: FormatData | null) {
        if (!format) {
            return;
        }
        const name = await this.askPresetName();
        if (!name) {
            return;
        }
        this.presets.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            createdAt: Date.now(),
            format: this.cloneFormat(format),
        });
        await this.saveData(PRESET_FILE, this.presets);
        this.notify(this.i18n.presetSaved);
    }

    private askPresetName() {
        return new Promise<string | null>((resolve) => {
            let settled = false;
            const finish = (value: string | null) => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(value);
            };
            const dialog = new Dialog({
                title: this.i18n.presetName,
                content: `<div class="b3-dialog__content"><input class="b3-text-field fn__block" type="text"></div>
                    <div class="b3-dialog__action">
                        <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button>
                        <div class="fn__space"></div>
                        <button class="b3-button b3-button--text" data-type="confirm">${window.siyuan.languages.confirm}</button>
                    </div>`,
                width: "420px",
                destroyCallback: () => finish(null),
            });
            const input = dialog.element.querySelector("input") as HTMLInputElement;
            const submit = () => {
                const value = input.value.trim();
                if (!value) {
                    input.focus();
                    return;
                }
                finish(value);
                dialog.destroy();
            };
            dialog.element.querySelector(".b3-button--cancel")?.addEventListener("click", () => dialog.destroy());
            dialog.element.querySelector('[data-type="confirm"]')?.addEventListener("click", submit);
            input.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    submit();
                }
            });
            requestAnimationFrame(() => input.focus());
        });
    }

    private confirmDeletePreset(preset: FormatPreset) {
        const dialog = new Dialog({
            title: this.i18n.deletePreset,
            content: `<div class="b3-dialog__content ft__breakword"></div>
                <div class="b3-dialog__action">
                    <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button>
                    <div class="fn__space"></div>
                    <button class="b3-button b3-button--remove" data-type="confirm">${window.siyuan.languages.confirm}</button>
                </div>`,
            width: "420px",
        });
        const content = dialog.element.querySelector(".b3-dialog__content");
        if (content) {
            content.textContent = `${this.i18n.confirmDeletePreset}“${preset.name}”？`;
        }
        dialog.element.querySelector(".b3-button--cancel")?.addEventListener("click", () => dialog.destroy());
        dialog.element.querySelector('[data-type="confirm"]')?.addEventListener("click", async () => {
            this.presets = this.presets.filter((item) => item.id !== preset.id);
            await this.saveData(PRESET_FILE, this.presets);
            dialog.destroy();
            this.notify(this.i18n.presetDeleted);
        });
    }

    private normalizePreset(value: unknown): FormatPreset | null {
        if (!value || typeof value !== "object") {
            return null;
        }
        const preset = value as FormatPreset;
        if (typeof preset.id !== "string" || typeof preset.name !== "string" || !preset.format) {
            return null;
        }
        if (preset.format.kind === "inline") {
            const snapshot = preset.format.snapshot;
            if (snapshot && Array.isArray(snapshot.types) && snapshot.styles && typeof snapshot.styles === "object") {
                return preset;
            }
            return null;
        }
        if (preset.format.kind === "heading" || preset.format.kind === "block") {
            const format = preset.format as (HeadingFormat | BlockFormat) & {
                blockType?: "NodeHeading" | "NodeParagraph";
                subtype?: string;
                blockStyle?: BlockStyle & { attributes?: Record<string, string> };
            };
            const blockStyle = this.normalizeBlockStyle(format.blockStyle);
            if (format.kind === "heading") {
                const blockType = format.blockType ?? (format.subtype ? "NodeHeading" : "NodeParagraph");
                return {
                    ...preset,
                    format: {
                        kind: "heading",
                        blockType,
                        subtype: blockType === "NodeHeading" ? format.subtype : undefined,
                        blockStyle,
                    },
                };
            }
            return {
                ...preset,
                format: { kind: "block", blockStyle },
            };
        }
        return null;
    }

    private normalizeBlockStyle(value: unknown): BlockStyle {
        if (!value || typeof value !== "object") {
            return {};
        }
        const style = value as BlockStyle & { attributes?: Record<string, string> };
        if (style.backgroundColor || style.color) {
            return {
                backgroundColor: style.backgroundColor || undefined,
                color: style.color || undefined,
            };
        }

        // Existing test presets may contain the previous full attribute snapshot.
        // Keep only the two supported CSS properties and discard custom attributes.
        const cssText = style.attributes?.style;
        if (!cssText) {
            return {};
        }
        const element = document.createElement("div");
        element.style.cssText = cssText;
        return this.captureBlockStyle(element);
    }

    private cloneFormat<T extends FormatData>(format: T): T {
        return JSON.parse(JSON.stringify(format)) as T;
    }

    private getModeIcon(mode: PainterMode) {
        return mode === "inline" ? "iconFont" : mode === "heading" ? "iconHeadings" : "iconParagraph";
    }

    private getModeLabel(mode: PainterMode) {
        return mode === "inline"
            ? this.i18n.inlinePainter
            : mode === "heading"
                ? this.i18n.headingPainter
                : this.i18n.blockPainter;
    }

    private closeInlineToolbar() {
        this.protyle?.toolbar.range?.collapse(true);
        document.querySelectorAll(".protyle-toolbar").forEach((element) => {
            element.classList.add("fn__none");
        });
    }

    private addDockBrushModeIndicator() {
        const indicator = document.createElement("div");
        indicator.classList.add(
            "siyuan-plugin-formatPainter_brush_indicator",
            "status__counter",
            "toolbar__item",
            "ariaLabel",
            "format-painter-blink",
        );
        indicator.innerHTML = `<svg class="icon"><use xlink:href="#${ICON_ID}"></use></svg>`;
        indicator.setAttribute("aria-label", this.i18n.closeTips);
        indicator.style.display = "none";
        indicator.addEventListener("click", () => this.disableFormatPainter());
        this.addStatusBar({ element: indicator });
        this.indicator = indicator;

        const style = document.createElement("style");
        style.textContent = `
            @keyframes format-painter-blink {
                0%, 100% { opacity: 1; }
                50% { opacity: .25; }
            }
            .format-painter-blink { animation: format-painter-blink 1s infinite; }
        `;
        document.head.appendChild(style);
        this.indicatorStyle = style;
    }

    private updateIndicator() {
        if (this.indicator) {
            this.indicator.style.display = this.formatPainterEnable ? "flex" : "none";
        }
    }

    private notify(message: string) {
        void fetchPost("/api/notification/pushMsg", { msg: message, timeout: 5000 });
    }
}
