const fs            = require('fs-extra');
const path          = require('path');
const cssSelect     = require('css-select');
const cssAdapter    = require('./src/htmlparser/CSSAdapter');
const htmlParser    = require('./src/htmlparser/HTMLParser');
const parseUtil     = require('./src/utils/ParseUtil');
const cssColor      = require('./src/utils/CSSColor');
const KCConfig      = require('./src/config/KCConfig');
const VNode         = require('./src/node/VNode');
const Graph         = require('./src/node/DependencyGraph');
const astCollection = require('./src/utils/ASTParse').astCollection;

const TagName = {
    template : "template",
    script : "script",
    style : "style"
}

const nodeTool = {

    /* 根据tagName 找到document 下最顶层的标签 */
    findTargetTag(document, tagName){

        if (!document.children) {
            return [];
        }
    
        const targets = [];
        for(let i = 0;i < document.children.length; i++) {
            const node = document.children[i];
            if (node.tagName === tagName ) {
                targets.push(node);
            }
        }
    
        return targets;
    },

    processScriptTags(document) {
        // 只规定第一个标签才能生效
        const scriptNode = this.findTargetTag(document, TagName.script)[0];
        return scriptNode.text;
    },


    processStyleTags(document) {
        // 寻找到style 节点
        const styleNodes  = this.findTargetTag(document, TagName.style);
        const allStyleObj = {};
        const colorMap    = {
            "background-color" : true,
            "color"            : true,
            "border-color"     : true
        }

        // 可能一个文件内部有多个<style></style> 但是需要把所有的内容合并
        for(let styleNode of styleNodes) {
            const styleText = styleNode.text;
            const ruleStore = parseUtil.parseCSSString(styleText);
            for (let cssRuleKey in ruleStore) {
                // 先替换颜色 比如red blue green 替换为 rgb(ar,g,b)...
                const properties = ruleStore[cssRuleKey];
                for (let key in properties) {
                    if (colorMap[key]) {
                        const roiginColorValue = properties[key]; // red
                        const rgbColor = cssColor[roiginColorValue]; // rgb(255,0,0)
                        if (rgbColor) {
                            properties[key] = rgbColor;
                            continue;
                        }
                    }
                }
                
                allStyleObj[cssRuleKey] = properties;
            }
        }
    
        return allStyleObj;
    },

    processTemplateTag(document) {
        // 寻找到template 模板 只规定第一个标签才能生效
        const templateNode = this.findTargetTag(document, TagName.template)[0];
        if (!templateNode) {
            return null;
        }
        return templateNode.children[0];
    },

    // 提前将CSS 匹配的结果写入到DOM 中
    preprocessCSS(rootNode, cssRules) {
        
        const findAll = (query)=>{
            return cssSelect.selectAll(query, [rootNode], {
                adapter: cssAdapter
            })
        };

        for (const selectors in cssRules) {
            const selectorList = selectors.split(" ");
            const style        = cssRules[selectors];
            
            selectorList.forEach((selector) => {
                // 根据 selector 寻找匹配的nodes 
                const nodes = findAll(selector);
                // nodes 将css rules合并进去
                nodes.forEach((node) => {
                    node.addCSSStyle(style);
                });
            });
        } 
    }
}

class FileProcess {

    constructor() {
        this.kcConfig = null;
        this.allComponentVNode = {};
    }

    startProcess(file) {
        // 读取配置文件 kc.config.json
        const configJSONPath = '/Users/chenxiong/个人项目/KCNative/Demos/Demo/kc.config.json';
        this.produceConfigModel(configJSONPath)
        .then((kcConfig)=>{
            return this.processAllFiles(kcConfig);
        })
        .then((nodes) => {
            const allTasks = [];
            for(let fileNode of nodes) {
                // 收集自定义的组件
                allTasks.push(this.processFileNode(fileNode));
                this.allComponentVNode[fileNode.componentName] = fileNode;
            }

            return Promise.all(allTasks);
        })
        .then((list)=>{
            const dependencyMap = this.produceComponentsDependencies();
            const allTasks = [];
            // 所有的组件都可以分析自己的依赖
            for (let saveItem of list) {
                // ['组件A','组件B']
                const singleDependency = dependencyMap[saveItem.componentName];
                // 如果每个组件自己的依赖数量大于0
                if (singleDependency && singleDependency.length) {
                    saveItem.data.dependency = this.kcConfig.getOriginComponentMetaData(singleDependency);
                }

                // mark 只有$enter才写入 dependency 因为不让组件相互引用 后续可能会开放
                if (saveItem.componentName !== '$enter') {
                    delete saveItem.data['dependency'];
                }

                const data = JSON.stringify(saveItem.data, null , 2);
                if (data && data.length) {
                    // 保存到磁盘
                    allTasks.push(fs.writeFile(saveItem.dirPath, data));
                }
            }

            // 写入ast 文件
            const astSavePath = path.join(this.kcConfig.distPath, 'kc.ast.json');
            const astJSON = JSON.stringify(astCollection(), null , 2);
            allTasks.push(fs.writeFile(astSavePath, astJSON));

            return Promise.all(allTasks);
        }).then(()=>{
            // 写入ast 文件
            console.log("编译结束"); 
        })
        .catch((error)=>{
            console.log("[KCNative] 错误:error", error);
        });
    }

    processFileNode(fileNode) {
        // 生成AST
        const astNode = fileNode.node.makeNativeAST();
        const data = {
            template: astNode,
            componentName:fileNode.componentName
        };

        const cssKeys = Object.keys(fileNode.styles);
        if (cssKeys.length) {
            data['css'] = fileNode.styles
        }

        return Promise.resolve({
            data,
            dirPath: fileNode.filePath + '.json',
            componentName:fileNode.componentName
        });
    }

    // 分析组件之间的依赖关系
    produceComponentsDependencies() {
        const graph = new Graph();

        // 遍历所有的组件，包括入口组件
        for (let vertexKey in this.allComponentVNode) {
            const fileNode = this.allComponentVNode[vertexKey];
            // 获取该组件的依赖组件
            const dependencies = fileNode.node.collectCustomJSComponents();
            // 遍历该组件的依赖组件
            for (let componentName in dependencies) {
                const component = this.allComponentVNode[componentName];
                // 添加边 边:'该组件' -> '依赖组件' 
                const result = graph.addEdge(fileNode, component);
                if (!result) {
                    throw Error('[Error]: 组件循环依赖!');
                }
            }
        }

        // 该 dependencyMap 里面 { '$enter': ['组件A', '组件B', ...], '组件A': ['组件B', ...] }
        const dependencyMap = {};

        // 通过图来计算每个组件所依赖或者间接依赖的组件
        for (let vertexKey in this.allComponentVNode) {
            const fileNode = this.allComponentVNode[vertexKey];
            graph.clearVisitInfo();
            dependencyMap[fileNode.componentName] = [];
            graph.visistGraph(fileNode, (dependency)=> {
                if (dependency.componentName !== fileNode.componentName) {
                    dependencyMap[fileNode.componentName].push(dependency.componentName);
                }
            });
        }

        // 通过入口文件找出真正被使用的组件
        const componensUsing = new Set();
        const enterDependencies = dependencyMap['$enter'];
        componensUsing.add('$enter');
        for (let componentName of enterDependencies) {
            componensUsing.add(componentName);
            for (let otherName of dependencyMap[componentName]) {
                componensUsing.add(otherName);
            }
        }

        // 准备通知未使用的组件
        const unuse = {};
        for (let key in this.allComponentVNode) {
            if (!componensUsing.has(key)) {
                unuse[key] = true;
            }
        }

        const unuseNames = Object.keys(unuse);
        this.kcConfig.resaveConfigJSON(unuse);
        if (unuseNames.length) {
            console.warn(`[warning]:下列组件未被使用:[${unuseNames}]`);
        }

        return dependencyMap;
    }

    processAllFiles(kcConfig) {
        // 该数组保存所有的 .kc 路径，首先将主入口 .kc 文件路径添加进去
        const paths = [kcConfig.entrance];
        // 将所有的自定义组件 .kc 文件路径添加进去
        for (let key in kcConfig.components) {
            paths.push(kcConfig.components[key]);
        }
        // 根据kc 文件的路径，生成单个fileNode 用于后续的处理
        const tasks = [];
        for(let p of paths) {
            tasks.push(this.processSingleFilePath(p));
        }

        return Promise.all(tasks);
    }

    // 生成kcConfig 实例
    produceConfigModel(kcConfigPath) {
        return new Promise((resolve)=> {
            const kcConfig = new KCConfig(kcConfigPath);
            // 将源码复制到build目录，方便进行下一步操作
            const distPath = kcConfig.distPath;
            fs.copy(kcConfig.srcFolderPath, distPath)
            .then(()=>{
                const dirname    = path.dirname(kcConfigPath);   
                const folderName = path.basename(dirname);
                const fixPath    = path.join(dirname,`../build/${folderName}/kc.config.json`);
                // 重新修正路径用新的kc.config.json 的路径
                kcConfig.configWithJSONPath(fixPath);
                kcConfig.distPath = distPath;

                // 给VNode 设置组件节点信息 方便VNode 自己处理信息
                VNode.setComponetsInfo(kcConfig.originComponents);
                this.kcConfig = kcConfig;
                resolve(kcConfig);
            })
        })
    }

    /* 
        根据传入的filePath 生成一个VNode 实例
        eg: xxxx/xxx/xx.kc  => VNode
    */
    produceFileModel(filePath) {
        return new Promise((resolve)=> {
            fs.readFile(filePath).then((data)=>{
                const htmlText = data.toString();
                const parser   = new htmlParser();
                const document = parser.parse(htmlText);
                const componentName = this.kcConfig.reverseComponents[filePath] || "$enter";
                const htmlNode = nodeTool.processTemplateTag(document);
                const styles =  nodeTool.processStyleTags(document);
                nodeTool.preprocessCSS(htmlNode, styles);
                resolve({
                    node : htmlNode.recursiveToVNode(),
                    styles,
                    script: nodeTool.processScriptTags(document),
                    componentName,
                    filePath
                });
            });
        })
    }

    processSingleFilePath(path){
        const p = this.produceFileModel(path)
        .then((fileNode)=>{
            return this.processJavaScriptCode(fileNode);
        });
        
        return p;
    }

    /* 处理JS 源码 */
    processJavaScriptCode(fileNode) {
        if (!fileNode.script.length) {
            return Promise.resolve(fileNode);
        }

        return new Promise((resolve) => {
            // kcPath 是每个.kc 文件的路径 xxx/Demo/pages/index/index.kc
            fs.writeFile(`${fileNode.filePath}.js`, fileNode.script)
            .then(()=>{
                resolve(fileNode);
            })
        })
    }
}

const fileProcess = new FileProcess();
fileProcess.startProcess();
