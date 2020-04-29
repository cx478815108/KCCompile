const {Parser} = require("acorn")

let id = 0;
const collection = {};

function ASTIdentifierAlloc() {
    id += 1;
    return `ast-${id}`;
}

const ASTParse = (expression) => {
    const id = ASTIdentifierAlloc();
    const ast = Parser.parse(expression);
    collection[id] = ast;
    return {
        ast,
        id
    };
}

const astCollection = ()=>{
    return collection;
}

module.exports = {
    parse:ASTParse,
    astCollection
};