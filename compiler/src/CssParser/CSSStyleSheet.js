const CSSStyleRule = require('./CSSStyleRule');

class CSSStyleSheet {
    constructor() {
        this.styleRules         = {};
        this.styleRuleMedias    = {};
        this.variablePools      = {};
        this.mediaVariablePools = {};
        this.idRules            = {};
    }

    extrackIdRules() {
        for (let cssRuleSelector in this.styleRules) {
            const list = cssRuleSelector.trim().split(' ');
            if (list.length === 1) {
                const selector = list[0];
                if (selector.startsWith('#')) {
                    this.idRules[selector] = this.styleRules[selector];
                    delete this.styleRules[selector];
                }
            }
        }
    }

    setStyleRule(selector, cssStyleRule, mediaQuery = '') {
        if (mediaQuery.length === 0) {
            if (!this.styleRules[selector]) {
                this.styleRules[selector] = cssStyleRule;
            }
        } else {
            let mediaStyleRuleMap = this.styleRuleMedias[mediaQuery];
            if (!mediaStyleRuleMap) {
                mediaStyleRuleMap = {};
                this.styleRuleMedias[mediaQuery] = mediaStyleRuleMap;
            }

            if (!mediaStyleRuleMap[selector]) {
                mediaStyleRuleMap[selector] = cssStyleRule;
            }

            // 设置关联的 媒体查询
            let normalStyleRule = this.styleRules[selector];
            if (!normalStyleRule) {
                normalStyleRule = new CSSStyleRule(selector);
                normalStyleRule.addAssociatedMediaQuery(mediaQuery);
                this.styleRules[selector] = normalStyleRule;
            }
        }
    }

    getStyleRule(selector, mediaQuery = '') {
        if (mediaQuery.length) {
            const mediaQueryMap = this.styleRuleMedias[mediaQuery];
            if (mediaQueryMap) {
                return mediaQueryMap[selector];
            }
        }
        return this.styleRules[selector];
    }

    addVariablePools(selector, cssVariablePool, mediaQuery = '') {
        // 普通的直接存储
        if (mediaQuery.length === 0) {
            const existedVariablePool = this.variablePools[selector];
            if (existedVariablePool) {
                existedVariablePool.appendPool(cssVariablePool);
            } else {
                this.variablePools[selector] = cssVariablePool;
            }
            return;
        }

        // 带媒体查询的根据媒体查询存储
        let mediaPool = this.mediaVariablePools[mediaQuery];
        if (!mediaPool) {
            mediaPool = {};
            this.mediaVariablePools[mediaQuery] = mediaPool;
        }

        let existedVariablePool = mediaPool[selector];
        if (!existedVariablePool) {
            mediaPool[selector] = cssVariablePool;
        } else {
            existedVariablePool.appendPool(cssVariablePool);
        }
    }

    getVariablePool(selector, mediaQuery = '') {

        if (mediaQuery.length === 0) {
            return this.variablePools[selector];
        }

        let mediaPool = this.mediaVariablePools[mediaQuery];
        if (!mediaPool) {
            return null;
        }

        return mediaPool[selector];
    }

    getRootVariablePool() {
        return this.variablePools[':root'];
    }

    removeCssRule(selector, mediaQuery = '') {
        if (mediaQuery.length === 0) {
            const cssStyleRule = this.styleRules[selector];
            if (cssStyleRule.isEmptyAssociatedMediaQuery()) {
                delete this.styleRules[selector];
            }
            return;
        }

        const styleRuleMediaMap = this.styleRuleMedias[mediaQuery];
        if (styleRuleMediaMap) {
            delete styleRuleMediaMap[selector];
            if (Object.keys(styleRuleMediaMap).length === 0) {
                delete this.styleRuleMedias[mediaQuery];
            }
        }
    }
}

module.exports = CSSStyleSheet;