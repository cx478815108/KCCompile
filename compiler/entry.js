const fs               = require('fs-extra');
const path             = require('path');
const builder          = require('./src/config/KCBuilder');
const { execFileSync } = require('child_process');

const configJSONPath = '/Users/chenxiong/个人项目/KCNative/Demos/Demo/kc.config.json';

const getSrcPath = (configJSONPath)=>{
    return path.dirname(configJSONPath);
}

const getDistPath = (configJSONPath)=> {
    const srcFolderPath = path.dirname(configJSONPath);
    const srcFolderName = path.basename(srcFolderPath);
    const distPath      = path.join(srcFolderPath, `../build/${srcFolderName}`);
    return distPath;
}

const copyToDistFolder = (enterConfigPath = '')=> {
    if (!enterConfigPath.endsWith('kc.config.json') || 
        !fs.existsSync(enterConfigPath)) {
        return '';
    }

    const srcFolderPath = getSrcPath(enterConfigPath);
    const distPath = getDistPath(enterConfigPath);

    if (fs.existsSync(distPath)) {
        fs.removeSync(distPath); 
    }
    // 将源码复制到 ./build/目录下
    fs.copySync(srcFolderPath, distPath);
    return path.join(distPath, 'kc.config.json');
}

const serialization = (folderPath)=>{
    const serialization_iOS_path = path.join(__dirname, '/src/serialization_iOS');
    execFileSync(serialization_iOS_path, [folderPath]);
}

builder.setConfigJSONPath(copyToDistFolder(configJSONPath));
builder.build();
console.log('[Success] JS 编译完成✅✅✅');
// 开始序列化为OC 文件
serialization(getDistPath(configJSONPath));
console.log('[Success] Native 序列化完成 ✅✅✅');

// to-do 2. 完成CSS 选择器的首次匹配