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
const loc = require('../../loc');
let BlueApp = require('../../BlueApp');
let BlueElectrum = require('../../BlueElectrum');
import { FALLBACK_DATA_PER_BYTE_FEE } from '../../models/networkTransactionFees';
import { updateKeyValue } from '../../class/keva-ops';
import { setNamespaceList } from '../../actions'
import { connect } from 'react-redux'
import FloatTextInput from '../../common/FloatTextInput';
import StepModal from "../../common/StepModalWizard";
import Biometric from '../../class/biometrics';

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
    let {namespaceInfo, price, desc} = this.state;

    if (!(price > 0)) {
      toastError('Asking price must be set');
      return;
    }

    if (desc.length == 0) {
      toastError('Missing description');
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
    }, () => {
        setTimeout(async () => {
          try {
            // Check if there is an image to upload.
            await BlueElectrum.ping();
            // Payment address.
            const addr = await this.wallet.getChangeAddressAsync();
            const key = '\x01_KEVA_NS_';
            const value = {
              displayName: namespaceInfo.displayName,
              price, desc, addr,
            };
            const { tx, fee } = await updateKeyValue(this.wallet, FALLBACK_DATA_PER_BYTE_FEE, namespaceId, key, JSON.stringify(value));
            let feeKVA = fee / 100000000;
            this.setState({ showSellNFTModal: true, currentPage: 1, fee: feeKVA });
            this.namespaceTx = tx;
          } catch (err) {
            console.warn(err);
            this.setState({createTransactionErr: err.message});
          }
        }, 200);
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

  updateCurrentProfile = () => {
    // We don't need to wait for confirmation, just
    // update the namespace info.
    const {namespaceList, dispatch} = this.props;
    const {namespaceId} = this.props.navigation.state.params;
    const {price, desc} = this.state;
    let order = [...namespaceList.order];
    // Need to duplicate everything as this is assumed by
    // setNamespaceList later.
    let namespaceInfo = {...namespaceList.namespaces};

    namespaceInfo[namespaceId].displayName = this.state.namespaceInfo.displayName;
    namespaceInfo[namespaceId].price = price;
    namespaceInfo[namespaceId].desc = desc;

    dispatch(setNamespaceList(namespaceInfo, order));
  }

  getSellNFTModal = () => {
    if (!this.state.showSellNFTModal) {
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
              // Update the profile right away before confirmation.
              this.updateCurrentProfile();
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
              const {onSaleCreated} = this.props.navigation.state.params;
              onSaleCreated();
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
            placeholder={loc.namespaces.asking_price + ' (KVA)'}
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
            placeholder={loc.namespaces.nft_desc}
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
