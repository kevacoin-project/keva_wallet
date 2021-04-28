import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import Toast from 'react-native-root-toast';
import RNPickerSelect from 'react-native-picker-select';
import Icon from 'react-native-vector-icons/Ionicons';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
import FloatTextInput from '../../common/FloatTextInput';
import { THIN_BORDER, SCREEN_WIDTH, toastError } from '../../util';
import { HDSegwitP2SHWallet,  } from '../../class';
import {
  BlueNavigationStyle,
  BlueLoading,
  BlueBigCheckmark,
} from '../../BlueComponents';
const loc = require('../../loc');
let BlueApp = require('../../BlueApp');
let BlueElectrum = require('../../BlueElectrum');
import { FALLBACK_DATA_PER_BYTE_FEE } from '../../models/networkTransactionFees';
import { TransitionPresets } from 'react-navigation-stack';

import { connect } from 'react-redux'
import { replyKeyValue } from '../../class/keva-ops';
import { createNFTBid, } from '../../class/nft-ops';
import StepModal from "../../common/StepModalWizard";
import Biometric from '../../class/biometrics';

class OfferNFT extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      changes: false,
      saving: false,
      value: '',
      showKeyValueModal: false,
      createTransactionErr: null,
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
        <View style={{ borderRadius: 20, backgroundColor: KevaColors.actionText, paddingVertical: 4, paddingHorizontal: 15 }}>
          <Text style={{color: '#FFF', fontSize: 16}}>{'Offer'}</Text>
        </View>
      </TouchableOpacity>
    ),
    headerLeft: () => (
      <TouchableOpacity
        style={{ marginHorizontal: 16, minWidth: 150, justifyContent: 'center', alignItems: 'flex-start' }}
        onPress={() => navigation.goBack()}
      >
        <Text style={{ color: KevaColors.actionText, fontSize: 16 }}>{loc.general.cancel}</Text>
      </TouchableOpacity>
    ),
    ...TransitionPresets.ModalTransition,
  });

  async componentDidMount() {
    const { replyTxid } = this.props.navigation.state.params;
    this.setState({
      replyTxid,
    });
    this.props.navigation.setParams({
      onPress: this.onSave
    });
    this.isBiometricUseCapableAndEnabled = await Biometric.isBiometricUseCapableAndEnabled();
  }

  onSave = async () => {
    const { value } = this.state;
    const { namespaceList } = this.props;

    if (value.length == 0) {
      toastError('Price required');
      return;
    }
    const wallets = BlueApp.getWallets();
    if (wallets.length == 0) {
      Toast.show("You don't have wallet");
      return;
    }

    const namespaces = namespaceList.namespaces;
    const defaultNamespaceId = namespaces[Object.keys(namespaces)[0]].id;

    this.setState({
      showKeyValueModal: true,
      currentPage: 0,
      showSkip: true,
      broadcastErr: null,
      isBroadcasting: false,
      fee: 0,
      createTransactionErr: null,
      currentPage: 0,
      namespaceId: this.state.namespaceId || defaultNamespaceId,
    });
  }

  KeyValueCreationFinish = () => {
    return this.setState({ showKeyValueModal: false });
  }

  KeyValueCreationCancel = () => {
    return this.setState({ showKeyValueModal: false });
  }

  KeyValueCreationNext = () => {
    return this.setState({
      currentPage: this.state.currentPage + 1
    });
  }

  getOfferModal = () => {
    const { namespaceList } = this.props;
    const { replyTxid, displayName, namespaceId: origNamespaceId, addr, profile, onOfferDone } = this.props.navigation.state.params;
    if (!this.state.showKeyValueModal) {
      return null;
    }

    const namespaces = namespaceList.namespaces;
    const items = Object.keys(namespaces).map(ns => ({label: namespaces[ns].displayName, value: namespaces[ns].id}));
    let selectNamespacePage = (
      <View style={styles.modalNS}>
        <Text style={[styles.modalText, {textAlign: 'center', marginBottom: 20, color: KevaColors.darkText}]}>{"Choose a namespace"}</Text>
        <RNPickerSelect
          value={this.state.namespaceId}
          placeholder={{}}
          useNativeAndroidPickerStyle={false}
          style={{
            inputAndroid: styles.inputAndroid,
            inputIOS: styles.inputIOS,
          }}
          onValueChange={(namespaceId) => this.setState({namespaceId})}
          items={items}
          Icon={() => <Icon name="ios-arrow-down" size={24} color={KevaColors.actionText} style={{ padding: 12 }} />}
        />
        <KevaButton
          type='secondary'
          style={{margin:10, marginTop: 40}}
          caption={'Next'}
          onPress={async () => {
            try {
              const {namespaceId, value} = this.state;
              const shortCode = namespaceList.namespaces[namespaceId].shortCode;
              if (!shortCode) {
                toastError(loc.namespaces.namespace_unconfirmed);
                throw new Error('Namespace not confirmed yet');
              }
              const walletId = namespaceList.namespaces[namespaceId].walletId;
              const wallets = BlueApp.getWallets();
              const wallet = wallets.find(w => w.getID() == walletId);
              if (!wallet) {
                throw new Error('Wallet not found');
              }
              // Make sure it is not single address wallet.
              if (wallet.type != HDSegwitP2SHWallet.type) {
                return alert(loc.namespaces.multiaddress_wallet);
              }
              this.setState({ showNSCreationModal: true, currentPage: 1 });
              await BlueElectrum.ping();

              const offerPrice = this.state.value * 100000000;
              const {offerTx, lockedFund} = await createNFTBid(wallet, FALLBACK_DATA_PER_BYTE_FEE, origNamespaceId, addr, offerPrice, profile, displayName);
              const { tx, fee, cost, key } = await replyKeyValue(wallet, FALLBACK_DATA_PER_BYTE_FEE, namespaceId, offerTx, replyTxid, true, lockedFund);
              let feeKVA = (fee + cost) / 100000000;
              this.setState({ showNSCreationModal: true, currentPage: 2, fee: feeKVA, key });
              this.namespaceTx = tx;
              this.lockedFund = lockedFund;
            } catch (err) {
              console.warn(err);
              this.setState({createTransactionErr: loc.namespaces.namespace_creation_err + ' [' + err.message + ']'});
            }
          }}
        />
      </View>
    );

    let createNSPage = (
      <View style={styles.modalNS}>
        {
          this.state.createTransactionErr ?
            <>
              <Text style={[styles.modalText, { color: KevaColors.errColor, fontWeight: 'bold' }]}>{"Error"}</Text>
              <Text style={styles.modalErr}>{this.state.createTransactionErr}</Text>
              <KevaButton
                type='secondary'
                style={{ margin: 10, marginTop: 30 }}
                caption={'Cancel'}
                onPress={async () => {
                  this.setState({ showKeyValueModal: false, createTransactionErr: null });
                }}
              />
            </>
            :
            <>
              <Text style={[styles.modalText, { alignSelf: 'center', color: KevaColors.darkText }]}>{loc.namespaces.creating_tx}</Text>
              <Text style={styles.waitText}>{loc.namespaces.please_wait}</Text>
              <BlueLoading style={{ paddingTop: 30 }} />
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
          style={{ margin: 10, marginTop: 40 }}
          caption={loc.namespaces.confirm}
          onPress={async () => {
            this.setState({ currentPage: 3, isBroadcasting: true });
            try {
              await BlueElectrum.ping();
              await BlueElectrum.waitTillConnected();
              if (this.isBiometricUseCapableAndEnabled) {
                if (!(await Biometric.unlockWithBiometrics())) {
                  this.setState({ isBroadcasting: false });
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
              const currentLockedFund = await BlueApp.getLockedFund();
              const lockedFund = {...currentLockedFund, ...this.lockedFund};
              await BlueApp.saveAllLockedFund(lockedFund);
              await BlueApp.saveToDisk();
              this.setState({ isBroadcasting: false, showSkip: false });
            } catch (err) {
              this.setState({ isBroadcasting: false });
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
          <BlueLoading style={{ paddingTop: 30 }} />
        </View>
      );
    } else if (this.state.broadcastErr) {
      broadcastPage = (
        <View style={styles.modalNS}>
          <Text style={[styles.modalText, { color: KevaColors.errColor, fontWeight: 'bold' }]}>{"Error"}</Text>
          <Text style={styles.modalErr}>{this.state.broadcastErr}</Text>
          <KevaButton
            type='secondary'
            style={{ margin: 10, marginTop: 30 }}
            caption={'Cancel'}
            onPress={async () => {
              this.setState({ showKeyValueModal: false });
            }}
          />
        </View>
      );
    } else {
      broadcastPage = (
        <View style={styles.modalNS}>
          <BlueBigCheckmark style={{ marginHorizontal: 50 }} />
          <KevaButton
            type='secondary'
            style={{ margin: 10, marginTop: 30 }}
            caption={'Done'}
            onPress={async () => {
              this.setState({
                showKeyValueModal: false,
                nsName: '',
              });
              Toast.show(loc.general.offer_sent, {
                position: Toast.positions.TOP,
                backgroundColor: "#53DD6C",
              });
              onOfferDone();
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
          stepComponents={[selectNamespacePage, createNSPage, confirmPage, broadcastPage]}
          onFinish={this.KeyValueCreationFinish}
          onNext={this.KeyValueCreationNext}
          onCancel={this.KeyValueCreationCancel} />
      </View>
    );
  }

  render() {
    let { navigation, dispatch } = this.props;
    return (
      <View style={styles.container}>
        {this.getOfferModal()}
        <View style={styles.inputKey}>
          <FloatTextInput
            editable
            noBorder
            keyboardType={'numeric'}
            autoCorrect={false}
            value={this.state.value}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{fontSize:15}}
            placeholder={loc.namespaces.bid_price + ' (KVA)'}
            clearButtonMode="while-editing"
            onChangeTextValue={value => {this.setState({value})}}
          />
        </View>
      </View>
    );
  }

}

function mapStateToProps(state) {
  return {
    keyValueList: state.keyValueList,
    namespaceList: state.namespaceList,
    hashtags: state.hashtags,
  }
}

export default OfferNFTScreen = connect(mapStateToProps)(OfferNFT);

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KevaColors.background,
  },
  inputKey: {
    height: 56,
    marginTop: 10,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    paddingHorizontal: 10
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
  inputAndroid: {
    width: SCREEN_WIDTH*0.8,
    color: KevaColors.lightText,
    textAlign: 'center',
    fontSize: 16,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.lightText,
    borderRadius: 4
  },
  inputIOS: {
    width: SCREEN_WIDTH*0.8,
    color: KevaColors.lightText,
    textAlign: 'center',
    fontSize: 16,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.lightText,
    borderRadius: 4,
    height: 46,
  },
});
