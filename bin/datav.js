

const chalk = require('chalk');
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const pkgJSON = require('../package.json');
const version = require('../libs/utils/check-version');
const log = require('../libs/utils/log');
const i18n = require('../libs/i18n_json');
const whoami = require('../libs/whoami');
const checkNodejsVersion = require('../libs/utils/check-nodejs-version');
const config = require('../config');

const cmd = new Command();

const logo =
`                                                                             
                                                                             
          ___           ___           ___           ___           ___        
         /\\  \\         /\\  \\         /\\  \\         /\\  \\         /\\__\\       
        /::\\  \\       /::\\  \\        \\:\\  \\       /::\\  \\       /:/  /       
       /:/\\:\\  \\     /:/\\:\\  \\        \\:\\  \\     /:/\\:\\  \\     /:/  /        
      /:/  \\:\\__\\   /::\\~\\:\\  \\       /::\\  \\   /::\\~\\:\\  \\   /:/__/  ___    
     /:/__/ \\:|__| /:/\\:\\ \\:\\__\\     /:/\\:\\__\\ /:/\\:\\ \\:\\__\\  |:|  | /\\__\\   
     \\:\\  \\ /:/  / \\/__\\:\\/:/  /    /:/  \\/__/ \\/__\\:\\/:/  /  |:|  |/:/  /   
      \\:\\  /:/  /       \\::/  /    /:/  /           \\::/  /   |:|__/:/  /    
       \\:\\/:/  /        /:/  /     \\/__/            /:/  /     \\::::/__/     
        \\::/__/        /:/  /                      /:/  /       ~~~~         
         ~~            \\/__/                       \\/__/                     
                                                                             
                                                                            

`;

console.log(chalk.cyan(logo));
checkNodejsVersion();
console.log(i18n.get('hello.npm'));

const COMMANDMAP = {
  preview: require('../libs/preview'),     // 预览  -- ✅已验证
  comInit: require('../libs/init'),        // 初始化 -- ✅已验证
  login:   require('../libs/login'),       // 登录 -- ✅已验证
  publish: require('../libs/publish'),     // 发布 -- ✅已验证
  package: require('../libs/package'),     // 打包 -- ✅已验证
  locale: require('../libs/locale'),       // 语言环境 -- ✅已验证
  localeClear: require('../libs/locale_clear'), // 清空语言环境 -- ✅已验证
  // 对公网暂时不发布
  // cubeBuild: require('../libs/cube_build'), // 采用 cube 打包模拟线上打包结果
  // 以下为多环境打包, 且用 webpack 打包
  // comBuild: require('../libs/build'), // 组件不同版本打包
  // comBuildReact: require('../libs/react_com_build')// react组件toDataV组件 临时方案，后续新增datav preview datav publish一键发布
};

function exec(command, ...args) {
  log.debugModeSwitch(typeof args[0] === 'string' ? args[1] && args[1].debug : args[0] && args[0].debug);
  COMMANDMAP[command](config, ...args);
}

function list(val) {
  return val.split(',');
}

cmd
  .usage('[options] <folder|file...>')
  .version(pkgJSON.version)
  .description(i18n.get('datav.title'))
  .option('-v, --verbose', 'increase verbosity')
  .option('-E, --exclude <items>', 'exclude file or folder', list);

cmd.command('set-key')
  .alias('login')
  .description('set-key with you username and token in the datav.aliyun.com')
  .action((...args) => exec('login', ...args));

cmd.command('init') // ✅ 已验证
  .description('init com for datav-coms')
  .action((...args) => exec('comInit', ...args));

cmd
  .command('start') // ✅ 已验证
  .alias('run')
  .argument('[root]', 'the root path')
  .option('-p, --port [value]', 'custom server port')
  .option('-s, --silent', 'keep silent')
  .option('-l, --local', 'use local remote')
  .option('-i, --locale [value]', 'language mode, ex: en-US')
  .description('start service for preview component')
  .action((...args) => exec('preview', ...args));

cmd
  .command('publish') 
  .alias('pbl')
  .option('-f --force', 'skip sensitive information checks')
  .option('-pc --privatecloud', 'publish for private cloud')
  .description('publish component')
  .argument('[root]', 'the root path')
  .action((...args) => exec('publish', ...args));

cmd
  .command('package') 
  .alias('pack')
  .option('-pc --privatecloud', 'publish for private cloud')
  .description('package component')
  .argument('[root]', 'the root path')
  .action((...args) => exec('package', ...args));

cmd
  .command('locale') 
  .description('Set your locale')
  .action((...args) => exec('locale', ...args));

cmd
  .command('locale-clear') 
  .alias('lc')
  .description('Clear your locale')
  .action((...args) => exec('localeClear', ...args));

cmd.command('help')
  .description('help')
  .action(() => cmd.help());

cmd.command('latest')
  .description(`check ${  pkgJSON.name  } latest version`)
  .action(() => version(pkgJSON));

cmd.command('whoami')
  .description('display datav username, datav region')
  .action(whoami);

cmd.command('cube-build')
  .alias('cb')
  .description('build with cube')
  .argument('[root]', 'the root path')
  .option('-p, --port [value]', 'custom server port')
  .option('-o, --output-dir [value]', 'output the build result')
  .option('-wc, --with-children', 'build with children')
  .option('-uc, --uncompress', 'compress code if or not, default is compress')
  .option('-hmr, --hot-module-reload', 'hot module reload')
  .option('-d, --debug', 'debug mode')
  .action((...args) => exec('cubeBuild', ...args));

// cmd.command('build')
//   .description('datav build test')
//   .argument('[root]', 'the root path')
//   .option('--mode [value]', 'default is lite')
//   .action((...args) => exec('comBuild', ...args));

// cmd.command('build-react')
//   .description('datav build-react')
//   .argument('[root]', 'the root path')
//   .option('--entry [value]', 'default entry=src/index.js')
//   .option('--datav-entry [value]', 'default datav-entry=index.js')
//   .option('--force [value]', 'default is false')
//   .option('--config [value]', 'default config=webpack.config.js ')
//   .action((...args) => exec('comBuildReact', ...args));

cmd.version(`v${  pkgJSON.version}`);

cmd.parse(process.argv);

if (!cmd.args.length) {
  cmd.help();
}

const cacheDir = path.join(config.root, config.cacheDir);
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir);
}