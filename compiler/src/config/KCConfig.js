const path = require('path');
const fs   = require('fs-extra');

class KCConfig {
    constructor(jsonPath) {
        this.configWithJSONPath(jsonPath);
    }

    configWithJSONPath(jsonPath) {
        this.jsonPath      = jsonPath;
        this.json          = this.checkJSON();
        this.srcFolderPath = path.dirname(jsonPath);
        this.srcName       = path.basename(path.dirname(jsonPath));
        this.distPath      = path.join(this.srcFolderPath, `../build/${this.srcName}`);
        this.entrance      = this.json['entrance'];
        this.version       = this.json['version'] || "1.0";
        this.components    = {};
        this.originComponents = {};
        this.reverseComponents = {};
        this.makePath();
    }

    getOriginComponentMetaData(componentNames) {
        const list = {};
        for(let name of componentNames) {
            if (this.originComponents[name]) {
                list[name] = this.originComponents[name];
            }
        }

        return list;
    }

    checkJSON() {
        if (!fs.existsSync(this.jsonPath)) {
            throw `${this.jsonPath} 不存在`;
        }

        const text = fs.readFileSync(this.jsonPath).toString();
        const json = JSON.parse(text);
        if (typeof json !== 'object') {
            throw `${this.jsonPath}  ： 解析JSON 文件失败`;
        }

        return json;
    }

    tagNameIsComponent(tagName) {
        return (typeof this.components[tagName] === 'string' && 
                this.components[tagName].length > 0);
    }

    resaveConfigJSON(unuseComponents) {
        const mainConfigJSON = JSON.parse(JSON.stringify(this.json));
        const components = [{
            name : "$entrance",
            path : mainConfigJSON.entrance
        }];

        delete mainConfigJSON['entrance'];
        
        if (mainConfigJSON.components.length) {
            for (let declareComponent of mainConfigJSON.components) {
                if (!unuseComponents[declareComponent.name]) {
                    components.push(declareComponent);
                }
            }
    
            mainConfigJSON.components = components;
            fs.writeFileSync(this.jsonPath, JSON.stringify(mainConfigJSON, null, 2));
        }
    }

    makePath() {
        const rootDir = path.dirname(this.jsonPath);
        this.entrance = path.join(rootDir, this.entrance);
        const Path = path;

        const invalidName = {
            'div': true,
            'label' : true,
            'button' : true
        }

        for (let component of this.json['components']) {
            const {name , path} = component;
            if (this.components[name]) {
                console.log(`🔔🔔🔔：${name} 组件重复注册`);
                continue;
            }

            this.originComponents[name] = path;

            if (invalidName[name]) {
                console.log(`❌❌❌：${JSON.stringify(component, null, 2)} 组件注册无效, 请更换组件名！`);
            }

            const realPath = Path.join(rootDir, path);
            this.components[name] = realPath;
            this.reverseComponents[realPath] = name;
        }
    }
}

module.exports = KCConfig;



