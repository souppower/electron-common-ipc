'use strict';

var processId;
var peerName;
var processToMaster = null;
var ipcBus = CreateIpcBusClient();
// var bigpayload = null;

function doNewNodeProcess(event) {
    processToMaster.send('new-process', 'node');
}

function doNewRendererProcess(event) {
    processToMaster.send('new-process', 'renderer');
}

function doNewFrameProcess(event) {
    processToMaster.send('new-process', 'frame');
}

function doNewRendererInstance(event) {
    processToMaster.send('new-renderer', processId);
}

function doOpenPerfView(event) {
    processToMaster.send('new-perf');
}

function doQueryBrokerState() {
//    processToMaster.send('queryState');
    ipcBus.request(ipcBus.IPCBUS_CHANNEL_QUERY_STATE, 20000)
        .then((ipcBusRequestResponse) => onIPC_BrokerStatusTopic(ipcBusRequestResponse.payload));
}

function getProcessElt() {
    return document.getElementById('ProcessMonitor');
}

function getTopicName(elt) {
    if (elt == null) {
        return '';
    }
    var topicName = elt.getAttribute('topic-name');
    if ((topicName !== undefined) && (topicName !== null)) {
        return topicName;
    }
    return getTopicName(elt.parentElement);
}

function doSubscribeToTopic(event) {
    console.log('doSubscribeToTopic:' + event);

    var target = event.target;
    var topicActionsElt = target.parentElement;
    var topicNameElt = topicActionsElt.querySelector('.topicSubscribeName');
    var topicName = topicNameElt.value;

    if (processToMonitor.Type() === 'renderer') {
        ipcBus.connect()
            .then(() => {
                ipcBus.on(topicName, onIPC_Received);
                onIPCElectron_SubscribeNotify(topicName);
        });
    }
    else {
        processToMonitor.postSubscribe(topicName);
    }
}

function doGenerateResponseChannel(event) {
    console.log('doGenerateResponseChannel:' + event);

    var target = event.target;
    var topicActionsElt = target.parentElement;
    var topicNameElt = topicActionsElt.querySelector('.topicSubscribeName');

    if (processToMonitor.Type() === 'renderer') {
        var responseChannel = ipcBus.createResponseChannel();
        topicNameElt.value = responseChannel;
    }
    // else {
    //     processToMonitor.postSubscribe(topicName);
    // }
}


function onIPCElectron_SubscribeNotify(topicName) {
    console.log('onIPCElectron_SubscribeNotify:' + topicName);

    var topicItemTemplate = document.getElementById('SubscriptionItem-template');
    var topicItemElt = topicItemTemplate.cloneNode(true);

    topicItemElt.id = '';
    topicItemElt.setAttribute('topic-name', topicName);

    var topicNameElt = topicItemElt.querySelector('.topicSubscribeName');
    topicNameElt.textContent = topicName;

    var SubscriptionsListElt = document.getElementById('ProcessSubscriptions');
    SubscriptionsListElt.appendChild(topicItemElt);

    var topicAutoReplyElt = topicItemElt.querySelector('.topicAutoReply');
    topicAutoReplyElt.value = topicName + ' - AutoReply';

    //    subscriptionsListElt.appendChild(topicItemElt);
    topicItemElt.style.display = 'block';

    console.log('topicName : ' + topicName + ' - subscribe');
}

function doUnsubscribeFromTopic(event) {
    console.log('doUnsubscribeFromTopic:' + event);

    var target = event.target;
    var topicName = getTopicName(target);

    if (processToMonitor.Type() === 'renderer') {
        ipcBus.connect()
        .then(() => {
            ipcBus.off(topicName, onIPC_Received);
            onIPCElectron_UnsubscribeNotify(topicName);
        });
    }
    else {
        processToMonitor.postUnsubscribe(topicName);
    }
}

function onIPCElectron_UnsubscribeNotify(topicName) {
    console.log('doUnsubscribeFromTopic:' + topicName);
    var topicItemElt = findTopicItemElt(topicName);
    topicItemElt.parentElement.removeChild(topicItemElt);
    console.log('topicName : ' + topicName + ' - unsubscribe');
}

function doRequestMessageToTopic(event) {
    console.log('doRequestMessageToTopic:' + event);

    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicNameElt = topicItemElt.querySelector('.topicRequestName');
    var topicName = topicNameElt.value;

    var topicMsgElt = topicItemElt.querySelector('.topicRequestMsg');
    var topicMsg = topicMsgElt.value;

    var topicRespElt = document.querySelector('.topicRequestResponse');
    topicRespElt.value = '';

    var args = { topic: topicName, msg: topicMsg };
    if (processToMonitor.Type() === 'renderer') {
        let p = ipcBus.request(topicName, 20000, topicMsg)
            .then((requestPromiseResponse) => {
                onIPCBus_OnRequestThen(requestPromiseResponse);
            })
            .catch((requestPromiseResponse) => {
                onIPCBus_OnRequestCatch(requestPromiseResponse);
            });
    }
    else {
        processToMonitor.postRequestMessage(topicName, topicMsg);
    }
}

function onIPCBus_OnRequestThen(requestPromiseResponse) {
    console.log('onIPCBus_OnRequestThen : requestPromiseArgs:' + requestPromiseResponse);
    var topicRespElt = document.querySelector('.topicRequestResponse');
    if (topicRespElt != null) {
        topicRespElt.style.color = 'black';
        topicRespElt.value = requestPromiseResponse.payload + ' from (' + JSON.stringify(requestPromiseResponse.event.sender) + ')';
    }
}

function onIPCBus_OnRequestCatch(requestPromiseResponse) {
    console.log('onIPCBus_OnRequestCatch : err:' + requestPromiseResponse.payload);
    var topicRespElt = document.querySelector('.topicRequestResponse');
    if (topicRespElt != null) {
        topicRespElt.style.color = 'red';
        topicRespElt.value = 'Error:' + requestPromiseResponse.payload;
    }
}

function doSendMessageToTopic(event) {
    console.log('doSendMessageToTopic:' + event);

    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicNameElt = topicItemElt.querySelector('.topicSendName');
    var topicName = topicNameElt.value;

    var topicMsgElt = topicItemElt.querySelector('.topicSendMsg');
    var topicMsg = topicMsgElt.value;

    var args = { topic: topicName, msg: topicMsg };
    if (processToMonitor.Type() === 'renderer') {
        ipcBus.send(topicName, topicMsg);
        // ipcBus.send(topicName, bigpayload);
    }
    else {
        processToMonitor.postSendMessage(topicName, topicMsg);
    }
}

function doClearTopic(event) {
    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicReceivedElt = topicItemElt.querySelector('.topicReceived');
    topicReceivedElt.value = '';
}

function findTopicItemElt(channel) {
    var SubscriptionsListElt = document.getElementById('ProcessSubscriptions');
    var topicItemElt = SubscriptionsListElt.querySelector('[topic-name=\"' + channel + '\"]');
    return topicItemElt;
}

function onIPC_Received(ipcBusEvent, ipcContent) {
    console.log('onIPCBus_received : msgTopic:' + ipcBusEvent.channel + ' from #' + ipcBusEvent.sender.name)

    var topicItemElt = findTopicItemElt(ipcBusEvent.channel);
    if (topicItemElt != null) {
        var topicAutoReplyElt = topicItemElt.querySelector('.topicAutoReply');
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve(topicAutoReplyElt.value);
        }
        var topicReceivedElt = topicItemElt.querySelector('.topicReceived');
        ipcContent += ' from (' + JSON.stringify(ipcBusEvent.sender) + ')';
        topicReceivedElt.value = ipcContent + '\n';
    }
}

function onIPC_EmitReceived(ipcBusEvent, ipcContent1, ipcContent2, ipcContent3) {
    console.log('onIPC_EmitReceived : msgTopic:' + ipcBusEvent.channel + ' from #' + ipcBusEvent.sender.name)


    var topicItemElt = findTopicItemElt(ipcBusEvent.channel);
    if (topicItemElt != null) {
        var topicAutoReplyElt = topicItemElt.querySelector('.topicAutoReply');
        if (ipcBusEvent.requestResolve) {
            ipcBusEvent.requestResolve(topicAutoReplyElt.value);
        }
        var topicReceivedElt = topicItemElt.querySelector('.topicReceived');
        ipcContent += ' from (' + JSON.stringify(ipcBusEvent.sender) + ')';
        topicReceivedElt.value += ipcContent + '\n';
    }
}


function onIPCBus_ReceivedSendNotify(ipcBusEvent, ipcContent) {
    ipcBusEvent.request = undefined;
    onIPC_Received(ipcBusEvent, ipcContent);
}

function onIPC_BrokerStatusTopic(ipcContent) {
    console.log('queryBrokerState - msgContent:' + ipcContent)

    var statesListElt = document.getElementById('brokerStatesList');
    statesListElt.style.display = 'block';

    // Keep the header
    while (statesListElt.rows.length > 1) {
        statesListElt.deleteRow(1);
    }
    for (var i = 0; i < ipcContent.length; ++i) {
        var row = statesListElt.insertRow(-1);
        var cell = row.insertCell(0);
        cell.innerHTML = ipcContent[i]['channel'];

        cell = row.insertCell(1);
        cell.innerHTML = JSON.stringify(ipcContent[i]['peer']);

        cell = row.insertCell(2);
        cell.innerHTML = ipcContent[i]['count'];
    }
}

// function loadJSON(callback) {
//     const xobj = new XMLHttpRequest();
//     xobj.overrideMimeType("application/json");
//     xobj.open('GET', 'huge-payload.json', true);
//     xobj.onreadystatechange = () => {
//         if (xobj.readyState == 4 && xobj.status == "200") {
//             // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
//             callback(xobj.responseText);
//         }
//     };
//     xobj.send(null);
// }

var processToMonitor = null;

window.addEventListener('load', () => {

function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

// In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
processId = getParameterByName('id');
peerName = getParameterByName('peerName'); 

var processMonitorElt = document.getElementById('ProcessMonitor');
processMonitorElt.setAttribute('topic-process', getParameterByName('type'));

var processTitleElt = document.getElementById('ProcessTitle');
processTitleElt.textContent = getParameterByName('peerName') + ' (' + processId + ')';
document.title = processTitleElt.textContent;

var processMonitorDefaultSubscribe = processMonitorElt.querySelector('.topicSubscribeName');
processMonitorDefaultSubscribe.value = 'TopicOf' + getParameterByName('peerName');

var processMonitorDefaultSend = processMonitorElt.querySelector('.topicSendMsg');
processMonitorDefaultSend.value = 'SendFrom:' + getParameterByName('peerName');

var processMonitorDefaultRequest = processMonitorElt.querySelector('.topicRequestMsg');
processMonitorDefaultRequest.value = 'PromiseFrom:' + getParameterByName('peerName');

processToMaster = new ProcessConnector('browser', ipcRenderer);

processToMonitor = new ProcessConnector(getParameterByName('type'), ipcRenderer, getParameterByName('id'));

if (getParameterByName('type') === 'browser') {
    processToMonitor.onRequestThen(onIPCBus_OnRequestThen);
    processToMonitor.onRequestCatch(onIPCBus_OnRequestCatch);
    processToMonitor.OnReceivedMessage(onIPCBus_ReceivedSendNotify);
    processToMonitor.onSubscribeDone(onIPCElectron_SubscribeNotify);
    processToMonitor.onUnsubscribeDone(onIPCElectron_UnsubscribeNotify);

    var processToolbar = document.getElementById('ProcessBrowserToolbar');
    processToolbar.style.display = 'block';

    processToolbar = document.getElementById('ProcessBrokerState');
    processToolbar.style.display = 'block';

    ipcRenderer.on('get-queryState', onIPC_BrokerStatusTopic);

    ipcBus.connect()
        .then(() => {
            console.log('renderer : connected to ipcBus');
        });
}
if (getParameterByName('type') === 'renderer') {

    var processToolbar = document.getElementById('ProcessRendererToolbar');
    processToolbar.style.display = 'block';

    // loadJSON((txt) => {
    //     bigpayload = JSON.stringify(txt);
    // });

    ipcBus.connect()
        .then(() => {
            console.log('renderer : connected to ipcBus');
            perfTests.connect(peerName);
        });
}
if (getParameterByName('type') === 'node') {
    processToMonitor.onRequestThen(onIPCBus_OnRequestThen);
    processToMonitor.onRequestCatch(onIPCBus_OnRequestCatch);
    processToMonitor.OnReceivedMessage(onIPCBus_ReceivedSendNotify);
    processToMonitor.onSubscribeDone(onIPCElectron_SubscribeNotify);
    processToMonitor.onUnsubscribeDone(onIPCElectron_UnsubscribeNotify);
    ipcBus.connect()
        .then(() => {
            console.log('renderer : connected to ipcBus');
        });
}
});