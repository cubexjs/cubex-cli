

const inquirer = require('inquirer');
const fs       = require('fs-extra');
const shelljs  = require('shelljs');
const Path     = require('path');
const process  = require('process');
const semver   = require('semver');
const urllib   = require('urllib');
const _        = require('lodash');
const unzip    = require('unzipper');
const debug = require('debug')('info');
const log      = require('./utils/log');
const i18n = require('./i18n_json');
const userConfig = require('../config/user');
const pkgJSON = require('../package.json');
const sysConfig = require('../config');
const {getLocale} = require('./utils/locale');

module.exports = function (config, args) {
  shelljs.config.verbose = true;
  shelljs.config.silent = true;

  const user = userConfig[userConfig.loggedin];
  const serverURL = user && user.server || sysConfig.serverDefault;
  const locale = getLocale(userConfig, sysConfig);

  function createDirForCom(answers, newProject) {
    debug('[3]create dir for com');
    const err = fs.mkdirSync(`./${  answers.comName}`);
    if (!err) {
      process.chdir(`./${  answers.comName}`);
      return __download(answers).then(() => {
        shelljs.exec('npm install');
      });
    } 
      throw err.stack || err;
    
  }

  function __download(answers) {
    debug('[4]download component.');
    const {comName} = answers;
    const name = answers.comTemplate.name.split('/');
    const repository = `${serverURL  }cube/modules/examples/${  name[name.length-1]  }/${  answers.comTemplate.version}`;

    const copyUrl = Path.join(config.root, config.cacheDir);
    const comURL = Path.join(copyUrl, `${name[name.length-1]}-${answers.comTemplate.version}`);
    return urllib.request(repository).then((res) => {
      if (!res || !res.data || !res.headers) throw 'download error';
      return res;
    }).then((data) => {
      return new Promise((resolve) => {
        const filename = data.headers['content-disposition'].split('=')[1];
        const fileurl = Path.join(config.root, config.cacheDir, filename);
        fs.writeFileSync(fileurl, data.data);
        fs.mkdirSync(comURL);
        fs.createReadStream(fileurl).pipe(unzip.Parse())
          .on('entry', entry => {
            const fileName = entry.path;
            const {type} = entry; 
            if (type === 'Directory') {
              fs.mkdirSync(Path.join(comURL, fileName));
            } else {
              entry.on('data', (content) => {
                content = content.toString('utf-8');

                if (fileName.indexOf('package.json') >= 0) {
                  content = JSON.parse(content);
                  content.version = '0.0.1';
                  content.name = `@namespace/${  comName}`;
                  content.datav.cn_name = answers.comCnName;
                  content = JSON.stringify(content, null, 2);
                }

                content = content.replace(/{comName}/g, comName);
                content = content.replace(/{comCnName}/g, answers.comCnName);
                content = content.replace(/{comDesc}/g, answers.comDesc);
                content = content.replace(/{username}/g, userConfig.loggedin);
                content = content.replace(/{ComName}/g, _.camelCase(comName));

                fs.writeFileSync(Path.join(comURL, fileName), content);
              });
            }
          }).on('close', () => {
            const i18nRootURL = Path.join(comURL, 'i18n');
            const i18nURL = Path.join(i18nRootURL, `${locale  }.json`);
            const packageURL = Path.join(comURL, 'package.json');
            if (fs.existsSync(i18nRootURL)) {
              if (fs.existsSync(i18nURL)) {
                let packageJSON = require(packageURL);
                const i18nJSON = require(i18nURL);
                delete i18nJSON.cn_name;
                packageJSON = _.merge({}, packageJSON, {datav: i18nJSON});
                fs.writeFileSync(packageURL, JSON.stringify(packageJSON, null, 2));
              } else {
                debug('no i18n file:', i18nURL);
              }
              // 删除 i18n
              fs.removeSync(i18nRootURL);
            }
            resolve(Path.join(copyUrl, `${name[name.length-1]}-${answers.comTemplate.version}`));
          });
      });
    }).then(url => {
      // 拷贝 url 到 '.'
      fs.copySync(url, '.');
      // 删除 url
      fs.removeSync(url);
    }).catch((e) => {
      throw e.stack || e;
    });
  }

  function showQuestions(examples) {
    debug('[2]show questions');
    const questions = [
      {
        type: 'input',
        name: 'comName',
        message: i18n.get('init.comNameMessage'),
        validate (value) {
          if (!value) {
            return i18n.get('error.empty');
          }
          if (/_/.test(value)) {
            return i18n.get('error.underline');
          }

          if (fs.existsSync(value)) {
            return i18n.get('error.dirDuplicateName');
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'comCnName',
        message: i18n.get('init.displayNameMessage'),
        validate (value) {
          return !value ? i18n.get('error.empty') : true;
        }
      },
      {
        type: 'input',
        name: 'comDesc',
        message: i18n.get('init.descriptionMessage'),
        validate (value) {
          return !value ? i18n.get('error.empty') : true;
        }
      },
      {
        type: 'list',
        name: 'comTemplate',
        message: i18n.get('init.templateMessage'),
        choices: examples && examples.length && _.map(examples, 'cn_name') || [],
        validate (value) {
          return !value ? i18n.get('error.empty') : true;
        }
      }
    ];

    return inquirer.prompt(questions).then((answers) => {
      answers.comTemplate = _.find(examples, {cn_name: answers.comTemplate});
      return answers;
    });
  }

  function getExampleList() {
    debug('[1]get remote example list, url: ', `${serverURL  }cube/modules/examples?i18n=${  locale}`);
    return urllib.request(`${serverURL  }cube/modules/examples?i18n=${  locale}`, {dataType: 'json'}).then((data) => {
      data = data && data.data || {};
      if (!semver.satisfies(pkgJSON.version, data['datav-cli-version'])) {
        log.warn(i18n.get('init.exampleVersionError', { cliVerion: pkgJSON.version, remoteVersion: data['datav-cli-version'] } ));
      }
      return data.coms || [];
    }).catch((e) => {
      throw i18n.get('init.remoteError');
    });
  }

  function sayHello() {
    return new Promise((resolve) => {
      resolve();
    });
  }

  sayHello()
    .then(getExampleList)
    .then(showQuestions)
    .then(createDirForCom)
    .then(() => {
      log.info(i18n.get('init.success'));
      return process.exit();
    }).catch((e) => {
      log.err(e);
      return process.exit();
    });
};


