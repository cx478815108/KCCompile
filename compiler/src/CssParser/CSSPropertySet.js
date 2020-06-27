const CSSVariable = require('./CSSVariable');

class CSSPropertySet {
    constructor(property, mediaQuery = '') {
        if (mediaQuery.length) {
            this.mediaQuery = mediaQuery;
        }
        this.staticPropertySet = {}; // font-size:13dp
        this.varPropertySet    = {}; // background-color: var(--bg-color);
        this.parseProperty(property);
    }

    parseProperty(property) {
        for (let key in property) {
            const value = property[key];
            // 区分变量、静态、动态key values
            if (key.startsWith('--')) {
                // 过滤避免外界没有做处理，这里不需要记录变量
            } else {
                if (typeof value === 'string') {
                    if (value.startsWith('var(') && value.endsWith(')')) {
                        const cssVariable = new CSSVariable(key, value);
                        this.varPropertySet[key] = cssVariable;
                    } else {
                        this.staticPropertySet[key] = value;
                    }
                } else {
                    this.varPropertySet[key] = value;
                }
            }
        }
    }

    appendPropertySet(propertySet) {
        if (propertySet.staticPropertySet) {
            this.parseProperty(propertySet.staticPropertySet);
        }

        // 这里待处理
        if (propertySet.varPropertySet) {
            this.parseProperty(propertySet.varPropertySet);
        }
    }

    transfromVariableToStatic(cssVariable, queryResult) {
        const key = cssVariable.key;
        if (!key) {
            return;
        }
        this.staticPropertySet[key] = queryResult;
        delete this.varPropertySet[key];
    }

    removeUndefinedVariable(cssVariable) {
        const key = cssVariable.key;
        if (!key) {
            return;
        }

        delete this.varPropertySet[key];
    }

    staticPropertySetIsEmpty() {
        if (this.staticPropertySet && 
            Object.keys(this.staticPropertySet).length === 0) {
            return true;
        }

        return false;
    }

    varPropertySetIsEmpty() {
        if (this.staticPropertySet && 
            Object.keys(this.varPropertySet).length === 0) {
            return true;
        }
        return false;
    }
}

module.exports = CSSPropertySet;