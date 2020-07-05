const fs    = require('fs-extra');
const VNode = require('../node/VNode');
const path  = require('path');
const KCFile = require('./KCFile');
const Graph  = require('../node/DependencyGraph');

const kEnterNodeName = "$enter";

class KCBuilder {
    static sharedBuilder() {
        if (!this._sharedData) {
            this._sharedData = new KCBuilder();
        }
        return this._sharedData;
    }

    constructor() {
        this.originConfigJSON = {};
        this.kcFileMap        = {};
        this.srcFolderPath    = ''; 
    }

    /* 设置kc.config.json 的路径，并重新读取 */
    setConfigJSONPath(filePath) {
        this.originConfigJSON = JSON.parse(fs.readFileSync(filePath).toString());
        // 给VNode 设置哪些是组件
        this.registedComponentInfo = this.getRegistedComponentInfo();
        VNode.setComponetsInfo(this.registedComponentInfo);
        this.srcFolderPath = path.dirname(filePath);
    }

    build() {
        const kcFileInfos = this.getRegistedComponentInfo();
        kcFileInfos[kEnterNodeName] = this.originConfigJSON['entrance'];
        for (let componentName in kcFileInfos) {
            const relativePath = kcFileInfos[componentName];
            const absolutePath = path.join(this.srcFolderPath, relativePath);
            const kcFile       = new KCFile(absolutePath, componentName);
            this.addKCFile(kcFile);
            kcFile.writeAssets();
        }

        this.saveConfigJSON();
    }

    saveConfigJSON() {
        const dependencyMap = this.getComponentsDependence();
        const components = [];
        for (let componentInfo of this.originConfigJSON.components) {
            const componentsSaveData = {};
            const {name , path} = componentInfo;
            componentsSaveData['name'] = name;
            componentsSaveData['path'] = path;
            components.push(componentsSaveData);
        }
        const saveConfigJSON = JSON.parse(JSON.stringify(this.originConfigJSON));
        components.push({
            name: '$enter',
            path: this.originConfigJSON['entrance']
        })
        saveConfigJSON['components'] = components;
        saveConfigJSON['dependency'] = dependencyMap;
        delete saveConfigJSON['entrance'];
        const saveText = JSON.stringify(saveConfigJSON, null, 2);
        const savePath = path.resolve(this.srcFolderPath, 'kc.config.json');
        fs.writeFileSync(savePath, saveText);
        console.log('[Success] 编译完成✅✅✅');
    }

    /* 获取通过kc.config.json 注册的组件信息 */
    getRegistedComponentInfo() {
        const info = {};
        for (let registedComponentInfo of this.originConfigJSON.components) {
            info[registedComponentInfo.name] = registedComponentInfo.path;
        }
        return info;
    }

    isComponentRegisted(componentName) {
        if (this.registedComponentInfo[componentName]) {
            return true;
        }
        return false;
    }

    /* 组件将自己添加进去，方便进行组件依赖的分析 */
    addKCFile(kcFile) {
        if (!kcFile) {
            return;
        }

        const componentName = kcFile.componentName;
        if (this.isComponentRegisted(componentName) || 
            componentName === kEnterNodeName) {
            this.kcFileMap[componentName] = kcFile;
        } else {
            console.log(`[warning] ${componentName} 组件未注册`);
        }
    }

    getComponentsDependence() {
        const allDependencies = {};
        // 遍历所有的组件，包括入口组件
        for (let vertexKey in this.kcFileMap) {
            const kcFile = this.kcFileMap[vertexKey];
            // 获取该组件的依赖组件
            const dependencies = kcFile.templateNode.collectCustomJSComponents();
            allDependencies[kcFile.componentName] = dependencies;
        }
        
        return allDependencies;
    }
}

module.exports = KCBuilder.sharedBuilder();