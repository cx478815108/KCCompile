class CSSStyleRule {
    constructor(selector) {
        this.selector = selector; // .box
        this.associatedMediaQuerys = {};
        if (selector.length) {
            this.selectorList = this.selector.trim().split(' ');
        }
    }

    appendPropertySet(propertySet) {
        if (!this.propertySet) {
            this.propertySet = propertySet;
        }

        this.propertySet.appendPropertySet(propertySet);
    }

    addAssociatedMediaQuery(mediaQuery) {
        if (mediaQuery.length > 0) {
            if (typeof this.associatedMediaQuerys[mediaQuery] === 'undefined') {
                this.associatedMediaQuerys[mediaQuery] = 0;
            }

            this.associatedMediaQuerys[mediaQuery] += 1;
        }
    }

    removeAssociatedMediaQuery(mediaQuery) {
        if (mediaQuery.length > 0) {
            if (typeof this.associatedMediaQuerys[mediaQuery] === 'number') {
                this.associatedMediaQuerys[mediaQuery] -= 1;
            }

            if (this.associatedMediaQuerys[mediaQuery] === 0) {
                delete this.associatedMediaQuerys[mediaQuery];
            }
        }
    }

    isEmptyRule() {
        if (!this.propertySet) {
            return true;
        }

        if (this.propertySet.staticPropertySetIsEmpty() &&
            this.propertySet.varPropertySetIsEmpty()) {
            return true;
        }

        return false;
    }

    isEmptyAssociatedMediaQuery() {
        if (Object.keys(this.associatedMediaQuerys).length === 0) {
            return true;
        }
    }
}

module.exports = CSSStyleRule;