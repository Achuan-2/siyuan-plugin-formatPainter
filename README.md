[中文](README_zh_CN.md)

## 🚀 Background

When taking notes in SiYuan Note and needing to add styles, it can be quite troublesome to apply multiple overlapping styles to text simultaneously, such as background color + bold, let alone three or more styles (like font color + font size + bold) 😖💔

Therefore, inspired by the format painter in Office, I developed this format painter plugin, hoping it can be your little helper in beautifying SiYuan notes, saving you time and quickly enhancing your notes! 💃🕺

## ✨ Feature Introduction

> This plugin supports SiYuan Note v3.1.12 or later. SiYuan v3.8.0 and later use the native inline format painter when available; earlier versions automatically use the compatibility implementation.

- **Enter format painter mode**: Select text, click the brush icon on the floating toolbar, and choose a painter type from the SiYuan menu:
  - **Inline Format Painter** copies font size, colors, bold, inline code, keyboard style, underline, strikethrough, superscript, subscript, highlight, and other inline styles.
  - **Heading Format Painter** copies a heading level from a heading, or converts headings back to paragraphs when sampled from a paragraph.
  - **Block Style Painter** copies only the block background and text colors without changing other styles, custom attributes, content, or type.
  - All three modes can be applied continuously to multiple targets.
  - Presets apply immediately to the current selection or block and remain active for painting additional targets.
  - Supports copying **no style** to clear the selected text style
- **Exit format painter mode**: 
  1. Press the `Esc` key
  2. When the format painter is activated, a button is added to the right of the dock's bottom bar. The button's icon gradually flashes, and clicking the button allows you to exit the format painter mode.


![](https://fastly.jsdelivr.net/gh/Achuan-2/PicBed/assets/思源笔记格式刷插件-2024-11-19.gif)


## ❤️ Tips Are Welcome

If you find this plugin useful, you're welcome to leave a tip or give the repository a star on GitHub. Your support helps me maintain and improve this plugin and develop new ones. Thank you for your support!

[Leave a tip](https://pancake.waffo.ai/store/achuan-2-fdbho4ye/product/PROD_3F7Aa7c2NQlz9KmxcgxjQ7?type=onetime&currency=USD)
