import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  View,
  TextInput,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Platform,
  PixelRatio,
  Text,
  RefreshControl,
  Clipboard,
  LayoutAnimation,
  Keyboard,
  Image,
  InteractionManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  BlueNavigationStyle,
  BlueLoading,
  BlueBigCheckmark,
  BlueBigWait,
} from '../../BlueComponents';
import Modal from 'react-native-modal';
import ActionSheet from 'react-native-actionsheet';
import SortableListView from 'react-native-sortable-list'
import RNPickerSelect from 'react-native-picker-select';
import { TabView, TabBar } from 'react-native-tab-view';
import { connect } from 'react-redux'
import {
  setNamespaceList, setOtherNamespaceList,
  setNamespaceOrder, setOtherNamespaceOrder,
  deleteOtherNamespace, setKeyValueList,
  setAllReactions,
} from '../../actions'
import { HDSegwitP2SHWallet,  } from '../../class';
import { FALLBACK_DATA_PER_BYTE_FEE } from '../../models/networkTransactionFees';
import Biometric from '../../class/biometrics';
import { Avatar, Button } from 'react-native-elements';

let BlueApp = require('../../BlueApp');
let loc = require('../../loc');
let BlueElectrum = require('../../BlueElectrum');
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
import {
  THIN_BORDER, SCREEN_WIDTH, ModalHandle, toastError,
  stringToColor, getInitials,
} from '../../util';
import Toast from 'react-native-root-toast';
import StepModal from "../../common/StepModalWizard";

import {
  createKevaNamespace, findMyNamespaces,
  findOtherNamespace, getNamespaceInfo,
  waitPromise, populateReactions,
} from '../../class/keva-ops';

const COPY_ICON = (<Icon name="ios-copy" size={22} color={KevaColors.extraLightText}
                         style={{ paddingVertical: 5, paddingHorizontal: 5, position: 'relative', left: -3 }}
                  />)

let _g_cleanLockedFund;
let _g_checkLockedFund;

class Namespace extends React.Component {

  constructor(props) {
    super(props);
    this.state = { loading: false, selectedImage: null };

    this._active = new Animated.Value(0);
    this._style = {
      ...Platform.select({
        ios: {
          transform: [{
            rotate: this._active.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -0.04],
            }),
          }],
          shadowRadius: this._active.interpolate({
            inputRange: [0, 1],
            outputRange: [2, 10],
          }),
        },

        android: {
          transform: [{
            rotate: this._active.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '-5deg'],
            }),
          }],
          elevation: this._active.interpolate({
            inputRange: [0, 1],
            outputRange: [2, 6],
          }),
        },
      }),
      opacity: this._active.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.7],
      }),
    };
  }

  onInfo = () => {
    let namespace = this.props.data;
    this.props.onInfo(namespace);
  }

  onSoldorOffer = () => {
    const {refresh} = this.props;
    setTimeout(async () => {
      if (refresh) {
        await refresh();
      } else {
        await _g_cleanLockedFund();
        await _g_checkLockedFund();
      }
    }, 2000);
  }

  onKey = () => {
    let namespace = this.props.data;
    let isOther = this.props.isOther;
    this.props.navigation.push('KeyValues', {
      namespaceId: namespace.id || namespace.namespaceId,
      shortCode: namespace.shortCode,
      displayName: namespace.displayName,
      txid: namespace.txId,
      rootAddress: namespace.rootAddress,
      walletId: namespace.walletId,
      isOther,
      price: namespace.price, desc: namespace.desc, addr: namespace.addr,
      profile: namespace.profile,
      onSoldorOffer: this.onSoldorOffer,
    });
  }

  onTransfer = (namespace) => {
    this.props.navigation.push('TransferNamespace', {
      namespaceId: namespace.id,
      walletId: namespace.walletId,
    });
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.active !== nextProps.active) {
      Animated.timing(this._active, {
        duration: 100,
        easing: Easing.bounce,
        toValue: Number(nextProps.active),
      }).start();
    }
  }

  onWait = () => {
    const {data, onWait, refresh} = this.props;
    onWait(data.id, data.displayName, refresh);
  }

  getAvatar = name => {
    return {titleAvatar: getInitials(name), colorAvatar: stringToColor(name)}
  }

  render() {
    const namespace = this.props.data;
    const {canDelete, onDelete} = this.props;
    const {titleAvatar, colorAvatar} = this.getAvatar(namespace.displayName);
    const canTransfer = !canDelete;
    const isForSale = !!namespace.price;

    return (
      <Animated.View style={this._style}>
        <View style={styles.cardTitle} >
          <View style={{padding: 5}}>
            <Avatar rounded size="medium" title={titleAvatar} containerStyle={{backgroundColor: colorAvatar}}/>
          </View>
          <View style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 7, paddingTop: 10 }}>
            <View style={{ flex: 1 }} >
              <Text style={[styles.cardTitleText, isForSale && {color: KevaColors.okColor}]} numberOfLines={1} ellipsizeMode="tail">{namespace.displayName}</Text>
            </View>
            <View style={styles.actionContainer}>
              {
                !namespace.shortCode &&
                <TouchableOpacity onPress={this.onWait}>
                  <Icon name="ios-hourglass" size={20} style={[styles.actionIcon, {color: KevaColors.warnColor}]} />
                </TouchableOpacity>
              }
              <TouchableOpacity onPress={this.onInfo}>
                <Icon name="ios-information-circle-outline" size={20} style={styles.actionIcon} />
              </TouchableOpacity>
              { canDelete &&
              <TouchableOpacity onPress={() => onDelete(namespace.id || namespace.namespaceId)}>
                <Icon name="ios-remove-circle-outline" size={20} style={styles.actionIcon} />
              </TouchableOpacity>
              }
              { canTransfer &&
              <TouchableOpacity onPress={() => this.onTransfer(namespace)}>
                <Icon name="ios-log-out" size={20} style={styles.actionIcon} />
              </TouchableOpacity>
              }
            </View>
          </View>
          <TouchableOpacity onPress={this.onKey}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="ios-arrow-forward" size={24} color={KevaColors.actionText} style={{ padding: 12 }} />
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    )
  }

}


class MyNamespaces extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      loaded: false, changes: false, nsName: '',
      namespaceId: null, saving: false,
      isLoading: true, isModalVisible: false,
      showNSCreationModal: false,
      walletId: null,
      currentPage: 0,
      isRefreshing: false,
      createTransactionErr: null,
      inputMode: false,
      lockedFund: {},
    };
  }

  onChangeOrder = async (order) => {
    const { dispatch } = this.props;
    dispatch(setNamespaceOrder(order));
  }

  NSCreationFinish = () => {
    return this.setState({showNSCreationModal: false});
  }

  NSCreationCancel = () => {
    return this.setState({showNSCreationModal: false});
  }

  NSCreationNext = () => {
    return this.setState({
      currentPage: this.state.currentPage + 1
    });
  }

  getNSCreationModal = () => {
    if (!this.state.showNSCreationModal) {
      return null;
    }

    const wallets = BlueApp.getWallets();
    const walletList = wallets.map((w, i) => {
      return { label: w.getLabel(), value: w.getID() }
    })

    const wallet = wallets.find(w => w.getID() == this.state.walletId);

    let selectWalletPage = (
      <View style={styles.modalNS}>
        <Text style={[styles.modalText, {textAlign: 'center', marginBottom: 20, color: KevaColors.darkText}]}>{"Choose a Wallet"}</Text>
        <RNPickerSelect
          value={this.state.walletId}
          placeholder={{}}
          useNativeAndroidPickerStyle={false}
          style={{
            inputAndroid: styles.inputAndroid,
            inputIOS: styles.inputIOS,
          }}
          onValueChange={(walletId, i) => this.setState({walletId: walletId})}
          items={walletList}
          Icon={() => <Icon name="ios-arrow-down" size={24} color={KevaColors.actionText} style={{ padding: 12 }} />}
        />
        <Text style={[styles.modalFee, {textAlign: 'center', marginTop: 10}]}>{wallet.getBalance()/100000000 + ' KVA'}</Text>
        <KevaButton
          type='secondary'
          style={{margin:10, marginTop: 40}}
          caption={'Next'}
          onPress={async () => {
            try {
              const wallet = wallets.find(w => w.getID() == this.state.walletId);
              if (!wallet) {
                throw new Error('Wallet not found.');
              }
              // Make sure it is not single address wallet.
              if (wallet.type != HDSegwitP2SHWallet.type) {
                return alert(loc.namespaces.multiaddress_wallet);
              }
              this.setState({ showNSCreationModal: true, currentPage: 1 });
              await BlueElectrum.ping();
              const { tx, namespaceId, fee } = await createKevaNamespace(wallet, FALLBACK_DATA_PER_BYTE_FEE, this.state.nsName);
              let feeKVA = fee / 100000000;
              this.setState({ showNSCreationModal: true, currentPage: 2, fee: feeKVA });
              this.namespaceTx = tx;
              this.newNamespaceId = namespaceId;
            } catch (err) {
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
                  this.setState({showNSCreationModal: false, createTransactionErr: null});
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
            this.setState({currentPage: 3, isBroadcasting: true});
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
              // Wait until the namespace is available in the mempool.
              let totalWait = 0;
              while (true) {
                await this.fetchNamespaces();
                if (!this.props.namespaceList.namespaces[this.newNamespaceId]) {
                  waitPromise(2000);
                  totalWait += 2000;
                  if (totalWait > 20000) {
                    break;
                  }
                } else {
                  break;
                }
              }
              this.newNamespaceId = '';
              this.setState({isBroadcasting: false, showSkip: false});
              this.closeItemAni();
              await BlueApp.saveToDisk();
            } catch (err) {
              this.setState({isBroadcasting: false});
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
              this.setState({showNSCreationModal: false});
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
                showNSCreationModal: false,
                nsName: '',
              });
              await this.refreshNamespaces();
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
          stepComponents={[selectWalletPage, createNSPage, confirmPage, broadcastPage]}
          onFinish={this.NSCreationFinish}
          onNext={this.NSCreationNext}
          onCancel={this.NSCreationCancel}/>
      </View>
    );
  }

  onAddNamespace = () => {
    const wallets = BlueApp.getWallets();
    if (wallets.length == 0) {
      return toastError(loc.namespaces.no_wallet);
    }

    Keyboard.dismiss();
    if (!this.state.nsName || this.state.nsName.length == 0) {
      this.setState({inputMode: false});
      return;
    }

    this.setState({
      showNSCreationModal: true,
      currentPage: 0,
      showSkip: true,
      broadcastErr: null,
      isBroadcasting: false,
      fee: 0,
      createTransactionErr: null,
      inputMode: false,
      walletId: wallets[0].getID(),
    });
  }

  checkLockedFund = async () => {
    // Check if any fund locked for NFT bidding.
    const lockedFund = await BlueApp.getLockedFund();
    let lockedAmount = 0;
    for (let f of Object.keys(lockedFund)) {
      lockedAmount += lockedFund[f].fund;
    }
    this.setState({lockedFund, lockedAmount});
  }

  cleanLockedFund = async (wallets) => {
    // If utxo doesn't exist, remove it from lockedFund.
    const lockedFund = await BlueApp.getLockedFund();
    for (let key of Object.keys(lockedFund)) {
      let found = false;
      for (let w of wallets) {
        found = w.getUtxo().find(u => {
          const myKey = `${u.txId}:${u.vout}`;
          return myKey == key;
        });
        if (found) {
          break;
        }
      }

      if (!found) {
        delete lockedFund[key];
      }
    }
    await BlueApp.saveAllLockedFund(lockedFund);
  }

  fetchNamespaces = async () => {
    const { dispatch } = this.props;
    const wallets = BlueApp.getWallets();
    let namespaces = {};
    await BlueElectrum.ping();
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

    await this.cleanLockedFund(wallets);
    await this.checkLockedFund();
    dispatch(setNamespaceList(namespaces, newOrder));
  }

  async componentDidMount() {

    _g_cleanLockedFund = async () => {
      const wallets = BlueApp.getWallets();
      await this.cleanLockedFund(wallets);
    }

    _g_checkLockedFund = async () => {
      await this.checkLockedFund();
    }

    try {
      await this.fetchNamespaces();
    } catch (err) {
      toastError('Cannot fetch namespaces');
      console.error(err);
    }
    this.isBiometricUseCapableAndEnabled = await Biometric.isBiometricUseCapableAndEnabled();
  }

  refreshNamespaces = async () => {
    this.setState({isRefreshing: true});
    try {
      await BlueElectrum.ping();
      await this.fetchNamespaces();
    } catch (err) {
      console.error(err);
      this.setState({isRefreshing: false});
    }
    this.setState({isRefreshing: false});
  }

  openItemAni = () => {
    LayoutAnimation.configureNext({
      duration: 100,
      update: {type: LayoutAnimation.Types.easeInEaseOut}
    });
    this.setState({inputMode: true});
  }

  closeItemAni = () => {
    LayoutAnimation.configureNext({
      duration: 100,
      update: {type: LayoutAnimation.Types.easeInEaseOut}
    });
    this.setState({inputMode: false, nsName: ''});
    this._inputRef && this._inputRef.blur();
    this._inputRef && this._inputRef.clear();
  }

  onLockedChange = async () => {
    await this.checkLockedFund();
  }

  onManageLockedFund = () => {
    this.props.navigation.push('ManageLocked', {
      lockedFund: this.state.lockedFund,
      onLockedChange: this.onLockedChange,
    });
  }

  render() {
    const { navigation, namespaceList, onInfo, onWait } = this.props;
    const canAdd = this.state.nsName && this.state.nsName.length > 0;
    const inputMode = this.state.inputMode;
    const hasLockedFund = this.state.lockedAmount > 0;
    return (
      <View style={styles.container}>
        {this.getNSCreationModal()}
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={this.closeItemAni}>
            <Text style={[{color: KevaColors.actionText, fontSize: 16, textAlign: 'left'}, inputMode && {paddingRight: 5}]}>
              {inputMode ? loc.general.cancel : ''}
            </Text>
          </TouchableOpacity>
          <TextInput
            onFocus={this.openItemAni}
            ref={ref => this._inputRef = ref}
            onChangeText={nsName => this.setState({ nsName: nsName })}
            value={this.state.nsName}
            placeholder={loc.namespaces.namespace_name}
            multiline={false}
            underlineColorAndroid='rgba(0,0,0,0)'
            returnKeyType={ 'done' }
            style={styles.textInput}
            onEndEditing={this.onAddNamespace}
            clearButtonMode='while-editing'
          />
          {this.state.saving ?
            <ActivityIndicator size="small" color={KevaColors.actionText} style={{ width: 42, height: 42 }} />
            :
            <TouchableOpacity onPress={this.onAddNamespace} disabled={!canAdd}>
              <Icon name={'md-add'}
                    style={[styles.addIcon, !canAdd && {color: KevaColors.inactiveText}]}
                    size={28} />
            </TouchableOpacity>
          }
        </View>
        {hasLockedFund &&
          <View style={styles.inputContainer}>
            <Text style={{fontSize: 16, marginLeft: 10, color: KevaColors.errColor}}>{this.state.lockedAmount/100000000 + ' KVA Locked'}</Text>
            <Button
              type='clear'
              buttonStyle={{alignSelf: 'center', marginRight: 10}}
              onPress={()=>{this.onManageLockedFund()}}
              icon={
                <Icon
                  name="ios-settings"
                  size={24}
                  color={KevaColors.actionText}
                />
              }
            />
          </View>
        }
        {
          (namespaceList.order.length > 0) ?
          <SortableListView
            style={styles.listStyle}
            contentContainerStyle={{paddingBottom: 400}}
            data={namespaceList.namespaces}
            order={namespaceList.order}
            onChangeOrder={this.onChangeOrder}
            refreshControl={
              <RefreshControl onRefresh={() => this.refreshNamespaces()} refreshing={this.state.isRefreshing} />
            }
            renderRow={({data, active, key}) => {
              return <Namespace onInfo={onInfo} onWait={onWait} refresh={this.refreshNamespaces} data={data} active={active} navigation={navigation} key={key}/>
            }}
          />
          :
          <ScrollView style={{flex: 1, paddingHorizontal: 10, paddingTop: 30}}
            contentContainerStyle={{justifyContent: 'center', alignItems: 'center'}}
            refreshControl={
              <RefreshControl onRefresh={() => this.refreshNamespaces()} refreshing={this.state.isRefreshing} />
            }
          >
            <Text style={[styles.emptyMessage, { marginBottom: 40, marginTop: 30 }]}>
              {loc.namespaces.click_add_btn}
            </Text>
            <Text style={[styles.emptyMessage, styles.help, {marginTop: 10}]}>
              {loc.namespaces.explain}
            </Text>
            <MCIcon type='material-community'
              name='chevron-double-down'
              color={KevaColors.inactiveText}
              size={60}
            />
          </ScrollView>
        }
      </View>
    );
  }

}

class OtherNamespaces extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      loaded: false, changes: false, nsName: '',
      namespaceId: null, saving: false,
      isLoading: true, isModalVisible: false,
      isRefreshing: false,
      inputMode: false,
    };
  }

  onChangeOrder = async (order) => {
    this.props.dispatch(setOtherNamespaceOrder(order));
  }

  async componentDidMount() {
  }

  refreshNamespaces = async () => {
    const { dispatch, otherNamespaceList } = this.props;
    this.setState({isRefreshing: true});
    let namespaceAll = {};
    try {
      for (let ns of Object.keys(otherNamespaceList.namespaces)) {
        if (ns.length < 20) {
          continue;
        }
        const namespace = await getNamespaceInfo(BlueElectrum, ns, true);
        namespaceAll = {...namespaceAll, ...{[ns]: namespace}};
      }
      const order = otherNamespaceList.order;
      dispatch(setOtherNamespaceList(namespaceAll, order));
    } catch (err) {
      console.error(err);
      this.setState({isRefreshing: false});
    }
    this.setState({isRefreshing: false});
  }

  onSearchNamespace = async () => {
    const { dispatch, otherNamespaceList } = this.props;
    try {
      Keyboard.dismiss();
      if (!this.state.nsName || this.state.nsName.length == 0) {
        this.setState({inputMode: false});
        return;
      }
      this.setState({saving: true, inputMode: false});
      await BlueElectrum.ping();
      const namespace = await findOtherNamespace(BlueElectrum, this.state.nsName);
      if (!namespace) {
        throw new Error('Cannot find namespace');
      }
      const newId = Object.keys(namespace)[0];

      // Fix the order
      let order = [...otherNamespaceList.order];
      if (!order.find(nsid => nsid == newId)) {
        order.unshift(newId);
      }
      dispatch(setOtherNamespaceList(namespace, order));
      this.setState({nsName: '', saving: false});
      this.closeItemAni();
    } catch (err) {
      this.setState({saving: false});
      console.log(err)
      toastError(loc.namespaces.namespace_not_found);
    }
  }

  onDeleteConfirm = index => {
    const {dispatch} = this.props;
    if (index === 0 && this._namespaceId) {
      LayoutAnimation.configureNext({
        duration: 300,
        update: {type: LayoutAnimation.Types.easeInEaseOut}
      });
      dispatch(deleteOtherNamespace(this._namespaceId));
      dispatch(setKeyValueList(this._namespaceId));
    }
  }

  onDelete = namespaceId => {
    this._namespaceId = namespaceId;
    this._actionDelete.show();
  }

  openItemAni = () => {
    LayoutAnimation.configureNext({
      duration: 100,
      update: {type: LayoutAnimation.Types.easeInEaseOut}
    });
    this.setState({inputMode: true});
  }

  closeItemAni = () => {
    LayoutAnimation.configureNext({
      duration: 100,
      update: {type: LayoutAnimation.Types.easeInEaseOut}
    });
    this.setState({inputMode: false, nsName: '', isRefreshing: false});
    this._inputRef && this._inputRef.blur();
    this._inputRef && this._inputRef.clear();
  }

  render() {
    const { navigation, otherNamespaceList, onInfo } = this.props;
    const canSearch = this.state.nsName && this.state.nsName.length > 0;
    const inputMode = this.state.inputMode;
    const isEmpty = otherNamespaceList.order.length == 0;

    return (
      <View style={styles.container}>
        <ActionSheet
          ref={ref => this._actionDelete = ref}
          options={[loc.namespaces.hide, loc.general.cancel]}
          cancelButtonIndex={1}
          destructiveButtonIndex={0}
          onPress={this.onDeleteConfirm}
        />
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={this.closeItemAni}>
            <Text style={[{color: KevaColors.actionText, fontSize: 16, textAlign: 'left'}, inputMode && {paddingRight: 5}]}>
              {inputMode ? loc.general.cancel : ''}
            </Text>
          </TouchableOpacity>
          <TextInput
            onFocus={this.openItemAni}
            ref={ref => this._inputRef = ref}
            onChangeText={nsName => this.setState({ nsName: nsName })}
            value={this.state.nsName}
            placeholder={loc.namespaces.shortcode_id}
            multiline={false}
            underlineColorAndroid='rgba(0,0,0,0)'
            returnKeyType='search'
            clearButtonMode='while-editing'
            onSubmitEditing={this.onSearchNamespace}
            style={styles.textInput}
            returnKeyType={ 'done' }
            clearButtonMode='while-editing'
          />
          {this.state.saving ?
            <ActivityIndicator size="small" color={KevaColors.actionText} style={{ width: 42, height: 42 }} />
            :
            <TouchableOpacity onPress={this.onSearchNamespace} disabled={!canSearch}>
              <Icon name={'md-search'}
                    style={[styles.searchIcon, !canSearch && {color: KevaColors.inactiveText}]}
                    size={25} />
            </TouchableOpacity>
          }
        </View>
        {otherNamespaceList.order.length > 0 ?
          <SortableListView
            style={[styles.listStyle, isEmpty && {flex: 0}]}
            contentContainerStyle={(!isEmpty) && {paddingBottom: 400}}
            data={otherNamespaceList.namespaces}
            order={otherNamespaceList.order}
            onChangeOrder={this.onChangeOrder}
            refreshControl={
              <RefreshControl onRefresh={() => this.refreshNamespaces()} refreshing={this.state.isRefreshing} />
            }
            renderRow={({data, active}) => {
              return <Namespace onInfo={onInfo} onDelete={this.onDelete} data={data} active={active} navigation={navigation} canDelete={true} isOther={true}/>
            }}
          />
          :
          <ScrollView style={{flex: 1, paddingHorizontal: 10, paddingTop: 30}}
            contentContainerStyle={{justifyContent: 'center', alignItems: 'center'}}
            refreshControl={
              <RefreshControl onRefresh={() => this.refreshNamespaces()} refreshing={this.state.isRefreshing} />
            }
          >
            <Image source={require('../../img/other_no_data.png')} style={{ width: SCREEN_WIDTH*0.33, height: SCREEN_WIDTH*0.33, marginBottom: 20 }} />
            <Text style={[styles.emptyMessage, { marginBottom: 7 }]} selectable>
              {loc.namespaces.click_search_btn}
            </Text>
          </ScrollView>
        }
      </View>
    );
  }

}

class Namespaces extends React.Component {

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    headerShown: false,
  });

  constructor(props) {
    super(props);
    this.state = {
      loaded: false, changes: false, nsName: '', namespaceId: null, saving: false ,
      isLoading: true, isModalVisible: false,
      spinning: false,
      index: 0,
      routes: [
        { key: 'first', title: loc.namespaces.my_data },
        { key: 'second', title: loc.namespaces.others }
      ]
    };
  }

  async componentDidMount() {
    const { dispatch, reactions } = this.props;
    InteractionManager.runAfterInteractions(async () => {
      if (!reactions.populated) {
        const allReactions = populateReactions();
        dispatch(setAllReactions(allReactions));
      }
    });
  }

  onNSInfo = (nsData) => {
    this.setState({
      nsData: nsData,
      codeErr: null,
      isModalVisible: true
    });
  }

  onWait = (namespaceId, displayName, refresh) => {
    this.setState({
      pendingDisplayName: displayName,
      pendingNamespaceId: namespaceId,
      refresh,
      pendingModalVisible: true,
    });
  }

  copyString = (str) => {
    Clipboard.setString(str);
    Toast.show(loc.general.copiedToClipboard, {
      position: Toast.positions.TOP,
      backgroundColor: "#53DD6C",
    });
  }

  getNSModal() {
    const nsData = this.state.nsData;
    if (!nsData) {
      return null;
    }

    const titleStyle ={
      fontSize: 17,
      fontWeight: '700',
      marginTop: 15,
      marginBottom: 0,
      color: KevaColors.darkText,
    };
    const contentStyle ={
      fontSize: 16,
      color: KevaColors.lightText,
      paddingTop: 5,
    };
    const container = {
      flexDirection: 'column',
      justifyContent: 'flex-start',
    }
    return (
      <Modal style={styles.modalShow} backdrop={true}
        swipeDirection="down"
        coverScreen={false}
        onSwipeComplete={this.closeModal}
        isVisible={this.state.isModalVisible}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={this.closeModal}>
            <Text style={{color: KevaColors.actionText, fontSize: 16, paddingVertical: 5}}>
              {loc.general.close}
            </Text>
          </TouchableOpacity>
          {ModalHandle}
          <Text style={{color: '#fff', fontSize: 16}}>
              {loc.general.close}
          </Text>
        </View>
        <View style={{ marginHorizontal: 10}}>
          <Text style={[titleStyle, {marginTop: 5}]}>{'Name'}</Text>
          <Text style={contentStyle}>{nsData.displayName}</Text>

          <Text style={titleStyle}>{'ID'}</Text>
          <View style={container}>
            <Text style={contentStyle}>{nsData.id}</Text>
            <TouchableOpacity onPress={() => {this.copyString(nsData.id)}}>
              {COPY_ICON}
            </TouchableOpacity>
          </View>

          <Text style={titleStyle}>{loc.namespaces.shortcode}</Text>
          <View style={container}>
            {nsData.shortCode ?
              <>
                <Text style={contentStyle}>{nsData.shortCode}</Text>
                <TouchableOpacity onPress={() => {this.copyString(nsData.shortCode)}}>
                  {COPY_ICON}
                </TouchableOpacity>
              </>
              :
              <Text style={contentStyle}>{loc.general.unconfirmed}</Text>
            }
          </View>
        </View>
      </Modal>
    )
  }

  closeModal = () => {
    this.setState({ codeErr: null, isModalVisible: false });
  }

  getPendingModal() {
    const {pendingDisplayName, pendingNamespaceId, pendingModalVisible, refresh} = this.state;
    const {namespaceList} = this.props;
    if (!pendingModalVisible || !pendingNamespaceId) {
      return;
    }
    const nsData = namespaceList.namespaces[pendingNamespaceId];
    const titleStyle ={
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 5,
      color: KevaColors.darkText,
    };
    const contentStyle = {
      fontSize: 16,
      color: KevaColors.darkText,
      paddingTop: 15,
      alignSelf: 'center',
      textAlign: 'center',
    };
    const confirmStyle = {
      fontSize: 20,
      color: KevaColors.okColor,
      paddingTop: 15,
      alignSelf: 'center',
      textAlign: 'center',
    };
    return (
      <Modal style={styles.modalPending} backdrop={true}
        swipeDirection="down"
        coverScreen={false}
        onSwipeComplete={this.closePendingModal}
        isVisible={this.state.pendingModalVisible}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={this.closePendingModal}>
            <Text style={{color: KevaColors.actionText, fontSize: 16, paddingVertical: 5}}>
              {loc.general.close}
            </Text>
          </TouchableOpacity>
          {ModalHandle}
          <Text style={{color: '#fff', fontSize: 16}}>
              {loc.general.close}
          </Text>
        </View>
        <View style={{ marginHorizontal: 10}}>
          <Text style={titleStyle}>{pendingDisplayName}</Text>
          {!nsData.shortCode &&
            <>
              <BlueBigWait style={{marginHorizontal: 50}}/>
              <Text style={contentStyle}>{loc.namespaces.pending_confirmation}</Text>
            </>
          }
          {nsData.shortCode &&
            <>
              <BlueBigCheckmark style={{marginHorizontal: 50}}/>
              <Text style={confirmStyle}>{loc.namespaces.confirmed}</Text>
            </>
          }
          <KevaButton
            type='secondary'
            loading={this.state.checking}
            style={{margin:10, marginTop: 40}}
            caption={nsData.shortCode ? loc.general.done: loc.namespaces.check_again}
            onPress={async () => {
              if (nsData.shortCode) {
                return this.closePendingModal();
              }
              this.setState({checking: true});
              await refresh();
              this.setState({checking: false});
            }}
          />
        </View>
      </Modal>
    )
  }

  closePendingModal = () => {
    this.setState({
      pendingModalVisible: false,
      pendingDisplayName: "",
      pendingNamespaceId: "",
    });
  }

  render() {
    const { dispatch, navigation, namespaceList, otherNamespaceList } = this.props;
    const labelStyle = focused => ({
      color: focused ? KevaColors.actionText : KevaColors.inactiveText,
      margin: 0,
      fontSize: 16,
    });
    return (
      <SafeAreaView style={styles.topContainer}>
        {this.getNSModal()}
        {this.getPendingModal()}
        <TabView
          navigationState={this.state}
          renderScene={({ route }) => {
            switch (route.key) {
              case 'first':
                return <MyNamespaces dispatch={dispatch} navigation={navigation} namespaceList={namespaceList} onInfo={this.onNSInfo} onWait={this.onWait}/>;
              case 'second':
                return <OtherNamespaces dispatch={dispatch} navigation={navigation} otherNamespaceList={otherNamespaceList} onInfo={this.onNSInfo} />;
            }
          }}
          onIndexChange={index => this.setState({ index })}
          initialLayout={{ width: Dimensions.get('window').width }}
          renderTabBar={props =>
            <TabBar
              {...props}
              renderLabel={({ route, focused }) => (
                <Text style={labelStyle(focused)}>
                  {route.title}
                </Text>
              )}
              indicatorStyle={{ backgroundColor: KevaColors.actionText }}
              labelStyle={{ backgroundColor: '#fff', color: KevaColors.inactiveText }}
              style={{
                backgroundColor: '#fff', shadowOpacity: 0, shadowOffset: { height: 0, width: 0 },
                shadowColor: 'transparent',
                shadowOpacity: 0,
                elevation: 0,
                borderBottomWidth: THIN_BORDER,
                borderBottomColor: KevaColors.actionText,
              }}
            />
          }
        />
      </SafeAreaView>
    );
  }

}

function mapStateToProps(state) {
  return {
    namespaceList: state.namespaceList,
    otherNamespaceList: state.otherNamespaceList,
    reactions: state.reactions,
  }
}

export default NamespacesScreen = connect(mapStateToProps)(Namespaces)

var styles = StyleSheet.create({
  topContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: KevaColors.background,
  },
  sectionWrap: {
    marginBottom: 0
  },
  section: {
    backgroundColor: 'white',
    borderBottomWidth: 1 / PixelRatio.get(),
    borderBottomColor: '#e8e8e8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  detail: {
    color: '#5E5959',
    fontSize: 13,
    paddingTop: 3
  },
  sectionText: {
    color: '#5E5959',
    fontSize: 16,
  },
  resultText: {
    color: '#918C8C',
    fontSize: 15,
    top: -1,
    paddingRight: 5
  },
  listStyle: {
    flex: 1,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: "center",
    marginHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 14,
  },
  cardTitleText: {
    fontSize: 17,
    color: KevaColors.darkText,
    paddingHorizontal: 5,
  },
  cardContent: {
    backgroundColor: '#fff',
    padding: 5
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 5
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginHorizontal: 20,
    marginTop: 5
  },
  actionIcon: {
    color: KevaColors.actionText,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  modal: {
    height: 300,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
  },
  modalPending: {
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
    marginHorizontal: 0,
    marginVertical: 60,
    marginHorizontal: 20,
  },
  modalShow: {
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
    marginHorizontal: 0,
    marginBottom: 0,
    android: {
      marginTop: 20,
    },
    ios: {
      marginTop: 50,
    }
  },
  modalHeader: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
  },
  codeErr: {
    marginTop: 20,
    marginHorizontal: 20,
    flexDirection: 'row'
  },
  codeErrText: {
    color: KevaColors.errColor
  },
  inputContainer: {
    paddingVertical: 3,
    paddingLeft: 8,
    backgroundColor: '#fff',
    borderBottomWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textInput:
  {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#f1f3f4',
    android: {
      paddingTop: 5,
      paddingBottom: 5,
    },
    ios: {
      paddingTop: 8,
      paddingBottom: 8,
    },
    paddingLeft: 7,
    paddingRight: 36,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    height: 50
  },
  addIcon: {
    width: 42,
    height: 42,
    color: KevaColors.actionText,
    paddingVertical: 5,
    paddingHorizontal: 9,
    top: 1,
  },
  searchIcon: {
    width: 42,
    height: 42,
    color: KevaColors.actionText,
    paddingVertical: 5,
    paddingHorizontal: 9,
    android: {
      top: 4,
    },
    ios: {
      top: 3,
    }
  },
  action: {
    fontSize: 16,
    color: KevaColors.actionText,
    paddingVertical: 10
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
  emptyMessage: {
    fontSize: 18,
    color: KevaColors.inactiveText,
    textAlign: 'center',
    lineHeight: 30,
  },
  help: {
    fontSize: 16,
    alignSelf: 'center',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
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
