import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  View,
  TextInput,
  Alert,
  TouchableOpacity,
  Dimensions,
  Platform,
  PixelRatio,
  Text,
  RefreshControl,
  Clipboard,
  LayoutAnimation,
  Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  BlueNavigationStyle,
  BlueLoading,
  BlueBigCheckmark,
} from '../../BlueComponents';
import Modal from 'react-native-modal';
import ActionSheet from 'react-native-actionsheet';
import SortableListView from 'react-native-sortable-list'
import RNPickerSelect from 'react-native-picker-select';
import ElevatedView from 'react-native-elevated-view'
import { TabView, TabBar } from 'react-native-tab-view';
import { connect } from 'react-redux'
import {
  setNamespaceList, setOtherNamespaceList,
  setNamespaceOrder, setOtherNamespaceOrder,
  deleteOtherNamespace, setKeyValueList,
} from '../../actions'
import { HDSegwitP2SHWallet,  } from '../../class';
import { FALLBACK_DATA_PER_BYTE_FEE } from '../../models/networkTransactionFees';

let BlueApp = require('../../BlueApp');
let loc = require('../../loc');
let BlueElectrum = require('../../BlueElectrum');
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, SCREEN_WIDTH, ModalHandle } from '../../util';
import Toast from 'react-native-root-toast';
import StepModal from "../../common/StepModalWizard";

import {
  createKevaNamespace, findMyNamespaces,
  findOtherNamespace,
} from '../../class/keva-ops';

const COPY_ICON = (<Icon name="ios-copy" size={22} color={KevaColors.extraLightText}
                         style={{ paddingVertical: 5, paddingHorizontal: 5, position: 'relative', left: -3 }}
                  />)

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
              outputRange: [0, -0.04],
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

  onPress() {
  }

  onInfo = () => {
    let namespace = this.props.data;
    this.props.onInfo(namespace);
  }

  onKey = () => {
    let namespace = this.props.data;
    let isOther = this.props.isOther;
    this.props.navigation.navigate('KeyValues', {
      namespaceId: namespace.id,
      shortCode: namespace.shortCode,
      txid: namespace.txId,
      walletId: namespace.walletId,
      isOther,
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

  render() {
    let namespace = this.props.data;
    const {canDelete, onDelete} = this.props;
    return (
      <Animated.View style={this._style}>
        <ElevatedView elevation={1} style={styles.cardTitle}>
          <View style={{borderWidth: THIN_BORDER, borderColor: '#aaa', borderRadius: 2, width: 3, height: 32, marginLeft: 5 }}/>
          <View style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 7, paddingTop: 10 }}>
            <View style={{ flex: 1 }} >
              <Text style={styles.cardTitleText} numberOfLines={1} ellipsizeMode="tail">{namespace.displayName}</Text>
            </View>
            <View style={styles.actionContainer}>
              <TouchableOpacity onPress={this.onInfo}>
                <Icon name="ios-information-circle-outline" size={20} style={styles.actionIcon} />
              </TouchableOpacity>
              { canDelete &&
              <TouchableOpacity onPress={() => onDelete(namespace.id)}>
                <Icon name="ios-trash" size={20} style={styles.actionIcon} />
              </TouchableOpacity>
              }
            </View>
          </View>
          <TouchableOpacity onPress={this.onKey}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="ios-arrow-forward" size={24} color={KevaColors.actionText} style={{ padding: 12 }} />
            </View>
          </TouchableOpacity>
        </ElevatedView>
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
              const { tx, namespaceId, fee } = await createKevaNamespace(wallet, FALLBACK_DATA_PER_BYTE_FEE, this.state.nsName);
              let feeKVA = fee / 100000000;
              this.setState({ showNSCreationModal: true, currentPage: 2, fee: feeKVA });
              this.namespaceTx = tx;
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
              <Text style={styles.modalText}>{"Creating Transaction ..."}</Text>
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
            this.setState({currentPage: 3, isBroadcasting: true});
            try {
              await BlueElectrum.ping();
              await BlueElectrum.waitTillConnected();
              let result = await BlueElectrum.broadcast(this.namespaceTx);
              if (result.code) {
                // Error.
                return this.setState({
                  isBroadcasting: false,
                  broadcastErr: result.message,
                });
              }
              this.setState({isBroadcasting: false, showSkip: false});
              this.closeItemAni();
              await BlueApp.saveToDisk();
              await this.refreshNamespaces(this.state.walletId);
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
      return Toast.show('No wallet available');
    }

    if (this.state.nsName && this.state.nsName.length > 0) {
      this.setState({
        showNSCreationModal: true,
        currentPage: 0,
        showSkip: true,
        broadcastErr: null,
        isBroadcasting: false,
        fee: 0,
        createTransactionErr: null,
        walletId: wallets[0].getID(),
      });
    }
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
    for (let id of Object.keys(namespaces)) {
      if (!order.find(nsid => nsid == id)) {
        order.unshift(id);
      }
    }
    dispatch(setNamespaceList(namespaces, order));
  }

  async componentDidMount() {
    try {
      await this.fetchNamespaces();
    } catch (err) {
      Toast.show('Cannot fetch namespaces');
      console.error(err);
    }
  }

  refreshNamespaces = async (walletId) => {
    this.setState({isRefreshing: true});
    try {
      await BlueElectrum.ping();
      if (walletId) {
        const wallets = BlueApp.getWallets();
        const wallet = wallets.find(w => w.getID() == walletId);
        if (wallet) {
          await wallet.fetchBalance();
          await wallet.fetchTransactions();
        }
      }
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

  render() {
    const { navigation, namespaceList, onInfo } = this.props;
    const canAdd = this.state.nsName && this.state.nsName.length > 0;
    const inputMode = this.state.inputMode;
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
            style={styles.textInput}
          />
          {this.state.saving ?
            <ActivityIndicator size="small" color={KevaColors.actionText} style={{ width: 42, height: 42 }} />
            :
            <TouchableOpacity onPress={this.onAddNamespace} disabled={!canAdd}>
              <Icon name={'md-add-circle'}
                    style={[styles.addIcon, !canAdd && {color: KevaColors.inactiveText}]}
                    size={28} />
            </TouchableOpacity>
          }
        </View>
        {
          namespaceList.order.length > 0 ?
          <SortableListView
            style={styles.listStyle}
            contentContainerStyle={{paddingBottom: 400}}
            data={namespaceList.namespaces}
            order={namespaceList.order}
            onChangeOrder={this.onChangeOrder}
            refreshControl={
              <RefreshControl onRefresh={() => this.refreshNamespaces()} refreshing={this.state.isRefreshing} />
            }
            renderRow={({data, active}) => {
              return <Namespace onInfo={onInfo} data={data} active={active} navigation={navigation} />
            }}
          />
          :
          <View style={styles.emptyMessageContainer}>
            <Text style={[styles.emptyMessage, { marginBottom: 20, fontSize: 24 }]}>
              {loc.namespaces.no_data}
            </Text>
            <Text style={[styles.emptyMessage, { marginBottom: 7 }]}>
              {loc.namespaces.click_add_btn}
            </Text>
            <Icon name={'md-add-circle'}
              style={[styles.addIcon, {color: KevaColors.inactiveText}]}
              size={28} />
            <Text style={[styles.emptyMessage, styles.help, {marginTop: 10}]}>
              {loc.namespaces.explain}
            </Text>
          </View>
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

  fetchOtherNamespaces = async () => {
    const { dispatch, otherNamespaceList } = this.props;
    try {
      const order = otherNamespaceList.order;
      const namespaces = otherNamespaceList.namespaces;
      for (let ns of Object.keys(namespaces)) {
        const namespace = await findOtherNamespace(BlueElectrum, namespaces[ns].rootTxid);
        dispatch(setOtherNamespaceList(namespace, order));
      }
    } catch (err) {
      Toast.show('Cannot find namespace');
      console.log(err);
    }
  }

  async componentDidMount() {
    try {
      await this.fetchOtherNamespaces();
    } catch (err) {
      Toast.show('Cannot fetch namespaces');
      console.error(err);
    }
  }

  refreshNamespaces = async () => {
    this.setState({isRefreshing: true});
    try {
      this.fetchOtherNamespaces();
    } catch (err) {
      console.error(err);
      this.setState({isRefreshing: false});
    }
    this.setState({isRefreshing: false});
  }

  onSearchNamespace =async () => {
    const { dispatch, otherNamespaceList } = this.props;
    try {
      Keyboard.dismiss();
      this.setState({isRefreshing: true});
      const namespace = await findOtherNamespace(BlueElectrum, this.state.nsName);
      if (!namespace) {
        return;
      }
      const newId = Object.keys(namespace)[0];

      // Fix the order
      let order = [...otherNamespaceList.order];
      if (!order.find(nsid => nsid == newId)) {
        order.unshift(newId);
      }
      dispatch(setOtherNamespaceList(namespace, order));
      this.setState({nsName: '', isRefreshing: false});
      this.closeItemAni();
    } catch (err) {
      this.setState({isRefreshing: false});
      Toast.show('Cannot find namespace');
      console.log(err);
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
    this.setState({inputMode: false, nsName: ''});
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
          title={'Delete the namespace?'}
          options={[loc.general.delete, loc.general.cancel]}
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
          />
          {this.state.saving ?
            <ActivityIndicator size="small" color={KevaColors.actionText} style={{ width: 42, height: 42 }} />
            :
            <TouchableOpacity onPress={this.onSearchNamespace} disabled={!canSearch}>
              <Icon name={'md-search'}
                    style={[styles.addIcon, !canSearch && {color: KevaColors.inactiveText}]}
                    size={25} />
            </TouchableOpacity>
          }
        </View>
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
        {otherNamespaceList.order.length == 0 &&
          <View style={styles.emptyMessageContainer}>
            <Text style={[styles.emptyMessage, { marginBottom: 20, fontSize: 24 }]}>
              {loc.namespaces.no_data}
            </Text>
            <Text style={[styles.emptyMessage, { marginBottom: 7 }]}>
              {loc.namespaces.click_search_btn}
            </Text>
            <Icon name={'md-search'}
              style={[styles.addIcon, {color: KevaColors.inactiveText}]}
              size={28} />
            <Text style={[styles.emptyMessage, styles.help, {marginTop: 10}]}>
              {loc.namespaces.explain_tx}
            </Text>
            <Text style={[styles.emptyMessage, styles.help, {marginTop: 10}]}>
              {loc.namespaces.explain_ns}
            </Text>
          </View>
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
  }

  onNSInfo = (nsData) => {
    this.setState({
      nsData: nsData,
      codeErr: null,
      isModalVisible: true
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

          <Text style={titleStyle}>{'Id'}</Text>
          <View style={container}>
            <Text style={contentStyle}>{nsData.id}</Text>
            <TouchableOpacity onPress={() => {this.copyString(nsData.id)}}>
              {COPY_ICON}
            </TouchableOpacity>
          </View>

          <Text style={titleStyle}>{'Short Code'}</Text>
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

          <Text style={titleStyle}>{'Tx Id'}</Text>
          <View style={container}>
            <Text style={contentStyle}>{nsData.txId}</Text>
            <TouchableOpacity onPress={() => {this.copyString(nsData.txId)}}>
              {COPY_ICON}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  }

  closeModal = () => {
    this.setState({ codeErr: null, isModalVisible: false });
  }

  render() {
    const { dispatch, navigation, namespaceList, otherNamespaceList } = this.props;
    const labelStyle = focused => ({
      color: focused ? KevaColors.actionText : KevaColors.inactiveText,
      margin: 0,
      fontSize: 16,
    });
    return (
      <View style={styles.container}>
        {this.getNSModal()}
        <TabView
          navigationState={this.state}
          renderScene={({ route }) => {
            switch (route.key) {
              case 'first':
                return <MyNamespaces dispatch={dispatch} navigation={navigation} namespaceList={namespaceList} onInfo={this.onNSInfo}/>;
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
      </View>
    );
  }

}

function mapStateToProps(state) {
  return {
    namespaceList: state.namespaceList,
    namespaceOrder: state.namespaceOrder,
    otherNamespaceList: state.otherNamespaceList,
    otherNamespaceOrder: state.otherNamespaceOrder,
  }
}

export default NamespacesScreen = connect(mapStateToProps)(Namespaces)

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
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
    paddingTop: 5,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: "center",
    marginHorizontal: 7,
    backgroundColor: '#fff',
    borderRadius: 5,
    marginVertical: 4
  },
  cardTitleText: {
    fontSize: 16,
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
    color: KevaColors.arrowIcon,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  modal: {
    height: 300,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
  },
  modalShow: {
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
    marginHorizontal: 0,
    marginBottom: 0,
    marginTop: 20,
  },
  modalHeader: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    paddingVertical: 7,
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
    borderRadius: 4,
    backgroundColor: '#ececed',
    paddingTop: 5,
    paddingBottom: 5,
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
    top: 1
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
  modalFee: {
    fontSize: 18,
    color: KevaColors.statusColor,
  },
  modalErr: {
    fontSize: 16,
    marginTop: 20,
  },
  emptyMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  emptyMessage: {
    fontSize: 18,
    color: KevaColors.inactiveText,
    textAlign: 'center',
  },
  help: {
    fontSize: 16,
    alignSelf: 'center',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20
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
    borderRadius: 4
  },
});
