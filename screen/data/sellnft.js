import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, SCREEN_WIDTH, toastError } from '../../util';
import {
  BlueNavigationStyle,
  BlueLoading,
  BlueBigCheckmark,
} from '../../BlueComponents';
import RNPickerSelect from 'react-native-picker-select';
const loc = require('../../loc');
let BlueApp = require('../../BlueApp');
let BlueElectrum = require('../../BlueElectrum');
import { FALLBACK_DATA_PER_BYTE_FEE } from '../../models/networkTransactionFees';
import { HDSegwitP2SHWallet,  } from '../../class';

import { connect } from 'react-redux'
import { updateKeyValue } from '../../class/keva-ops';
import FloatTextInput from '../../common/FloatTextInput';
import StepModal from "../../common/StepModalWizard";
import Biometric from '../../class/biometrics';
import IonIcon from 'react-native-vector-icons/Ionicons';

class SellNFT extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      changes: false,
      saving: false,
      namespaceId: '',
      namespaceInfo: {},
      sellerNamespaceId: '',
      showSellNFTModal: false,
      valueOnly: false,
      createTransactionErr: null,
      imagePreview: null,
      price: '',
      desc: '',
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
    const {namespaceId, namespaceInfo} = this.props.navigation.state.params;
    this.setState({
        namespaceId,
        namespaceInfo,
    });

    this.props.navigation.setParams({
      onPress: this.onSave
    });
    this.isBiometricUseCapableAndEnabled = await Biometric.isBiometricUseCapableAndEnabled();
  }

  onSave = async () => {
    const {namespaceId, walletId} = this.props.navigation.state.params;
    let {price, desc, namespaceInfo} = this.state;
    if (!(price > 0)) {
      toastError('Asking price must be set');
      return;
    }
    //TODO: FIXME
    if (desc.length <= 1) {
      toastError('At least 20 characters for description');
      return;
    }
    const wallets = BlueApp.getWallets();
    this.wallet = wallets.find(w => w.getID() == walletId);
    if (!this.wallet) {
      toastError('Cannot find wallet');
      return;
    }

    this.setState({
      showSellNFTModal: true,
      currentPage: 0,
      showSkip: true,
      broadcastErr: null,
      isBroadcasting: false,
      fee: 0,
      createTransactionErr: null,
    });
  }

  KeyValueCreationFinish = () => {
    return this.setState({showSellNFTModal: false});
  }

  KeyValueCreationCancel = () => {
    return this.setState({showSellNFTModal: false});
  }

  KeyValueCreationNext = () => {
    return this.setState({
      currentPage: this.state.currentPage + 1
    });
  }

  getSellNFTModal = () => {
    const { namespaceList, keyValueList, dispatch } = this.props;
    if (!this.state.showSellNFTModal) {
      return null;
    }

    const namespaces = namespaceList.namespaces;
    const items = Object.keys(namespaces).map(ns => ({label: namespaces[ns].displayName, value: namespaces[ns].id}));
    let selectNamespacePage = (
      <View style={styles.modalNS}>
        <Text style={[styles.modalText, {textAlign: 'center', marginBottom: 20, color: KevaColors.darkText}]}>{"Choose a namespace"}</Text>
        <RNPickerSelect
          value={this.state.sellerNamespaceId}
          placeholder={{}}
          useNativeAndroidPickerStyle={false}
          style={{
            inputAndroid: styles.inputAndroid,
            inputIOS: styles.inputIOS,
          }}
          onValueChange={(sellerNamespaceId) => this.setState({sellerNamespaceId})}
          items={items}
          Icon={() => <IonIcon name="ios-arrow-down" size={24} color={KevaColors.actionText} style={{ padding: 12 }} />}
        />
        <KevaButton
          type='secondary'
          style={{margin:10, marginTop: 40}}
          caption={'Next'}
          onPress={async () => {
            try {
              const {namespaceId, desc, price, sellerNamespaceId} = this.state;
              const shortCode = namespaceList.namespaces[sellerNamespaceId].shortCode;
              if (!shortCode) {
                toastError(loc.namespaces.namespace_unconfirmed);
                throw new Error('Namespace not confirmed yet');
              }

              // Seller wallet
              const sellerWalletId = namespaceList.namespaces[sellerNamespaceId].walletId;
              const wallets = BlueApp.getWallets();
              const sellerWallet = wallets.find(w => w.getID() == sellerWalletId);
              if (!sellerWallet) {
                throw new Error('Wallet not found');
              }
              // Make sure it is not single address wallet.
              if (sellerWallet.type != HDSegwitP2SHWallet.type) {
                return alert(loc.namespaces.multiaddress_wallet);
              }

              // NFT wallet
              const nftWalletId = namespaceList.namespaces[namespaceId].walletId;
              const nftWallet = wallets.find(w => w.getID() == nftWalletId);
              if (!nftWallet) {
                throw new Error('Wallet not found');
              }
              // Make sure it is not single address wallet.
              if (nftWallet.type != HDSegwitP2SHWallet.type) {
                return alert(loc.namespaces.multiaddress_wallet);
              }

              this.setState({ showNSCreationModal: true, currentPage: 1 });
              await BlueElectrum.ping();

              // TODO: create two transactions:
              // 1. From the selected namesapce, a tx with key: 0004 (sell) + namespaceid to sell
              // 2. In the namespace to sell, a tx with key key: 0005 (confirm sell) + above txid.
              const { txSeller, feeSeller} = await createSellNFT(sellerWallet, FALLBACK_DATA_PER_BYTE_FEE, namespaceId, desc, price);
              const { txConfirm, feeConfirm} = await confirmSellNFT(nftWallet, FALLBACK_DATA_PER_BYTE_FEE, sellerNamespaceId, txSeller);
              let feeKVA = (feeSeller + feeConfirm) / 100000000;
              this.setState({ showNSCreationModal: true, currentPage: 2, fee: feeKVA });
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
              <Text style={[styles.modalText, {color: KevaColors.errColor, fontWeight: 'bold'}]}>{"Error"}</Text>
              <Text style={styles.modalErr}>{this.state.createTransactionErr}</Text>
              <KevaButton
                type='secondary'
                style={{margin:10, marginTop: 30}}
                caption={'Cancel'}
                onPress={async () => {
                  this.setState({showSellNFTModal: false, createTransactionErr: null});
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
          caption={'Confirm'}
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
              this.setState({showSellNFTModal: false});
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
                showSellNFTModal: false,
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
          stepComponents={[selectNamespacePage, createNSPage, confirmPage, broadcastPage]}
          onFinish={this.KeyValueCreationFinish}
          onNext={this.KeyValueCreationNext}
          onCancel={this.KeyValueCreationCancel}/>
      </View>
    );
  }

  render() {
    let {navigation, dispatch} = this.props;
    let {namespaceInfo, desc} = this.state;
    return (
      <View style={styles.container}>
        {this.getSellNFTModal()}
        <View style={styles.inputKey}>
          <FloatTextInput
            noBorder
            autoCorrect={false}
            keyboardType='numeric'
            value={this.state.price}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{fontSize:15}}
            placeholder={'Asking Price (KVA)'}
            clearButtonMode="while-editing"
            onChangeTextValue={price => {this.setState({price})}}
          />
          {
            <Text style={styles.iconBtn}>
              {'KVA'}
            </Text>
          }
        </View>
        <View style={styles.inputValue}>
          <FloatTextInput
            noBorder
            multiline={true}
            autoCorrect={false}
            value={desc}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{fontSize:15}}
            placeholder={'Description of your NFT'}
            clearButtonMode="while-editing"
            onChangeTextValue={desc => {this.setState({desc})}}
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
  }
}

export default SellNFTScreen = connect(mapStateToProps)(SellNFT);

var styles = StyleSheet.create({
  container: {
    flex:1,
    backgroundColor: KevaColors.background,
  },
  inputKey: {
    height:46,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  inputValue: {
    height:215,
    borderWidth: THIN_BORDER,
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
    justifyContent: 'center',
    marginRight: 15,
  },
  closePicture: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 100,
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
