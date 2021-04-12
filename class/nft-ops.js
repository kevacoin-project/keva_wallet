const bitcoin = require('bitcoinjs-lib');
const bip65 = require('bip65');
const base58check = require('bs58check')
const coinSelectAccumulative = require('coinselect/accumulative');
let loc = require('../loc');
const BlueApp = require('../BlueApp');

import {
    createBidKey, getKeyValueUpdateScript, getNamespaceUtxo, getNonNamespaceUxtos
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

// m, n: hours.
function getNFTBidScript(myAddressPubKeyHash160, paymentAddressPubKeyHash160, n, m) {
    const lockTime = bip65.encode({ utc: utcNow() + 3600 * n });
    const extracLockTime = bip65.encode({ utc: utcNow() + 3600 * (m + n) });
    let bscript = bitcoin.script;
    let timelockRedeemScript = bscript.compile([
        bscript.OPS.OP_IF,
            bscript.number.encode(lockTime),
            bscript.OPS.OP_CHECKLOCKTIMEVERIFY,
            bscript.OPS.OP_DROP,
            bscript.OPS.OP_DUP,
            bscript.OPS.OP_HASH160,
            myAddressPubKeyHash160,
            bscript.OPS.OP_EQUALVERIFY,
            bscript.OPS.OP_CHECKSIGVERIFY,
        bscript.OPS.OP_ELSE,
            bscript.number.encode(extracLockTime),
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
            bscript.OPS.OP_CHECKSIGVERIFY,
        bscript.OPS.OP_ENDIF,
    ]);
    return timelockRedeemScript;
}


// nsNFTId: namespaceId of the NFT namespace to bid for.
// paymentAddress: the address to send the payment.
// n: future hours
// m: future hours in addition to n.
export async function createNFTBid(wallet, requestedSatPerByte, namespaceId,
        amount, nsNFTId, offerTxId, paymentAddress, paymentAddressPubKeyHash160, n, m)
{
    await wallet.fetchBalance();
    await wallet.fetchTransactions();
    let nsUtxo = await getNamespaceUtxo(wallet, namespaceId);
    if (!nsUtxo) {
      throw new Error(loc.namespaces.update_key_err);
    }
    console.log('ZZZ nsUXto>>>>>>>>>>>>>>>>>>>')
    console.log(nsUtxo)

    const key = createBidKey(offerTxId);
    // IMPORTANT: re-use the namespace address, security/privacy trade-off.
    const namespaceAddress = nsUtxo.address;
    const value = "TBD - the partially signed bid tx again";
    const nsScript = getKeyValueUpdateScript(namespaceId, namespaceAddress, key, value);

    let bcrypto = bitcoin.crypto;
    const namespaceAddressPubKeyHash160 = bcrypto.hash160(bitcoin.ECPair.fromWIF(nsUtxo.wif).publicKey);
    const lockRedeemScript = getNFTBidScript(namespaceAddressPubKeyHash160, paymentAddressPubKeyHash160, n, m);
    console.log('ZZZ lockRedeemScript -----')
    console.log(lockRedeemScript.toString('hex'))

    /*
    const payment = bitcoin.payments.p2sh({
        redeem: { output: lockRedeemScript }
    });
    */
    const witnessHash = bcrypto.hash160(lockRedeemScript)
    const redeemScript = Buffer.concat([Buffer.from('0014', 'hex'), witnessHash]);
    const payment = bitcoin.payments.p2sh({
      redeem: { output: redeemScript }
    });

    const lockRedeemScriptAddress = payment.address;
    console.log('ZZZ lockRedeem payment:----- ')
    console.log(JSON.stringify(payment))
    console.log('ZZZ lockRedeemScriptAddress: ' + lockRedeemScriptAddress)

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
