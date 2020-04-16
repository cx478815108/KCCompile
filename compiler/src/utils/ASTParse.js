const {Parser} = require("acorn")

const filterValues = {
    start: true,
    end: true,
    sourceType : true,
    init : true,
    await : true,
    kind : true
}

class AST {
    constructor(ast) {
        for (let key in ast) {
            const item = ast[key];
            if(filterValues[key] || !item) {
                continue;
            }

            if (typeof item === "object") {
                if (Array.isArray(item)) {
                    const list = [];
                    for (let n of item) {
                        list.push(new AST(n));
                    }

                    if (list.length) {
                        this[key] = list;
                    }
                } else {
                    this[key] = new AST(item);
                }
                continue;
            }

            this[key] = ast[key];
        }
    }
}

const ASTParse = (expression) => {
    const ast = new AST(Parser.parse(expression).body[0]);
    return ast;
}

module.exports = ASTParse;