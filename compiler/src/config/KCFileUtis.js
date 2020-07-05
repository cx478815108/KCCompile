const path = require('path');
const fs   = require('fs-extra');
const TagName = {
    template : "template",
    script : "script",
    style : "style",
    link : "link"
}

const findTargetTag = (document, tagName) => {
    const children = document.children;
    if (!children) {
        return [];
    }

    const targets = [];
    for(let i = 0;i < children.length; i++) {
        const node = children[i];
        if (node.tagName === tagName) {
            targets.push(node);
        }
    }
    return targets;
}

const findTemplateNode = (document) => {
    // 寻找到template 模板 只规定第一个标签才能生效
    const templateNode = findTargetTag(document, TagName.template)[0];
    return templateNode ? templateNode.children[0] : null;
}

const findScriptImportPath = (document, filePath) => {
    const nodes = findTargetTag(document, TagName.script);
    const results = [];
    const basePath = path.dirname(filePath);
    for (let i =0;i < nodes.length ;i++) {
        const node = nodes[i];
        const srcPath = node.attributes['src'];
        if (srcPath && srcPath.length > 0) {
            const filePath = path.resolve(basePath, srcPath);
            if (!fs.existsSync(filePath)) {
                console.log(`[warning] ${path} => ${filePath}:不存在`);
                continue;
            }
            results.push(filePath);
        }
    }
    return results;
}

const findMainScriptText = (document, filePath) => {
    const nodes = findTargetTag(document, TagName.script);
    const basePath = path.dirname(filePath);
    for (let i = 0;i < nodes.length ;i++) {
        const node = nodes[i];
        const attrs = node.attributes;
        if (attrs.hasOwnProperty('main')) {
            if (node.text.length > 0) {
                return node.text;
            }
            
            const filePath = path.resolve(basePath, attrs['src']);
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath).toString();
            }
        }
    }
    return '';
}

const findCssStyleText = (document, filePath)=> {
    const children = document.children;
    if (!children) {
        return [];
    }

    const basePath = path.dirname(filePath);
    const textArray = [];
    for(let i = 0;i < children.length; i++) {
        const node = children[i];
        if (node.tagName === TagName.link) {
            const cssFilePath = path.resolve(basePath, node.attributes['href']);
            if (!fs.existsSync(cssFilePath)) {
                console.log(`[warning] ${node.attributes['href']} => ${cssFilePath}:不存在`);
                continue;
            }
            const text = fs.readFileSync(cssFilePath).toString();
            if (text.length > 0) {
                textArray.push(text);
            }
        } else if (node.tagName === TagName.style) {
            if (node.text.length > 0) {
                textArray.push(node.text);
            }
        }
    }
    return textArray;
}

module.exports = {
    findTargetTag,
    findTemplateNode,
    findScriptImportPath,
    findMainScriptText,
    findCssStyleText
}