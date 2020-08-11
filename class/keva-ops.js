const bitcoin = require('bitcoinjs-lib');
const base58check = require('bs58check')
const coinSelectAccumulative = require('coinselect/accumulative');
const BigNumber = require('bignumber.js');

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

export function kevaToJson(result) {
  if (result[0] === KEVA_OP_NAMESPACE) {
    return {
      op: 'KEVA_OP_NAMESPACE',
      namespaceId: hexToNamespace(result[1]),
      displayName: hexToUtf8(result[2])
    }
  } else if (result[0] === KEVA_OP_PUT) {
    return {
      op: 'KEVA_OP_PUT',
      namespace: hexToNamespace(result[1]),
      key: hexToUtf8(result[2]),
      value: hexToUtf8(result[3])
    }
  } else if (result[0] === KEVA_OP_DELETE) {
    return {
      op: 'KEVA_OP_DELETE',
      namespace: hexToNamespace(result[1]),
      key: hexToUtf8(result[2])
    }
  } else {
    return null;
  }
}

export function parseKevaPut(asm) {
  let re = /^OP_KEVA_PUT\s([0-9A-Fa-f]+)\s([0-9A-Fa-f]+)\s([0-9A-Fa-f]+)/;
  let match = asm.match(re);
  if (!match || match.length !== 4) {
    return null;
  }
  return [KEVA_OP_PUT, ...match.slice(1)];
}

export function parseKevaDelete(asm) {
  let re = /^OP_KEVA_DELETE\s([0-9A-Fa-f]+)\s([0-9A-Fa-f]+)/;
  let match = asm.match(re);
  if (!match || match.length !== 3) {
    return null;
  }
  return [KEVA_OP_DELETE, ...match.slice(1)];
}

export function parseKevaNamespace(asm) {
  let re = /^OP_KEVA_NAMESPACE\s([0-9A-Fa-f]+)\s([0-9A-Fa-f]+)/;
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

export async function getNamespaceDataFromTx(ecl, txidStart, nsStart) {
  let stack = [];
  stack.push([txidStart, nsStart]);
  while (stack.length > 0) {
    let [txid, ns] = stack.pop();
    let tx = await ecl.blockchainTransaction_get(txid, true);
    for (let v of tx.vout) {
      let result = parseKeva(v.scriptPubKey.asm);
      if (!result) {
        continue;
      }

      if (result[0] === KEVA_OP_NAMESPACE) {
        if (!ns || ns === result[1]) {
          return {
            txid,
            result
          };
        }
      }

      let nextns = result[1];
      if (!ns || nextns === ns) {
        txIds = tx.vin.map(t => t.txid);
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

  let { inputs, outputs, fee } = coinSelectAccumulative(utxos, targets, requestedSatPerByte);

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
  console.log(returnNamespaceId);
  console.log(hexTx);
  return {tx: hexTx, namespaceId: returnNamespaceId};
}

function getKeyValueUpdateScript(namespaceId, address, key, value) {
  const keyBuf = Buffer.from(utf8ToHex(key), 'hex');
  const valueBuf = Buffer.from(utf8ToHex(value), 'hex');

  let bscript = bitcoin.script;
  let baddress = bitcoin.address;
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    namespaceId,
    keyBuf,
    valueBuf,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_HASH160,
    baddress.fromBase58Check(address).hash,
    bscript.OPS.OP_EQUAL]);

  return nsScript;
}

export async function updateKeyValue(wallet, requestedSatPerByte, namespaceId, key, value) {
  await wallet.fetchUtxo();
  const utxos = wallet.getUtxo();
  const namespaceAddress = await wallet.getAddressAsync();
  const nsDummyScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);

  // Namespace needs at least 0.01 KVA.
  const namespaceValue = 1000000;
  let targets = [{
    address: namespaceAddress, value: namespaceValue,
    script: nsDummyScript
  }];

  let { inputs, outputs, fee } = coinSelectAccumulative(utxos, targets, requestedSatPerByte);

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
        throw new Error('Namespace creation script has incorrect value.');
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
}
