class ASTLayoutNode{
    constructor() {
        this.type = "KCASTLayoutNode";
        this.body = []; 
        this.content = null;
    }

    addChildNode(node) {
        if (node) {
            this.body.push(node);
        }
    }
}

module.exports = ASTLayoutNode;
