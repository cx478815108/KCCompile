const CSSColor = require('./CSSColor');

module.exports = {
    parseForString(forString) {
        if (!forString.length) { return null;}
        const g = forString.replace("(", "")
            .replace(")", "")
            .split('in ')
            .map((v) => {
                return v.trim();
            });
        const r = g[0].split(',');
        const o = {};
        o.valueKey = r[0].trim();
        if (r.length === 2) {
            o.indexKey = r[1].trim();
        } else {
            o.indexKey = 'index';
        }
        o.dataKey = g[1];
        return o;
    },
    parseStyleString(styleString){
        const r = {};
        styleString.split(';').filter((v) => {
            return v.length > 0;
        }).forEach((v) => {
            const list = v.split(':');
            if (list.length === 2) {
                r[list[0].trim()] = list[1].trim();
            }
        });
        return r;
    },
    parseMarginOrPadding(name, val){
        const list = val.split(' ').filter((v)=>{
            return v.length > 0;
        });
        const r = {};
        const props = ["top" ,"left", "bottom", "right"];
        if(list.length === 1) list[3] = list[2] = list[1] = list[0];
        for(let i = 0;i < 4; i++){
            r[`${name}-${props[i]}`] = list[i] || "0px";
        }
        return r;
    },
    parseCSSString(text){
        if (!text || !text.length) return {};
        const reg = /("([^\\\"]*(\\.)?)*")|('([^\\\']*(\\.)?)*')|(\/{2,}.*?(\r|\n))|(\/\*(\n|.)*?\*\/)/g;
        const pureText = text.replace(reg, "");

        let braceMarker = 0;
        let selector = '';
        let ruleString = '';
        const r = {};
        for (let i = 0; i < pureText.length; i++) {
            const c = pureText[i];
            if (c == '{') {
                selector = pureText.substr(braceMarker, i - braceMarker).trim();
                braceMarker = i + 1;
            }
            if (c == '}') {
                ruleString = pureText.substr(braceMarker, i - braceMarker);
                braceMarker = i + 1;
                r[selector] = {};
                ruleString.split(';').forEach((val) => {
                    const s = val.trim();
                    if (s.length) {
                        let g = s.split(':');
                        if (g.length === 2) {
                            const attrname = g[0].trim();
                            const attrval  = g[1].trim();
                            if(attrname === 'margin' || attrname === 'padding'){
                                const m = this.parseMarginOrPadding(attrname, attrval);
                                for(let key in m){
                                    r[selector][key] = m[key];
                                }
                            }
                            else{
                                r[selector][attrname] = attrval;
                            }
                        }
                    }
                });
            }
        }
        return r;
    },
    parseClickString(text) {
        const t = text.indexOf('(');
        const l = t > 0 ? t : text.length;
        const r = text.indexOf(')');
        const functionName = text.substring(0, l);
        const parametersString = text.substring(l + 1, r);
        const o = {}
        if (functionName.length === 0) {
            console.log('没有函数名');
        }

        o.f = functionName;
        const parameters = [];
        parametersString.split(',').map((v) => {
            return v.trim()
        }).forEach((v) => {
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                const m = v.substring(1,v.length - 1);
                parameters.push(m);
            } else {
                const n = Number(v);
                if (!isNaN(n)) {
                    parameters.push(n);
                }
            }
        });
        if (parameters.length) {
            o.p = parameters;
        }
        return o;
    },
    parseCalcString(exp, replace){
        const temp = [];
        let expression = exp.trim().replace('px','');
        if(expression.length < 7){
            return "";
        }
        for (let i in exp){
            if (exp[i] === "%"){
                let start = i - 1;
                let c = exp[start];
                while((parseInt(c) >= 0 && parseInt(c) <= 9) || c === '.'){
                    start -= 1;
                    c = exp[start];
                }
                let percent = exp.substring(start + 1, i);
                let floatValue = parseFloat(percent) / 100;
                let replaceItem = {
                    old:percent + "%",
                    new:`(${floatValue} * ${replace})`
                }
                temp.push(replaceItem);
            }
        }
    
        for(item of temp){
            expression = expression.replace(item.old,item.new);
        }
        expression = expression.substring(5, expression.length - 1);
        return expression;
    },
    parseSpecificColor(colorName){
        return CSSColor[colorName];
    }
}