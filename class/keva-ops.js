const ElectrumCli = require('electrum-client')
const bitcoin = require('bitcoinjs-lib');
const base58check = require('bs58check')

export const KEVA_OP_NAMESPACE = 0xd0;
export const KEVA_OP_PUT       = 0xd1;
export const KEVA_OP_DELETE    = 0xd2;

const convert = (from, to) => str => Buffer.from(str, from).toString(to)
const utf8ToHex = convert('utf8', 'hex')
const hexToUtf8 = convert('hex', 'utf8')

export function reverse (src) {
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

export async function createKevaNamespace(wallet, requestedSatPerByte) {
    await wallet.fetchUtxo();
    const namespaceAddress = await wallet.getChangeAddressAsync();
    const changeAddress = await wallet.getChangeAddressAsync();

    // Namespace needs at least 0.01 KVA.
    const namespaceValue = new BigNumber(0.01).multipliedBy(100000000).toNumber();
    let targets = [{ address: namespaceAddress, value: namespaceValue}];

    let { tx, fee, psbt } = wallet.createTransaction(
        wallet.getUtxo(),
        targets,
        requestedSatPerByte,
        changeAddress,
        this.state.isTransactionReplaceable ? HDSegwitBech32Wallet.defaultRBFSequence : HDSegwitBech32Wallet.finalRBFSequence,
    );
}