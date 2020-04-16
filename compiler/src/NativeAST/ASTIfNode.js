class ASTIfNode{
    constructor() {
        this.type = "KCASTIfNode";
        this.ast  = {expression:"",node:{}};
        this.body = [];
        this.alternateNode = null;
    }

    addChildNode(excuseNode) {
        if(excuseNode) {
            this.body.push(excuseNode);
        }
    }

    setAlternate(alternate) {
        let   firstElseIfItem  = null;
        let   elseItem         = null;
        const others           = [];
        for(let item of alternate) {
            if (item.type === 'elseIf') {
                if (!firstElseIfItem) {
                    firstElseIfItem = item;
                }
                else {
                    others.push(item);
                }
            }
            else if (item.type === 'else') {
                elseItem = item;
            }
        }

        if (firstElseIfItem) {
            this.alternateNode = firstElseIfItem.excuseNode;
            elseItem && others.push(elseItem);
            others.length && this.alternateNode.setAlternate(others);
        }
        else {
            this.alternateNode = elseItem.excuseNode;
        }
    }
}

module.exports = ASTIfNode;


