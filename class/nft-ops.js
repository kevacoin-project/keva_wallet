const bitcoin = require('bitcoinjs-lib');
const bip65 = require('bip65');
const base58check = require('bs58check')
const coinSelectAccumulative = require('coinselect/accumulative');
let loc = require('../loc');
const Txdecoder = require('./txdecoder');
import Toast from 'react-native-root-toast';
let BlueApp = require('../BlueApp');

import {
    getKeyValueUpdateScript, getNamespaceUtxo, getNonNamespaceUxtos,
    KEVA_OP_NAMESPACE, KEVA_OP_PUT, KEVA_OP_DELETE,
} from './keva-ops';

// Reference: https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki
// https://bitcoin.stackexchange.com/questions/69809/op-checklocktimeverify-op-hodl-script

/*
How to create a bid:

1. In my namespace, create new key-value pair, with the key as createBidKey, the value
   as the paritially signed transaction.

2. At the same transaction of key-value pair, create a tx output to the payment address,
   the unlock script allows the me to spend it in (n + m) hours, while allows the seller to
   spend it in (n) hours, where n is the future number of hours that bidding will
   end. The second one must be signed by both me and the seller.

3. The partially signed transaction includes: sending the seller namespace to my address,
   to be signed by the seller. Partially signed the timelock txout (described in 2) to seller.
   The seller must sign both parts to complete the transaction.

4. The seller must complete the transaction between n and (n+m). Otherwise, I can unlock and send
   the payment back to me after (n + m) hours.
*/

// OP_IF <this pubkey can spend at any time> OP_CHECKSIG OP_ELSE <block number> OP_CHECKLOCKTIMEVERIFY OP_DROP
// <this pubkey must wait until block number> OP_CHECKSIG OP_ENDIF
function utcNow() {
    return Math.floor(Date.now() / 1000);
}

// n: future block height
// m: additional m blocks.
function getLockFundScript(myAddressPubKeyHash160, paymentAddressPubKeyHash160, n, m) {
    const lockTime = bip65.encode({ blocks: n });
    const extracLockTime = bip65.encode({ blocks: (m + n) });
    let bscript = bitcoin.script;
    let timelockRedeemScript = bscript.compile([
        bscript.OPS.OP_IF,
            bscript.number.encode(extracLockTime),
            bscript.OPS.OP_CHECKLOCKTIMEVERIFY,
            bscript.OPS.OP_DROP,
            bscript.OPS.OP_DUP,
            bscript.OPS.OP_HASH160,
            myAddressPubKeyHash160,
            bscript.OPS.OP_EQUALVERIFY,
            bscript.OPS.OP_CHECKSIG,
        bscript.OPS.OP_ELSE,
            bscript.number.encode(lockTime),
            bscript.OPS.OP_CHECKLOCKTIMEVERIFY,
            bscript.OPS.OP_DROP,
            // Bidder signature
            bscript.OPS.OP_DUP,
            bscript.OPS.OP_HASH160,
            myAddressPubKeyHash160,
            bscript.OPS.OP_EQUALVERIFY,
            bscript.OPS.OP_CHECKSIGVERIFY,
            // Seller signature
            bscript.OPS.OP_DUP,
            bscript.OPS.OP_HASH160,
            paymentAddressPubKeyHash160,
            bscript.OPS.OP_EQUALVERIFY,
            bscript.OPS.OP_CHECKSIG,
        bscript.OPS.OP_ENDIF,
    ]);
    return timelockRedeemScript;
}

// Only bidder (me) sign it.
// keyPiar: bidder's key pair
// myTargetAddress: the address NFT namespace should be transferred to.
// blockHeight: the tx locktime in block height.
export function spendLockPaymentPartial(redeemScript, txidLockedFund, voutLockedFund, nsNFT, nsNFTTxId, nsNFTTxIdVout, myTargetAddress, keyPair, paymentAddress, paymentAmount, fee, blockHeight) {

  const bscript = bitcoin.script;
  const bcrypto = bitcoin.crypto;

  /*
  const witnessHash = bcrypto.sha256(witnessScript)
  const redeemScript = Buffer.concat([Buffer.from('220020', 'hex'), witnessHash]);
  */

  let txb = new bitcoin.Transaction();
  // Sequence cannot be 0xffffffff because it disables time lock checking.
  // This input is the locked fund.
  txb.addInput(Buffer.from(txidLockedFund, "hex").reverse(), voutLockedFund, 0xfffffffe, redeemScript);

  // This input is the NFT namespace. It is standard P2SH-P2WPK, no redeem script.
  txb.addInput(Buffer.from(nsNFTTxId, "hex").reverse(), nsNFTTxIdVout, 0xfffffffe);

  const lockTime = bip65.encode({ blocks: blockHeight});
  txb.locktime = lockTime;

  // Output to NFT's payment address.
  const scriptPubKey = bitcoin.address.toOutputScript(paymentAddress);
  const value = paymentAmount - fee;
  txb.addOutput(scriptPubKey, value);

  // Output to my NFT target address (transferring to me).
  const scriptPubKeyNS = getKeyValueUpdateScript(nsNFT, myTargetAddress, '__NFT_TRADE__', '');
  txb.addOutput(scriptPubKeyNS, DEFAULT_NS_VALUE);

  const hash = txb.hashForWitnessV0(0, witnessScript, paymentAmount, bitcoin.Transaction.SIGHASH_ALL);
  // The second input, index 1, has no witness yet. To be done by the nsNFT owner.

  const sig1 = bscript.signature.encode(keyPair.sign(hash), bitcoin.Transaction.SIGHASH_ALL);
  // IMPORTANT: To be signed by the current NFT owner, i.e. seller.
  // This order is strange. All items except witness script must be reversed.
  let witness = [Buffer.from("", "hex"), keyPair.publicKey, sig1, /* sellerPubKey, seller Sig*/].reverse();

  witness.push(witnessScript);
  txb.ins[0].witness = witness;
  return txb;
}

// nsNFTId: namespaceId of the NFT namespace to bid for.
// paymentAddress: the address to send the payment.
// n: future block height
// m: future block height in addition to n.
// myTargetAddress: transfer NFT to my target address.
/*
export async function createNFTBid(wallet, requestedSatPerByte, namespaceId,
        amount, nsNFTId, offerTxId, paymentAddress, paymentAddressPubKeyHash160, myTargetAddress, n, m)
{
    await wallet.fetchBalance();
    await wallet.fetchTransactions();
    let nsUtxo = await getNamespaceUtxo(wallet, namespaceId);
    if (!nsUtxo) {
      throw new Error(loc.namespaces.update_key_err);
    }

    const key = createBidKey(offerTxId);
    // IMPORTANT: re-use the namespace address, security/privacy trade-off.
    const namespaceAddress = nsUtxo.address;

    let bcrypto = bitcoin.crypto;

    // Need my namespace key to unlock the locked fund.
    const myNSKeyPair = bitcoin.ECPair.fromWIF(nsUtxo.wif);
    const namespaceAddressPubKeyHash160 = bcrypto.hash160(myNSKeyPair.publicKey);
    const lockRedeemScript = getLockFundScript(namespaceAddressPubKeyHash160, paymentAddressPubKeyHash160, n, m);

    const witnessHash = bcrypto.sha256(lockRedeemScript)
    const redeemScript = Buffer.concat([Buffer.from('0020', 'hex'), witnessHash]);

    const payment = bitcoin.payments.p2sh({
      redeem: { output: redeemScript }
    });

    // txid: the lockfund tx id: problem: we don't know it yet!!!
    const partialTx = spendLockPaymentPartial(lockRedeemScript, txid, vout, nsNFTId, nsNFTTxId, nsNFTTxIdVout, myTargetAddress, myNSKeyPair, paymentAddress, amount, fee, n+1);
    // Make it work first, optimization later, base64 encode the partial Tx.
    const txInfo = {
      v: 0, // version.
      tx: partialTx.toString('base64'),
    };
    const value = JSON.stringify(txInfo);
    const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);

    const lockRedeemScriptAddress = payment.address;
    // Namespace needs at least 0.01 KVA.
    const namespaceValue = 1000000;
    let targets = [{
      address: namespaceAddress, value: namespaceValue,
      script: nsScript
    }, {
      address: lockRedeemScriptAddress, value: amount,
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
*/

export function completePaymentSigning(txb, sellerKeyPair, nsNFTKeyPair) {
  const bscript = bitcoin.script;
  const partialTx = bitcoin.Transaction.fromBuffer(txb);
  const ins = partialTx.ins;
  if (!ins || ins.length != 2) {
      throw Error("Incorrect input length");
  }

  const paymentIn = ins.find((value, index, txin) => txin[index].witness.length > 0);
  const nsNFTIn = ins.find((value, index, txin) => txin[index].witness.length == 0);

  // Sign the payment.
  const witnessScript = paymentIn.witness[paymentIn.witness.length - 1];
  //TODO: where to get the paymentAmount?
  const hash = partialTx.hashForWitnessV0(0, witnessScript, paymentAmount, bitcoin.Transaction.SIGHASH_ALL);

  const sig2 = bscript.signature.encode(sellerKeyPair.sign(hash), bitcoin.Transaction.SIGHASH_ALL);
  paymentIn.witness.unshift(sellerKeyPair.publicKey);
  paymentIn.witness.unshift(sig2);

  // Sign the nsNFT transfer
  nsNFTIn.witness.unshift(nsNFTKeyPair.publicKey);
  // nsNFT is the second input.
  // TODO: is this the right way to the default witnessScript?
  const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: nsNFTKeyPair.publicKey });
  const nsWitnessScript = p2wpkh.output;

  // TODO: the amount is not neccessarily DEFAULT_NS_VALUE.
  const nftHash = partialTx.hashForWitnessV0(1, nsWitnessScript, DEFAULT_NS_VALUE, bitcoin.Transaction.SIGHASH_ALL);

  const sigNFT = bscript.signature.encode(nsNFTKeyPair.sign(nftHash), bitcoin.Transaction.SIGHASH_ALL);
  nsNFTIn.witness.unshift(sigNFT);
  // Now it is fully signed.
  return partialTx;
}

// prefix 0x0004
export function createSellKey(namespaceId) {
  const nsId = base58check.decode(namespaceId);
  return Buffer.concat([Buffer.from('0004', 'hex'), Buffer.from(nsId, 'hex')]);
}

// From the selected namesapce, a tx with key: 0004 (sell) + namespaceid to sell
export async function createSellNFT(sellerWallet, requestedSatPerByte, sellerNamespaceId, namespaceId, desc, price) {
  await sellerWallet.fetchBalance();
  await sellerWallet.fetchTransactions();
  let nsUtxo = await getNamespaceUtxo(sellerWallet, sellerNamespaceId);
  if (!nsUtxo) {
    throw new Error(loc.namespaces.update_key_err);
  }

  // IMPORTANT: we will use the same namespace address. Ideally, for
  // security/privacy reason, it is better to use a new address. But that
  // would create many addresses and slow down the update.
  const currentAddress = nsUtxo.address;
  const namespaceAddress = currentAddress;
  const key = createSellKey(namespaceId);
  const value = JSON.stringify({
    d: desc,
    p: price,
  });
  const nsScript = getKeyValueUpdateScript(sellerNamespaceId, namespaceAddress, key, value);

  // Namespace needs at least 0.01 KVA.
  const namespaceValue = 1000000;
  let targets = [{
    address: namespaceAddress, value: namespaceValue,
    script: nsScript
  }];

  const transactions = sellerWallet.getTransactions();
  let utxos = sellerWallet.getUtxo();
  let nonNamespaceUtxos = await getNonNamespaceUxtos(sellerWallet, transactions, utxos);
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
    const pubkey = sellerWallet._getPubkeyByAddress(input.address);
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
      const nsScript = getKeyValueUpdateScript(sellerNamespaceId, namespaceAddress, key, value);
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
  const hexTx = psbt.extractTransaction(true).toHex();
  const txId = psbt.extractTransaction(true).getId();
  return {txSeller: hexTx, txIdSeller: txId, feeSeller: fee};
}

// prefix 0x0005
export function createConfirmKey(txId) {
  return Buffer.concat([Buffer.from('0005', 'hex'), Buffer.from(txId, 'hex')]);
}

// namespaceId: namespaceId of the NFT.
export async function confirmSellNFT(nftWallet, requestedSatPerByte, namespaceId, addressSeller) {
  await nftWallet.fetchBalance();
  await nftWallet.fetchTransactions();
  let nsUtxo = await getNamespaceUtxo(nftWallet, namespaceId);
  if (!nsUtxo) {
    throw new Error(loc.namespaces.update_key_err);
  }

  // IMPORTANT: we will use the same namespace address. Ideally, for
  // security/privacy reason, it is better to use a new address. But that
  // would create many addresses and slow down the update.
  const currentAddress = nsUtxo.address;
  const namespaceAddress = currentAddress;
  const key = createConfirmKey(txSeller);
  const value = '';
  const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);

  // Namespace needs at least 0.01 KVA.
  const namespaceValue = 1000000;
  let targets = [{
    address: namespaceAddress, value: namespaceValue,
    script: nsScript
  }];

  const transactions = nftWallet.getTransactions();
  let utxos = nftWallet.getUtxo();
  let nonNamespaceUtxos = await getNonNamespaceUxtos(nftWallet, transactions, utxos);
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
    const pubkey = nftWallet._getPubkeyByAddress(input.address);
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
  return {txConfirm: hexTx, feeConfirm: fee};
}

// nsNFTId: namespaceId of the NFT namespace to bid for.
// paymentAddress: the address to send the payment.
export async function createNFTBid(wallet, requestedSatPerByte, nsNFTId, paymentAddress, price, profile, displayName)
{
  await wallet.fetchBalance();
  await wallet.fetchTransactions();

  const nsTargetAddress = await wallet.getAddressAsync();

  // Remove the for sale info in the profile after transferring.
  const key = '\x01_KEVA_NS_';
  let value;
  if (profile) {
    let newProfile = { ...JSON.parse(profile) };
    delete newProfile.price;
    delete newProfile.desc;
    delete newProfile.addr;
    value = JSON.stringify(newProfile);
  } else {
    value = JSON.stringify({displayName});
  }

  const nsScript = getKeyValueUpdateScript(nsNFTId, nsTargetAddress, key, value);

  // Namespace needs at least 0.01 KVA.
  const namespaceValue = 1000000;
  let targets = [{
    address: nsTargetAddress, value: namespaceValue,
    script: nsScript
  }, {
    address: paymentAddress, value: price,
  }];

  const transactions = wallet.getTransactions();
  let utxos = wallet.getUtxo();
  let nonNamespaceUtxos = await getNonNamespaceUxtos(wallet, transactions, utxos);
  let { inputs, outputs, fee } = coinSelectAccumulative(nonNamespaceUtxos, targets, requestedSatPerByte);

  // inputs and outputs will be undefined if no solution was found
  if (!inputs || !outputs) {
    throw new Error('Not enough balance. Try sending smaller amount');
  }

  const psbt = new bitcoin.Psbt();
  psbt.setVersion(0x7100); // Kevacoin transaction.
  const sighashType = bitcoin.Transaction.SIGHASH_ALL | bitcoin.Transaction.SIGHASH_ANYONECANPAY;
  let keypairs = [];
  let lockedFund = {};
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
      sighashType: sighashType,
      index: input.vout,
      witnessUtxo: {
        script: p2sh.output,
        value: input.value,
      },
      redeemScript: p2wpkh.output,
    });

    let keyPair = bitcoin.ECPair.fromWIF(input.wif);
    keypairs.push(keyPair);

    // Add it to locked fund as we cannot use them again.
    //BlueApp.saveLockedFund(nsNFTId, input.txId, input.vout, input.value);
    lockedFund[`${input.txId}:${input.vout}`] = {
      namespaceId: nsNFTId,
      fund: input.value
    }
  }

  for (let i = 0; i < outputs.length; i++) {
    let output = outputs[i];
    if (!output.address) {
      // Change address.
      output.address = nsTargetAddress;
    }

    if (output.script) {
      // The namespace creation script.
      if (output.value != 1000000) {
        throw new Error('Key update script has incorrect value.');
      }
      psbt.addOutput({
        script: output.script,
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
    psbt.signInput(i, keypairs[i], [sighashType]);
    if (!psbt.validateSignaturesOfInput(i)) {
      throw new Error('Invalid signature for input #' + i);
    }
  }

  let offerTx = psbt.toBuffer();
  return {offerTx, fee, lockedFund};
}

export async function acceptNFTBid(walletId, partialTransaction, namespaceId) {
  const wallets = BlueApp.getWallets();
  let wallet = wallets.find(w => w.getID() == walletId);
  if (!wallet) {
    Toast.show('Cannot find wallet');
    return;
  }

  let partialTx = bitcoin.Psbt.fromHex(partialTransaction);
  let nsUtxo = await getNamespaceUtxo(wallet, namespaceId);
  if (!nsUtxo) {
    throw new Error('Cannot find namespace');
  }

  const keyPair = bitcoin.ECPair.fromWIF(nsUtxo.wif);
  const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey });
  const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh });
  const sighashType = bitcoin.Transaction.SIGHASH_ALL | bitcoin.Transaction.SIGHASH_ANYONECANPAY;

  partialTx.addInput({
    hash: nsUtxo.txId,
    sighashType: sighashType,
    index: nsUtxo.vout,
    witnessUtxo: {
      script: p2sh.output,
      value: nsUtxo.value,
    },
    redeemScript: p2wpkh.output,
  });

  const index = partialTx.inputCount - 1;
  partialTx.signInput(index, keyPair, [sighashType]);
  if (!partialTx.validateSignaturesOfInput(index)) {
    throw new Error('Invalid signature for input #' + index);
  }

  partialTx.finalizeAllInputs();
  let hexTx = partialTx.extractTransaction(true).toHex();
  return hexTx;
}

export function validateOffer(offerTx, paymentAddress, price) {
  try {
    const psbt = bitcoin.Psbt.fromBuffer(offerTx);
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction(true);

    let hasNS = false;
    let paymentValue = 0;
    let index;
    for (index = 0; index < tx.outs.length; index++) {
      const value = tx.outs[index].value;
      const script = tx.outs[index].script;
      if (script[0] == KEVA_OP_PUT) {
        hasNS = true;
        continue;
      }
      const address = bitcoin.address.fromOutputScript(tx.outs[index].script);
      if (address == paymentAddress) {
        paymentValue = value;
      }
    }
    if (hasNS && paymentValue) {
      return paymentValue / 100000000;
    }
    return 0;
  } catch (err) {
    console.log(err)
    return 0;
  }
}

export function decodePSBT(offerTx) {
  const psbt = bitcoin.Psbt.fromBuffer(offerTx);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction(true);
  const txdecoder = new Txdecoder(tx.toBuffer());
  return txdecoder.decode();
}