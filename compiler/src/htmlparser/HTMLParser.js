const HTMLParser2 = require("htmlparser2");
const HTMLNode   = require("./HTMLNode");

Array.prototype.top = function () {
    const l = this.length;
    return l > 0 ? this[l - 1] : null;
}

class HTMLParser {

    parse(htmlText) {

        if (htmlText.length === 0) {
            return null;
        }

        const document   = new HTMLNode();
        document.tagName = "document";
        const nodeStack  = [document];

        const parser = new HTMLParser2.Parser({
            onopentag: function (tagName, attributes) {
                const node      = new HTMLNode();
                node.tagName    = tagName;
                node.setAttributes(attributes);
                nodeStack.push(node);
            },
            ontext: function (text) {
                const currentNode = nodeStack.top();
                const t = text.trim();
                if (t.length) {
                    currentNode.text = t;
                }
            },
            onclosetag: function (tagName) {
                const currentNode = nodeStack.pop();
                const parentNode = nodeStack.top();
                if (parentNode) {
                    parentNode.addChildNode(currentNode);
                }
            }
        }, {
            lowerCaseAttributeNames: false,
            lowerCaseTags: false,
            recognizeSelfClosing : true
        });

        parser.write(htmlText);
        parser.end();
        return document;
    }
}

module.exports = HTMLParser;