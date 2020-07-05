const fs            = require('fs-extra');
const path          = require('path');
const cssSelect     = require('css-select');
const cssAdapter    = require('./src/htmlparser/CSSAdapter');
const parseUtil     = require('./src/utils/ParseUtil');
const cssColor      = require('./src/utils/CSSColor');
const KCConfig      = require('./src/config/KCConfig');
const VNode         = require('./src/node/VNode');
const Graph         = require('./src/node/DependencyGraph');
const astCollection = require('./src/utils/ASTParse').astCollection;
const builder       = require('./src/config/KCBuilder');

const configJSONPath = '/Users/chenxiong/个人项目/KCNative/Demos/Demo/kc.config.json';

const copyToDistFolder = (enterConfigPath = '')=> {
    if (!enterConfigPath.endsWith('kc.config.json') || 
        !fs.existsSync(enterConfigPath)) {
        return '';
    }

    const srcFolderPath = path.dirname(enterConfigPath);
    const srcFolderName = path.basename(srcFolderPath);
    const distPath      = path.join(srcFolderPath, `../build/${srcFolderName}`);

    if (fs.existsSync(distPath)) {
        fs.removeSync(distPath); 
    }
    // 将源码复制到 ./build/目录下
    fs.copySync(srcFolderPath, distPath);
    return path.join(distPath, 'kc.config.json');
}

builder.setConfigJSONPath(copyToDistFolder(configJSONPath));
builder.build();
