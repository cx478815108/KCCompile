class ASTUINode {
    constructor() {
        this.type        = "KCASTUINode";
        this.content     = null;
        this.body        = []; 
    }

    addChildNode(node) {
        if (node) {
            this.body.push(node);
        }
    }
}

module.exports = ASTUINode;