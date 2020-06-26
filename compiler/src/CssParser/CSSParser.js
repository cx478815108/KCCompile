const CSSOM = require('cssom');

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

const CSSIdType = {
    mediaType : 1,
    propertySetType : 2,
};

let uniqueId = 0;
const idTypeMap = {};
const getUniqueId = (idType, key) => {
    let keyMap = idTypeMap[''+idType];
    if (!keyMap) {
        keyMap = {};
        idTypeMap[''+idType] = keyMap;
    }

    let allocId = keyMap[''+key];
    if (!allocId) {
        allocId = ''+uniqueId;
        keyMap[''+key] = uniqueId;
        uniqueId += 1;
    }

    return allocId;
}

const checkKeyIsCssVariable = (key)=> {
    return key.startsWith('--');
}

const extractVariable = (value)=> {
    if (value.startsWith('var(') && value.endsWith(')')) {
        return value.substring(4, value.length - 1);
    }
    return '';
}

class CSSVariablePool {
    constructor(item) {
        /*
         --C1: #E6E9F0;
         --C2: #E6E9F073;
         */
        this.vars   = {};
        this.poolId = "";
        this.parseItem(item);
    }

    parseItem(item) {
        for (let key in item) {
            this.vars[key] = item[key];
        }
    }

    appendPool(cssVariablePool) {
        if (cssVariablePool.vars) {
            this.parseItem();
        }
    }
}

class CSSVariable {
    constructor(key, value) {
        this.poolId = -1;
        this.key    = key;
        this.value  = value;
    }
}

class CSSPropertySet {
    constructor(property) {
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
}

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
            this.associatedMediaQuerys[mediaQuery] = 1;
        }
    }
}

class CSSStyleSheet {
    constructor() {
        this.styleRules         = {};
        this.styleRuleMedias    = {};
        this.variablePools      = {};
        this.mediaVariablePools = {};
    }

    setStyleRule(selector, cssStyleRule, mediaQuery = '') {
        const selectedStyleRule = mediaQuery.length ? this.styleRuleMedias : this.styleRules;
        if (!selectedStyleRule[selector]) {
            selectedStyleRule[selector] = cssStyleRule;
        }

        let normalStyleRule = this.styleRules[selector];
        if (!normalStyleRule) {
            normalStyleRule = new CSSStyleRule(selector);
            normalStyleRule.addAssociatedMediaQuery(mediaQuery);
            this.styleRules[selector] = normalStyleRule;
        }
    }

    getStyleRule(selector, mediaQuery = '') {
        if (mediaQuery.length) {
            return this.styleRuleMedias[selector];
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
}

class CSSParser {
    parse(cssString) {
        const result = CSSOM.parse(cssString);
        const styleSheet = new CSSStyleSheet();
        for (let item of result.cssRules) {
            if (item.type === CSSRuleType.STYLE_RULE) {
                this.processStyleRule(styleSheet, item);
            } else if (item.type === CSSRuleType.MEDIA_RULE) {
                this.processMediaRule(styleSheet, item);
            }
        }
        return styleSheet;
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
            const cssPropertySet = new CSSPropertySet(property);
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
}

const css = `
.box {
    --bga:orange;
    background-color: var(--bga);
}

:root {
    --C1: #E6E9F0;
    --C2: #E6E9F073;
}

@media screen and (min-width: 768px){
    body{
      --primary:  #F7EFD2;
      --secondary: #7F583F;
      background-color: red;
    }

    b {
        color: var(--primary);
        text-decoration-color: var(--secondary);
    }
  }

body {
    --primary: #7F583F;
    --secondary: #F7EFD2;
    font-size: var(--C1);
  }

body {
    font-size: var(--C2);
    color:red;
}

a {
    color: var(--primary);
    text-decoration-color: var(--secondary);
  }
  
  @media screen and (min-width: 768px) {
    header {
      --primary:  #F7EFD2;
      --secondary: #7F583F;
    }
  }
`

const parser = new CSSParser();
const styleSheet = parser.parse(css);
console.log(JSON.stringify(styleSheet, null, 2));
console.log('----✅');

// to-do 1. 分析每个变量对应的变量池，注意是每个var(--a) 不是一个propertySet