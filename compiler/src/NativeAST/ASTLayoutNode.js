class ASTLayoutNode{
    constructor() {
        this.type = "KCASTLayoutNode";
        this.body = []; 
    }

    addChildNode(node) {
        if (node) {
            this.body.push(node);
        }
    }
}

module.exports = ASTLayoutNode;
