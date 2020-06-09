const ipcSocket = require('socket-serializer');

const Conversions = {
  's': [1, 1e-9],
  'ms': [1e3, 1e-6],
  'us': [1e6, 1e-3],
  'ns': [1e9, 1]
};

describe(`Performance IPCPacketBuffer`, () => {
  const rawContent = {
    type: ipcSocket.BufferType.NotValid,
    contentSize: 0,
    buffer: Buffer.alloc(128)
  };

  it('static buffer', (done) => {
    const ipcBuffer = new ipcSocket.IpcPacketBuffer();

    const time = process.hrtime();
    for (let i = 0; i < 10000; ++i) {
      ipcBuffer.setRawContent(rawContent);
      ipcBuffer.reset();
    }
    const diff = process.hrtime(time);
    const diffms = diff[0] * Conversions.ms[0] + diff[1] * Conversions.ms[1];
    console.log(`static buffer ${diffms.toFixed(2)} ms`);
    done();
  });

  it('dynamic buffer', (done) => {
    const time = process.hrtime();
    for (let i = 0; i < 10000; ++i) {
      const ipcBuffer = new ipcSocket.IpcPacketBuffer(rawContent);
    }
    const diff = process.hrtime(time);
    const diffms = diff[0] * Conversions.ms[0] + diff[1] * Conversions.ms[1];
    console.log(`dynamic buffer ${diffms.toFixed(2)} ms`);
    done();
  });
})


