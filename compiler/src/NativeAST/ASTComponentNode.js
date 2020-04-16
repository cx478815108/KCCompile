class ASTComponentNode {
    constructor() {
        this.type          = "KCASTComponentNode";
        this.content       = null;
        this.componentName = "";
        this.path          = "";
        this.template      = {};
    }

    addChildNode() {}
}

module.exports = ASTComponentNode;