const CSSOM = require('cssom');
const CSSVariablePool = require('./CSSVariablePool');
const CSSPropertySet = require('./CSSPropertySet');
const CSSStyleRule = require('./CSSStyleRule');
const CSSStyleSheet = require('./CSSStyleSheet');

CSSRuleType = {};
CSSRuleType.UNKNOWN_RULE = 0;                 // obsolete
CSSRuleType.STYLE_RULE = 1;
CSSRuleType.CHARSET_RULE = 2;                 // obsolete
CSSRuleType.IMPORT_RULE = 3;
CSSRuleType.MEDIA_RULE = 4;
CSSRuleType.FONT_FACE_RULE = 5;
CSSRuleType.PAGE_RULE = 6;
CSSRuleType.KEYFRAMES_RULE = 7;
CSSRuleType.KEYFRAME_RULE = 8;
CSSRuleType.MARGIN_RULE = 9;
CSSRuleType.NAMESPACE_RULE = 10;
CSSRuleType.COUNTER_STYLE_RULE = 11;
CSSRuleType.SUPPORTS_RULE = 12;
CSSRuleType.DOCUMENT_RULE = 13;
CSSRuleType.FONT_FEATURE_VALUES_RULE = 14;
CSSRuleType.VIEWPORT_RULE = 15;
CSSRuleType.REGION_STYLE_RULE = 16;

const checkKeyIsCssVariable = (key)=> {
    return key.startsWith('--');
}

const extractVariable = (value)=> {
    if (value.startsWith('var(') && value.endsWith(')')) {
        return value.substring(4, value.length - 1);
    }
    return '';
}

class CSSParser {

    constructor() {
        this.styleSheet = new CSSStyleSheet();
    }

    parse(cssString) {
        const result = CSSOM.parse(cssString);
        const styleSheet = this.styleSheet;
        for (let item of result.cssRules) {
            if (item.type === CSSRuleType.STYLE_RULE) {
                this.processStyleRule(styleSheet, item);
            } else if (item.type === CSSRuleType.MEDIA_RULE) {
                this.processMediaRule(styleSheet, item);
            }
        }
        return styleSheet;
    }

    parseFinish() {
        this.findVariableIds();
        this.deleteUnuseProperty();
        this.extrackIdRules();
    }

    extrackIdRules() {
        this.styleSheet.extrackIdRules();
    }

    processStyleRule(styleSheet, item, mediaQuery = '') {
        const selector = item.selectorText;
        /*
            .box {
                --bga:orange;
                background-color: var(--bga);
            } 
        */
        const variables = {}; // CSS 变量
        const property  = {}; // CSS 属性
        for (let i = 0; i < item.style.length; i++) {
            const key = item.style[''+i];
            const value = item.style[key];
            if (checkKeyIsCssVariable(key)) {
                variables[key] = value;
            } else {
                property[key] = value;
            }
        }

        // 直接查变量
        for (let key in property) {
            const value = extractVariable(property[key]);
            if (variables[value]) {
                property[key] = variables[value];
            }
        }

        // 处理CSS 属性
        if (Object.keys(property).length) {
            const cssPropertySet = new CSSPropertySet(property, mediaQuery);
            // 判断是否存在
            let existedStyleRule = styleSheet.getStyleRule(selector, mediaQuery);
            if (existedStyleRule) {
                existedStyleRule.appendPropertySet(cssPropertySet);
            } else {
                const cssStyleRule = new CSSStyleRule(selector);
                cssStyleRule.appendPropertySet(cssPropertySet);
                styleSheet.setStyleRule(selector, cssStyleRule, mediaQuery);
            }
        }

        // 处理变量
        if (Object.keys(variables).length) {
            const cssVariablePool = new CSSVariablePool(variables);
            let existedVariablePool = styleSheet.getVariablePool(selector, mediaQuery);
            if (existedVariablePool) {
                existedVariablePool.appendPool(cssVariablePool);
            } else {
                styleSheet.addVariablePools(selector, cssVariablePool, mediaQuery);
            }
        }
    }

    processMediaRule(styleSheet, cssMediaRule) {
        const mediaQuery = cssMediaRule.media[0] || '';
        for (let item of cssMediaRule.cssRules) {
            if (item.type === CSSRuleType.STYLE_RULE) {
                this.processStyleRule(styleSheet, item, mediaQuery);
            } else if (item.type === CSSRuleType.MEDIA_RULE) {
                this.processMediaRule(styleSheet, item);
            }
        }
    }

    findVariableIds() {
        const styleSheet = this.styleSheet;
        // 首先处理非媒体查询的rules
        for (let selector in styleSheet.styleRules) {
            this.findVariableIdForCssRule(styleSheet.styleRules[selector]);
        }

        const styleRuleMediaMap = styleSheet.styleRuleMedias; 
        for (let mediaQuery in styleRuleMediaMap) {
            const styleRuleMedias = styleRuleMediaMap[mediaQuery];
            for (let selector in styleRuleMedias) {
                this.findVariableIdForCssRuleMedia(styleRuleMedias[selector], mediaQuery);
            }
        }
    }

    checkExistVariables(cssRule) {
        const propertySet = cssRule.propertySet;
        if (!propertySet) {
            return false;
        }

        const varPropertySet = propertySet.varPropertySet;
        const count = Object.keys(varPropertySet).length;
        // 没有属性使用变量
        if (count === 0) {
            return false;
        }

        return true;
    }

    findVariableIdForCssRuleMedia(cssRule, mediaQuery) {
        if (!this.checkExistVariables(cssRule)) {
            return;
        }

        const selector         = cssRule.selector;
        const selfVariablePool = this.styleSheet.mediaVariablePools[selector];
        const variablePool     = this.styleSheet.variablePools[selector];
        const rootVariablePool = this.styleSheet.getRootVariablePool();

        // 先从自己的里面开始找
        if (!selfVariablePool) {
            // 再从没有媒体查询的里面开始找
            if (!variablePool) {
                // 最后从根里面找
                if (!rootVariablePool) {
                    console.log(`[warning] 媒体查询'${mediaQuery}'内，CSS 选择器'${selector}' 未定义变量`);
                    return;
                }
            }
        }

        const varPropertySet = cssRule.propertySet.varPropertySet;
        for (let cssVariableKey in varPropertySet) {
            const cssVariable  = varPropertySet[cssVariableKey];
            const variableText = extractVariable(cssVariable.value);

            // 1. 首先从自己的styleRule 查变量
            let queryResult = selfVariablePool && selfVariablePool.vars[variableText];
            if (queryResult) {
                cssVariable.poolId = selfVariablePool.poolId;
                continue;
            }

            // 2. 其次从不带媒体查询的styleRule 变量池里面查变量
            queryResult = variablePool && variablePool.vars[variableText];
            if (queryResult) {
                cssVariable.poolId = variablePool.poolId;
                continue;
            }

            // 3. 最后从跟选择器里面寻找
            queryResult = rootVariablePool && rootVariablePool.vars[variableText];
            if (queryResult) {
                cssVariable.poolId = rootVariablePool.poolId;
                continue;
            }

            console.log(`[warning] 媒体查询'${mediaQuery}'内，CSS 选择器'${selector}' 使用了未定义的变量:${cssVariable.value}  该属性将被删除`);
            cssRule.propertySet.removeUndefinedVariable(cssVariable);
        }
    }

    findVariableIdForCssRule(cssRule) {
        if (!this.checkExistVariables(cssRule)) {
            return;
        }

        const selector = cssRule.selector;
        const selfVariablePool = this.styleSheet.variablePools[selector];
        const rootVariablePool = this.styleSheet.getRootVariablePool();

        if (!selfVariablePool) {
            if (!rootVariablePool) {
                console.log(`[warning] CSS 选择器${selector} 未定义变量`);
                return;
            }
        }
        
        const varPropertySet = cssRule.propertySet.varPropertySet;
        for (let cssVariableKey in varPropertySet) {
            const cssVariable  = varPropertySet[cssVariableKey];
            const variableText = extractVariable(cssVariable.value);

            // 首先从自己的styleRule 查变量
            let queryResult = selfVariablePool && selfVariablePool.vars[variableText];
            if (queryResult) {
                cssVariable.poolId = selfVariablePool.poolId;
                cssRule.propertySet.transfromVariableToStatic(cssVariable, queryResult);
                continue;
            }

            // 再从跟选择器里面寻找
            queryResult = rootVariablePool && rootVariablePool.vars[variableText];
            if (queryResult) {
                cssVariable.poolId = rootVariablePool.poolId;
                cssRule.propertySet.transfromVariableToStatic(cssVariable, queryResult);
                continue;
            }

            console.log(`[warning] CSS 选择器${selector} 使用了未定义的变量:${cssVariable.value} 该属性将被删除`);
            cssRule.propertySet.removeUndefinedVariable(cssVariable);
        }
    }

    deleteUnuseProperty() {
        const styleSheet = this.styleSheet;
        const styleRuleMediaMap = styleSheet.styleRuleMedias; 
        // 首先处理媒体查询的rules
        for (let mediaQuery in styleRuleMediaMap) {
            const styleRuleMedias = styleRuleMediaMap[mediaQuery];
            for (let selector in styleRuleMedias) {
                const cssRule = styleRuleMedias[selector];
                if (cssRule.isEmptyRule()) {
                    // 从 styleSheet.styleRules 找到对应的删除 mediaQuery 引用计数
                    const cssRuleWithoutMediaQuery = styleSheet.getStyleRule(selector, '');
                    if (cssRuleWithoutMediaQuery) {
                        cssRuleWithoutMediaQuery.removeAssociatedMediaQuery(mediaQuery);
                    }

                    styleSheet.removeCssRule(selector, mediaQuery);
                }
            }
        }

        // 再处理非媒体查询的rules
        for (let selector in styleSheet.styleRules) {
            const cssRule = styleSheet.styleRules[selector];
            if (cssRule.isEmptyRule()) {
                styleSheet.removeCssRule(selector);
            }
        }
    }
}

module.exports = CSSParser;

// const css = `
// .box {
//     --bga:orange;
//     background-color: var(--bga);
// }

// :root {
//     --C1: #E6E9F0;
//     --C2: #E6E9F073;
// }

// @media screen and (min-width: 768px){
//     body{
//       --primary:  #F7EFD2;
//       --secondary: #7F583F;
//       background-color: red;
//     }

//     b {
//         color: var(--primary);
//         text-decoration-color: var(--secondary);
//     }
//   }

// body {
//     --primary: #7F583F;
//     --secondary: #F7EFD2;
//     font-size: var(--C1);
//   }

//     body {
//         font-size: var(--C2);
//         color:red;
//     }

//   a {
//     color: var(--primary);
//     text-decoration-color: var(--secondary);
//   }
  
//   @media screen and (min-width: 768px) {
//     header {
//       --primary:  #F7EFD2;
//       --secondary: #7F583F;
//     }
//   }
// `

// const css2 = `
// :root {
//     --C1: #999999;
//     --C2: #999999;
//     --secondary: blue;
// }
// `

// const parser = new CSSParser();
// parser.parse(css);
// parser.parse(css2);
// parser.parseFinish();

// console.log(JSON.stringify(parser.styleSheet, null, 2));
// console.log('----✅');

// to-do 1. 分析每个变量对应的变量池，注意是每个var(--a) 不是一个propertySet
