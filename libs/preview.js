

const shelljs = require('shelljs');
const service = require('./common/service');
const path    = require('path');
const fs      = require('fs');
const log     = require('./utils/log');
const Utils   = require('./utils');

module.exports = function (sysConfig, source, args = {}) {
  shelljs.config.verbose = true;
  shelljs.config.silent = true;

  source = Utils.isAbsPath(source) && typeof source === 'string' ?
    path.join(process.cwd(), source) :
    process.cwd();

  let fstat;

  try {
    fstat = fs.statSync(source);
  } catch (e) {
    log.err('source not found', e);
    return process.exit();
  }

  if (fstat.isDirectory()) {
    const configUrl = path.join(source, '/package.json');
    try {
      fstat = fs.statSync(configUrl);
    } catch (e) {
      log.err('source not found', e);
      return process.exit();
    }

    // 起服务
    service(Object.assign({}, sysConfig, args, {
      view: path.join(sysConfig.root, '/views'),
      source,
    }));
  } else {
    log.err('unknow type input source', source);
    return process.exit();
  }
};
