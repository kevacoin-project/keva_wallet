import bip39 from 'bip39';
import b58 from 'bs58check';
import { randomBytes } from './rng';
import { AbstractHDWallet } from './abstract-hd-wallet';
import { getNonNamespaceUxtosSync } from './keva-ops';
const bitcoin = require('bitcoinjs-lib');
const BlueElectrum = require('../BlueElectrum');
const HDNode = require('bip32');
const coinSelectAccumulative = require('coinselect/accumulative');
const coinSelectSplit = require('coinselect/split');
const reverse = require('buffer-reverse');
let BlueApp = require('../BlueApp');

const ABSURD_FEE = 10000000;
const MAX_FEE_RATE = 3500; // Satoshi Per-Byte

/**
 * Electrum - means that it utilizes Electrum protocol for blockchain data
 */
export class AbstractHDElectrumWallet extends AbstractHDWallet {
  static type = 'abstract';
  static typeReadable = 'abstract';
  static defaultRBFSequence = 2147483648; // 1 << 31, minimum for replaceable transactions as per BIP68
  static finalRBFSequence = 4294967295; // 0xFFFFFFFF

  constructor() {
    super();
    this._balances_by_external_index = {}; //  0 => { c: 0, u: 0 } // confirmed/unconfirmed
    this._balances_by_internal_index = {};

    this._txs_by_external_index = {};
    this._txs_by_internal_index = {};

    this._utxo = [];
  }

  async clearHistory() {
    this._balances_by_external_index = {};
    this._balances_by_internal_index = {};

    this._txs_by_external_index = {};
    this._txs_by_internal_index = {};

    this._utxo = [];
    await BlueApp.clearTxs();
    await BlueApp.saveToDisk();
  }

  skipSerialization(k, v) {
    if (k == 'cachedTransactions') {
      return [];
    }
    if (k == '_txs_by_external_index' || k == '_txs_by_internal_index') {
      return {}
    }
    return v;
  }

  async saveNonsecuredData(MMKV) {
    const walletId = this.getID();
    try {
      const externalIndexFile = '/_txs_by_external_index' + walletId;
      await await MMKV.setStringAsync(externalIndexFile, JSON.stringify(this._txs_by_external_index));

      const internalIndexFile = '/_txs_by_internal_index' + walletId;
      await await MMKV.setStringAsync(internalIndexFile, JSON.stringify(this._txs_by_internal_index));

    } catch (e) {
      console.warn(e);
    }
  }

  async loadNonsecuredData(MMKV) {
    const walletId = this.getID();
    this._txs_by_external_index = {};
    this._txs_by_internal_index = {};
    try {
      const externalIndexFile = '/_txs_by_external_index' + walletId;
      const externalIndex = await MMKV.getStringAsync(externalIndexFile);
      if (externalIndex) {
        this._txs_by_external_index = JSON.parse(externalIndex);
      }

      const internalIndexFile = '/_txs_by_internal_index' + walletId;
      const internalIndex = await MMKV.getStringAsync(internalIndexFile);
      if (internalIndex) {
        this._txs_by_internal_index = JSON.parse(internalIndex);
      }
    } catch (e) {
      this._txs_by_external_index = {};
      this._txs_by_internal_index = {};
      console.warn(e);
    }
  }

  /**
   * @inheritDoc
   */
  getBalance() {
    let ret = 0;
    for (let bal of Object.values(this._balances_by_external_index)) {
      ret += bal.c;
    }
    for (let bal of Object.values(this._balances_by_internal_index)) {
      ret += bal.c;
    }
    return ret + (this.getUnconfirmedBalance() < 0 ? this.getUnconfirmedBalance() : 0);
  }

  /**
   * @inheritDoc
   */
  timeToRefreshTransaction() {
    for (let tx of this.getTransactions()) {
      if (tx.confirmations < 7) return true;
    }
    return false;
  }

  /**
   *
   * @inheritDoc
   */
  getUnconfirmedBalance() {
    let ret = 0;
    for (let bal of Object.values(this._balances_by_external_index)) {
      ret += bal.u;
    }
    for (let bal of Object.values(this._balances_by_internal_index)) {
      ret += bal.u;
    }
    return ret;
  }

  async generate() {
    const buf = await randomBytes(32);
    this.secret = bip39.entropyToMnemonic(buf.toString('hex'));
  }

  _getExternalWIFByIndex(index) {
    return this._getWIFByIndex(false, index);
  }

  _getInternalWIFByIndex(index) {
    return this._getWIFByIndex(true, index);
  }

  /**
   * Get internal/external WIF by wallet index
   * @param {Boolean} internal
   * @param {Number} index
   * @returns {string|false} Either string WIF or FALSE if error happened
   * @private
   */
  _getWIFByIndex(internal, index) {
    if (!this.secret) return false;
    const mnemonic = this.secret;
    const seed = bip39.mnemonicToSeed(mnemonic);
    const root = HDNode.fromSeed(seed);
    const path = `m/84'/0'/0'/${internal ? 1 : 0}/${index}`;
    const child = root.derivePath(path);

    return child.toWIF();
  }

  _getNodeAddressByIndex(node, index) {
    index = index * 1; // cast to int
    if (node === 0) {
      if (this.external_addresses_cache[index]) return this.external_addresses_cache[index]; // cache hit
    }

    if (node === 1) {
      if (this.internal_addresses_cache[index]) return this.internal_addresses_cache[index]; // cache hit
    }

    if (node === 0 && !this._node0) {
      const xpub = this.constructor._zpubToXpub(this.getXpub());
      const hdNode = HDNode.fromBase58(xpub);
      this._node0 = hdNode.derive(node);
    }

    if (node === 1 && !this._node1) {
      const xpub = this.constructor._zpubToXpub(this.getXpub());
      const hdNode = HDNode.fromBase58(xpub);
      this._node1 = hdNode.derive(node);
    }

    let address;
    if (node === 0) {
      address = this.constructor._nodeToBech32SegwitAddress(this._node0.derive(index));
    }

    if (node === 1) {
      address = this.constructor._nodeToBech32SegwitAddress(this._node1.derive(index));
    }

    if (node === 0) {
      return (this.external_addresses_cache[index] = address);
    }

    if (node === 1) {
      return (this.internal_addresses_cache[index] = address);
    }
  }

  _getNodePubkeyByIndex(node, index) {
    index = index * 1; // cast to int

    if (node === 0 && !this._node0) {
      const xpub = this.constructor._zpubToXpub(this.getXpub());
      const hdNode = HDNode.fromBase58(xpub);
      this._node0 = hdNode.derive(node);
    }

    if (node === 1 && !this._node1) {
      const xpub = this.constructor._zpubToXpub(this.getXpub());
      const hdNode = HDNode.fromBase58(xpub);
      this._node1 = hdNode.derive(node);
    }

    if (node === 0) {
      return this._node0.derive(index).publicKey;
    }

    if (node === 1) {
      return this._node1.derive(index).publicKey;
    }
  }

  _getExternalAddressByIndex(index) {
    return this._getNodeAddressByIndex(0, index);
  }

  _getInternalAddressByIndex(index) {
    return this._getNodeAddressByIndex(1, index);
  }

  /**
   * Returning zpub actually, not xpub. Keeping same method name
   * for compatibility.
   *
   * @return {String} zpub
   */
  getXpub() {
    if (this._xpub) {
      return this._xpub; // cache hit
    }
    // first, getting xpub
    const mnemonic = this.secret;
    const seed = bip39.mnemonicToSeed(mnemonic);
    const root = HDNode.fromSeed(seed);

    const path = "m/84'/0'/0'";
    const child = root.derivePath(path).neutered();
    const xpub = child.toBase58();

    // bitcoinjs does not support zpub yet, so we just convert it from xpub
    let data = b58.decode(xpub);
    data = data.slice(4);
    data = Buffer.concat([Buffer.from('04b24746', 'hex'), data]);
    this._xpub = b58.encode(data);

    return this._xpub;
  }

  /**
   * @inheritDoc
   */
  async fetchTransactions() {
    if (this.cachedTransactions) {
      this.cachedTransactions = null;
    }
    // if txs are absent for some internal address in hierarchy - this is a sign
    // we should fetch txs for that address
    // OR if some address has unconfirmed balance - should fetch it's txs
    // OR some tx for address is unconfirmed
    // OR some tx has < 7 confirmations

    // fetching transactions in batch: first, getting batch history for all addresses,
    // then batch fetching all involved txids
    // finally, batch fetching txids of all inputs (needed to see amounts & addresses of those inputs)
    // then we combine it all together

    let addresses2fetch = [];

    for (let c = 0; c < this.next_free_address_index + this.gap_limit; c++) {
      // external addresses first
      let hasUnconfirmed = false;
      this._txs_by_external_index[c] = this._txs_by_external_index[c] || [];
      for (let tx of this._txs_by_external_index[c]) hasUnconfirmed = hasUnconfirmed || !tx.confirmations || tx.confirmations < 7;

      if (hasUnconfirmed || this._txs_by_external_index[c].length === 0 || this._balances_by_external_index[c].u !== 0) {
        addresses2fetch.push(this._getExternalAddressByIndex(c));
      }
    }

    for (let c = 0; c < this.next_free_change_address_index + this.gap_limit; c++) {
      // next, internal addresses
      let hasUnconfirmed = false;
      this._txs_by_internal_index[c] = this._txs_by_internal_index[c] || [];
      for (let tx of this._txs_by_internal_index[c]) hasUnconfirmed = hasUnconfirmed || !tx.confirmations || tx.confirmations < 7;

      if (hasUnconfirmed || this._txs_by_internal_index[c].length === 0 || this._balances_by_internal_index[c].u !== 0) {
        addresses2fetch.push(this._getInternalAddressByIndex(c));
      }
    }

    // first: batch fetch for all addresses histories
    let histories = await BlueElectrum.multiGetHistoryByAddress(addresses2fetch);
    let txs = {};
    for (let history of Object.values(histories)) {
      for (let tx of history) {
        txs[tx.tx_hash] = tx; //tx content: {tx_hash: <hash>, height: <height>}
      }
    }

    // next, batch fetching each txid we got
    const txList = Object.keys(txs);
    let txdatas = await BlueElectrum.multiGetTransactionInfoByTxid(txList, 50, true);
    let height = await BlueElectrum.blockchainBlock_count();
    // Add the confirmation info
    Object.keys(txdatas).forEach((txid, i) => {
      const txHeight = txs[txid].height;
      txdatas[txid].confirmations = (txHeight > 0) ? (height - txHeight + 1) : 0;
      txdatas[txid].txid = txid;
    });

    // now purge all unconfirmed txs from internal hashmaps, since some may be evicted from mempool because they became invalid
    // or replaced. hashmaps are going to be re-populated anyways, since we fetched TXs for addresses with unconfirmed TXs
    for (let c = 0; c < this.next_free_address_index + this.gap_limit; c++) {
      this._txs_by_external_index[c] = this._txs_by_external_index[c].filter(tx => !!tx.confirmations);
    }
    for (let c = 0; c < this.next_free_change_address_index + this.gap_limit; c++) {
      this._txs_by_internal_index[c] = this._txs_by_internal_index[c].filter(tx => !!tx.confirmations);
    }

    // now, we need to put transactions in all relevant `cells` of internal hashmaps: this._txs_by_internal_index && this._txs_by_external_index
    for (let c = 0; c < this.next_free_address_index + this.gap_limit; c++) {
      for (let tx of Object.values(txdatas)) {
        for (let index = 0; index < tx.i.length; index = index + 2) {
          const address = tx.i[index];
          if (address && address == this._getExternalAddressByIndex(c)) {
            // this TX is related to our address
            this._txs_by_external_index[c] = this._txs_by_external_index[c] || [];

            // trying to replace tx if it exists already (because it has lower confirmations, for example)
            let replaced = false;
            for (let cc = 0; cc < this._txs_by_external_index[c].length; cc++) {
              if (this._txs_by_external_index[c][cc].txid === tx.txid) {
                replaced = true;
                this._txs_by_external_index[c][cc] = tx;
              }
            }
            if (!replaced) this._txs_by_external_index[c].push(tx);
          }
        }
        for (let index = 0; index < tx.o.length; index = index + 2) {
          const address = tx.o[index];
          if (address == this._getExternalAddressByIndex(c)) {
            // this TX is related to our address
            this._txs_by_external_index[c] = this._txs_by_external_index[c] || [];

            // trying to replace tx if it exists already (because it has lower confirmations, for example)
            let replaced = false;
            for (let cc = 0; cc < this._txs_by_external_index[c].length; cc++) {
              if (this._txs_by_external_index[c][cc].txid === tx.txid) {
                replaced = true;
                this._txs_by_external_index[c][cc] = tx;
              }
            }
            if (!replaced) this._txs_by_external_index[c].push(tx);
          }
        }
      }
    }

    for (let c = 0; c < this.next_free_change_address_index + this.gap_limit; c++) {
      for (let tx of Object.values(txdatas)) {
        for (let index = 0; index < tx.i.length; index = index + 2) {
          const address = tx.i[index];
          if (address && address == this._getInternalAddressByIndex(c)) {
            // this TX is related to our address
            this._txs_by_internal_index[c] = this._txs_by_internal_index[c] || [];

            // trying to replace tx if it exists already (because it has lower confirmations, for example)
            let replaced = false;
            for (let cc = 0; cc < this._txs_by_internal_index[c].length; cc++) {
              if (this._txs_by_internal_index[c][cc].txid === tx.txid) {
                replaced = true;
                this._txs_by_internal_index[c][cc] = tx;
              }
            }
            if (!replaced) this._txs_by_internal_index[c].push(tx);
          }
        }
        for (let index = 0; index < tx.o.length; index = index + 2) {
          const address = tx.o[index];
          if (address == this._getInternalAddressByIndex(c)) {
            // this TX is related to our address
            this._txs_by_internal_index[c] = this._txs_by_internal_index[c] || [];

            // trying to replace tx if it exists already (because it has lower confirmations, for example)
            let replaced = false;
            for (let cc = 0; cc < this._txs_by_internal_index[c].length; cc++) {
              if (this._txs_by_internal_index[c][cc].txid === tx.txid) {
                replaced = true;
                this._txs_by_internal_index[c][cc] = tx;
              }
            }
            if (!replaced) this._txs_by_internal_index[c].push(tx);
          }
        }
      }
    }

    this._lastTxFetch = +new Date();
  }

  getTransactions() {
    if (this.cachedTransactions) {
      return this.cachedTransactions;
    }

    let txs = [];

    for (let addressTxs of Object.values(this._txs_by_external_index)) {
      txs = txs.concat(addressTxs);
    }
    for (let addressTxs of Object.values(this._txs_by_internal_index)) {
      txs = txs.concat(addressTxs);
    }

    let ret = [];
    for (let tx of txs) {
      tx.received = tx.t * 1000; //tx.t is blocktime
      if (tx.t < 0) tx.received = +new Date() - 30 * 1000; // unconfirmed
      tx.confirmations = tx.confirmations || 0; // unconfirmed
      tx.hash = tx.txid;
      tx.value = 0;

      for (let index = 0; index < tx.i.length; index = index + 2) {
        const address = tx.i[index];
        // if input (spending) goes from our address - we are loosing!
        if (address && this.weOwnAddress(address)) {
          const value = tx.i[index + 1];
          tx.value -= value;
        }
      }

      for (let index = 0; index < tx.o.length; index = index + 2) {
        const address = tx.o[index];
        // when output goes to our address - this means we are gaining!
        if (address && this.weOwnAddress(address)) {
          const value = tx.o[index + 1];
          tx.value += value;
        }
      }
      ret.push(tx);
    }

    // now, deduplication:
    let usedTxIds = {};
    let ret2 = [];
    for (let tx of ret) {
      if (!usedTxIds[tx.txid]) ret2.push(tx);
      usedTxIds[tx.txid] = 1;
    }

    this.cachedTransactions = ret2.sort(function(a, b) {
      return b.received - a.received;
    });
    return this.cachedTransactions;
  }

  async _binarySearchIterationForInternalAddress(index) {
    const gerenateChunkAddresses = chunkNum => {
      let ret = [];
      for (let c = this.gap_limit * chunkNum; c < this.gap_limit * (chunkNum + 1); c++) {
        ret.push(this._getInternalAddressByIndex(c));
      }
      return ret;
    };

    let lastChunkWithUsedAddressesNum = null;
    let lastHistoriesWithUsedAddresses = null;
    for (let c = 0; c < Math.round(index / this.gap_limit); c++) {
      let histories = await BlueElectrum.multiGetHistoryByAddress(gerenateChunkAddresses(c));
      if (this.constructor._getTransactionsFromHistories(histories).length > 0) {
        // in this particular chunk we have used addresses
        lastChunkWithUsedAddressesNum = c;
        lastHistoriesWithUsedAddresses = histories;
      } else {
        // empty chunk. no sense searching more chunks
        break;
      }
    }

    let lastUsedIndex = 0;

    if (lastHistoriesWithUsedAddresses) {
      // now searching for last used address in batch lastChunkWithUsedAddressesNum
      for (
        let c = lastChunkWithUsedAddressesNum * this.gap_limit;
        c < lastChunkWithUsedAddressesNum * this.gap_limit + this.gap_limit;
        c++
      ) {
        let address = this._getInternalAddressByIndex(c);
        if (lastHistoriesWithUsedAddresses[address] && lastHistoriesWithUsedAddresses[address].length > 0) {
          lastUsedIndex = Math.max(c, lastUsedIndex) + 1; // point to next, which is supposed to be unsued
        }
      }
    }

    return lastUsedIndex;
  }

  async _binarySearchIterationForExternalAddress(index) {
    const gerenateChunkAddresses = chunkNum => {
      let ret = [];
      for (let c = this.gap_limit * chunkNum; c < this.gap_limit * (chunkNum + 1); c++) {
        ret.push(this._getExternalAddressByIndex(c));
      }
      return ret;
    };

    let lastChunkWithUsedAddressesNum = null;
    let lastHistoriesWithUsedAddresses = null;
    for (let c = 0; c < Math.round(index / this.gap_limit); c++) {
      let histories = await BlueElectrum.multiGetHistoryByAddress(gerenateChunkAddresses(c));
      if (this.constructor._getTransactionsFromHistories(histories).length > 0) {
        // in this particular chunk we have used addresses
        lastChunkWithUsedAddressesNum = c;
        lastHistoriesWithUsedAddresses = histories;
      } else {
        // empty chunk. no sense searching more chunks
        break;
      }
    }

    let lastUsedIndex = 0;

    if (lastHistoriesWithUsedAddresses) {
      // now searching for last used address in batch lastChunkWithUsedAddressesNum
      for (
        let c = lastChunkWithUsedAddressesNum * this.gap_limit;
        c < lastChunkWithUsedAddressesNum * this.gap_limit + this.gap_limit;
        c++
      ) {
        let address = this._getExternalAddressByIndex(c);
        if (lastHistoriesWithUsedAddresses[address] && lastHistoriesWithUsedAddresses[address].length > 0) {
          lastUsedIndex = Math.max(c, lastUsedIndex) + 1; // point to next, which is supposed to be unsued
        }
      }
    }

    return lastUsedIndex;
  }

  async fetchBalance() {
    try {
      if (this.next_free_change_address_index === 0 && this.next_free_address_index === 0) {
        // doing binary search for last used address:
        this.next_free_change_address_index = await this._binarySearchIterationForInternalAddress(1000);
        this.next_free_address_index = await this._binarySearchIterationForExternalAddress(1000);
      } // end rescanning fresh wallet

      // finally fetching balance
      await this._fetchBalance();
    } catch (err) {
      console.warn(err);
    }
  }

  async _fetchBalance() {
    // probing future addressess in hierarchy whether they have any transactions, in case
    // our 'next free addr' pointers are lagging behind
    let tryAgain = false;
    let txs = await BlueElectrum.getTransactionsByAddress(
      this._getExternalAddressByIndex(this.next_free_address_index + this.gap_limit - 1),
    );
    if (txs.length > 0) {
      // whoa, someone uses our wallet outside! better catch up
      this.next_free_address_index += this.gap_limit;
      tryAgain = true;
    }

    txs = await BlueElectrum.getTransactionsByAddress(
      this._getInternalAddressByIndex(this.next_free_change_address_index + this.gap_limit - 1),
    );
    if (txs.length > 0) {
      this.next_free_change_address_index += this.gap_limit;
      tryAgain = true;
    }

    // FIXME: refactor me ^^^ can be batched in single call. plus not just couple of addresses, but all between [ next_free .. (next_free + gap_limit) ]

    if (tryAgain) return this._fetchBalance();

    // next, business as usuall. fetch balances

    let addresses2fetch = [];

    // generating all involved addresses.
    // basically, refetch all from index zero to maximum. doesnt matter
    // since we batch them 100 per call

    // external
    for (let c = 0; c < this.next_free_address_index + this.gap_limit; c++) {
      addresses2fetch.push(this._getExternalAddressByIndex(c));
    }

    // internal
    for (let c = 0; c < this.next_free_change_address_index + this.gap_limit; c++) {
      addresses2fetch.push(this._getInternalAddressByIndex(c));
    }

    let balances = await BlueElectrum.multiGetBalanceByAddress(addresses2fetch);

    // converting to a more compact internal format
    for (let c = 0; c < this.next_free_address_index + this.gap_limit; c++) {
      let addr = this._getExternalAddressByIndex(c);
      if (balances.addresses[addr]) {
        // first, if balances differ from what we store - we delete transactions for that
        // address so next fetchTransactions() will refetch everything
        if (this._balances_by_external_index[c]) {
          if (
            this._balances_by_external_index[c].c !== balances.addresses[addr].confirmed ||
            this._balances_by_external_index[c].u !== balances.addresses[addr].unconfirmed
          ) {
            delete this._txs_by_external_index[c];
          }
        }
        // update local representation of balances on that address:
        this._balances_by_external_index[c] = {
          c: balances.addresses[addr].confirmed,
          u: balances.addresses[addr].unconfirmed,
        };
      }
    }
    for (let c = 0; c < this.next_free_change_address_index + this.gap_limit; c++) {
      let addr = this._getInternalAddressByIndex(c);
      if (balances.addresses[addr]) {
        // first, if balances differ from what we store - we delete transactions for that
        // address so next fetchTransactions() will refetch everything
        if (this._balances_by_internal_index[c]) {
          if (
            this._balances_by_internal_index[c].c !== balances.addresses[addr].confirmed ||
            this._balances_by_internal_index[c].u !== balances.addresses[addr].unconfirmed
          ) {
            delete this._txs_by_internal_index[c];
          }
        }
        // update local representation of balances on that address:
        this._balances_by_internal_index[c] = {
          c: balances.addresses[addr].confirmed,
          u: balances.addresses[addr].unconfirmed,
        };
      }
    }

    this._lastBalanceFetch = +new Date();
  }

  async fetchUtxo() {
    // fetching utxo of addresses that only have some balance
    let addressess = [];

    // considering confirmed balance:
    for (let c = 0; c < this.next_free_address_index + this.gap_limit; c++) {
      if (this._balances_by_external_index[c] && this._balances_by_external_index[c].c && this._balances_by_external_index[c].c > 0) {
        addressess.push(this._getExternalAddressByIndex(c));
      }
    }
    for (let c = 0; c < this.next_free_change_address_index + this.gap_limit; c++) {
      if (this._balances_by_internal_index[c] && this._balances_by_internal_index[c].c && this._balances_by_internal_index[c].c > 0) {
        addressess.push(this._getInternalAddressByIndex(c));
      }
    }

    // considering UNconfirmed balance:
    for (let c = 0; c < this.next_free_address_index + this.gap_limit; c++) {
      if (this._balances_by_external_index[c] && this._balances_by_external_index[c].u && this._balances_by_external_index[c].u > 0) {
        addressess.push(this._getExternalAddressByIndex(c));
      }
    }
    for (let c = 0; c < this.next_free_change_address_index + this.gap_limit; c++) {
      if (this._balances_by_internal_index[c] && this._balances_by_internal_index[c].u && this._balances_by_internal_index[c].u > 0) {
        addressess.push(this._getInternalAddressByIndex(c));
      }
    }

    // note: we could remove checks `.c` and `.u` to simplify code, but the resulting `addressess` array would be bigger, thus bigger batch
    // to fetch (or maybe even several fetches), which is not critical but undesirable.
    // anyway, result has `.confirmations` property for each utxo, so outside caller can easily filter out unconfirmed if he wants to

    addressess = [...new Set(addressess)]; // deduplicate just for any case

    this._utxo = [];
    for (let arr of Object.values(await BlueElectrum.multiGetUtxoByAddress(addressess))) {
      this._utxo = this._utxo.concat(arr);
    }

    // backward compatibility TODO: remove when we make sure `.utxo` is not used
    this.utxo = this._utxo;
    // this belongs in `.getUtxo()`
    for (let u of this.utxo) {
      u.txid = u.txId;
      u.amount = u.value;
      u.wif = this._getWifForAddress(u.address);
      u.confirmations = u.height ? 1 : 0;
    }

    this.utxo = this.utxo.sort((a, b) => a.amount - b.amount);
    // more consistent, so txhex in unit tests wont change
  }

  /**
   * Getter for previously fetched UTXO. For example:
   *     [ { height: 0,
   *    value: 666,
   *    address: 'string',
   *    txId: 'string',
   *    vout: 1,
   *    txid: 'string',
   *    amount: 666,
   *    wif: 'string',
   *    confirmations: 0 } ]
   *
   * @returns {[]}
   */
  getUtxo() {
    // Must call fetchUtxo before calling this function, otherwise it will be empty.
    return this._utxo;
  }

  _getDerivationPathByAddress(address, BIP = 84) {
    const path = `m/${BIP}'/0'/0'`;
    for (let c = 0; c < this.next_free_address_index + this.gap_limit; c++) {
      if (this._getExternalAddressByIndex(c) === address) return path + '/0/' + c;
    }
    for (let c = 0; c < this.next_free_change_address_index + this.gap_limit; c++) {
      if (this._getInternalAddressByIndex(c) === address) return path + '/1/' + c;
    }

    return false;
  }

  /**
   *
   * @param address {string} Address that belongs to this wallet
   * @returns {Buffer|boolean} Either buffer with pubkey or false
   */
  _getPubkeyByAddress(address) {
    for (let c = 0; c < this.next_free_address_index + this.gap_limit; c++) {
      if (this._getExternalAddressByIndex(c) === address) return this._getNodePubkeyByIndex(0, c);
    }
    for (let c = 0; c < this.next_free_change_address_index + this.gap_limit; c++) {
      if (this._getInternalAddressByIndex(c) === address) return this._getNodePubkeyByIndex(1, c);
    }

    return false;
  }

  weOwnAddress(address) {
    for (let c = 0; c < this.next_free_address_index + this.gap_limit; c++) {
      if (this._getExternalAddressByIndex(c) === address) return true;
    }
    for (let c = 0; c < this.next_free_change_address_index + this.gap_limit; c++) {
      if (this._getInternalAddressByIndex(c) === address) return true;
    }
    return false;
  }

  /**
   *
   * @param utxos {Array.<{vout: Number, value: Number, txId: String, address: String}>} List of spendable utxos
   * @param targets {Array.<{value: Number, address: String}>} Where coins are going. If theres only 1 target and that target has no value - this will send MAX to that address (respecting fee rate)
   * @param feeRate {Number} satoshi per byte
   * @param changeAddress {String} Excessive coins will go back to that address
   * @param sequence {Number} Used in RBF
   * @param skipSigning {boolean} Whether we should skip signing, use returned `psbt` in that case
   * @param masterFingerprint {number} Decimal number of wallet's master fingerprint
   * @returns {{outputs: Array, tx: Transaction, inputs: Array, fee: Number, psbt: Psbt}}
   */
  createTransaction(utxos, targets, feeRateSatPerByte, changeAddress, sequence, skipSigning = false, masterFingerprint) {
    let feeRate = feeRateSatPerByte;
    // Limit the feeRate
    if (feeRate >= MAX_FEE_RATE) {
      feeRate = MAX_FEE_RATE;
    }

    if (!changeAddress) throw new Error('No change address provided');
    sequence = sequence || AbstractHDElectrumWallet.defaultRBFSequence;

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
    let keypairs = {};
    let values = {};

    inputs.forEach(input => {
      let keyPair;
      if (!skipSigning) {
        // skiping signing related stuff
        keyPair = bitcoin.ECPair.fromWIF(this._getWifForAddress(input.address));
        keypairs[c] = keyPair;
      }
      values[c] = input.value;
      c++;
      if (!skipSigning) {
        // skiping signing related stuff
        if (!input.address || !this._getWifForAddress(input.address)) throw new Error('Internal error: no address or WIF to sign input');
      }

      let masterFingerprintBuffer;
      if (masterFingerprint) {
        let masterFingerprintHex = Number(masterFingerprint).toString(16);
        if (masterFingerprintHex.length < 8) masterFingerprintHex = '0' + masterFingerprintHex; // conversion without explicit zero might result in lost byte
        const hexBuffer = Buffer.from(masterFingerprintHex, 'hex');
        masterFingerprintBuffer = Buffer.from(reverse(hexBuffer));
      } else {
        masterFingerprintBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      }
      // this is not correct fingerprint, as we dont know real fingerprint - we got zpub with 84/0, but fingerpting
      // should be from root. basically, fingerprint should be provided from outside  by user when importing zpub

      psbt = this._addPsbtInput(psbt, input, sequence, masterFingerprintBuffer);
    });

    outputs.forEach(output => {
      // if output has no address - this is change output
      let change = false;
      if (!output.address) {
        change = true;
        output.address = changeAddress;
      }

      let path = this._getDerivationPathByAddress(output.address);
      let pubkey = this._getPubkeyByAddress(output.address);
      let masterFingerprintBuffer;

      if (masterFingerprint) {
        let masterFingerprintHex = Number(masterFingerprint).toString(16);
        if (masterFingerprintHex.length < 8) masterFingerprintHex = '0' + masterFingerprintHex; // conversion without explicit zero might result in lost byte
        const hexBuffer = Buffer.from(masterFingerprintHex, 'hex');
        masterFingerprintBuffer = Buffer.from(reverse(hexBuffer));
      } else {
        masterFingerprintBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      }

      // this is not correct fingerprint, as we dont know realfingerprint - we got zpub with 84/0, but fingerpting
      // should be from root. basically, fingerprint should be provided from outside  by user when importing zpub

      let outputData = {
        address: output.address,
        value: output.value,
      };

      if (change) {
        outputData['bip32Derivation'] = [
          {
            masterFingerprint: masterFingerprintBuffer,
            path,
            pubkey,
          },
        ];
      }

      psbt.addOutput(outputData);
    });

    if (!skipSigning) {
      // skiping signing related stuff
      for (let cc = 0; cc < c; cc++) {
        psbt.signInput(cc, keypairs[cc]);
      }
    }

    let tx;
    if (!skipSigning) {
      // FIXME: use a coinselect algorithm that supports SegWit.
      tx = psbt.finalizeAllInputs().extractTransaction(true);
    }
    return { tx, inputs, outputs, fee, psbt };
  }

  _addPsbtInput(psbt, input, sequence, masterFingerprintBuffer) {
    const pubkey = this._getPubkeyByAddress(input.address);
    const path = this._getDerivationPathByAddress(input.address);
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey });

    psbt.addInput({
      hash: input.txId,
      index: input.vout,
      sequence,
      bip32Derivation: [
        {
          masterFingerprint: masterFingerprintBuffer,
          path,
          pubkey,
        },
      ],
      witnessUtxo: {
        script: p2wpkh.output,
        value: input.value,
      },
    });

    return psbt;
  }

  /**
   * Combines 2 PSBTs into final transaction from which you can
   * get HEX and broadcast
   *
   * @param utf8one {string}
   * @param utf8two {string}
   * @returns {Transaction}
   */
  combinePsbt(utf8one, utf8two) {
    const final1 = bitcoin.Psbt.fromutf8(utf8one);
    const final2 = bitcoin.Psbt.fromutf8(utf8two);
    final1.combine(final2);
    return final1.finalizeAllInputs().extractTransaction();
  }

  /**
   * Creates Segwit Bech32 Kevacoin address
   *
   * @param hdNode
   * @returns {String}
   */
  static _nodeToBech32SegwitAddress(hdNode) {
    return bitcoin.payments.p2wpkh({
      pubkey: hdNode.publicKey,
    }).address;
  }

  /**
   * Converts zpub to xpub
   *
   * @param {String} zpub
   * @returns {String} xpub
   */
  static _zpubToXpub(zpub) {
    let data = b58.decode(zpub);
    data = data.slice(4);
    data = Buffer.concat([Buffer.from('0488b21e', 'hex'), data]);

    return b58.encode(data);
  }

  static _getTransactionsFromHistories(histories) {
    let txs = [];
    for (let history of Object.values(histories)) {
      for (let tx of history) {
        txs.push(tx);
      }
    }
    return txs;
  }

  /**
   * Probes zero address in external hierarchy for transactions, if there are any returns TRUE.
   * Zero address is a pretty good indicator, since its a first one to fund the wallet. How can you use the wallet and
   * not fund it first?
   *
   * @returns {Promise<boolean>}
   */
  async wasEverUsed() {
    let txs = await BlueElectrum.getTransactionsByAddress(this._getExternalAddressByIndex(0));
    return txs.length > 0;
  }
}
