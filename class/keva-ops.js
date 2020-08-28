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

const DUMMY_TXID = 'c70483b4613b18e750d0b1087ada28d713ad1e406ebc87d36f94063512c5f0dd';

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
          displayName: hexToUtf8(fixInt(result[2]))
      }
  } else if (result[0] === KEVA_OP_PUT) {
      return {
          op: 'KEVA_OP_PUT',
          namespaceId: hexToNamespace(result[1]),
          key: hexToUtf8(fixInt(result[2])),
          value: hexToUtf8(fixInt(result[3]))
      }
  } else if (result[0] === KEVA_OP_DELETE) {
      return {
          op: 'KEVA_OP_DELETE',
          namespaceId: hexToNamespace(result[1]),
          key: hexToUtf8(fixInt(result[2]))
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
  let nonNamespaceUtxos = getNonNamespaceUxtos(transactions, utxos);
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
  console.log(hexTx);
  return {tx: hexTx, namespaceId: returnNamespaceId, fee};
}

function getKeyValueUpdateScript(namespaceId, address, key, value) {
  const keyBuf = Buffer.from(utf8ToHex(key), 'hex');
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
  const keyBuf = Buffer.from(utf8ToHex(key), 'hex');

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

export function getNonNamespaceUxtos(transactions, utxos) {
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

export async function getNamespaceUtxo(wallet, namespaceId) {
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
  return null;
}

function reorderUtxos(utxos, nsUtxo) {
  let newUtxos = [nsUtxo];
  for (let t of utxos) {
    if (t.txId == nsUtxo.txId && t.vout == nsUtxo.vout) {
      continue;
    }
    newUtxos.push(t);
  }
  return newUtxos;
}

export async function updateKeyValue(wallet, requestedSatPerByte, namespaceId, key, value) {
  await wallet.fetchTransactions();
  let nsUtxo = await getNamespaceUtxo(wallet, namespaceId);
  if (!nsUtxo) {
    throw new Error(loc.namespaces.update_key_err);
  }

  const namespaceAddress = await wallet.getAddressAsync();
  const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);

  // Namespace needs at least 0.01 KVA.
  const namespaceValue = 1000000;
  let targets = [{
    address: namespaceAddress, value: namespaceValue,
    script: nsScript
  }];

  const transactions = wallet.getTransactions();
  let utxos = wallet.getUtxo();
  let nonNamespaceUtxos = getNonNamespaceUxtos(transactions, utxos);
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
  console.log(hexTx);
  return {tx: hexTx, fee};
}

export async function deleteKeyValue(wallet, requestedSatPerByte, namespaceId, key) {
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
  let nonNamespaceUtxos = getNonNamespaceUxtos(transactions, utxos);
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
  console.log(hexTx);
  return {tx: hexTx, fee};
}

// nsTx: any tx that contains namespace operation.
export async function findNamespaceShortCode(ecl, transctions, nsTx) {
  // Find the "root" tx, the first tx that creates the namespace.
  let result = await getNamespaceDataFromTx(ecl, transctions, nsTx);
  let txid = result.txid;
  let history = await ecl.blockchainScripthash_getHistory(toScriptHash(result.address));
  let foundTx = history.find(h => h.tx_hash == txid);
  if (foundTx) {
    if (foundTx.height <= 0) {
      // Still in mempool.
      return { rootTxidL: txid };
    }
    let merkle = await ecl.blockchainTransaction_getMerkle(txid, foundTx.height, false);
    if (merkle) {
      // The first digit is the length of the block height.
      let strHeight = merkle.block_height.toString();
      let prefix = strHeight.length;
      let shortCode = prefix + strHeight + merkle.pos.toString();
      return { shortCode, rootTxid: txid };
    }
  }
  return { rootTxidL: txid };
}

export async function getNamespaceFromShortCode(ecl, shortCode) {
  let prefix = parseInt(shortCode.substring(0, 1));
  let height = shortCode.substring(1, 1 + prefix);
  let pos = shortCode.substring(1 + prefix, 2 + prefix);
  let txHash = await ecl.blockchainTransaction_idFromPos(height, pos);
  return txHash;
}

const VERBOSE = true;
const RELOAD_HEIGHT = 5;

// Address is the root address, i.e. the address that is involved in
// namespace creation.
async function traverseKeyValues(ecl, address, namespaceId, transactions, currentkeyValueList, cb) {
  let results = [];
  let txvoutsDone = {};
  let stack = [];
  let resultMap = {};
  let txChild = {};

  // Caching
  let cacheAddress;
  let rescanPos;

  if (currentkeyValueList && currentkeyValueList.length > 0) {
    if (currentkeyValueList.length > RELOAD_HEIGHT) {
      rescanPos = RELOAD_HEIGHT;
      cacheAddress = currentkeyValueList[RELOAD_HEIGHT].address;
    } else {
      rescanPos = currentkeyValueList.length - 1;
      cacheAddress = currentkeyValueList[rescanPos].address;
    }
  }

  address = cacheAddress || address;
  stack.push(address);
  let missingParens = {};
  while (stack.length > 0) {
    let address = stack.pop();
    let history = await ecl.blockchainScripthash_getHistory(toScriptHash(address));
    let txsToFetch = history.map(h => h.tx_hash);
    let txs;
    if (transactions) {
      txs = transactions.filter(tx => txsToFetch.includes(tx.txid));
    }
    if (txs.length != txsToFetch.length) {
      txs = await ecl.blockchainTransaction_getBatch(txsToFetch, VERBOSE);
    }
    for (let i = 0; i < txs.length; i++) {
      let tx = txs[i].result || txs[i];
      // From transactions, tx.outputs
      // From server: tx.vout
      const vout = tx.outputs || tx.vout;
      for (let v of vout) {
        let txvout = tx.txid + v.n.toString();
        if (txvoutsDone[txvout]) {
          continue;
        }
        let result = parseKeva(v.scriptPubKey.asm);
        if (!result) {
          txvoutsDone[txvout] = 1;
          continue;
        }
        address = v.scriptPubKey.addresses[0];
        let resultJson = kevaToJson(result);
        if (resultJson.namespaceId != namespaceId) {
          continue;
        }
        resultJson.tx = tx.txid;
        let h = history.find(h => h.tx_hash == tx.txid);
        resultJson.height = h.height;
        resultJson.n = v.n;
        resultJson.time = tx.time;
        resultJson.address = address;
        resultMap[resultJson.tx + resultJson.n] = resultJson;
        if (cb) {
          // Report progress.
          cb(resultJson.height);
        }
        const vins = tx.inputs || tx.vin;
        let hasParent = false;
        let parents = [];
        for (let vin of vins) {
          parents.push(vin.txid + vin.vout);
          if (resultMap[vin.txid + vin.vout]) {
            txChild[vin.txid + vin.vout] = resultJson.tx + resultJson.n;
            hasParent = true;
            break;
          }
        }

        if (!hasParent) {
          missingParens[resultJson.tx + resultJson.n] = parents;
        }

        txvoutsDone[txvout] = 1;
        stack.push(address);
      }
    }
  }

  //Sort the result according to txChild.
  // We should have at least one tx that has no parent.
  if (Object.keys(missingParens).length == 0) {
    return [];
  }

  for (let c in missingParens) {
    for (let txout of missingParens[c]) {
      if (resultMap[txout]) {
        txChild[txout] = c;
        missingParens[c] = null;
        break;
      }
    }
  }

  let firstTxOut;
  for (let c in missingParens) {
    if (missingParens[c]) {
      firstTxOut = c;
    }
  }

  results.push(resultMap[firstTxOut]);
  let nextTxVout = txChild[firstTxOut];
  while (nextTxVout) {
    results.push(resultMap[nextTxVout]);
    nextTxVout = txChild[nextTxVout];
  }

  if (!cacheAddress) {
    return results;
  }

  // Merge the current one and cached one.
  for (let m = 0; m <= rescanPos; m++) {
    let foundIndex = results.findIndex(r => r.tx == currentkeyValueList[m]);
    if (foundIndex >= 0) {
      results.splice(foundIndex, 1);
    }
  }

  origResults = [...currentkeyValueList]
  origResults.splice(0, rescanPos + 1);
  origResults.reverse();
  return origResults.concat(results);
}

export async function getKeyValuesFromTxid(ecl, transactions, txid, keyValueList, cb) {
  let result = await getNamespaceDataFromTx(ecl, transactions, txid);
  let address = result.address;
  const namespaceId = kevaToJson(result.result).namespaceId;
  let results = await traverseKeyValues(ecl, address, namespaceId, transactions, keyValueList, cb);
  // Merge the results.
  let keyValues = [];
  for (let kv of results) {
      if (kv.op === 'KEVA_OP_PUT') {
        // Remove the existing one.
        keyValues = keyValues.filter(e => e.key != kv.key);
        keyValues.push(kv);
      } else if (kv.op === 'KEVA_OP_DELETE') {
        keyValues = keyValues.filter(e => e.key != kv.key);
      } else if (kv.op === 'KEVA_OP_NAMESPACE') {
        keyValues.push({key: '_KEVA_NS_', value: kv.displayName, ...kv});
      } else {
        // Legacy - TODO: remove this.
        if (kv.key == '_KEVA_NS_') {
          keyValues.push({op: 'KEVA_OP_NAMESPACE', ...kv});
        } else {
          keyValues.push({op: 'KEVA_OP_PUT', ...kv});
        }
      }
  }
  keyValues.reverse();
  return keyValues;
}

export async function getKeyValuesFromShortCode(ecl, transactions, shortCode, keyValueList, cb) {
  let txid = await getNamespaceFromShortCode(ecl, shortCode);
  return getKeyValuesFromTxid(ecl, transactions, txid, keyValueList, cb);
}

export async function findMyNamespaces(wallet, ecl) {
  await wallet.fetchBalance();
  await wallet.fetchTransactions();
  const transactions = wallet.getTransactions();
  if (transactions.length == 0) {
    return;
  }
  let namespaces = {};
  for (let tx of transactions) {
    for (let v of tx.outputs) {
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
  }

  for (let nsId of Object.keys(namespaces)) {
    // Find the root txid and short code for each namespace.
    const { shortCode, rootTxid } = await findNamespaceShortCode(ecl, transactions, namespaces[nsId].txId);
    namespaces[nsId].shortCode = shortCode;
    namespaces[nsId].rootTxid = rootTxid;
  }
  return namespaces;
}

export async function findOtherNamespace(ecl, txidOrShortCode) {
  let txid;
  if (txidOrShortCode.length > 20) {
    // It is txid;
    txid = txidOrShortCode;
  } else {
    txid = await getNamespaceFromShortCode(ecl, txidOrShortCode);
  }

  const transactions = [];
  const { shortCode, rootTxid } = await findNamespaceShortCode(ecl, transactions, txid);

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
  }
  return namespaces;
}