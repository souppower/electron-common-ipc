const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusApi = require('../lib/electron-common-ipc');

describe('Connection', function () {

    it(`Connect/Close`, function () {
      let bufferListReader = new BufferListReader.BufferListReader();
      bufferListReader.appendBuffer(paramBuffer);
      bufferListReader.appendBuffer(paramBuffer);
      bufferListReader.appendBuffer(paramBuffer);
      {
        let result = bufferListReader.readBuffer(64);
        assert(Buffer.compare(globalBuffer.slice(0, 64), result) === 0);
      }
      {
        let result = bufferListReader.readBuffer(128);
        assert(Buffer.compare(globalBuffer.slice(64, 64 + 128), result) === 0);
      }
    });
});


