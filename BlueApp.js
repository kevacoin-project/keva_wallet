/**
 * @exports {AppStorage}
 */
import { AppStorage } from './class';
import DeviceQuickActions from './class/quickActions';
let prompt = require('./prompt');
let EV = require('./events');
let loc = require('./loc');

/** @type {AppStorage} */
const BlueApp = new AppStorage();

async function startAndDecrypt(retry) {
  console.log('startAndDecrypt');
  if (BlueApp.getWallets().length > 0) {
    console.log('App already has some wallets, so we are in already started state, exiting startAndDecrypt');
    return;
  }
  let password = false;
  if (await BlueApp.storageIsEncrypted()) {
    DeviceQuickActions.clearShortcutItems();
    do {
      password = await prompt((retry && loc._.bad_password) || loc._.enter_password, loc._.storage_is_encrypted, false);
    } while (!password);
  }
  let success = await BlueApp.loadFromDisk(password);
  if (success) {
    console.log('loaded from disk');
    EV(EV.enum.WALLETS_COUNT_CHANGED);
    EV(EV.enum.TRANSACTIONS_COUNT_CHANGED);
  }

  if (!success && password) {
    // we had password and yet could not load/decrypt
    return startAndDecrypt(true);
  }
}

BlueApp.startAndDecrypt = startAndDecrypt;

module.exports = BlueApp;
