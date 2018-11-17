const brokersLifeCycle = require('./brokers/brokersLifeCycle');

describe('Brokers', () => {
    let brokers;
    before(() => {
        brokers = new brokersLifeCycle.Brokers();
    });

    it('start brokers', async () => {
        return brokers.start();
    });

    it('stop brokers', async () => {
        return brokers.stop();
    });
});

describe('Brokers in remote process', () => {
    let brokers;
    before(() => {
        brokers = new brokersLifeCycle.Brokers(true);
    });

    it('start brokers', async () => {
        return brokers.start();
    });

    it('stop brokers', async () => {
        return brokers.stop();
    });
});

describe(`Brokers ${brokersLifeCycle.localBusPath}`, () => {
    let brokers;
    before(() => {
        brokers = new brokersLifeCycle.Brokers(false, brokersLifeCycle.localBusPath);
    });

    it('start brokers', async () => {
        return brokers.start();
    });

    it('stop brokers', async () => {
        return brokers.stop();
    });
});

describe(`Brokers ${brokersLifeCycle.localBusPath} in remote process`, () => {
    let brokers;
    before(() => {
        brokers = new brokersLifeCycle.Brokers(true, brokersLifeCycle.localBusPath);
    });

    it('start brokers', async () => {
        return brokers.start();
    });

    it('stop brokers', async () => {
        return brokers.stop();
    });
});

