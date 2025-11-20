/* eslint-disable no-underscore-dangle */
const path = require('path');
const fs = require('fs');
const debug = require('debug')('info');
const Utils = require('../utils');
const Parse = require('../utils/parse');
const Read = require('../utils/read');
const shelljs = require('shelljs');
const co = require('co');
const log = require('../utils/log');
const _ = require('lodash');
const sysConfig = require('../../config');
const userConfig = require('../../config/user');
const i18n = require('../i18n_json');
const {getLocale} = require('../utils/locale');

function write(url, json) {
  return fs.writeFileSync(url, JSON.stringify(json, null, 2), 'utf8');
}

function end(code, str, data) {
  const res = {
    data
  };
  if (code === 1) {
    res.code = code;
    res.isError = false;
    res.message = str || 'success';
  } else {
    res.code = code;
    res.isError = true;
    res.message = str || 'error';
  }
  return JSON.stringify(res);
}

module.exports = function (router, source, options) {
  const configUrl = path.join(source, '/package.json');
  const { local } = options;

  router.get('/', (req, res) => {
    res.redirect('/index.html');
  });

  router.get('/index.html', (req, res) => {
    const config = Read.file(configUrl, res);
    const locale = options.locale || getLocale(userConfig, sysConfig);
    const datavI18n = _getI18N(source, locale);
    const datav = Parse.convertDatav(_.merge({}, config.datav, datavI18n), res, source);

    const logged = userConfig.loggedin;
    const user = logged && userConfig[userConfig.loggedin];
    const region = user && user.region || sysConfig.regionDefault;
    let childrenList;

    if (datav.children) {
      childrenList = _getChildrenList(datav.children && datav.children.default, source, { locale }, res);
    }

    res.render('index.html', {
      name: config.name,
      version: config.version,
      _dir: config.main || '/index.jsx',
      datav: JSON.stringify(datav),
      children: childrenList || null,
      i18n: JSON.stringify(i18n.getAll()),
      region,
      locale,
      server: `${user && user.server || sysConfig.serverDefault}cube`,
      isReact: datav.framework === 'react',
      isRemoteLocal: local,
    });
  });

  router.get('/modules', (req, res) => {
    const modules = [];

    function getModuleContent(pkgJsonString) {
      const pkgJson = JSON.parse(pkgJsonString);
      const { datav, name, version } = pkgJson;
      if (!datav) {
        throw new Error('非 datav 组件');
      }
  
      const { cn_name, description, icon, level } = datav;
      return {
        cn_name,
        config: JSON.stringify(datav),
        description,
        icon,
        level,
        name,
        version
      };
    }
    
    function travel(dir) {
      try {
        fs.readdirSync(dir).forEach((file) => {
          const pathname = path.join(dir, file);
            if (fs.statSync(pathname).isDirectory()) {
              const pkgPath = path.join(pathname, 'package.json');
              try {
                const pkgString = fs.readFileSync(pkgPath);
                modules.push(getModuleContent(pkgString));
              } catch (error) {
                console.error(error);
              }
            }
        });
      } catch (error) {
        console.warn('未找到 children 文件夹');
      } 
    }
    const pkgString = fs.readFileSync(path.join(source, 'package.json'));
    modules.push(getModuleContent(pkgString));
    
    travel(path.join(source, 'children'));

    res.setHeader('content-type', 'application/json;charset=utf-8');
    res.end(JSON.stringify(modules));
  });

  router.post('/publish', (req, res) => {
    const logged = userConfig.loggedin;
    if (!logged) {
      res.end(end(0, i18n.get('publish.loginMessage')));
      return;
    }

    const config = Read.file(configUrl, res);
    const data = req.body;
    config.datav.view = data.view;

    if (data.type === '' || !data.type) {
      res.end(end(0, i18n.get('preview.typeErrorMessage')));
    }
    config.datav.type = [data.type];
    config.version = data.version;
    if (data.icon) {
      config.datav.icon = data.icon;
    }

    if (config.datav.protocol >= 2) {            // 为handler fold 位置修改的兼容代码
      Parse.fixConfig(config.datav.config);
    }

    write(configUrl, config);

    try {
      shelljs.config.verbose = false;
      shelljs.config.silent = true;
      shelljs.exec('datav pbl', {timeout: 1000 * 60 * 5}, (code, stdout) => {
        if (stdout.indexOf('upload successed') === -1) {
          log.warn(stdout);
          res.end(end(0, i18n.get('preview.publishFail')));
        } else {
          res.end(end(1, i18n.get('preview.publishSuccess')));
        }
      });
    } catch (e) {
      res.end(end(0, e.toString()));
    }
  });


  function saveConfigSchema (configUrl, req, res) {
    // config 为 gui schema
    const config = Read.file(configUrl, res);
    let data = req.body;
    data = data.config;
    try {
      _.set(config, 'datav.config', data);
      write(configUrl, config);
      res.end(end(1, i18n.get('preview.syncSuccess')));
    } catch (e) {
      res.end(end(0, e.toString()));
    }
  };

  // 同步 gui schema 的值
  router.post('/config_schema_save', (req, res) => {
    saveConfigSchema(configUrl, req, res);
  });

  function findChildUrl(child, fileName, parent) {
    let url = path.join(parent, 'children', child, fileName);
    if (fs.existsSync(url)) return url;

    if (child.startsWith('@') && child.includes('/')) {
      url = path.join(parent, 'children', child.split('/')[1], fileName);
      if (fs.existsSync(url)) return url;
    }
    
    throw new Error(`error: invalid child name ${child}`);
  }

  router.post('/child_config_schema_save/:namespace/:dir', (req, res) => {
    const { dir } = req.params;
    try {
      const childConfigUrl = findChildUrl(dir, 'package.json', source);
      saveConfigSchema(childConfigUrl, req, res);
    } catch(e) {
      return res.end(end(0, e.message || e));
    }
  });

  router.post('/child_config_schema_save/:dir', (req, res) => {
    const { dir } = req.params;
    try {
      const childConfigUrl = findChildUrl(dir, 'package.json', source);
      saveConfigSchema(childConfigUrl, req, res);
    } catch(e) {
      return res.end(end(0, e.message || e));
    }
  });


  function saveConfig(configUrl, req, res) {
    const config = Read.file(configUrl, res);
    let data = req.body;
    data = data.config;
    try {
      Parse.convert2Datav(data, config.datav);
      write(configUrl, config);
      res.end(end(1, i18n.get('preview.syncSuccess')));
    } catch (e) {
      res.end(end(0, e.toString()));
    }
  }

  router.post('/config_save', (req, res) => {
    saveConfig(configUrl, req, res);
  });

  router.post('/child_config_save/:namespace/:dir', (req, res) => {
    const { dir } = req.params;
    try {
      const childConfigUrl = findChildUrl(dir, 'package.json', source);
      saveConfig(childConfigUrl, req, res);
    } catch(e) {
      return res.end(end(0, e.message || e));
    }
  });

  router.post('/child_config_save/:dir', (req, res) => {
    const { dir } = req.params;
    try {
      const childConfigUrl = findChildUrl(dir, 'package.json', source);
      saveConfig(childConfigUrl, req, res);
    } catch(e) {
      return res.end(end(0, e.message || e));
    }
  });


  function saveData(configUrl, req, res) {
    const config = Read.file(configUrl, res);
    const data = req.body;
    if (!data || !config || !config.datav) {
      res.end(end(0, 'error: there is no data'));
    } else {
      const { api_data } = config.datav;
      for (const k in api_data) {
        const api = api_data[k];
        if (typeof api === 'string') {
          if (JSON.stringify(data[k]).length > 512 * 1024) {
            res.end(end(0, i18n.get('preview.largeSize')));
          }
          write(path.join(source, api), data[k]);
        } else {
          if (JSON.stringify(data[k]).length > 512 * 1024) {
            res.end(end(0, i18n.get('preview.largeSize')));
          }
          api_data[k] = data[k];
        }
      }
      write(configUrl, config);
      res.end(end(1, i18n.get('preview.syncSuccess')));
    }
  }

  router.post('/data_save', (req, res) => {
    saveData(configUrl, req, res);
  });

  router.post('/child_data_save/:namespace/:dir', (req, res) => {
    const { dir } = req.params;
    try {
      const childConfigUrl = findChildUrl(dir, 'package.json', source);
      saveData(childConfigUrl, req, res);
    } catch(e) {
      return res.end(end(0, e.message || e));
    }
  });

  router.post('/child_data_save/:dir', (req, res) => {
    const { dir } = req.params;
    try {
      const childConfigUrl = findChildUrl(dir, 'package.json', source);
      saveData(childConfigUrl, req, res);
    } catch(e) {
      return res.end(end(0, e.message || e));
    }
  });


  router.post('/cnname_save', (req, res) => {
    const config = Read.file(configUrl, res);
    const data = req.body;
    if (!data || !config || !config.datav) {
      res.end(end(0, 'error: there is no data'));
    } else {
      config.datav.cn_name = data.name;
      write(configUrl, config);
      res.end(end(1, i18n.get('preview.syncSuccess')));
    }
  });

  function saveResource(req, res, base, filenameFun, cb) {
    let data, filename;
    if (!req.file) {
      res.end(end(0, 'error: there is no data'));
    } else {
      data = req.file.buffer;

      // 图片大小限制
      if (data.length > 1024 * 200) {
        res.end(end(0, i18n.get('preview.imageSize')));
      }

      if (typeof filenameFun === 'function') {
        filename = filenameFun(req.file.originalname);
      } else if (typeof filenameFun === 'string') {
        filename = filenameFun;
      } else {
        filename = `resource-${  Utils.randomWord(5)  }${path.extname(req.file.originalname)}`;
      }
      const root = path.join(source, base);
      const filepath = path.join(root, filename);
      co(function* () {
        if (!fs.existsSync(root)) {
          fs.mkdirSync(root);
        }
        fs.writeFileSync(path.join(root, filename), data);
        cb && cb();
        res.end(JSON.stringify({
          code: 1,
          file: `${filename  }?time=${  new Date().getTime()}`,
          isError: false,
          message: i18n.get('preview.syncSuccess')
        }));
      }).catch((err) => {
        log.err('resource save err: ', err.stack || err);
        res.end(end(0, err.toString()));
      });
    }
  }

  router.post('/resource_save', (req, res) => {
    saveResource(req, res, sysConfig.resourceDir);
  });

  router.post('/icon_save/:key', (req, res) => {
    const key = req.params.key || '316x238';
    saveResource(req, res, sysConfig.iconDir, `${key}icon.png`, () => {
      const config = Read.file(configUrl, res);
      config.datav.icon = path.join('./icons', `${key}icon.png`);
      write(configUrl, config);
    });
  });

  return router;
};

function _getI18N(root, locale, res) {
  const i18nURL = path.join(root, `/i18n/${locale}.json`);
  debug('i18nURL:', i18nURL);
  if (!locale) {
    debug(`${root} local locale start...`);
  } else if (!fs.existsSync(i18nURL)) {
    // 多语言文件缺失
    // log.warn(`${i18nURL} is not exist.`);
    debug(root, '缺失:', i18nURL);
  } else {
    return Read.file(i18nURL, res);
  }
  return {};
}

function _getChildrenList(children, source, config, res) {
  const childrenList = [];
  try {
    const childrenUrl = path.join(source, '/children');
    const childrenDir = fs.readdirSync(childrenUrl);
    if (childrenDir && childrenDir.length) {
      childrenDir.forEach((_dir) => {
        const _childrenUrl = path.join(childrenUrl, _dir);
        if (fs.statSync(_childrenUrl).isDirectory()) {
          const _childrenConfig = Read.file(path.join(_childrenUrl, 'package.json'));
          // console.log(_childrenConfig)
          const _childrenI18N = _getI18N(_childrenUrl, config.locale);
          if (children.indexOf(_childrenConfig.name) !== -1) {
            const _datav = Parse.convertDatav(_.merge({}, _childrenConfig.datav, _childrenI18N), res, _childrenUrl);
            childrenList.push({
              _dir: `/children/${_dir}/${_childrenConfig.main || 'index.jsx'}`,
              name: _childrenConfig.name,
              version: _childrenConfig.version,
              datav: _datav,
              _datav: _childrenConfig.datav,
            });
          }
        }
      });
    }
  } catch (e) {
    log.err(e);
  }
  return childrenList;
}