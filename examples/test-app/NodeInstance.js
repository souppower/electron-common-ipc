//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

// console.log('Starting Node instance ...')

// Node
const util = require('util');
const path = require('path');
const child_process = require('child_process');

function GetCmdLineArgValue(argName)  {
    for (let i = 0; i < process.argv.length; ++i) {
        if (process.argv[i].startsWith('--' + argName)) {
            const argValue = process.argv[i].split('=')[1];
            return argValue;
        }
    }
    return null;
}

let busPath = GetCmdLineArgValue('bus-path');
console.log(busPath);

const ipcBusModule = require('electron-common-ipc');
const ipcBus = ipcBusModule.IpcBusClient.Create();
// ipcBusModule.ActivateIpcBusTrace(true);

const PerfTests = require('./PerfTests.js');

const peerName = 'Node_' + process.pid;

function onTopicMessage(ipcBusEvent, ipcContent) {
   console.log('Node - IPCBUS - ReceivedMessage - topic:' + ipcBusEvent.channel + 'from #' + ipcBusEvent.sender.name);
    if (ipcBusEvent.request) {
        var autoReply = ipcBusEvent.channel + ' - AutoReply from #' + ipcBusEvent.sender.name;
        ipcBusEvent.request.resolve(autoReply);
        console.log(autoReply);
    }
    var msgJSON = {
        action: 'receivedSend',
        args: { event : ipcBusEvent, content : ipcContent}
    };
    process.send(JSON.stringify(msgJSON));
}

function doSubscribeTopic(msgJSON) {
    var topicName = msgJSON['topic'];
    console.log('node - doSubscribeTopic:' + topicName);
    ipcBus.on(topicName, onTopicMessage);
    process.send(JSON.stringify(msgJSON));
}

function doUnsubscribeTopic(msgJSON) {
    var topicName = msgJSON['topic'];
    console.log('node - doUnsubscribeTopic:' + topicName);
    ipcBus.off(topicName, onTopicMessage);
    process.send(JSON.stringify(msgJSON));
}

function doSendOnTopic(msgJSON) {
    var args = msgJSON['args'];
    console.log('node - doSendOnTopic: topicName:' + args['topic'] + ' msg:' + args['msg']);
    ipcBus.send(args['topic'], args['msg']);
    process.send(JSON.stringify(msgJSON));
}

function doRequestOnTopic(msgJSON) {
    var args = msgJSON['args'];
    console.log('node - doRequestOnTopic: topicName:' + args['topic'] + ' msg:' + args['msg']);
    ipcBus.request(args['topic'], 2000, args['msg'])
        .then((requestPromiseResponse) => {
            msgJSON['action'] = 'receivedRequestThen';
            msgJSON['requestPromiseResponse'] = requestPromiseResponse;
            process.send(JSON.stringify(msgJSON));
        })
        .catch((requestPromiseResponse) => {
            msgJSON['action'] = 'receivedRequestCatch';
            msgJSON['requestPromiseResponse'] = requestPromiseResponse;
            process.send(JSON.stringify(msgJSON));
        });
}


function doInit(msgJSON) {
    var args = msgJSON['args'];
    console.log('node - doInit: topicName:' + args);
}

function dispatchMessage(msg) {
    console.log('node - receive message:' + msg);
    if (isConnected == false) {
        // console.log('node - delay message:' + msg);
        msgs.push(msg);
    }
    else {
        var actionFcts =
        {
            subscribe : doSubscribeTopic,
            unsubscribe : doUnsubscribeTopic,
            send : doSendOnTopic,
//            request : doRequestOnTopic,
            request : doRequestOnTopic,
            init : doInit
        };

        // console.log('node - execute message:' + msg);
        try {
            var msgJSON = JSON.parse(msg);
            if (actionFcts.hasOwnProperty(msgJSON['action'])) {
                actionFcts[msgJSON['action']](msgJSON);
            }
        }
        catch(_) {
        }
    }
}


console.log('node - start');

var isConnected = false;
var msgs = [];
var perfTests;

ipcBus.connect(busPath)
    .then(() => {
        console.log('node - connect');
        isConnected = true;
        for(var msg in msgs) {
            dispatchMessage(msg);
        }
        msgs = [];
        perfTests = new PerfTests('node', busPath);
        perfTests.connect();
});

process.on('message', dispatchMessage);
