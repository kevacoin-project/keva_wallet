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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import FAIcon from 'react-native-vector-icons/FontAwesome';
import {
  BlueNavigationStyle,
  BlueLoading,
  BlueBigCheckmark,
} from '../../BlueComponents';
import Modal from 'react-native-modal';
import ActionSheet from 'react-native-actionsheet';
import SortableListView from 'react-native-sortable-list'
import {Picker} from '@react-native-community/picker';
import ElevatedView from 'react-native-elevated-view'
import { TabView, TabBar } from 'react-native-tab-view';
import { connect } from 'react-redux'
import {
  setNamespaceList, setOtherNamespaceList,
  setNamespaceOrder, setOtherNamespaceOrder,
} from '../../actions'

let BlueApp = require('../../BlueApp');
let loc = require('../../loc');
let BlueElectrum = require('../../BlueElectrum');
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER } from '../../util';
import Toast from 'react-native-root-toast';
import StepModal from "../../common/StepModalWizard";

import {
  createKevaNamespace, findMyNamespaces,
  findOtherNamespace,
} from '../../class/keva-ops';

const CLOSE_ICON = (<Icon name="ios-close" size={36} color={KevaColors.primaryLightColor} style={{ paddingVertical: 5, paddingHorizontal: 15 }} />)
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
    this.props.navigation.navigate('KeyValues', {
      namespaceId: namespace.id,
      shortCode: namespace.shortCode,
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

  render() {
    let namespace = this.props.data;
    let canDelete = this.props.canDelete;
    return (
      <Animated.View style={this._style}>
        <ElevatedView elevation={1} style={styles.cardTitle}>
          <View style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 7, paddingTop: 10 }}>
            <View style={{ flex: 1 }} >
              <Text style={styles.cardTitleText} numberOfLines={1} ellipsizeMode="tail">{namespace.displayName}</Text>
            </View>
            <View style={styles.actionContainer}>
              <TouchableOpacity onPress={this.onInfo}>
                <FAIcon name="info-circle" size={20} style={styles.actionIcon} />
              </TouchableOpacity>
              { canDelete &&
              <TouchableOpacity onPress={() => this.props.onShowActions(this.props.categoryId)}>
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
      return <Picker.Item key={i} label={w.getLabel()} value={w.getID()} />
    })

    const wallet = wallets.find(w => w.getID() == this.state.walletId);

    let selectWalletPage = (
      <View style={styles.modalNS}>
        <Text style={[styles.modalText, {textAlign: 'center', marginBottom: 20, color: KevaColors.darkText}]}>{"Choose a Wallet"}</Text>
        <Picker
          selectedValue={this.state.walletId}
          style={{height: 50, width: 270, color: KevaColors.lightText}}
          onValueChange={(walletId, i) => this.setState({walletId: walletId})
          }>
          { walletList }
        </Picker>
        <Text style={[styles.modalFee, {textAlign: 'center', marginTop: 5}]}>{wallet.getBalance()/100000000 + ' KVA'}</Text>
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
              this.setState({ showNSCreationModal: true, currentPage: 1 });
              const { tx, namespaceId, fee } = await createKevaNamespace(wallet, 120, this.state.nsName);
              let feeKVA = fee / 100000000;
              this.setState({ showNSCreationModal: true, currentPage: 2, fee: feeKVA });
              this.namespaceTx = tx;
            } catch (err) {
              this.setState({createTransactionErr: err.message});
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
              console.log(result)
              this.setState({isBroadcasting: false, showSkip: false});
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
    const namespaces = await findMyNamespaces(wallets[0], BlueElectrum);

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

  refreshNamespaces = async () => {
    this.setState({isRefreshing: true});
    try {
      this.fetchNamespaces();
    } catch (err) {
      console.error(err);
      this.setState({isRefreshing: false});
    }
    this.setState({isRefreshing: false});
  }

  render() {
    const { navigation, namespaceList, onInfo } = this.props;
    const canAdd = this.state.nsName && this.state.nsName.length > 0;
    return (
      <View style={styles.container}>
        {/*
        <ActionSheet
          ref={ref => this._actionSheet = ref}
          title={'Are you sure you want to delete it?'}
          options={[Lang.general.delete, Lang.general.cancel]}
          cancelButtonIndex={1}
          destructiveButtonIndex={0}
          onPress={this.onAction}
        />
        */}
        {this.getNSCreationModal()}
        <View style={styles.inputContainer}>
          <TextInput
            onChangeText={nsName => this.setState({ nsName: nsName })}
            value={this.state.nsName}
            placeholder={"Name of new namespace"}
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
          namespaceList &&
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
    };
  }

  onChangeOrder = async (order) => {
    this.props.dispatch(setOtherNamespaceOrder(order));
  }

  fetchOtherNamespaces = async () => {
    const { dispatch, otherNamespaceList } = this.props;
    try {
      const order = otherNamespaceList.order;
      const wallets = BlueApp.getWallets();
      const namespaces = otherNamespaceList.namespaces;
      for (let ns of Object.keys(namespaces)) {
        const namespace = await findOtherNamespace(wallets[0], BlueElectrum, namespaces[ns].rootTxid);
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
      const wallets = BlueApp.getWallets();
      const namespace = await findOtherNamespace(wallets[0], BlueElectrum, this.state.nsName);
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
      this.setState({nsName: ''});
    } catch (err) {
      Toast.show('Cannot find namespace');
      console.log(err);
    }
  }

  render() {
    const { navigation, otherNamespaceList, onInfo } = this.props;
    const canSearch = this.state.nsName && this.state.nsName.length > 0;

    return (
      <View style={styles.container}>
        <ActionSheet
          ref={ref => this._actionSheet = ref}
          title={'Are you sure you want to delete it?'}
          options={[loc.general.delete, loc.general.cancel]}
          cancelButtonIndex={1}
          destructiveButtonIndex={0}
          onPress={this.onAction}
        />
        <View style={styles.inputContainer}>
          <TextInput
            onChangeText={nsName => this.setState({ nsName: nsName })}
            value={this.state.nsName}
            placeholder={"Namespace short code or tx id"}
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
        {
          otherNamespaceList &&
          <SortableListView
            style={styles.listStyle}
            contentContainerStyle={{paddingBottom: 400}}
            data={otherNamespaceList.namespaces}
            order={otherNamespaceList.order}
            onChangeOrder={this.onChangeOrder}
            refreshControl={
              <RefreshControl onRefresh={() => this.refreshNamespaces()} refreshing={this.state.isRefreshing} />
            }
            renderRow={({data, active}) => {
              return <Namespace onInfo={onInfo} data={data} active={active} navigation={navigation} canDelete={true} />
            }}
          />
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
      index: 0,
      routes: [
        { key: 'first', title: 'My Namespaces' },
        { key: 'second', title: 'Others' }
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
          <View/>
          <TouchableOpacity onPress={this.closeModal}>
            {CLOSE_ICON}
          </TouchableOpacity>
        </View>
        <View style={{ paddingVertical: 5, marginHorizontal: 10}}>
          <Text style={titleStyle}>{'Name'}</Text>
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
            <Text style={contentStyle}>{nsData.shortCode}</Text>
            <TouchableOpacity onPress={() => {this.copyString(nsData.shortCode)}}>
              {COPY_ICON}
            </TouchableOpacity>
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
                return <OtherNamespaces dispatch={dispatch} navigation={navigation} otherNamespaceList={otherNamespaceList} onInfo={this.onNSInfo}/>;
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
              style={{ backgroundColor: '#fff' }}
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
    marginTop: 10
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
    margin: 0,
  },
  modalHeader: {
    paddingLeft: 15,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  overlay: {
    flex: 1,
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0.4,
    backgroundColor: 'black',
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center'
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
  }
});
