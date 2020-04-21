import { BitcoinUnit } from './bitcoinUnits';
import BigNumber from 'bignumber.js';
let loc = require('../loc');

const BlueElectrum = require('../BlueElectrum');

export const NetworkTransactionFeeType = Object.freeze({
  FAST: 'Fast',
  MEDIUM: 'MEDIUM',
  SLOW: 'SLOW',
  CUSTOM: 'CUSTOM',
});

export class NetworkTransactionFee {
  static StorageKey = 'NetworkTransactionFee';

  constructor(fastestFee = 1, halfHourFee = 1, hourFee = 1) {
    this.fastestFee = fastestFee;
    this.halfHourFee = halfHourFee;
    this.hourFee = hourFee;
  }
}

const FALLBACK_FAST_FEE     = 0.02;
const FALLBACK_MEDIUMN_FEE  = 0.01;
const FALLBACK_SLOW_FEE     = 0.005;

export default class NetworkTransactionFees {
  static recommendedFees() {
    return new Promise(async (resolve, reject) => {
      try {
        let response = await BlueElectrum.estimateFees();
        if (typeof response === 'object') {
          const fast = loc.formatBalanceWithoutSuffix(
            new BigNumber(response.fast > 0 ? response.fast : FALLBACK_FAST_FEE)
              .multipliedBy(100000)
              .toNumber()
              .toFixed(0),
            BitcoinUnit.SATS,
          );
          const medium = loc.formatBalanceWithoutSuffix(
            new BigNumber(response.medium > 0 ? response.medium : FALLBACK_MEDIUMN_FEE)
              .multipliedBy(100000)
              .toNumber()
              .toFixed(0),
            BitcoinUnit.SATS,
          );
          const slow = loc.formatBalanceWithoutSuffix(
            new BigNumber(response.slow > 0 ? response.slow : FALLBACK_SLOW_FEE)
              .multipliedBy(100000)
              .toNumber()
              .toFixed(0),
            BitcoinUnit.SATS,
          );
          const networkFee = new NetworkTransactionFee(fast, medium, slow);
          resolve(networkFee);
        } else {
          const networkFee = new NetworkTransactionFee(1, 1, 1);
          reject(networkFee);
        }
      } catch (err) {
        console.warn(err);
        const networkFee = new NetworkTransactionFee(1, 1, 1);
        reject(networkFee);
      }
    });
  }
}
