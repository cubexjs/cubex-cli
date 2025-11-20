const fs = require('fs');
const path = require('path');
const ignore = require('ignore');
const { pack } = require('tar-pack');

const IGNORE = ['/node_modules', '/datav_modules', '/.cubecache', '/children/', '/.idea', '/package-lock.json', '/.vscode'];

// @params source 要打包的源目录
// @params target 打包到目标路径
// @params extra 额外信息
// @params callback 
module.exports = function (source, target, { nodeModules = false } = {}, callback) {
  // 需要把 .gitignore 读取出来
  const ignoreStr = fs.readFileSync(path.join(source, '.gitignore'), 'utf8');
  const customIgnore = ignore({
    allowRelativePaths: true,
  }).add(ignoreStr);

  customIgnore.add(IGNORE);

  if (nodeModules) {
    /** 注意组件 gitignore 的 dist 规则不要影响到 node_modules 下 */
    customIgnore.add([ '!node_modules', '!dist' ]);
  }

  return pack(source, {
    ignoreFiles: [],
    filter (entry) {
      const relativePath = path.relative(source, entry.path);
      if (!relativePath) return true;
      return !customIgnore.ignores(relativePath);
    }
  }).pipe(fs.createWriteStream(target)).on('error', (err) => {
    callback(err);
  }).on('close', () => {
    callback(null);
  });
};
