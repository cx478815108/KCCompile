class ASTForNode{
    constructor() {
        this.type = "KCASTForNode";
        this.body = [];
        this.ast = {};
    }

    addChildNode(excuseNode) {
        if(excuseNode) {
            this.body.push(excuseNode);
        }
    }

    setForAST(ast) {
        this.ast = ast;
    }
}

module.exports = ASTForNode;
