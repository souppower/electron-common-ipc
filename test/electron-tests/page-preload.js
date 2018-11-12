const electronCommonIpcModule = require('../..');
electronCommonIpcModule.PreloadElectronCommonIpc();

console.log(`IsElectronCommonIpcAvailable=${electronCommonIpcModule.IsElectronCommonIpcAvailable()}`);
