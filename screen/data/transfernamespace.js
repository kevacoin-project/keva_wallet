import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  TextInput,
} from 'react-native';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
const utils = require('../../util');
import {
  BlueNavigationStyle,
  BlueLoading,
  BlueBigCheckmark,
  BlueAddressInput,
  BlueText,
} from '../../BlueComponents';
const { width } = Dimensions.get('window');
const loc = require('../../loc');
let BlueApp = require('../../BlueApp');
let BlueElectrum = require('../../BlueElectrum');
import { FALLBACK_DATA_PER_BYTE_FEE } from '../../models/networkTransactionFees';

import { connect } from 'react-redux'
import { updateKeyValue, findMyNamespaces } from '../../class/keva-ops';
import StepModal from "../../common/StepModalWizard";
import Biometric from '../../class/biometrics';

import BitcoinBIP70TransactionDecode from '../../bip70/bip70';
import { BitcoinUnit } from '../../models/bitcoinUnits';
import { BitcoinTransaction } from '../../models/bitcoinTransactionInfo';
import DeeplinkSchemaMatch from '../../class/deeplink-schema-match';

import { setNamespaceList } from '../../actions'

const btcAddressRx = /^[a-zA-Z0-9]{26,35}$/;

class TransferNamespace extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      changes: false,
      saving: false,
      key: '__WALLET_TRANSFER__' + Date.now(),
      value: '',
      showKeyValueModal: false,
      valueOnly: false,
      createTransactionErr: null,
      recipientsScrollIndex: 0,
      address: '',
      addresses: [],
    };
  }

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    title: '',
    tabBarVisible: false,
    headerRight: () => (
      <TouchableOpacity
        style={{ marginHorizontal: 16, minWidth: 150, justifyContent: 'center', alignItems: 'flex-end' }}
        onPress={navigation.state.params.onPress}
      >
        <Text style={{color: KevaColors.actionText, fontSize: 16}}>{loc.namespaces.submit}</Text>
      </TouchableOpacity>
    ),
  });

  async componentDidMount() {
    const {walletId} = this.props.navigation.state.params;
    const fromWallet = BlueApp.getWallets().find(wallet => wallet.getID() == walletId);
    this.setState({fromWallet});

    this.props.navigation.setParams({
      onPress: this.onSave
    });
    this.isBiometricUseCapableAndEnabled = await Biometric.isBiometricUseCapableAndEnabled();
  }

  fetchNamespaces = async () => {
    const { dispatch } = this.props;
    const wallets = BlueApp.getWallets();
    let namespaces = {};
    for (let w of wallets) {
      const ns = await findMyNamespaces(w, BlueElectrum);
      namespaces = {...namespaces, ...ns};
    }

    const order = this.props.namespaceList.order;
    // Remove the order that are not in the namespace list.
    let newOrder = order.filter(nsid => namespaces[nsid]);
    for (let id of Object.keys(namespaces)) {
      if (!newOrder.find(nsid => nsid == id)) {
        newOrder.unshift(id);
      }
    }
    dispatch(setNamespaceList(namespaces, newOrder));
  }

  onSave = async () => {
    const {namespaceId} = this.props.navigation.state.params;
    let {key, value} = this.state;

    this.wallet = this.state.fromWallet;
    this.setState({
      showKeyValueModal: true,
      currentPage: 0,
      showSkip: true,
      broadcastErr: null,
      isBroadcasting: false,
      fee: 0,
      createTransactionErr: null,
    }, () => {
      setTimeout(async () => {
        try {
          await BlueElectrum.ping();
          const newAddress = this.state.addresses[0] ? this.state.addresses[0].address : null;
          const { tx, fee } = await updateKeyValue(this.wallet, FALLBACK_DATA_PER_BYTE_FEE, namespaceId, key, value, null, newAddress);
          let feeKVA = fee / 100000000;
          this.setState({ showKeyValueModal: true, currentPage: 1, fee: feeKVA });
          this.namespaceTx = tx;
        } catch (err) {
          console.warn(err);
          this.setState({createTransactionErr: err.message});
        }
      }, 800);
    });
  }

  KeyValueCreationFinish = () => {
    return this.setState({showKeyValueModal: false});
  }

  KeyValueCreationCancel = () => {
    return this.setState({showKeyValueModal: false});
  }

  KeyValueCreationNext = () => {
    return this.setState({
      currentPage: this.state.currentPage + 1
    });
  }

  getKeyValueModal = () => {
    if (!this.state.showKeyValueModal) {
      return null;
    }

    let createNSPage = (
      <View style={styles.modalNS}>
        {
          this.state.createTransactionErr ?
            <>
              <Text style={[styles.modalText, {color: KevaColors.errColor, fontWeight: 'bold'}]}>{"Error"}</Text>
              <Text style={styles.modalErr}>{this.state.createTransactionErr}</Text>
              <KevaButton
                type='secondary'
                style={{margin:10, marginTop: 30}}
                caption={'Cancel'}
                onPress={async () => {
                  this.setState({showKeyValueModal: false, createTransactionErr: null});
                }}
              />
            </>
          :
            <>
              <Text style={[styles.modalText, {alignSelf: 'center', color: KevaColors.darkText}]}>{loc.namespaces.creating_tx}</Text>
              <Text style={styles.waitText}>{loc.namespaces.please_wait}</Text>
              <BlueLoading style={{paddingTop: 30}}/>
            </>
        }
      </View>
    );

    let confirmPage = (
      <View style={styles.modalNS}>
        <Text style={styles.modalText}>{"Transaction fee:  "}
          <Text style={styles.modalFee}>{this.state.fee + ' KVA'}</Text>
        </Text>
        <KevaButton
          type='secondary'
          style={{margin:10, marginTop: 40}}
          caption={loc.namespaces.confirm}
          onPress={async () => {
            this.setState({currentPage: 2, isBroadcasting: true});
            try {
              await BlueElectrum.ping();
              await BlueElectrum.waitTillConnected();
              if (this.isBiometricUseCapableAndEnabled) {
                if (!(await Biometric.unlockWithBiometrics())) {
                  this.setState({isBroadcasting: false});
                  return;
                }
              }
              let result = await BlueElectrum.broadcast(this.namespaceTx);
              if (result.code) {
                // Error.
                return this.setState({
                  isBroadcasting: false,
                  broadcastErr: result.message,
                });
              }
              await BlueApp.saveToDisk();
              // Refresh the namespaces. If the address is from a wallet not owned
              // by us, the namespace will disappear.
              await utils.sleepAync(3000);
              await this.fetchNamespaces();
              this.setState({isBroadcasting: false, showSkip: false});
            } catch (err) {
              this.setState({isBroadcasting: false, broadcastErr: err.message});
              console.warn(err);
            }
          }}
        />
      </View>
    );

    let broadcastPage;
    if (this.state.isBroadcasting) {
      broadcastPage = (
        <View style={styles.modalNS}>
          <Text style={styles.modalText}>{"Broadcasting Transaction ..."}</Text>
          <BlueLoading style={{paddingTop: 30}}/>
        </View>
      );
    } else if (this.state.broadcastErr) {
      broadcastPage = (
        <View style={styles.modalNS}>
          <Text style={[styles.modalText, {color: KevaColors.errColor, fontWeight: 'bold'}]}>{"Error"}</Text>
          <Text style={styles.modalErr}>{this.state.broadcastErr}</Text>
          <KevaButton
            type='secondary'
            style={{margin:10, marginTop: 30}}
            caption={'Cancel'}
            onPress={async () => {
              this.setState({showKeyValueModal: false});
            }}
          />
        </View>
      );
    } else {
      broadcastPage = (
        <View style={styles.modalNS}>
          <BlueBigCheckmark style={{marginHorizontal: 50}}/>
          <KevaButton
            type='secondary'
            style={{margin:10, marginTop: 30}}
            caption={'Done'}
            onPress={async () => {
              this.setState({
                showKeyValueModal: false,
                nsName: '',
              });
              this.props.navigation.goBack();
            }}
          />
        </View>
      );
    }

    return (
      <View>
        <StepModal
          showNext={false}
          showSkip={this.state.showSkip}
          currentPage={this.state.currentPage}
          stepComponents={[createNSPage, confirmPage, broadcastPage]}
          onFinish={this.KeyValueCreationFinish}
          onNext={this.KeyValueCreationNext}
          onCancel={this.KeyValueCreationCancel}/>
      </View>
    );
  }

  processBIP70Invoice = async (text) => {
    try {
      if (BitcoinBIP70TransactionDecode.matchesPaymentURL(text)) {
        Keyboard.dismiss();
        return BitcoinBIP70TransactionDecode.decode(text)
          .then(response => {
            const recipient = new BitcoinTransaction(
              response.address,
              loc.formatBalanceWithoutSuffix(response.amount, BitcoinUnit.BTC, false),
            );
            return {
              recipient,
              memo: response.memo,
              fee: response.fee,
              feeSliderValue: response.fee,
              bip70TransactionExpiration: response.expires,
            };
          })
          .catch(error => {
            alert(error.errorMessage);
            throw error;
          });
      }
    } catch (error) {
      return false;
    }
    throw new Error('BIP70: Unable to process.');
  }

  decodeBitcoinUri = (uri) => {
    let amount = '';
    let parsedBitcoinUri = null;
    let address = uri || '';
    let memo = '';
    try {
      parsedBitcoinUri = DeeplinkSchemaMatch.bip21decode(uri);
      address = parsedBitcoinUri.hasOwnProperty('address') ? parsedBitcoinUri.address : address;
      if (parsedBitcoinUri.hasOwnProperty('options')) {
        if (parsedBitcoinUri.options.hasOwnProperty('amount')) {
          amount = parsedBitcoinUri.options.amount.toString();
          amount = parsedBitcoinUri.options.amount;
        }
        if (parsedBitcoinUri.options.hasOwnProperty('label')) {
          memo = parsedBitcoinUri.options.label || memo;
        }
      }
    } catch (_) {}
    return { address, amount, memo };
  }

  processAddressData = data => {
    this.setState({ isLoading: true }, async () => {
      if (BitcoinBIP70TransactionDecode.matchesPaymentURL(data)) {
        const bip70 = await this.processBIP70Invoice(data);
        this.setState({
          addresses: [bip70.recipient],
          memo: bip70.memo,
          feeSliderValue: bip70.feeSliderValue,
          fee: bip70.fee,
          isLoading: false,
          bip70TransactionExpiration: bip70.bip70TransactionExpiration,
        });
      } else {
        let recipients = this.state.addresses;
        const dataWithoutSchema = data.replace('kevacoin:', '').replace('KEVACOIN:', '');
        if (this.state.fromWallet.isAddressValid(dataWithoutSchema)) {
          let item = {};
          item.address = dataWithoutSchema;
          this.setState({
            addresses: [item],
            bip70TransactionExpiration: null,
            isLoading: false,
          });
        } else {
          let address = '';
          let options;
          try {
            if (!data.toLowerCase().startsWith('kevacoin:')) {
              data = `kevacoin:${data}`;
            }
            const decoded = DeeplinkSchemaMatch.bip21decode(data);
            address = decoded.address;
            options = decoded.options;
          } catch (error) {
            data = data.replace(/(amount)=([^&]+)/g, '').replace(/(amount)=([^&]+)&/g, '');
            const decoded = DeeplinkSchemaMatch.bip21decode(data);
            decoded.options.amount = 0;
            address = decoded.address;
            options = decoded.options;
            this.setState({ isLoading: false });
          }
          if (btcAddressRx.test(address) || address.indexOf('bc1') === 0 || address.indexOf('BC1') === 0) {
            let item = {};
            item.address = address;
            item.amount = options.amount;
            this.setState({
              addresses: [item],
              memo: options.label || options.message,
              bip70TransactionExpiration: null,
              isLoading: false,
            });
          } else {
            this.setState({ isLoading: false });
          }
        }
      }
    });
  };

  render() {
    let {navigation, dispatch} = this.props;
    const index = 0;
    return (
      <View style={styles.container}>
        {this.getKeyValueModal()}
        <Text style={styles.explain}>{loc.namespaces.ns_transfer_explain}</Text>
        <View style={{ minWidth: width, maxWidth: width, width: width }}>
          <BlueAddressInput
            onChangeText={async text => {
              text = text.trim();
              let transactions = this.state.addresses;
              try {
                const { recipient, memo, fee, feeSliderValue } = await this.processBIP70Invoice(text);
                transactions[index].address = recipient.address;
                transactions[index].amount = recipient.amount;
                this.setState({ addresses: transactions, memo: memo, fee, feeSliderValue, isLoading: false });
              } catch (_e) {
                const { address, amount, memo } = this.decodeBitcoinUri(text);
                let item = transactions[index] || {};
                item.address = address || text;
                item.amount = amount || item.amount;
                transactions[index] = item;
                this.setState({
                  addresses: transactions,
                  memo: memo || this.state.memo,
                  isLoading: false,
                  bip70TransactionExpiration: null,
                });
              }
            }}
            onBarScanned={this.processAddressData}
            address={this.state.addresses[index] ? this.state.addresses[index].address : ''}
            isLoading={this.state.isLoading}
            //inputAccessoryViewID={BlueDismissKeyboardInputAccessory.InputAccessoryViewID}
            launchedBy={this.props.navigation.state.routeName}
          />
          {this.state.addresses.length > 1 && (
            <BlueText style={{ alignSelf: 'flex-end', marginRight: 18, marginVertical: 8 }}>
              {index + 1} of {this.state.addresses.length}
            </BlueText>
          )}
        </View>
        <View style={styles.inputKey}>
          <TextInput
            editable={!this.state.valueOnly}
            noBorder
            autoCorrect={false}
            value={this.state.value}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{ flex: 1, marginHorizontal: 8, minHeight: 33 }}
            placeholder={loc.namespaces.ns_transfer_notes}
            clearButtonMode="while-editing"
            onChangeText={value => {this.setState({value})}}
          />
        </View>
      </View>
    );
  }

}

function mapStateToProps(state) {
  return {
    namespaceList: state.namespaceList,
    keyValueList: state.keyValueList,
  }
}

export default TransferNamespaceScreen = connect(mapStateToProps)(TransferNamespace);

var styles = StyleSheet.create({
  container: {
    flex:1,
    backgroundColor: '#fff',
  },
  inputKey: {
    flexDirection: 'row',
    borderColor: '#d2d2d2',
    borderBottomColor: '#d2d2d2',
    borderWidth: 1.0,
    borderBottomWidth: 0.5,
    backgroundColor: '#f5f5f5',
    minHeight: 44,
    height: 44,
    marginHorizontal: 20,
    alignItems: 'center',
    marginVertical: 8,
    borderRadius: 4,
  },
  inputValue: {
    height:215,
    borderWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
  },
  modalNS: {
    height: 300,
    alignSelf: 'center',
    justifyContent: 'flex-start',
  },
  modalText: {
    fontSize: 18,
    color: KevaColors.lightText,
  },
  waitText: {
    fontSize: 16,
    color: KevaColors.lightText,
    paddingTop: 10,
    alignSelf: 'center',
  },
  modalFee: {
    fontSize: 18,
    color: KevaColors.statusColor,
  },
  modalErr: {
    fontSize: 16,
    marginTop: 20,
  },
  iconBtn: {
    alignSelf: 'flex-end',
    marginVertical: 5,
    marginRight: 15,
  },
  closePicture: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 100,
  },
  explain: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    paddingTop: 5,
    paddingBottom: 15,
    color: KevaColors.lightText,
  }
});
