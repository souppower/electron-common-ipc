const minimist = require('minimist');

const createClient = require('./createClient.js')

// busPath
console.log(argv);

const args = minimist(process.argv.slice(1));
const busTimeout = 30000;
if (args.busTimeout) {
    busTimeout = parseInt(args.busTimeout);
}
const busPath = 0;
if (args.busPath) {
    busPath = parseInt(args.busPath);
}

createClient('client Node', busPath, busTimeout, (response) => {
    process.send(JSON.stringify({ response }));
})
.then(() => {
    process.send(JSON.stringify({ ready: { resolve: true }}));
})
.catch((err) => {
    process.send(JSON.stringify({ ready: { reject: true, error: err }}));
});

