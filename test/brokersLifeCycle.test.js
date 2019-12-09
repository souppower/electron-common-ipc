const brokersLifeCycle = require('./brokers/brokersLifeCycle');

function test(remoteBroker, busPath) {
    describe(`Brokers lifeCycle`, () => {
        before(() => {
            return brokersLifeCycle.createConnection(busPath)
            .then((busPortOrPath) => {
                describe(`Brokers ${busPortOrPath} ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
                    let brokers;
                    before(() => {
                        brokers = new brokersLifeCycle.Brokers(remoteBroker, busPortOrPath);
                    });

                    it('start brokers', async () => {
                        return brokers.start();
                    });

                    it('stop brokers', async () => {
                        return brokers.stop();
                    });
                });
            });
        });
        it("", async function(){})  // this is important!
    });
}
test(false, false);
test(true, false);
test(false, true);
test(true, true);

