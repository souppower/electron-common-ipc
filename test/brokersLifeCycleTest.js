const brokersLifeCycle = require('./brokersLifeCycle');

describe('Brokers', () => {
  it('start brokers', async () => {
      return brokersLifeCycle.startBrokers();
  });

  it('stop brokers', async () => {
      return brokersLifeCycle.stopBrokers();
  });
});

