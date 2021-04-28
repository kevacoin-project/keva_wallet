const bitcoin = require('bitcoinjs-lib');
const base58check = require('bs58check')
const coinSelectAccumulative = require('coinselect/accumulative');
let loc = require('../loc');
const BlueApp = require('../BlueApp');

export const KEVA_OP_NAMESPACE = 0xd0;
export const KEVA_OP_PUT = 0xd1;
export const KEVA_OP_DELETE = 0xd2;

const convert = (from, to) => str => Buffer.from(str, from).toString(to)
const utf8ToHex = convert('utf8', 'hex')

const DUMMY_TXID = 'c70483b4613b18e750d0b1087ada28d713ad1e406ebc87d36f94063512c5f0dd';

export function getSpecialKeyText(keyType) {
  let displayKey = "";
  if (keyType === 'comment') {
    displayKey = loc.namespaces.comment_post;
  } else if (keyType === 'share') {
    displayKey = loc.namespaces.share_post;
  } else if (keyType === 'like') {
    displayKey = loc.namespaces.reward_post;
  } else if (keyType === 'profile') {
    displayKey = loc.namespaces.update_profile;
  }
  return displayKey;
}

export function waitPromise(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export function reverse(src) {
  let buffer = Buffer.alloc(src.length)

  for (let i = 0, j = src.length - 1; i <= j; ++i, --j) {
    buffer[i] = src[j]
    buffer[j] = src[i]
  }

  return buffer
}

export function hexToNamespace(hexStr) {
  let decoded = Buffer.from(hexStr, "hex")
  return base58check.encode(decoded);
}

export function namespaceToHex(nsStr) {
  return base58check.decode(nsStr);
}

export function toScriptHash(addr) {
  let script = bitcoin.address.toOutputScript(addr);
  let hash = bitcoin.crypto.sha256(script);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}

export function getNamespaceScriptHash(namespaceId, isBase58 = true) {
  const emptyBuffer = Buffer.alloc(0);
  let bscript = bitcoin.script;
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    isBase58 ? namespaceToHex(namespaceId) : Buffer.from(namespaceId, "hex"),
    emptyBuffer,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_RETURN]);
  let hash = bitcoin.crypto.sha256(nsScript);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}

const _KEVA_NS_BUF = Buffer.from('\x01_KEVA_NS_', 'utf8');

export function getRootNamespaceScriptHash(namespaceId) {
  const emptyBuffer = Buffer.alloc(0);
  const nsBuf = namespaceId.startsWith('N') ? namespaceToHex(namespaceId) : Buffer.from(namespaceId, "hex");
  const totalBuf = Buffer.concat([nsBuf, _KEVA_NS_BUF]);
  let bscript = bitcoin.script;
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    totalBuf,
    emptyBuffer,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_RETURN]);
  let hash = bitcoin.crypto.sha256(nsScript);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}

export function getKeyScriptHash(key) {
  let emptyBuffer = Buffer.alloc(0);
  let bscript = bitcoin.script;
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    Buffer.from(key, 'utf8'),
    emptyBuffer,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_RETURN]);
  let hash = bitcoin.crypto.sha256(nsScript);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}

export function getHashtagScriptHash(hashtag) {
  let emptyBuffer = Buffer.alloc(0);
  let bscript = bitcoin.script;
  if (hashtag.startsWith('#')) {
    hashtag = hashtag.substring(1);
  }
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    Buffer.from(hashtag.toLowerCase(), 'utf8'),
    emptyBuffer,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_RETURN]);
  let hash = bitcoin.crypto.sha256(nsScript);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}

// \0x_KEVA_NS_
const KEY_PUT_NAMESPACE = '015f4b4556415f4e535f';

/*
 The profile is in json format.
 {
   displayName: <display name>,
   bio: <short bio>
 }
*/
function parseProfile(value) {
  try {
    return JSON.parse(value);
  } catch(err) {
    return {}
  }
}

// If the transaction is KEVA_OP_PUT, The txid must contain a keva transaction
// with the key value in the following format:
// \x01_KEVA_NS_
// That is, this transaction is used to set the namespace info.
// Or, it must be KEVA_OP_NAMESPACE.
export async function getNamespaceDataFromNSTx(ecl, history) {
  const txids = history.map(h => h.tx_hash);
  const results = await ecl.multiGetTransactionInfoByTxid(txids, 1, true);
  // Find the latest one that is not KEVA_OP_DELETE.
  // Some early version allowed the "deletion" of namespace, which didn't really work.
  const latestHistory = history.slice().reverse().find(h => {
    const tx = results[h.tx_hash];
    if (!tx.n || !tx.kv) {
      return false;
    }
    if (tx.kv.op != KEVA_OP_DELETE) {
      return true;
    }
  });

  const tx = results[latestHistory.tx_hash];
  if (!tx.n || !tx.kv) {
    return null;
  }

  const op = tx.kv.op;
  if (op === KEVA_OP_NAMESPACE) {
    return {
      op: 'KEVA_OP_NAMESPACE',
      namespaceId: tx.n[0],
      displayName: decodeBase64(tx.kv.key),
    }
  } else if (op === KEVA_OP_PUT) {
    // Check the key format.
    const key = decodeBase64(tx.kv.key);
    if ((typeof key) == 'string') {
      return null;
    }
    const keyHex = toHexString(key);
    if (keyHex.startsWith(KEY_PUT_NAMESPACE)) {
      let info = {
        op: 'KEVA_OP_PUT',
        namespaceId: tx.n[0],
        value: decodeBase64(tx.kv.value),
        tx: latestHistory.tx_hash,
      };
      const {displayName, bio, price, desc, addr} = parseProfile(info.value);
      return {...info, displayName, bio, price, desc, addr};
    }
    return null;
  } else if (op === KEVA_OP_DELETE) {
    // TODO: how to handle this?
    return null;
  }
}

export async function getNamespaceIdFromTx(ecl, txid) {
  const result = await ecl.multiGetTransactionInfoByTxid([txid], 1, true);
  const tx = result[txid];
  if (!tx || !tx.n) {
    return null;
  }
  return tx.n[0];
}

function getNamespaceCreationScript(nsName, address, txId, n) {
  let bcrypto = bitcoin.crypto;
  let nBuf = Buffer.from(n.toString(), 'utf-8');
  let txBuf = reverse(Buffer.from(txId, 'hex'));
  let namespaceId = bcrypto.hash160(Buffer.concat([txBuf, nBuf]));
  var prefixNS = Buffer.from([53])
  namespaceId = Buffer.concat([prefixNS, namespaceId]);
  let displayName = Buffer.from(utf8ToHex(nsName), 'hex');

  let bscript = bitcoin.script;
  let baddress = bitcoin.address;
  let nsScript = bscript.compile([
    KEVA_OP_NAMESPACE,
    namespaceId,
    displayName,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_HASH160,
    baddress.fromBase58Check(address).hash,
    bscript.OPS.OP_EQUAL]);
  return {nsScript, namespaceId};
}

export async function createKevaNamespace(wallet, requestedSatPerByte, nsName) {
  await wallet.fetchBalance();
  await wallet.fetchTransactions();
  await wallet.fetchUtxo();
  const utxos = wallet.getUtxo();
  const namespaceAddress = await wallet.getAddressAsync();
  let { nsScript } = getNamespaceCreationScript(nsName, namespaceAddress, DUMMY_TXID, 0);

  // Namespace needs at least 0.01 KVA.
  const namespaceValue = 1000000;
  let targets = [{
    address: namespaceAddress, value: namespaceValue,
    script: nsScript
  }];

  const transactions = wallet.getTransactions();
  let nonNamespaceUtxos = await getNonNamespaceUxtos(wallet, transactions, utxos);
  let { inputs, outputs, fee } = coinSelectAccumulative(nonNamespaceUtxos, targets, requestedSatPerByte);

  // inputs and outputs will be undefined if no solution was found
  if (!inputs || !outputs) {
    throw new Error('Not enough balance. Try sending smaller amount');
  }

  const psbt = new bitcoin.Psbt();
  psbt.setVersion(0x7100); // Kevacoin transaction.
  let keypairs = [];
  for (let i = 0; i < inputs.length; i++) {
    let input = inputs[i];
    const pubkey = wallet._getPubkeyByAddress(input.address);
    if (!pubkey) {
      throw new Error('Failed to get pubKey');
    }
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey });
    const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh });

    psbt.addInput({
      hash: input.txId,
      index: input.vout,
      witnessUtxo: {
        script: p2sh.output,
        value: input.value,
      },
      redeemScript: p2wpkh.output,
    });

    let keyPair = bitcoin.ECPair.fromWIF(input.wif);
    keypairs.push(keyPair);
  }

  let returnNamespaceId;
  for (let i = 0; i < outputs.length; i++) {
    let output = outputs[i];
    if (!output.address) {
      // Change address.
      output.address = await wallet.getChangeAddressAsync();
    }

    if (i == 0) {
      // The namespace creation script.
      if (output.value != 1000000) {
        throw new Error('Namespace creation script has incorrect value.');
      }
      const { nsScript, namespaceId } = getNamespaceCreationScript(nsName, namespaceAddress, inputs[0].txId, inputs[0].vout);
      returnNamespaceId = namespaceId;
      psbt.addOutput({
        script: nsScript,
        value: output.value,
      });
    } else {
      psbt.addOutput({
        address: output.address,
        value: output.value,
      });
    }
  }

  for (let i = 0; i < keypairs.length; i++) {
    psbt.signInput(i, keypairs[i]);
    if (!psbt.validateSignaturesOfInput(i)) {
      throw new Error('Invalid signature for input #' + i);
    }
  }

  psbt.finalizeAllInputs();
  let hexTx = psbt.extractTransaction(true).toHex();
  return {tx: hexTx, namespaceId: hexToNamespace(returnNamespaceId), fee};
}

function keyToBuffer(key) {
  const isKeyString = (typeof key) === 'string';
  if (isKeyString) {
    return Buffer.from(utf8ToHex(key), 'hex');
  }
  // It is already a buffer.
  return key;
}

/**
 * @param {*} binaryValue the value parameter is a buffer.
 * @returns
 */
export function getKeyValueUpdateScript(namespaceId, address, key, value, binaryValue = false) {
  const keyBuf = keyToBuffer(key);
  const valueBuf = binaryValue ? value : Buffer.from(utf8ToHex(value), 'hex');

  let bscript = bitcoin.script;
  let baddress = bitcoin.address;
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    namespaceToHex(namespaceId),
    keyBuf,
    valueBuf,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_HASH160,
    baddress.fromBase58Check(address).hash,
    bscript.OPS.OP_EQUAL]);

  return nsScript;
}

function getKeyValueDeleteScript(namespaceId, address, key) {
  let keyBuf = keyToBuffer(key);
  let bscript = bitcoin.script;
  let baddress = bitcoin.address;
  let nsScript = bscript.compile([
    KEVA_OP_DELETE,
    namespaceToHex(namespaceId),
    keyBuf,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_HASH160,
    baddress.fromBase58Check(address).hash,
    bscript.OPS.OP_EQUAL]);

  return nsScript;
}

export function getNonNamespaceUxtosSync(transactions, utxos) {
  let nonNSutxos = [];
  for (let u of utxos) {
    const tx = transactions.find(t => t.txid == u.txId);
    if (!tx) {
      continue;
    }
    // tx.n is an array of namespace Id followed by vout.
    let isNSTx = tx.n && tx.n[1] == u.vout;
    if (!isNSTx) {
      nonNSutxos.push(u);
    }
  }
  return nonNSutxos;
}

export async function getNonNamespaceUxtos(wallet, transactions, utxos, defaultLockedFund, tryAgain) {
  let nonNSutxos = [];
  for (let u of utxos) {
    const tx = transactions.find(t => t.txid == u.txId);
    if (!tx) {
      continue;
    }
    // tx.n is an array of namespace Id followed by vout.
    let isNSTx = tx.n && tx.n[1] == u.vout;
    if (!isNSTx) {
      nonNSutxos.push(u);
    }
  }

  // Remove the locked fund (due to bidding) as we cannot use them.
  const lockedFund = defaultLockedFund ? defaultLockedFund : await BlueApp.getLockedFund();
  nonNSutxos = nonNSutxos.filter(u => {
    const key = `${u.txId}:${u.vout}`;
    return !lockedFund[key];
  })

  if (nonNSutxos.length == 0 && !tryAgain) {
    // Try again.
    console.log('Try again for getNonNamespaceUxtos')
    await waitPromise(2000);
    await wallet.fetchBalance();
    await wallet.fetchTransactions();
    await wallet.fetchUtxo();
    const transactions = wallet.getTransactions();
    let utxos = wallet.getUtxo();
    return await getNonNamespaceUxtos(wallet, transactions, utxos, defaultLockedFund, true);
  }
  return nonNSutxos;
}

const TRY_UTXO_COUNT = 2;

export async function getNamespaceUtxo(wallet, namespaceId) {
  for (let i = 0; i < TRY_UTXO_COUNT; i++) {
    await wallet.fetchUtxo();
    const utxos = wallet.getUtxo();
    const transactions = wallet.getTransactions();

    for (let u of utxos) {
      const tx = transactions.find(t => t.txid == u.txId);
      if (!tx || !tx.n) {
        continue;
      }
      if (tx.n[0] == namespaceId && u.vout == tx.n[1]) {
        return u;
      }
    }

    // No namespace UXTO, try again.
    await waitPromise(2000);
    await wallet.fetchBalance();
    await wallet.fetchTransactions();
  }
  return null;
}

export async function updateKeyValue(wallet, requestedSatPerByte, namespaceId, key, value, serverIPFS, newAddress) {
  await wallet.fetchBalance();
  await wallet.fetchTransactions();
  let nsUtxo = await getNamespaceUtxo(wallet, namespaceId);
  if (!nsUtxo) {
    throw new Error(loc.namespaces.update_key_err);
  }

  // IMPORTANT: we will use the same namespace address. Ideally, for
  // security/privacy reason, it is better to use a new address. But that
  // would create many addresses and slow down the update.
  const currentAddress = nsUtxo.address;
  const namespaceAddress = newAddress ? newAddress: currentAddress;
  const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);

  // Namespace needs at least 0.01 KVA.
  const namespaceValue = 1000000;
  let targets = [{
    address: namespaceAddress, value: namespaceValue,
    script: nsScript
  }];

  // Check if we need to pay the IPFS server.
  if (serverIPFS) {
    targets.push({
      address: serverIPFS.payment_address,
      value: Math.floor(serverIPFS.min_payment * 100000000),
    });
  }

  const transactions = wallet.getTransactions();
  let utxos = wallet.getUtxo();
  let nonNamespaceUtxos = await getNonNamespaceUxtos(wallet, transactions, utxos);
  // Move the nsUtxo to the first one, so that it will always be used.
  nonNamespaceUtxos.unshift(nsUtxo);
  let { inputs, outputs, fee } = coinSelectAccumulative(nonNamespaceUtxos, targets, requestedSatPerByte);

  // inputs and outputs will be undefined if no solution was found
  if (!inputs || !outputs) {
    throw new Error('Not enough balance. Try sending smaller amount');
  }

  const psbt = new bitcoin.Psbt();
  psbt.setVersion(0x7100); // Kevacoin transaction.
  let keypairs = [];
  for (let i = 0; i < inputs.length; i++) {
    let input = inputs[i];
    const pubkey = wallet._getPubkeyByAddress(input.address);
    if (!pubkey) {
      throw new Error('Failed to get pubKey');
    }
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey });
    const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh });

    psbt.addInput({
      hash: input.txId,
      index: input.vout,
      witnessUtxo: {
        script: p2sh.output,
        value: input.value,
      },
      redeemScript: p2wpkh.output,
    });

    let keyPair = bitcoin.ECPair.fromWIF(input.wif);
    keypairs.push(keyPair);
  }

  for (let i = 0; i < outputs.length; i++) {
    let output = outputs[i];
    if (!output.address) {
      // Change address.
      // IMPORTANT: we will use the same namespace address. See the
      // previous IMPORANT comment.
      output.address = currentAddress;
    }

    if (i == 0) {
      // The namespace creation script.
      if (output.value != 1000000) {
        throw new Error('Key update script has incorrect value.');
      }
      const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);
      psbt.addOutput({
        script: nsScript,
        value: output.value,
      });
    } else {
      psbt.addOutput({
        address: output.address,
        value: output.value,
      });
    }
  }

  for (let i = 0; i < keypairs.length; i++) {
    psbt.signInput(i, keypairs[i]);
    if (!psbt.validateSignaturesOfInput(i)) {
      throw new Error('Invalid signature for input #' + i);
    }
  }

  psbt.finalizeAllInputs();
  let hexTx = psbt.extractTransaction(true).toHex();
  return {tx: hexTx, fee};
}

const REPLY_COST = 1000000;

// prefix 0x0001
function createReplyKey(txId) {
  return Buffer.concat([Buffer.from('0001', 'hex'), Buffer.from(txId, 'hex')]);
}

// prefix 0x0003
function createRewardKey(txId) {
  return Buffer.concat([Buffer.from('0003', 'hex'), Buffer.from(txId, 'hex')]);
}

const MIN_REWARD = 10000000;

// Send a reward to a post(key/value pair).
// rewardRootAddress: the root namespace of the post.
// replyTxid: the txid of the post
//
export async function rewardKeyValue(ecl, wallet, requestedSatPerByte, namespaceId, value, amount, replyTxid) {
  await wallet.fetchBalance();
  await wallet.fetchTransactions();
  let nsUtxo = await getNamespaceUtxo(wallet, namespaceId);
  if (!nsUtxo) {
    throw new Error(loc.namespaces.update_key_err);
  }

  if (amount < MIN_REWARD) {
    throw new Error('Amount must be at least 0.1 KVA');
  }

  const key = createRewardKey(replyTxid);
  // IMPORTANT: re-use the namespace address, security/privacy trade-off.
  const namespaceAddress = nsUtxo.address;
  const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);

  // rewardRootAddress from replyTxid
  const result = await ecl.multiGetTransactionInfoByTxid([replyTxid], 1, true);
  const tx = result[replyTxid];
  let rewardAddress;
  for (let index = 0; index < tx.o.length; index = index + 2) {
    if (!tx.n) {
      continue;
    }
    const vout = tx.n[1];
    rewardAddress = tx.o[vout * 2];
  }

  if (!rewardAddress) {
    throw new Error('rewardAddress not found');
  }

  // Namespace needs at least 0.01 KVA.
  const namespaceValue = 1000000;
  let targets = [{
    address: namespaceAddress, value: namespaceValue,
    script: nsScript
  }, {
    address: rewardAddress, value: amount,
  }];

  const transactions = wallet.getTransactions();
  let utxos = wallet.getUtxo();
  let nonNamespaceUtxos = await getNonNamespaceUxtos(wallet, transactions, utxos);
  // Move the nsUtxo to the first one, so that it will always be used.
  nonNamespaceUtxos.unshift(nsUtxo);
  let { inputs, outputs, fee } = coinSelectAccumulative(nonNamespaceUtxos, targets, requestedSatPerByte);

  // inputs and outputs will be undefined if no solution was found
  if (!inputs || !outputs) {
    throw new Error('Not enough balance. Try sending smaller amount');
  }

  const psbt = new bitcoin.Psbt();
  psbt.setVersion(0x7100); // Kevacoin transaction.
  let keypairs = [];
  for (let i = 0; i < inputs.length; i++) {
    let input = inputs[i];
    const pubkey = wallet._getPubkeyByAddress(input.address);
    if (!pubkey) {
      throw new Error('Failed to get pubKey');
    }
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey });
    const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh });

    psbt.addInput({
      hash: input.txId,
      index: input.vout,
      witnessUtxo: {
        script: p2sh.output,
        value: input.value,
      },
      redeemScript: p2wpkh.output,
    });

    let keyPair = bitcoin.ECPair.fromWIF(input.wif);
    keypairs.push(keyPair);
  }

  for (let i = 0; i < outputs.length; i++) {
    let output = outputs[i];
    if (!output.address) {
      // Change address.
      // IMPORANT: re-use namespace address, security/privacy trade-off.
      output.address = namespaceAddress;
    }

    if (i == 0) {
      // The namespace creation script.
      if (output.value != 1000000) {
        throw new Error('Key update script has incorrect value.');
      }
      const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);
      psbt.addOutput({
        script: nsScript,
        value: output.value,
      });
    } else {
      psbt.addOutput({
        address: output.address,
        value: output.value,
      });
    }
  }

  for (let i = 0; i < keypairs.length; i++) {
    psbt.signInput(i, keypairs[i]);
    if (!psbt.validateSignaturesOfInput(i)) {
      throw new Error('Invalid signature for input #' + i);
    }
  }

  psbt.finalizeAllInputs();
  let hexTx = psbt.extractTransaction(true).toHex();
  return {tx: hexTx, fee, cost: amount, key};
}

// Send a reply/comment to a post(key/value pair).
// replyRootAddress: the root namespace of the post.
// replyTxid: the txid of the post
//
export async function replyKeyValue(wallet, requestedSatPerByte, namespaceId, value, replyTxid, binaryValue = false, lockedFund = null) {
  await wallet.fetchBalance();
  await wallet.fetchTransactions();
  let nsUtxo = await getNamespaceUtxo(wallet, namespaceId);
  if (!nsUtxo) {
    throw new Error(loc.namespaces.update_key_err);
  }

  // To reply to a post, the key must be <base64 of replyTxid>c.
  const key = createReplyKey(replyTxid);
  // IMPORANT: reuse address - trade-off between secuity and performance.
  const namespaceAddress = nsUtxo.address;
  const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value, binaryValue);

  // Namespace needs at least 0.01 KVA.
  const namespaceValue = 1000000;
  let targets = [{
    address: namespaceAddress, value: namespaceValue,
    script: nsScript
  }];

  const transactions = wallet.getTransactions();
  let utxos = wallet.getUtxo();
  let nonNamespaceUtxos = await getNonNamespaceUxtos(wallet, transactions, utxos, lockedFund);
  if (!nonNamespaceUtxos || nonNamespaceUtxos.length == 0) {
    if (lockedFund) {
      throw new Error(loc.namespaces.not_enough_fund_locked);
    } else {
      throw new Error(loc.namespaces.not_enough_fund);
    }
  }
  // Move the nsUtxo to the first one, so that it will always be used.
  nonNamespaceUtxos.unshift(nsUtxo);
  let { inputs, outputs, fee } = coinSelectAccumulative(nonNamespaceUtxos, targets, requestedSatPerByte);
  // inputs and outputs will be undefined if no solution was found
  if (!inputs || !outputs) {
    throw new Error(loc.namespaces.not_enough_fund);
  }

  const psbt = new bitcoin.Psbt();
  psbt.setVersion(0x7100); // Kevacoin transaction.
  let keypairs = [];
  for (let i = 0; i < inputs.length; i++) {
    let input = inputs[i];
    const pubkey = wallet._getPubkeyByAddress(input.address);
    if (!pubkey) {
      throw new Error('Failed to get pubKey');
    }
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey });
    const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh });

    psbt.addInput({
      hash: input.txId,
      index: input.vout,
      witnessUtxo: {
        script: p2sh.output,
        value: input.value,
      },
      redeemScript: p2wpkh.output,
    });

    let keyPair = bitcoin.ECPair.fromWIF(input.wif);
    keypairs.push(keyPair);
  }

  for (let i = 0; i < outputs.length; i++) {
    let output = outputs[i];
    if (!output.address) {
      // Change address.
      // IMPORANT: reuse address - trade-off between secuity and performance.
      output.address = namespaceAddress;
    }

    if (i == 0) {
      // The namespace creation script.
      if (output.value != 1000000) {
        throw new Error('Key update script has incorrect value.');
      }
      const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);
      psbt.addOutput({
        script: nsScript,
        value: output.value,
      });
    } else {
      psbt.addOutput({
        address: output.address,
        value: output.value,
      });
    }
  }

  for (let i = 0; i < keypairs.length; i++) {
    psbt.signInput(i, keypairs[i]);
    if (!psbt.validateSignaturesOfInput(i)) {
      throw new Error('Invalid signature for input #' + i);
    }
  }

  psbt.finalizeAllInputs();
  let hexTx = psbt.extractTransaction(true).toHex();
  return {tx: hexTx, fee, cost: REPLY_COST, key};
}

export async function deleteKeyValue(wallet, requestedSatPerByte, namespaceId, key) {
  await wallet.fetchBalance();
  await wallet.fetchTransactions();
  let nsUtxo = await getNamespaceUtxo(wallet, namespaceId);
  if (!nsUtxo) {
    throw new Error(loc.namespaces.delete_key_err);
  }

  const namespaceAddress = await wallet.getAddressAsync();
  const nsScript = getKeyValueDeleteScript(namespaceId, namespaceAddress, key);

  // Namespace needs at least 0.01 KVA.
  const namespaceValue = 1000000;
  let targets = [{
    address: namespaceAddress, value: namespaceValue,
    script: nsScript
  }];

  let utxos = wallet.getUtxo();
  const transactions = wallet.getTransactions();
  let nonNamespaceUtxos = await getNonNamespaceUxtos(wallet, transactions, utxos);
  // Move the nsUtxo to the first one, so that it will always be used.
  nonNamespaceUtxos.unshift(nsUtxo);
  let { inputs, outputs, fee } = coinSelectAccumulative(nonNamespaceUtxos, targets, requestedSatPerByte);

  // inputs and outputs will be undefined if no solution was found
  if (!inputs || !outputs) {
    throw new Error('Not enough balance. Try sending smaller amount');
  }

  const psbt = new bitcoin.Psbt();
  psbt.setVersion(0x7100); // Kevacoin transaction.
  let keypairs = [];
  for (let i = 0; i < inputs.length; i++) {
    let input = inputs[i];
    const pubkey = wallet._getPubkeyByAddress(input.address);
    if (!pubkey) {
      throw new Error('Failed to get pubKey');
    }
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey });
    const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh });

    psbt.addInput({
      hash: input.txId,
      index: input.vout,
      witnessUtxo: {
        script: p2sh.output,
        value: input.value,
      },
      redeemScript: p2wpkh.output,
    });

    let keyPair = bitcoin.ECPair.fromWIF(input.wif);
    keypairs.push(keyPair);
  }

  for (let i = 0; i < outputs.length; i++) {
    let output = outputs[i];
    if (!output.address) {
      // Change address.
      output.address = await wallet.getChangeAddressAsync();
    }

    if (i == 0) {
      // The namespace creation script.
      if (output.value != 1000000) {
        throw new Error('Key deletion script has incorrect value.');
      }
      const nsScript = getKeyValueDeleteScript(namespaceId, namespaceAddress, key);
      psbt.addOutput({
        script: nsScript,
        value: output.value,
      });
    } else {
      psbt.addOutput({
        address: output.address,
        value: output.value,
      });
    }
  }

  for (let i = 0; i < keypairs.length; i++) {
    psbt.signInput(i, keypairs[i]);
    if (!psbt.validateSignaturesOfInput(i)) {
      throw new Error('Invalid signature for input #' + i);
    }
  }

  psbt.finalizeAllInputs();
  let hexTx = psbt.extractTransaction(true).toHex();
  return {tx: hexTx, fee};
}

// nsTx: any tx that contains namespace operation.
export async function getNamespaceInfoFromTx(ecl, nsTx, nsId) {
  if (!nsId) {
    nsId = await getNamespaceIdFromTx(ecl, nsTx);
  }
  return await getNamespaceInfo(ecl, nsId);
}

export async function getTxIdFromShortCode(ecl, shortCode) {
  let prefix = parseInt(shortCode.substring(0, 1));
  let height = shortCode.substring(1, 1 + prefix);
  let pos = shortCode.substring(1 + prefix);
  if (height >= 0 && pos >= 0) {
    let txHash = await ecl.blockchainTransaction_idFromPos(height, pos);
    return txHash;
  }
  return null;
}

export async function findMyNamespaces(wallet, ecl) {
  await wallet.fetchBalance();
  await wallet.fetchTransactions();
  await wallet.fetchUtxo();
  const transactions = wallet.getTransactions();
  if (transactions.length == 0) {
    return;
  }
  const UTXOs = wallet.getUtxo();

  let namespaces = {};
  for (let utxo of UTXOs) {
    const tx = transactions.find(t => utxo.txId == t.hash);
    if (!tx) {
      continue;
    }

    let v = tx.o[utxo.vout];
    if (!v) {
      // This should not happen.
      continue;
    }
    if (!tx.n) {
      // tx.n contains namespace Id and vout.
      continue;
    }
    if (utxo.vout != tx.n[1]) {
      continue;
    }

    const nsId = tx.n[0];
    namespaces[nsId] = namespaces[nsId] || {
      id: nsId,
      walletId: wallet.getID(),
      txId: tx.txid,
    }
  }

  for (let nsId of Object.keys(namespaces)) {
    const { shortCode, displayName, bio, price, desc, addr, tx, value } = await getNamespaceInfoFromTx(ecl, namespaces[nsId].txId, nsId);
    namespaces[nsId].shortCode = shortCode;
    namespaces[nsId].displayName = displayName;
    namespaces[nsId].bio = bio;
    namespaces[nsId].price = price;
    namespaces[nsId].desc = desc;
    namespaces[nsId].addr = addr;
    namespaces[nsId].txId = tx;
    namespaces[nsId].profile = value;
  }
  return namespaces;
}

export async function findOtherNamespace(ecl, nsidOrShortCode) {
  let txid;
  if (nsidOrShortCode.length > 20) {
    // It is nsid;
    const nsid = nsidOrShortCode;
    const history = await ecl.blockchainScripthash_getHistory(getNamespaceScriptHash(nsid));
    if (!history || history.length == 0) {
      return null;
    }
    txid = history[0].tx_hash;
  } else {
    txid = await getTxIdFromShortCode(ecl, nsidOrShortCode);
    if (!txid) {
      return null;
    }
  }

  const { shortCode, namespaceId, displayName, bio, price, desc, addr, tx, value } = await getNamespaceInfoFromTx(ecl, txid);
  if (!shortCode || !namespaceId) {
    return null;
  }

  let namespaces = {}
  namespaces[namespaceId] = {
    id: namespaceId,
    txId: tx,
    shortCode,
    displayName,
    bio,
    price, desc, addr,
    profile: value,
  };
  return namespaces;
}

export function decodeBase64(key) {
  const keyBuf = Buffer.from(key, 'base64');
  if (keyBuf[0] < 10) {
    // Special protocol, not a valid utf-8 string.
    return keyBuf;
  }
  return keyBuf.toString('utf-8');
}

// Prefix 0x0002
function createShareKey(txId) {
  return Buffer.concat([Buffer.from('0002', 'hex'), Buffer.from(txId, 'hex')]);
}

function toHexString(byteArray) {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('')
}

export function parseSpecialKey(key) {
  const isKeyString = (typeof key) === 'string';
  let keyHex;
  if (isKeyString) {
    keyHex = utf8ToHex(key)
  } else if (key.data) {
    // Buffer deserilized from JSON.
    keyHex = toHexString(key.data)
  } else {
    // Buffer object.
    keyHex = key.toString('hex');
  }

  // Check if it is profile type.
  if (keyHex === KEY_PUT_NAMESPACE) {
    return {keyType: 'profile'};
  }

  // 2 bytes prefix, plus 32 bytes txId, is the minimal length.
  // 4 + 64 = 68.
  if (!keyHex.startsWith('00') || keyHex.length < 68) {
    return false;
  }

  let txId = keyHex.substring(4, 68);
  if (keyHex.startsWith('0001')) {
    return {partialTxId: txId, keyType: 'comment'};
  } else if (keyHex.startsWith('0002')) {
    return {partialTxId: txId, keyType: 'share'};
  } else if (keyHex.startsWith('0003')) {
    return {partialTxId: txId, keyType: 'like'};
  } else {
    return false;
  }
}

// Share a post (key/value pair).
// replyRootAddress: the root namespace of the post.
// replyTxid: the txid of the post
//
export async function shareKeyValue(wallet, requestedSatPerByte, namespaceId, value, shareTxid) {
  await wallet.fetchBalance();
  await wallet.fetchTransactions();
  let nsUtxo = await getNamespaceUtxo(wallet, namespaceId);
  if (!nsUtxo) {
    throw new Error(loc.namespaces.update_key_err);
  }

  let key = createShareKey(shareTxid);
  // IMPORTANT: we will use the same namespace address - privacy/security trade-off.
  const namespaceAddress = nsUtxo.address;
  const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);

  // Namespace needs at least 0.01 KVA.
  const namespaceValue = 1000000;
  let targets = [{
    address: namespaceAddress, value: namespaceValue,
    script: nsScript
  }];

  const transactions = wallet.getTransactions();
  let utxos = wallet.getUtxo();
  let nonNamespaceUtxos = await getNonNamespaceUxtos(wallet, transactions, utxos);
  // Move the nsUtxo to the first one, so that it will always be used.
  nonNamespaceUtxos.unshift(nsUtxo);
  let { inputs, outputs, fee } = coinSelectAccumulative(nonNamespaceUtxos, targets, requestedSatPerByte);

  // inputs and outputs will be undefined if no solution was found
  if (!inputs || !outputs) {
    throw new Error('Not enough balance. Try sending smaller amount');
  }

  const psbt = new bitcoin.Psbt();
  psbt.setVersion(0x7100); // Kevacoin transaction.
  let keypairs = [];
  for (let i = 0; i < inputs.length; i++) {
    let input = inputs[i];
    const pubkey = wallet._getPubkeyByAddress(input.address);
    if (!pubkey) {
      throw new Error('Failed to get pubKey');
    }
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey });
    const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh });

    psbt.addInput({
      hash: input.txId,
      index: input.vout,
      witnessUtxo: {
        script: p2sh.output,
        value: input.value,
      },
      redeemScript: p2wpkh.output,
    });

    let keyPair = bitcoin.ECPair.fromWIF(input.wif);
    keypairs.push(keyPair);
  }

  for (let i = 0; i < outputs.length; i++) {
    let output = outputs[i];
    if (!output.address) {
      // Change address.
      //output.address = await wallet.getChangeAddressAsync();
      // IMPORTANT: we will use the same namespace address - privacy/security trade-off.
      output.address = namespaceAddress;
    }

    if (i == 0) {
      // The namespace creation script.
      if (output.value != 1000000) {
        throw new Error('Key update script has incorrect value.');
      }
      const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);
      psbt.addOutput({
        script: nsScript,
        value: output.value,
      });
    } else {
      psbt.addOutput({
        address: output.address,
        value: output.value,
      });
    }
  }

  for (let i = 0; i < keypairs.length; i++) {
    psbt.signInput(i, keypairs[i]);
    if (!psbt.validateSignaturesOfInput(i)) {
      throw new Error('Invalid signature for input #' + i);
    }
  }

  psbt.finalizeAllInputs();
  let hexTx = psbt.extractTransaction(true).toHex();
  return {tx: hexTx, fee, cost: REPLY_COST};
}

export async function getNamespaceInfoFromShortCode(ecl, shortCode) {
  const nsRootId = await getTxIdFromShortCode(ecl, shortCode);
  if (nsRootId) {
    return await getNamespaceInfoFromTx(ecl, nsRootId);
  }
  return null;
}

export async function getNamespaceInfo(ecl, namespaceId, needShortcode = true) {
  let history = await ecl.blockchainScripthash_getHistory(getRootNamespaceScriptHash(namespaceId));
  if (history.length == 0) {
    return {}
  }
  let result = await getNamespaceDataFromNSTx(ecl, history);
  if (needShortcode) {
    // Short code must use the first transaction when the namesapce is created.
    const rootTx = history[0];
    try {
      let merkle = await ecl.blockchainTransaction_getMerkle(rootTx.tx_hash, rootTx.height, false);
      if (merkle) {
        // The first digit is the length of the block height.
        let strHeight = merkle.block_height.toString();
        const prefix = strHeight.length;
        result.shortCode = prefix + strHeight + merkle.pos.toString();
      }
    } catch (e) {
      // No merkel result, the transaction has not been confirmed and included
      // in a block yet.
      result.shortCode = false;
    }
  }
  return result;
}

export function getTxReaction(tx) {
  for (let index = 0; index < tx.o.length; index = index + 2) {
    if (!tx.n) {
      continue;
    }
    if (tx.kv.op != KEVA_OP_PUT) {
      continue;
    }

    const key = decodeBase64(tx.kv.key);
    const {keyType, partialTxId} = parseSpecialKey(key);
    if (keyType == 'share' || keyType == 'comment' || keyType == 'like') {
      return {keyType: keyType, tx_hash: partialTxId}
    }
  }
  return {};
}

export function populateReactions() {
  const wallets = BlueApp.getWallets();
  if (wallets.length == 0) {
    return;
  }

  let reactions = {};
  for (const wallet of wallets) {
    const transactions = wallet.getTransactions();
    for (const tx of transactions) {
      const {keyType, tx_hash} = getTxReaction(tx);
      if (!keyType) {
        continue;
      }
      const reaction = reactions[tx_hash] || {};
      reactions[tx_hash] = {[keyType]:  tx.hash, ...reaction};
    }
  }
  return reactions;
}

export function findTxIndex(keyValues, txid) {
  if (!keyValues || !txid) {
    return -1;
  }

  if (!keyValues[0]) {
    return -1;
  }

  if (keyValues[0].tx_hash) {
    return keyValues.findIndex(kv => kv.tx_hash == txid);
  } else {
    return keyValues.findIndex(kv => kv.tx == txid);
  }
}
