import { LegacyWallet } from './legacy-wallet';
import { getNonNamespaceUxtosSync } from './keva-ops';
const bitcoin = require('bitcoinjs-lib');
const coinSelectAccumulative = require('coinselect/accumulative');
const coinSelectSplit = require('coinselect/split');
const loc = require('../loc');

const ABSURD_FEE = 10000000;

/**
 * Creates Segwit P2SH Kevacoin address
 * @param pubkey
 * @param network
 * @returns {String}
 */
function pubkeyToP2shSegwitAddress(pubkey, network) {
  network = network || bitcoin.networks.bitcoin;
  const { address } = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({ pubkey, network }),
    network,
  });
  return address;
}

export class SegwitP2SHWallet extends LegacyWallet {
  static type = 'segwitP2SH';
  static typeReadable = loc.wallets.list.single_address;

  static witnessToAddress(witness) {
    const pubKey = Buffer.from(witness, 'hex');
    return pubkeyToP2shSegwitAddress(pubKey);
  }

  /**
   * Converts script pub key to p2sh address if it can. Returns FALSE if it cant.
   *
   * @param scriptPubKey
   * @returns {boolean|string} Either p2sh address or false
   */
  static scriptPubKeyToAddress(scriptPubKey) {
    const scriptPubKey2 = Buffer.from(scriptPubKey, 'hex');
    let ret;
    try {
      ret = bitcoin.payments.p2sh({
        output: scriptPubKey2,
        network: bitcoin.networks.bitcoin,
      }).address;
    } catch (_) {
      return false;
    }
    return ret;
  }

  getAddress() {
    if (this._address) return this._address;
    let address;
    try {
      let keyPair = bitcoin.ECPair.fromWIF(this.secret);
      let pubKey = keyPair.publicKey;
      if (!keyPair.compressed) {
        console.warn('only compressed public keys are good for segwit');
        return false;
      }
      address = pubkeyToP2shSegwitAddress(pubKey);
    } catch (err) {
      return false;
    }
    this._address = address;

    return this._address;
  }

  /**
   *
   * @param utxos {Array.<{vout: Number, value: Number, txId: String, address: String, txhex: String, }>} List of spendable utxos
   * @param targets {Array.<{value: Number, address: String}>} Where coins are going. If theres only 1 target and that target has no value - this will send MAX to that address (respecting fee rate)
   * @param feeRate {Number} satoshi per byte
   * @param changeAddress {String} Excessive coins will go back to that address
   * @param sequence {Number} Used in RBF
   * @param skipSigning {boolean} Whether we should skip signing, use returned `psbt` in that case
   * @param masterFingerprint {number} Decimal number of wallet's master fingerprint
   * @returns {{outputs: Array, tx: Transaction, inputs: Array, fee: Number, psbt: Psbt}}
   */
  createTransaction(utxos, targets, feeRate, changeAddress, sequence, skipSigning = false, masterFingerprint) {
    if (!changeAddress) throw new Error('No change address provided');
    sequence = sequence || 0xffffffff; // disable RBF by default

    let algo = coinSelectAccumulative;
    if (targets.length === 1 && targets[0] && !targets[0].value) {
      // we want to send MAX
      algo = coinSelectSplit;
    }

    const transactions = this.getTransactions();
    let nonNamespaceUtxos = getNonNamespaceUxtosSync(transactions, utxos);
    let { inputs, outputs, fee } = algo(nonNamespaceUtxos, targets, feeRate);

    if (fee >= ABSURD_FEE) {
      // The network rule doesn't allow fee more than ABSURD_FEE. We
      // have to reduce the feeRate.
      feeRate = Math.floor((ABSURD_FEE / fee) * feeRate);
      ({ inputs, outputs, fee } = algo(nonNamespaceUtxos, targets, feeRate))
    }

    while (fee >= ABSURD_FEE) {
      // Still too big - brute force it.
      feeRate = feeRate - 20;
      ({ inputs, outputs, fee } = algo(nonNamespaceUtxos, targets, feeRate))
    }

    // .inputs and .outputs will be undefined if no solution was found
    if (!inputs || !outputs) {
      throw new Error('Not enough balance. Try sending smaller amount');
    }

    let psbt = new bitcoin.Psbt();

    let c = 0;
    let values = {};
    let keyPair;

    inputs.forEach(input => {
      if (!skipSigning) {
        // skiping signing related stuff
        keyPair = bitcoin.ECPair.fromWIF(this.secret); // secret is WIF
      }
      values[c] = input.value;
      c++;

      const pubkey = keyPair.publicKey;
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey });
      let p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh });

      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        sequence,
        witnessUtxo: {
          script: p2sh.output,
          value: input.value,
        },
        redeemScript: p2wpkh.output,
      });
    });

    outputs.forEach(output => {
      // if output has no address - this is change output
      if (!output.address) {
        output.address = changeAddress;
      }

      let outputData = {
        address: output.address,
        value: output.value,
      };

      psbt.addOutput(outputData);
    });

    if (!skipSigning) {
      // skiping signing related stuff
      for (let cc = 0; cc < c; cc++) {
        psbt.signInput(cc, keyPair);
      }
    }

    let tx;
    if (!skipSigning) {
      // FIXME: use a coinselect algorithm that supports SegWit.
      tx = psbt.finalizeAllInputs().extractTransaction(true);
    }
    return { tx, inputs, outputs, fee, psbt };
  }

  allowSendMax() {
    return true;
  }
}
