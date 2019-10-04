const path = require('path');
const child_process = require('child_process');

export function RunMochaNode(args) {
    return new Promise((resolve, reject) => {
        args = args || [];
        let mochaModule = require.resolve('mocha/package.json');
        if (mochaModule == null) {
            return reject(`Do not find mocha module`);
        }
        let mochaBin = path.join(path.dirname(mochaModule), '..', 'bin', '_mocha');
        args.unshift(mochaBin);
        if (process.env['NODE_ENV'] === 'development') {
            args.unshift('--debug-brk');
            args.unshift('--inspect-brk=10000');
        }

        let options = { env: {} };
        for (let key of Object.keys(process.env)) {
            options.env[key] = process.env[key];
        }
        options.env['ELECTRON_RUN_AS_NODE'] = '1';
        // options.cwd = __dirname;
        options.stdio = 'inherit';

        const child = child_process.spawn('node',
        // const child = child_process.spawn(process.execPath,
            args,
            options
        );
        child.on('error', (err) => {
            reject(err);
        });
        child.on('exit', (code) => {
            resolve();
        });
    });
}