const VNode = require('../node/VNode');

class HTMLNode {
    constructor() {
        this.children   = [];
        this.tagName    = "";
        this.text       = "";
        this.parent     = null;
        this.attributes = {};
    }

    addChildNode(node) {
        if (node) {
            node.parent = this;
            this.children.push(node);
        }
    }

    setAttributes(attrs) {
        for (let key in attrs) {
            this.attributes[key] = attrs[key];
        }
    }

    addCSSStyle(style) {
        // 防止css文件 里面的属性覆盖node 的attributes
        const filterValues = {
            "class": true,
            "id" : true,
        };

        filterValues[this.tagName] = true;
        for (let key in style) {
            if (!filterValues[key]) {
                this.attributes[key] = style[key];   
            }
        }
    }

    recursiveToVNode() {
        const vnode      = new VNode();
        vnode.tagName    = this.tagName;
        vnode.text       = this.text;
        vnode.attributes = this.attributes;

        for(let i = 0; i< this.children.length; i++) {
            const childNode = this.children[i];
            const childVNode = childNode.recursiveToVNode();
            vnode.addChildNode(childVNode);
        }

        return vnode;
    }
}

module.exports = HTMLNode;