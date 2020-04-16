class ASTForNode{
    constructor() {
        this.type = "KCASTForNode";
        this.ast  = {expression:"",node:{}};
        this.body = [];
    }

    addChildNode(excuseNode) {
        if(excuseNode) {
            this.body.push(excuseNode);
        }
    }
}

module.exports = ASTForNode;
