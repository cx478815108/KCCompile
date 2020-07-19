class ASTComponentNode {
    constructor() {
        this.type          = "KCASTComponentProxyNode";
        this.content       = null;
        this.componentName = "";
        this.path          = "";
        this.template      = {};
    }

    addChildNode() {}
}

module.exports = ASTComponentNode;