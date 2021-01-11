const bitcoin = require('bitcoinjs-lib');
const base58check = require('bs58check')
const coinSelectAccumulative = require('coinselect/accumulative');
let loc = require('../loc');

export const KEVA_OP_NAMESPACE = 0xd0;
export const KEVA_OP_PUT = 0xd1;
export const KEVA_OP_DELETE = 0xd2;

const convert = (from, to) => str => Buffer.from(str, from).toString(to)
const utf8ToHex = convert('utf8', 'hex')
const hexToUtf8 = convert('hex', 'utf8')

// Check if a hex string represents a valid utf-8 string.
// If yes, convert it into utf-8 string. Otherwise, convert
// it to binary buffer.
function hexToUtf8OrBuffer(hexStr) {
  const utf8Str = hexToUtf8(hexStr);
  if (utf8ToHex(utf8Str).length === hexStr.length) {
    return utf8Str;
  }
  return Buffer.from(hexStr, 'hex');
}

const DUMMY_TXID = 'c70483b4613b18e750d0b1087ada28d713ad1e406ebc87d36f94063512c5f0dd';

export function getSpecialKeyText(keyType) {
  let displayKey = "";
  if (keyType === 'comment') {
    displayKey = 'Comment';
  } else if (keyType === 'share') {
    displayKey = 'Share';
  } else if (keyType === 'reward') {
    displayKey = 'Reward';
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

export function isKevaNamespace(code) {
  return code === KEVA_OP_NAMESPACE;
}

export function isKevaPut(code) {
  return code === KEVA_OP_PUT;
}

export function isKevaDelete(code) {
  return code === KEVA_OP_DELETE;
}

export function hexToNamespace(hexStr) {
  let decoded = Buffer.from(hexStr, "hex")
  return base58check.encode(decoded);
}

export function namespaceToHex(nsStr) {
  return base58check.decode(nsStr);
}

function reverseHex(strHex) {
  if ((strHex.length % 2) != 0) {
    strHex = '0' + strHex;
  }
  const result = [];
  let len = strHex.length - 2;
  while (len >= 0) {
    result.push(strHex.substr(len, 2));
    len -= 2;
  }
  return result.join('');
}

function fixInt(num) {
  let intVal = parseInt(num, 10);
  if (intVal.toString(10) != num) {
    return num;
  }
  if (intVal > 2147483647) {
    return num;
  }
  if (intVal < 0) {
    // See set_vch method in script.h in bitcoin code.
    let scriptNum = (-intVal).toString(16);
    const numLen = scriptNum.length;
    if (numLen == 2) {
      intVal = -intVal + 0x80;
    } else if (numLen <= 4) {
      intVal = -intVal + 0x8000;
    } else if (numLen <= 6) {
      intVal = -intVal + 0x800000;
    } else if (numLen <= 8) {
      intVal = -intVal + 0x80000000;
    }
  }
  return reverseHex(intVal.toString(16));
}

function kevaToJson(result) {
  if (result[0] === KEVA_OP_NAMESPACE) {
      return {
          op: 'KEVA_OP_NAMESPACE',
          namespaceId: hexToNamespace(result[1]),
          displayName: hexToUtf8OrBuffer(fixInt(result[2]))
      }
  } else if (result[0] === KEVA_OP_PUT) {
      return {
          op: 'KEVA_OP_PUT',
          namespaceId: hexToNamespace(result[1]),
          key: hexToUtf8OrBuffer(fixInt(result[2])),
          value: hexToUtf8(fixInt(result[3]))
      }
  } else if (result[0] === KEVA_OP_DELETE) {
      return {
          op: 'KEVA_OP_DELETE',
          namespaceId: hexToNamespace(result[1]),
          key: hexToUtf8OrBuffer(fixInt(result[2]))
      }
  } else {
      return null;
  }
}

export function parseKevaPut(asm) {
  let re = /^OP_KEVA_PUT\s([0-9A-Fa-f]+)\s(-?[0-9A-Fa-f]+)\s(-?[0-9A-Fa-f]+)/;
  let match = asm.match(re);
  if (!match || match.length !== 4) {
    return null;
  }
  return [KEVA_OP_PUT, ...match.slice(1)];
}

export function parseKevaDelete(asm) {
  let re = /^OP_KEVA_DELETE\s([0-9A-Fa-f]+)\s(-?[0-9A-Fa-f]+)/;
  let match = asm.match(re);
  if (!match || match.length !== 3) {
    return null;
  }
  return [KEVA_OP_DELETE, ...match.slice(1)];
}

export function parseKevaNamespace(asm) {
  let re = /^OP_KEVA_NAMESPACE\s([0-9A-Fa-f]+)\s(-?[0-9A-Fa-f]+)/;
  let match = asm.match(re);
  if (!match || match.length !== 3) {
    return null;
  }
  return [KEVA_OP_NAMESPACE, ...match.slice(1)];
}

export function parseKeva(asm) {
  if (asm.startsWith("OP_KEVA_PUT")) {
    return parseKevaPut(asm);
  } else if (asm.startsWith("OP_KEVA_DELETE")) {
    return parseKevaDelete(asm);
  } else if (asm.startsWith("OP_KEVA_NAMESPACE")) {
    return parseKevaNamespace(asm);
  }
  return null;
}

export function toScriptHash(addr) {
  let script = bitcoin.address.toOutputScript(addr);
  let hash = bitcoin.crypto.sha256(script);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}

export function getNamespaceScriptHash(namespaceId) {
  let emptyBuffer = Buffer.alloc(0);
  let bscript = bitcoin.script;
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    namespaceToHex(namespaceId),
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

export async function getNamespaceDataFromTx(ecl, transactions, txidStart, nsStart) {
  let stack = [];
  stack.push([txidStart, nsStart]);
  while (stack.length > 0) {
    let [txid, ns] = stack.pop();
    let tx = transactions.find(t => t.txid == txid);
    if (!tx) {
      // Not found in the cache, try to fetch it from the server.
      tx = await ecl.blockchainTransaction_get(txid, true);
    }

    // From transactions, tx.outputs
    // From server: tx.vout
    const vout = tx.outputs || tx.vout;
    for (let v of vout) {
      let result = parseKeva(v.scriptPubKey.asm);
      if (!result) {
        continue;
      }

      if (result[0] === KEVA_OP_NAMESPACE) {
        if (!ns || ns === result[1]) {
          return {
            txid,
            result,
            address: v.scriptPubKey.addresses[0],
          };
        }
      }

      let nextns = result[1];
      if (!ns || nextns === ns) {
        // From transactions, tx.inputs
        // From server: tx.vin
        const vin = tx.inputs || tx.vin;
        let txIds = vin.map(t => t.txid);
        let uniqueTxIds = txIds.filter((v, i, a) => a.indexOf(v) === i);
        for (let t of uniqueTxIds) {
          stack.push([t, nextns]);
        }
      }
    }
  }
  return null;
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

function getKeyValueUpdateScript(namespaceId, address, key, value) {
  const keyBuf = keyToBuffer(key);
  const valueBuf = Buffer.from(utf8ToHex(value), 'hex');

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
    const v = tx.outputs[u.vout];
    let result = parseKeva(v.scriptPubKey.asm);
    let isNSTx = !!result;
    if (!isNSTx) {
      nonNSutxos.push(u);
    }
  }
  return nonNSutxos;
}

export async function getNonNamespaceUxtos(wallet, transactions, utxos, tryAgain) {
  let nonNSutxos = [];
  for (let u of utxos) {
    const tx = transactions.find(t => t.txid == u.txId);
    if (!tx) {
      continue;
    }
    const v = tx.outputs[u.vout];
    let result = parseKeva(v.scriptPubKey.asm);
    let isNSTx = !!result;
    if (!isNSTx) {
      nonNSutxos.push(u);
    }
  }

  if (nonNSutxos.length == 0 && !tryAgain) {
    // Try again.
    console.log('Try again for getNonNamespaceUxtos')
    await waitPromise(2000);
    await wallet.fetchBalance();
    await wallet.fetchTransactions();
    await wallet.fetchUtxo();
    const transactions = wallet.getTransactions();
    let utxos = wallet.getUtxo();
    return await getNonNamespaceUxtos(wallet, transactions, utxos, true);
  }
  return nonNSutxos;
}

export async function scanForNamespaces(wallet) {
  let results = [];
  const txs = wallet.getTransactions();
  for (let tx of txs) {
    for (let vout of tx.outputs) {
      const keva = parseKeva(vout.scriptPubKey.asm);
      if (keva) {
        results.push({
          tx: tx.txid,
          n: vout.n,
          address: vout.scriptPubKey.addresses[0],
          keva: kevaToJson(keva),
        });
      }
    }
  }
  return results;
}

const TRY_UTXO_COUNT = 2;
export async function getNamespaceUtxo(wallet, namespaceId) {
  for (let i = 0; i < TRY_UTXO_COUNT; i++) {
    await wallet.fetchUtxo();
    const utxos = wallet.getUtxo();
    const results = await scanForNamespaces(wallet);
    for (let r of results) {
      if (r.keva.namespaceId === namespaceId) {
        for (let t of utxos) {
          if (r.tx == t.txId && r.n == t.vout) {
            return t;
          }
        }
      }
    }
    // No namespace UXTO, try again.
    await waitPromise(2000);
    await wallet.fetchBalance();
    await wallet.fetchTransactions();
  }
  return null;
}

export async function updateKeyValue(wallet, requestedSatPerByte, namespaceId, key, value, serverIPFS) {
  await wallet.fetchBalance();
  await wallet.fetchTransactions();
  let nsUtxo = await getNamespaceUtxo(wallet, namespaceId);
  if (!nsUtxo) {
    throw new Error(loc.namespaces.update_key_err);
  }

  // IMPORTANT: we will use the same namespace address. Ideally, for
  // security/privacy reason, it is better to use a new address. But that
  // would create many addresses and slow down the update.
  const namespaceAddress = nsUtxo.address;
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
  const tx = await ecl.blockchainTransaction_get(replyTxid, true);
  const vout = tx.outputs || tx.vout;
  let rewardAddress;
  for (let v of vout) {
    let result = parseKeva(v.scriptPubKey.asm);
    if (!result) {
      continue;
    }

    if (result[0] === KEVA_OP_PUT) {
      rewardAddress = v.scriptPubKey.addresses[0];
    }
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
export async function replyKeyValue(wallet, requestedSatPerByte, namespaceId, shortCode, value, replyRootAddress, replyTxid) {
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
  if (!nonNamespaceUtxos || nonNamespaceUtxos.length == 0) {
    throw new Error('No nonNamespaceUtxos');
  }
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
export async function findNamespaceShortCode(ecl, transctions, nsTx) {
  // Find the "root" tx, the first tx that creates the namespace.
  let result = await getNamespaceDataFromTx(ecl, transctions, nsTx);
  let txid = result.txid;
  let rootAddress = result.address;
  let history = await ecl.blockchainScripthash_getHistory(toScriptHash(result.address));
  let foundTx = history.find(h => h.tx_hash == txid);
  if (foundTx) {
    if (foundTx.height <= 0) {
      // Still in mempool.
      return { rootTxid: txid, rootAddress };
    }
    let merkle = await ecl.blockchainTransaction_getMerkle(txid, foundTx.height, false);
    if (merkle) {
      // The first digit is the length of the block height.
      let strHeight = merkle.block_height.toString();
      let prefix = strHeight.length;
      let shortCode = prefix + strHeight + merkle.pos.toString();
      return { shortCode, rootTxid: txid, rootAddress, displayName: kevaToJson(result.result).displayName };
    }
  }
  return { rootTxid: txid, rootAddress };
}

export async function getTxShortCode(ecl, txid, height) {
  let merkle = await ecl.blockchainTransaction_getMerkle(txid, height, false);
  if (!merkle) {
    return -1;
  }

  // The first digit is the length of the block height.
  let strHeight = merkle.block_height.toString();
  let prefix = strHeight.length;
  let shortCode = prefix + strHeight + merkle.pos.toString();
  return shortCode;
}

export function getHeightFromShortCode(shortCode) {
  // The first digit is the length of the block height.
  let len = parseInt(shortCode.charAt(0));
  let height = parseInt(shortCode.substring(1, len + 1));
  return height;
}

export async function getTxIdFromShortCode(ecl, shortCode) {
  let prefix = parseInt(shortCode.substring(0, 1));
  let height = shortCode.substring(1, 1 + prefix);
  let pos = shortCode.substring(1 + prefix, 2 + prefix);
  let txHash = await ecl.blockchainTransaction_idFromPos(height, pos);
  return txHash;
}

const VERBOSE = true;
const FAST_LOAD = 20;

// Address is the root address, i.e. the address that is involved in
// namespace creation.
export async function fetchKeyValueList(ecl, completeHistory, currentkeyValueList, isFast, cb) {

  let history;
  if (isFast && completeHistory.length > FAST_LOAD) {
    // Only load some of the latest results.
    history = completeHistory.slice(completeHistory.length - FAST_LOAD);
  } else {
    history = completeHistory;
  }

  // Only need to fetch the txs that are not in the current list, or have different height.
  let txsToFetch = [];
  currentkeyValueList = currentkeyValueList || [];
  history.forEach(h => {
    const same = currentkeyValueList.find(c => (c.tx == h.tx_hash) && (c.height == h.height));
    if (same) {
      // No need to update.
      return;
    }
    txsToFetch.push(h.tx_hash);
  });

  if (txsToFetch.length == 0) {
    // No changes, return the original ones.
    return currentkeyValueList;
  }

  const txsMap = await ecl.multiGetTransactionByTxid(txsToFetch, 20, VERBOSE, cb);
  let txs = [];
  for (let t of txsToFetch) {
    txs.push(txsMap[t]);
  }
  let results = [];
  for (let i = 0; i < txs.length; i++) {
    let tx = txs[i].result || txs[i];
    // From transactions, tx.outputs
    // From server: tx.vout
    const vout = tx.outputs || tx.vout;
    for (let v of vout) {
      let result = parseKeva(v.scriptPubKey.asm);
      if (!result) {
        continue;
      }
      let resultJson = kevaToJson(result);
      resultJson.tx = tx.txid;
      const h = history.find(h => h.tx_hash == tx.txid);
      resultJson.height = h.height;
      resultJson.n = v.n;
      resultJson.time = tx.time;
      let address = v.scriptPubKey.addresses[0];
      resultJson.address = address;
      results.push(resultJson);
    }
  }

  // Merge the results. Update the existing ones, and append the rest
  // to the end;
  for (let c of currentkeyValueList) {
    const foundIndex = results.findIndex(r => (r.tx == c.tx));
    if (foundIndex >= 0) {
      // Update height in case it is different.
      c.height = results[foundIndex].height;
      c.time = results[foundIndex].time;
      results.splice(foundIndex, 1);
    }
  }

  return [...currentkeyValueList, ...results];
}

export function mergeKeyValueList(origkeyValues) {
  // Merge the results.
  let keyValues = [];
  for (let kv of origkeyValues) {
    if (kv.op === 'KEVA_OP_PUT') {
      // Remove the existing one.
      keyValues = keyValues.filter(e => e.key != kv.key);
      keyValues.push(kv);
    } else if (kv.op === 'KEVA_OP_DELETE') {
      keyValues = keyValues.filter(e => e.key != kv.key);
    } else if (kv.op === 'KEVA_OP_NAMESPACE') {
      keyValues.push({key: '_KEVA_NS_', value: kv.displayName, ...kv});
    }
  }
  return keyValues.reverse();
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

    let v = tx.outputs[utxo.vout];
    if (!v) {
      // This should not happen.
      continue;
    }
    let result = parseKeva(v.scriptPubKey.asm);
    if (!result) {
      continue;
    }
    const keva = kevaToJson(result);
    const nsId = keva.namespaceId;
    namespaces[nsId] = namespaces[nsId] || {
      id: nsId,
      walletId: wallet.getID(),
      txId: tx.hash,
    }
    if (keva.displayName) {
      namespaces[nsId].displayName = keva.displayName;
    }
  }

  for (let nsId of Object.keys(namespaces)) {
    // Find the root txid and short code for each namespace.
    const { shortCode, rootTxid, rootAddress } = await findNamespaceShortCode(ecl, transactions, namespaces[nsId].txId);
    namespaces[nsId].shortCode = shortCode;
    namespaces[nsId].rootTxid = rootTxid;
    namespaces[nsId].rootAddress = rootAddress;
    if (!namespaces[nsId].displayName) {
      // This namespace may be transferred from different wallet.
      const nsInfo = await getNamespaceInfoFromShortCode(ecl, shortCode);
      if (nsInfo) {
        namespaces[nsId].displayName = nsInfo.displayName;
      }
    }
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
  }

  const transactions = [];
  const { shortCode, rootTxid, rootAddress } = await findNamespaceShortCode(ecl, transactions, txid);

  if (!rootTxid) {
    return null;
  }

  let namespaces = {};
  let nsId;
  const tx = await ecl.blockchainTransaction_get(rootTxid, true);
  // From transactions, tx.outputs
  // From server: tx.vout
  for (let v of tx.vout) {
    let result = parseKeva(v.scriptPubKey.asm);
    if (!result) {
        continue;
    }
    const keva = kevaToJson(result);
    nsId = keva.namespaceId;
    namespaces[nsId] = namespaces[nsId] || {
      id: nsId,
      txId: tx.txid,
    }
    if (keva.displayName) {
      namespaces[nsId].displayName = keva.displayName;
    }
  }

  if (nsId) {
    namespaces[nsId].shortCode = shortCode;
    namespaces[nsId].rootTxid = rootTxid;
    namespaces[nsId].rootAddress = rootAddress;
  }
  return namespaces;
}

// Address is the root address, i.e. the address that is involved in
// namespace creation.
export async function getRepliesAndShares(ecl, historyTxList) {
  let replies = [];
  let shares = [];
  let rewards = []

  // Replies list.
  let txScriptHashes = historyTxList.map(t => {
    return getKeyScriptHash(createReplyKey(t.tx_hash));
  });

  // Shared list.
  txScriptHashes = txScriptHashes.concat(historyTxList.map(t => {
    return getKeyScriptHash(createShareKey(t.tx_hash));
  }));

  // Reward list.
  txScriptHashes = txScriptHashes.concat(historyTxList.map(t => {
    return getKeyScriptHash(createRewardKey(t.tx_hash));
  }));

  // The history is raw output, something like:
  // [{"id": 188, "jsonrpc": "2.0", "param": "89fc4149e6e3ce6fce7af87865b3655699b44afb0e986350281494d8334c3285", "result": []}, ...]
  const historyRaw = await ecl.blockchainScripthash_getHistoryBatch(txScriptHashes);
  let history = [];
  historyRaw.forEach(h => {
    history = history.concat(h.result);
  });

  let txsToFetch = [];
  history.forEach(h => {
    txsToFetch = txsToFetch.concat(h.result);
  });
  txsToFetch = history.map(t => t.tx_hash);

  const txsMap = await ecl.multiGetTransactionByTxid(txsToFetch, 20, VERBOSE);
  let txs = [];
  for (let t of txsToFetch) {
    txs.push(txsMap[t]);
  }

  for (let i = 0; i < txs.length; i++) {
    let tx = txs[i].result || txs[i];
    // From transactions, tx.outputs
    // From server: tx.vout
    const vout = tx.outputs || tx.vout;
    for (let v of vout) {
      let result = parseKeva(v.scriptPubKey.asm);
      if (!result || result[0] == KEVA_OP_NAMESPACE) {
        continue;
      }
      let resultJson = kevaToJson(result);

      // Check if it is a share
      const {partialTxId, keyType} = parseSpecialKey(resultJson.key);
      if (keyType == 'share') {
        resultJson.time = tx.time;
        const h = history.find(h => h.tx_hash == tx.txid);
        resultJson.height = h.height;
        resultJson.sharedTxId = partialTxId;

        //TODO: optimize this - this requires slow tracing of the tx history!
        let {shortCode, displayName} = await findNamespaceShortCode(ecl, [], h.tx_hash);
        resultJson.sharer = {
          shortCode,
          displayName
        }
        shares.push(resultJson);
      } else if (keyType == 'comment') {
        resultJson.time = tx.time;
        const h = history.find(h => h.tx_hash == tx.txid);
        resultJson.height = h.height;
        resultJson.partialTxId = partialTxId;

        //TODO: optimize this - this requires slow tracing of the tx history!
        let {shortCode, displayName} = await findNamespaceShortCode(ecl, [], h.tx_hash);
        resultJson.sender = {
          shortCode,
          displayName
        }
        replies.push(resultJson);
      } else if (keyType == 'reward') {
        resultJson.time = tx.time;
        const h = history.find(h => h.tx_hash == tx.txid);
        resultJson.height = h.height;

        //TODO: optimize this - this requires slow tracing of the tx history!
        let {shortCode, displayName} = await findNamespaceShortCode(ecl, [], h.tx_hash);

        resultJson.partialTxId = partialTxId;
        resultJson.rewarder = {
          shortCode,
          displayName
        }
        rewards.push(resultJson);
      }
    }
  }
  return {replies, shares, rewards};
}

const SHARE_COST = 1000000;

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
    return {partialTxId: txId, keyType: 'reward'};
  } else {
    return false;
  }
}

// Share a post (key/value pair).
// replyRootAddress: the root namespace of the post.
// replyTxid: the txid of the post
//
export async function shareKeyValue(ecl, wallet, requestedSatPerByte, namespaceId, shortCode, origShortCode, value, shareRootAddress, shareTxid, height) {
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
  }, {
    address: shareRootAddress, value: SHARE_COST,
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

export async function getKeyValueFromTxid(ecl, txid) {
  const tx = await ecl.blockchainTransaction_get(txid, true);
  const vout = tx.vout;
  for (let v of vout) {
    let result = parseKeva(v.scriptPubKey.asm);
    if (result) {
      let resultJson = kevaToJson(result);
      resultJson.time = tx.time;
      return resultJson;
    }
  }

  return null;
}

export async function getNamespaceInfoFromShortCode(ecl, shortCode) {
  const nsRootId = await getTxIdFromShortCode(ecl, shortCode);
  let nsData = await getNamespaceDataFromTx(ecl, [], nsRootId);
  if (!nsData) {
    return;
  }
  const nsInfo = kevaToJson(nsData.result);
  return nsInfo;
}
