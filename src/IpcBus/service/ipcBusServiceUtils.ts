import * as Client from '../IpcBusClientInterfaces';

export const IPCBUS_SERVICE_WRAPPER_EVENT = 'service-wrapper-event';
// Special call handlers
export const IPCBUS_SERVICE_CALL_GETSTATUS: string = '__getServiceStatus';

// Helper to get a valid service channel namespace
export function getServiceNamespace(serviceName: string): string {
    return `${Client.IPCBUS_CHANNEL}/ipc-service/${serviceName}`;
}

// Helper to get the call channel related to given service
export function getServiceCallChannel(serviceName: string): string {
    return getServiceNamespace(serviceName) + '/call';
}

// Helper to get the event channel related to given service
export function getServiceEventChannel(serviceName: string): string {
    return getServiceNamespace(serviceName) + '/event';
}
