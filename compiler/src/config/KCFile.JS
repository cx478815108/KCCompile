const fs         = require('fs-extra');
const htmlParser = require('../htmlparser/HTMLParser');
const util       = require('./KCFileUtis');
const path       = require('path');
const CSSParser  = require('../CssParser/CSSParser');

class KCFile {
    constructor(filePath = '', componentName = '') {
        if (!fs.existsSync(filePath)) {
            throw `new KCFile(), ${filePath} not exist`;
        }

        if (componentName.length === 0) {
            throw `new KCFile(), componentName.length is 0`;
        }

        this.filePath          = filePath;
        this.componentName     = componentName;
        this.templateNode      = null;
        this.cssTextArray      = [];
        this.scriptImportPaths = [];
        this.script            = '';
        this.templateASTNode   = null;
        this.readKCFile(filePath);
    }

    readKCFile(filePath) {
        const parser           = new htmlParser();
        const htmlText         = fs.readFileSync(filePath).toString();
        const document         = parser.parse(htmlText);
        this.templateNode      = util.findTemplateNode(document).recursiveToVNode();
        this.cssTextArray      = util.findCssStyleText(document, filePath);
        this.scriptImportPaths = util.findScriptImportPath(document, filePath);
        this.script            = util.findMainScriptText(document, filePath);
        this.templateASTNode   = this.templateNode.makeNativeAST();
    }

    writeAssets() {
        const baseFolderPath = path.dirname(this.filePath);
        const fileName       = path.basename(this.filePath);
        this.writeJS(baseFolderPath, fileName);
        this.writeCSS(baseFolderPath, fileName);
        this.writeAST(baseFolderPath, fileName);
    }

    writeJS(baseFolderPath, fileName) {
        // 写入JS 文件
        if (this.script.length) {
            // 通过script 标签引入的事直接复制黏贴，通过 require是运行时导入
            let content = '';
            this.scriptImportPaths.forEach((path)=>{
                const script = fs.readFileSync(path).toString();
                if (script.length) {
                    // 隔离作用域
                    content += `\n//src:${path}\n(()=>{\n${script.trim()}\n})()`;
                }
            });

            this.script += content;
            this.script = this.script.trim();
            const jsPath = path.resolve(baseFolderPath, `${fileName}.js`);
            fs.writeFileSync(jsPath, this.script);
        }
    }

    writeCSS(baseFolderPath, fileName) {
        const cssParser = new CSSParser();
        let shouldSave  = false;
        // 处理css 文本
        this.cssTextArray.forEach((cssText)=>{
            if (cssText.length) {
                shouldSave = true;
                cssParser.parse(cssText);
            }
        });

        if (shouldSave) {
            cssParser.parseFinish();
            const cssText = JSON.stringify(cssParser.styleSheet, null, 2);
            const styleSheetPath = path.resolve(baseFolderPath, `${fileName}.ss`);
            fs.writeFileSync(styleSheetPath, cssText);
        }
    }

    writeAST(baseFolderPath, fileName) {
        const astPath = path.resolve(baseFolderPath, `${fileName}.ast`);
        const data = JSON.parse(JSON.stringify(this.templateASTNode));
        const dataText = JSON.stringify(data, null, 2);
        fs.writeFileSync(astPath, dataText);

    }
}

module.exports = KCFile;