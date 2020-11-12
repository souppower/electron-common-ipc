const sinon = require('sinon');
const expect = require('expect');
const { IpcBusClientImpl } = require('../lib/IpcBus/IpcBusClientImpl');
const { IpcBusServiceProxyImpl } = require('../lib/IpcBus/service/IpcBusServiceProxyImpl');
const { IPCBUS_SERVICE_EVENT_START, IPCBUS_SERVICE_EVENT_STOP } = require('../');
const { IPCBUS_SERVICE_CALL_GETSTATUS } = require('../');
const { IpcBusTransportMultiImpl } = require('../lib/IpcBus/IpcBusTransportMultiImpl');
const serviceUtils = require('../lib/IpcBus/service/IpcBusServiceUtils');

describe('IpcBusServiceProxy', () => {
    let ipcBusClientMock;

    beforeEach(() => {
        const transportStub = sinon.createStubInstance(IpcBusTransportMultiImpl);
        this.ipcBusClientMock = sinon.mock(new IpcBusClientImpl(transportStub));
    });

    it('Should release the subscription if remove service is not started', async () => {
        const serviceName = 'service-1';
        const serviceEventChannel = serviceUtils.getServiceEventChannel(serviceName);
        this.ipcBusClientMock.expects('request').resolves({});
        this.ipcBusClientMock.expects('addListener').callThrough().calledOnceWith(serviceEventChannel, sinon.match.any);
        this.ipcBusClientMock.expects('removeListener').callThrough().calledOnceWith(serviceEventChannel, sinon.match.any);
        const testServiceProxy = new IpcBusServiceProxyImpl(this.ipcBusClientMock.object, serviceName);
        try {
             await testServiceProxy.connect();
        }
        catch (_) {}
        await testServiceProxy.close();
        this.ipcBusClientMock.verify();
    });

    // it('Should remove all listeners the closed', () => {
    //     this.ipcBusClientMock.expects('request').resolves({});
    //     const testServiceProxy = new IpcBusServiceProxyImpl(this.ipcBusClientMock.object, 'service-1');
    //     testServiceProxy.connect();
    //     expect(testServiceProxy._eventsCount).toEqual(1);
    //     testServiceProxy.close();
    //     expect(testServiceProxy._eventsCount).toEqual(0);
    // });

    // it('Should subscribe to start event if service is not available', () => {
    //     this.ipcBusClientMock.expects('request').resolves({});
    //     const testServiceProxy = new IpcBusServiceProxyImpl(this.ipcBusClientMock.object, 'service-1');
    //     testServiceProxy.connect();
    //     expect(testServiceProxy.listenerCount(IPCBUS_SERVICE_EVENT_START)).toEqual(1);
    // });

    it('Should successfully open connection after if was closed', async () => {
        this.ipcBusClientMock.expects('request').exactly(2).resolves({ payload: { started: true, callHandlers: [] } });
        const testServiceProxy = new IpcBusServiceProxyImpl(this.ipcBusClientMock.object, 'service-1');
        await testServiceProxy.connect();
        await testServiceProxy.close();
        await testServiceProxy.connect();
        expect(testServiceProxy.isStarted).toEqual(true);
        this.ipcBusClientMock.verify();
    });

    it('Should not have any effect if close was called before connect', async () => {
        this.ipcBusClientMock.expects('request').exactly(1).resolves({ payload: { started: true, callHandlers: [] } });
        const testServiceProxy = new IpcBusServiceProxyImpl(this.ipcBusClientMock.object, 'service-1');
        await testServiceProxy.close();
        await testServiceProxy.connect();
        expect(testServiceProxy.isStarted).toEqual(true);
        this.ipcBusClientMock.verify();
    });

    // it('Should call request method to ask remote service state while constructing', () => {
    //     const serviceName = 'service-1';
    //     const serviceEventChannel = serviceUtils.getServiceCallChannel(serviceName);
    //     const callMsg = { handlerName: IPCBUS_SERVICE_CALL_GETSTATUS, args: [] };
    //     this.ipcBusClientMock.expects('request').exactly(1).withExactArgs(serviceEventChannel, -1, callMsg).resolves({});
    //     new IpcBusServiceProxyImpl(this.ipcBusClientMock.object, serviceName);
    //     this.ipcBusClientMock.verify();
    // });

    it('Should return "false" when calling isStarted after close', async () => {
        this.ipcBusClientMock.expects('request').resolves({ payload: { started: true, callHandlers: [] } });
        const testServiceProxy = new IpcBusServiceProxyImpl(this.ipcBusClientMock.object, 'service-1');
        await testServiceProxy.connect();
        await testServiceProxy.close();
        expect(testServiceProxy.isStarted).toEqual(false);
    });

    it('Should emit start event when services is connected', async () => {
        this.ipcBusClientMock.expects('request').resolves({ payload: { started: true, callHandlers: [] } });
        const testServiceProxy = new IpcBusServiceProxyImpl(this.ipcBusClientMock.object, 'service-1');
        testServiceProxy.emit = sinon.spy(testServiceProxy.emit);
        await testServiceProxy.connect();
        expect(testServiceProxy.emit.calledOnceWith(IPCBUS_SERVICE_EVENT_START, sinon.match.any)).toEqual(true);
    });

    it('Should emit stop event if stopped explicitly', async () => {
        this.ipcBusClientMock.expects('request').resolves({ payload: { started: true, callHandlers: [] } });
        const testServiceProxy = new IpcBusServiceProxyImpl(this.ipcBusClientMock.object, 'service-1');
        testServiceProxy.emit = sinon.spy(testServiceProxy.emit);
        await testServiceProxy.connect();
        await testServiceProxy.close();
        expect(testServiceProxy.emit.lastCall.firstArg).toEqual(IPCBUS_SERVICE_EVENT_STOP);
    });
});