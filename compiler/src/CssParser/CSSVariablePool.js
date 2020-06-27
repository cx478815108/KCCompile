let poolId = 0;
const CSSVariablePoolAlloc = ()=> {
    const id = ""+poolId;
    poolId += 1;
    return id;
}

class CSSVariablePool {
    constructor(item) {
        /*
         --C1: #E6E9F0;
         --C2: #E6E9F073;
         */
        this.vars   = {};
        this.poolId = CSSVariablePoolAlloc();
        this.parseItem(item);
    }

    parseItem(item) {
        for (let key in item) {
            this.vars[""+key] = item[key];
        }
    }

    appendPool(cssVariablePool) {
        if (cssVariablePool.vars) {
            this.parseItem(cssVariablePool.vars);
        }
    }
}

module.exports = CSSVariablePool;