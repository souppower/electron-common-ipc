import * as Client from '../IpcBusClient';

export const IPCBUS_SERVICE_WRAPPER_EVENT = 'service-wrapper-event';
// Special call handlers
export const IPCBUS_SERVICE_CALL_GETSTATUS = '__getServiceStatus';


export const IPCBUS_SERVICE_ADD_LISTENER = '_addListener';
export const IPCBUS_SERVICE_REMOVE_LISTENER = '_removeListener';

export interface IpcBusServiceCall {
    handlerName: string;
    args: any[];
}

export interface IpcBusServiceEvent {
    eventName: string;
    args: any[];
}

export interface IpcBusServiceEventHandler {
    (event: IpcBusServiceEvent): void;
}

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
