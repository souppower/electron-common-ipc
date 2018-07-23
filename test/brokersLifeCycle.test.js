const brokersLifeCycle = require('./helpers/brokersLifeCycle');

describe('Brokers', () => {
  it('start brokers', async () => {
      return brokersLifeCycle.startBrokers();
  });

  it('stop brokers', async () => {
      return brokersLifeCycle.stopBrokers();
  });
});

describe('Brokers remote', () => {
    it('start brokers', async () => {
        return brokersLifeCycle.startBrokers(true);
    });
  
    it('stop brokers', async () => {
        return brokersLifeCycle.stopBrokers(true);
    });
  });
  
  