const path = require('path');
const pack = require('./utils/pack');
const log = require('./utils/log');
const i18n = require('./i18n_json');

module.exports = function(configSys, root, args = {}) {
  let packageCFG;

  root = typeof root === 'string' ? path.join(process.cwd(), root) : process.cwd();

  // log.debug('root:', root)
  try {
    packageCFG = require(path.join(root, 'package.json'));
  } catch (e) {
    log.err('parse package.json failed');
    return process.exit();
  }
  
  const tarPath = path.join(root, '../', `${!packageCFG.name.includes('@') ? '@datav#' : ''}${packageCFG.name.replace('/', '#')}-${packageCFG.version}.tar.gz`);
  pack(root, tarPath, { nodeModules: args.privatecloud }, function(err) {
    if (err) {
      log.err(err);
      return process.exit();
    } else {
      log.info(`${i18n.get('package.success')}`);
      return process.exit();
    }
  });
}
