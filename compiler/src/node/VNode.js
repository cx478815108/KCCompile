const parseUtil        = require('../utils/ParseUtil');
const cssColor         = require('../utils/CSSColor');
const ASTIfNode        = require('../NativeAST/ASTIfNode');
const ASTForNode       = require('../NativeAST/ASTForNode');
const ASTLayoutNode    = require('../NativeAST/ASTLayoutNode');
const ASTUINode        = require('../NativeAST/ASTUINode');
const ASTComponentNode = require('../NativeAST/ASTComponentNode');
const ASTParse         = require('../utils/ASTParse').parse;

const VNodeControlExpression = {
    if    : "v:if",
    elseIf: "v:else-if",
    else  : "v:else",
}

const VNodeIfConditionType = {
    "v:if"     : "if",       // 这里的if 对应 VNodeControlExpression keys 里面的if
    "v:else-if": "elseIf",
    "v:else"   : "else",
}

class VNode {

    static setComponetsInfo(componentInfo) {
        this._jsComponents = componentInfo;
    }

    static getComponnetsInfo(info) {
        return this._jsComponents || {};
    }

    constructor() {
        this.parent     = null;
        this.tagName    = "";
        this.text       = "";
        this.attributes = {};
        this.children   = [];

        this.staticAttributes  = {};
        this.dynamicAttributes = {};

        this.ifAST               = null;
        this.ifASTExpression     = "";
        this.elseIfASTExpression = "";
        this.forAST              = null;
        this.forASTExpression    = "";
        this.elseIfAST           = null;
        this.clickAST            = null;
        this.textAST             = null;

        this.ifConditionType = "";
        this.isLayoutNode    = false;
        this.isComponent     = false;
        this.hasIfSlibing    = false;
    }

    getIfConditionSiblings() {
        if (!this.parent) {
            return [];
        }

        // 只找比本if节点 位置大的节点
        let findMe = false;
        const results = [];
        for (let child of this.parent.children) {
            if (child === this) {
                findMe = true;
                continue;
            }

            if (!findMe) {
                continue;
            }

            if (findMe && child.ifConditionType === VNodeIfConditionType[VNodeControlExpression.if]) {
                break;
            }

            if (child.ifConditionType === VNodeIfConditionType[VNodeControlExpression.elseIf] || 
                child.ifConditionType === VNodeIfConditionType[VNodeControlExpression.else]) {
                results.push(child);
            }

            // 这里断链 也就是 v:if v:else-if v:else 必须是相邻的
            if (findMe && child.ifConditionType === "") {
                break;
            }
        }

        return results;
    }

    cloneMainInfo() {
        const node = {};
        node.tagName = this.tagName;

        if (this.textAST) {
            node.textAST = this.textAST;
        }
        else if (this.text.length){
            node.text = this.text;
        }

        const [sAttrKeys, dAttrKeys] = [Object.keys(this.staticAttributes), Object.keys(this.dynamicAttributes)];
        if (sAttrKeys.length) {
            node.staticAttributes  = this.staticAttributes;
        }

        if (dAttrKeys.length) {
            node.dynamicAttributes = this.dynamicAttributes;
        }

        if (this.clickAST) {
            node.clickAST = this.clickAST;
        }

        return node;
    }

    addChildNode(node) {
        if (node) {
            this.children.push(node);
            node.parent = this;
        }
    }

    removeFromParent() {
        if (!this.parent) {
            return;
        }

        const children = this.parent.children;
        for(let i = 0; i< children.length; i++) {
            if(children[i] === this) {
                this.parent.children = children.splice(i, 1);
            }
        }
    }

    removeChildNode(childNode) {
        const children = this.children;
        for(let i = 0; i< children.length; i++) {
            if(children[i] === childNode) {
                children.splice(i, 1);
                this.children = children;
                return children;
            }
        }
    }

    makeNativeAST() {
        this.processNode();
        return this.makeASTNode();
    }

    collectCustomJSComponents() {
        const components = {};

        if (VNode.getComponnetsInfo()[this.tagName]) {
            components[this.tagName] = VNode.getComponnetsInfo()[this.tagName];
        }

        for (let child of this.children) {
            const childComponents = child.collectCustomJSComponents();
            for (let key in childComponents) {
                components[key] = childComponents[key];
            }
        }

        return components;

    }

    processNode() {
        // 标记自己是否是自定义组件节点
        if (VNode.getComponnetsInfo()[this.tagName]) {
            this.isComponent = true;
        }

        this.isLayoutNode = this.tagName === 'v-layout';

        // 处理控制流
        this.processConditions();

        this.processForExpression();

        // 首先将style 里的数据提取出来
        this.processStyle();

        // 再将属性提取出来
        this.processAttributes();
        
        // 处理文本
        this.processText();

        for(let child of this.children) {
            child.processNode();
        }
    }

    processDynamicAttribute(key, value) {
        if (!(value.startsWith("{{") && value.endsWith("}}"))) {
            return;
        }

        const dynamicValue = value.replace(/{{/g, "").replace(/}}/g, "").trim();
        const dynamicKey   = key.substring(1, key.length);
        const astId = ASTParse(dynamicValue).id;
        this.dynamicAttributes[dynamicKey] = astId;
    }

    processAttributes() {
        const attrs = this.attributes;
        for (let key in attrs) {
            // 动态绑定的
            if (key.startsWith(':')) {
                this.processDynamicAttribute(key, attrs[key]);
                continue;
            }

            this.staticAttributes[key] = attrs[key];
        }

        // 绑定静态的
        for (let key in VNodeControlExpression) {
            const filterKey = VNodeControlExpression[key];
            if(this.staticAttributes[filterKey]) {
                delete this.staticAttributes[filterKey];
            }
        }

        const click = this.staticAttributes["@click"];
        if(click && click.length) {
            this.clickAST = ASTParse(click).id;
            delete this.staticAttributes["@click"];
        }

        delete this.staticAttributes["v:else"];
        delete this.staticAttributes["style"];
    }

    processStyle() {
        const styleText = this.attributes['style'];
        if(!styleText || styleText.length === 0) {
            return;
        }

        const colorMap    = {
            "background-color" : true,
            "color"            : true,
            "border-color"     : true
        }

        const styleObject = parseUtil.parseStyleString(styleText);
        const styleAttrs  = {};
        for (let key in styleObject) {
            // 先替换颜色 比如red blue green 替换为 rgb(ar,g,b)...
            if (colorMap[key]) {
                const colorValue = styleObject[key];
                const rgbColor = cssColor[colorValue];
                if (rgbColor) {
                    styleAttrs[key] = rgbColor;
                    continue;
                }
            }
            styleAttrs[key] = styleObject[key];
        }

        for (let key in styleAttrs) {
            this.attributes[key] = styleAttrs[key];
        }
    }

    processConditions() {
        // 将 v:if 等解析为AST
        for(let key in VNodeControlExpression) {
            let exp = this.attributes[VNodeControlExpression[key]];
            exp = exp ? exp.replace("{{","").replace("}}","").trim() : "";
            if (exp.startsWith('for')) {
                exp = exp + "{}";
            }

            if(exp.length) {
                const astId = ASTParse(exp).id;
                const nodeSetterkey     = key + "AST";
                const nodeExpSetterKey  = nodeSetterkey + "Expression";
                this [nodeSetterkey]    = astId;
                this [nodeExpSetterKey] = exp;
                const type = VNodeIfConditionType[VNodeControlExpression[key]];
                // 这里可能包括else
                this.ifConditionType = type || "";
            }
        }

        const elseAttr = this.attributes[VNodeControlExpression.else];
        if (elseAttr !== undefined) {
            this.ifConditionType = "else";
        }
    }

    processForExpression() {
        let exp = this.attributes['v:for'];
        exp = exp ? exp.replace("{{","").replace("}}","").trim() : "";
        if (exp.startsWith('for')) {
            exp = exp + "{}";
        }

        if(exp.length) {
            this.forAST =  ASTParse(exp).ast;
        }
    }

    processText() {
        if (this.text.length === 0) {
            return ;
        }

        if (!(this.text.startsWith("{{") && this.text.endsWith("}}"))) {
            return; 
        }
        const text = this.text.substring(2, this.text.length - 2);
        try {
            this.textAST = ASTParse(text).id;
        } catch (error) {
            const msg = `节点：<${this.tagName}> 文本内容:${this.text} 语法有问题 ⚠️⚠️⚠️`
            throw new Error(msg);
        } 

        if (this.textAST.expression && this.textAST.expression.type === 'Literal') {
            this.textAST = null;
            this.text = text.substring(1, text.length - 1);
        }
    }

    createNativeUINodeOrLayoutNode() {

        if (this.isLayoutNode) {
            const layoutNode   = new ASTLayoutNode();
            layoutNode.content = this.cloneMainInfo();
            return layoutNode;
        }

        if (this.isComponent) {
            const componentNode         = new ASTComponentNode();
            componentNode.content       = this.cloneMainInfo();
            componentNode.componentName = this.tagName;
            componentNode.path          = VNode.getComponnetsInfo()[this.tagName];
            return componentNode;
        }

        const uiNode   = new ASTUINode();
        uiNode.content = this.cloneMainInfo();
        return uiNode;
    }

    createNativeForNode() {
        const forNode    = new ASTForNode();
        const node = this.forAST.body[0];
        const left = node.left;
        const elements = left.declarations[0].id.elements;
        const declarations = [];
        for (let elementNode of elements) {
            declarations.push(elementNode.name);
        }

        const right = ASTParse(node.right.name).id;
        forNode.setForAST({
            declarations,
            right
        });
        return forNode;
    }

    createNativeIfNode() {
        const ifNode  = new ASTIfNode();
        if (this.ifASTExpression.length) {
            ifNode.ast.expression = this.ifASTExpression;
        }

        if (this.elseIfASTExpression.length) {
            ifNode.ast.expression = this.elseIfASTExpression;
        }

        ifNode.ast.node = this.ifAST || this.elseIfAST;
        return ifNode;
    }

    changeToNormalNode() {
        this.forAST = null;
        this.ifAST  = null;
        this.elseIfAST = null;
        this.ifConditionType = "";
    }

    makeASTForNode() {
        const forNode = this.createNativeForNode();
        const entityNode = this.makeASTNormalNode();
        delete entityNode.content.staticAttributes['v:for'];
        forNode.addChildNode(entityNode);
        return forNode;
    }

    makeASTForAndIfNode() {
        const forNode = this.createNativeForNode();
        const ifNode  = this.makeASTIfNode();
        forNode.addChildNode(ifNode);
        return forNode;
    }

    makeASTIfNode() {
        const ifNode = this.createNativeIfNode();
        // for 节点不让有else
        if (!this.forAST) {
            // 开始寻找兄弟节点(else-if else) 
            const slibings = this.getIfConditionSiblings();
            const alternate = [];
            for (let item of slibings) {
                // 将自己从父节点移除
                item.parent.removeChildNode(item);
                // 标记自己有if 节点的兄弟
                item.hasIfSlibing = true;
                // 让兄弟节点递归的创建
                const excuseNode  = item.makeASTNode();
                alternate.push({
                    excuseNode,
                    type: item.ifConditionType
                });
            }

            // 设置if 的替代方向
            if (alternate.length) {
                ifNode.setAlternate(alternate);
            }
        }
        ifNode.addChildNode(this.makeASTNormalNode());

        return ifNode;
    }

    makeASTNormalNode() {
        const targetNode = this.createNativeUINodeOrLayoutNode();
        for (let child of this.children) {
            const childExcuseNode = child.makeASTNode();
            targetNode.addChildNode(childExcuseNode);
        }
        return targetNode;
    }

    makeASTNode() {
        // 如果仅仅是for 节点
        if (this.forAST && !this.ifAST) {
            return this.makeASTForNode();
        }

        // 如果既是for又是if
        if (this.forAST && this.ifAST) {
            return this.makeASTForAndIfNode();
        }

        // 仅仅是if 或者 elseIf
        if (this.ifAST || (this.elseIfAST && this.hasIfSlibing)) {
            return this.makeASTIfNode();
        }

        // 单独使用 v:elseIf 或者 v:else 都是无效节点
        if ((this.ifConditionType === VNodeIfConditionType[VNodeControlExpression.elseIf] || 
            this.ifConditionType === VNodeIfConditionType[VNodeControlExpression.else]) && 
            !this.hasIfSlibing) {
            return null;
        }

        return this.makeASTNormalNode();
    }
}

module.exports = VNode;