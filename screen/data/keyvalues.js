import React from 'react';
import {
  Alert,
  Text,
  View,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  LayoutAnimation,
  Animated,
  Easing,
  StatusBar,
  RefreshControl,
} from 'react-native';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
const utils = require('../../util');
import {
  BlueNavigationStyle,
} from '../../BlueComponents';
const loc = require('../../loc');
let BlueApp = require('../../BlueApp');
let BlueElectrum = require('../../BlueElectrum');

import Icon from 'react-native-vector-icons/Ionicons';
import SortableListView from 'react-native-sortable-list'
import Modal from 'react-native-modal';
import ActionSheet from 'react-native-actionsheet';
import { connect } from 'react-redux'
import { setKeyValueList } from '../../actions'
import { getKeyValuesFromShortCode, getKeyValuesFromTxid, deleteKeyValue } from '../../class/keva-ops';

const CLOSE_ICON    = <Icon name="ios-close" size={42} color={KevaColors.errColor}/>;

class Item extends React.Component {

  constructor(props) {
    super(props);
    this.state = { loading: false, selectedImage: null, isRefreshing: false };
  }

  onEdit = () => {
    const {navigation, data} = this.props;
    const {walletId, namespaceId} = navigation.state.params;
    navigation.navigate('AddKeyValue', {
      walletId,
      namespaceId,
      key: data.key,
      value: data.value,
    })
  }

  onClose(close) {
    close && close();
    if (this.state.selectedImage) {
      setTimeout(() => this.setState({selectedImage: null}), 50);
    }
  }

  render() {
    let {data, onShow, namespaceId} = this.props;
    let item = data;
    console.log('JWU ------ item')
    console.log(item)

    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => onShow(item.key, item.value)}>
          <View style={{flex:1,paddingHorizontal:10,paddingTop:2}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <Text style={styles.keyDesc} numberOfLines={1} ellipsizeMode="tail">{item.key}</Text>
              <View style={{flexDirection: 'row', alignItems:'center',justifyContent:'flex-start'}}>
                <TouchableOpacity onPress={this.onEdit}>
                  <Icon name="ios-create" size={22} style={styles.actionIcon} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => this.props.onDelete(namespaceId, item.key)}>
                  <Icon name="ios-trash" size={22} style={styles.actionIcon} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.valueDesc} numberOfLines={3} ellipsizeMode="tail">{item.value}</Text>
          </View>
        </TouchableOpacity>
      </View>
    )
  }
}

class KeyValues extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      isModalVisible: false,
      currentPage: 0,
      showDeleteModal: false,
    };
  }

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    title: '',
    tabBarVisible: false,
    headerRight: () => (
      <TouchableOpacity
        style={{ marginHorizontal: 16, minWidth: 150, justifyContent: 'center', alignItems: 'flex-end' }}
        onPress={() =>
          navigation.navigate('AddKeyValue', {
            walletId: navigation.state.params.walletId,
            namespaceId: navigation.state.params.namespaceId,
          })
        }
      >
        <Icon name="ios-add-circle" type="octicon" size={30} color={KevaColors.actionText} />
      </TouchableOpacity>
    ),
  });

  onDelete = (namespaceId, key) => {
    this._namespaceId = namespaceId;
    this._key = key;
    this._actionDelete.show();
  }

  deleteItem = async (namespaceId, key) => {
    const wallets = BlueApp.getWallets();
    this.setState({
      showDeleteModal: true,
      currentPage: 0,
      showSkip: true,
      broadcastErr: null,
      isBroadcasting: false,
      fee: 0,
    }, () => {
      setTimeout(async () => {
        const { tx, fee } = await deleteKeyValue(wallets[0], 120, namespaceId, key);
        let feeKVA = fee / 100000000;
        this.setState({ showDeleteModal: true, currentPage: 1, fee: feeKVA });
        this.deleteKeyTx = tx;
      }, 800);
    });
  }

  onDeleteConfirm = index => {
    if (index === 0 && this._namespaceId && this._key) {
      this.deleteItem(this._namespaceId, this._key);
    }
  }

  onRowMoved = async (order) => {
    let {navigation, dispatch} = this.props;
    const namespaceId = navigation.getParam('namespaceId');
    dispatch(setKeyValueOrder(namespaceId, order))
  }

  fetchKeyValues = async () => {
    let {navigation, dispatch, keyValueList} = this.props;
    const namespaceId = navigation.getParam('namespaceId');
    const shortCode = navigation.getParam('shortCode');
    const txid = navigation.getParam('txid');
    const walletId = navigation.getParam('walletId');
    let keyValues;
    const wallets = BlueApp.getWallets();
    this.wallet = wallets.find(w => w.getID() == walletId);
    if (!this.wallet) {
      //TODO: error message.
      return;
    }
    if (shortCode) {
      const transactions = this.wallet.getTransactions();
      keyValues = await getKeyValuesFromShortCode(BlueElectrum, transactions, shortCode.toString());
    } else if (txid) {
      const transactions = this.wallet.getTransactions();
      keyValues = await getKeyValuesFromTxid(BlueElectrum, transactions, txid);
    }

    if (keyValues) {
      // TODO: add order.
      let order = keyValueList.order[namespaceId] || [];
      dispatch(setKeyValueList(namespaceId, keyValues, order));
    }
  }

  refreshKeyValues = async () => {
    this.setState({isRefreshing: true});
    await this.fetchKeyValues();
    this.setState({isRefreshing: false});
  }

  async componentDidMount() {
    await this.fetchKeyValues();
  }

  closeModal = () => {
    this.setState({
      isModalVisible: false,
      key: null,
      value: null,
    });
  }

  getKeyValueModal() {
    const {key, value, isModalVisible} = this.state;
    if (!key || !value) {
      return null;
    }

    const titleStyle ={
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 5,
      color: KevaColors.lightText,
    };
    const contentStyle ={
      fontSize: 16,
      color: KevaColors.lightText,
      paddingTop: 5,
      lineHeight: 25,
    };
    return (
      <Modal style={styles.modal}
        backdrop={true}
        coverScreen
        swipeDirection="down"
        onSwipeComplete={this.closeModal}
        isVisible={isModalVisible}>
        <View style={styles.modalHeader}>
          <View/>
          <TouchableOpacity onPress={this.closeModal}>
            {CLOSE_ICON}
          </TouchableOpacity>
        </View>
        <View style={{ paddingVertical: 5, marginHorizontal: 10}}>
          <Text style={titleStyle}>{key}</Text>
          <Text style={contentStyle}>{value}</Text>
        </View>
      </Modal>
    )
  }

  keyDeleteFinish = () => {
    return this.setState({showDeleteModal: false});
  }

  keyDeleteCancel = () => {
    return this.setState({showDeleteModal: false});
  }

  keyDeleteNext = () => {
    return this.setState({
      currentPage: this.state.currentPage + 1
    });
  }

  getDeleteModal = () => {
    if (!this.state.showDeleteModal) {
      return null;
    }

    let deleteKeyPage = (
      <View style={styles.modalDelete}>
        <Text style={styles.modalText}>{"Creating Transaction ..."}</Text>
        <BlueLoading style={{paddingTop: 30}}/>
      </View>
    );

    let confirmPage = (
      <View style={styles.modalDelete}>
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
              let result = await BlueElectrum.broadcast(this.deleteKeyTx);
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
        <View style={styles.modalDelete}>
          <Text style={styles.modalText}>{"Broadcasting Transaction ..."}</Text>
          <BlueLoading style={{paddingTop: 30}}/>
        </View>
      );
    } else if (this.state.broadcastErr) {
      broadcastPage = (
        <View style={styles.modalDelete}>
          <Text style={[styles.modalText, {color: KevaColors.errColor, fontWeight: 'bold'}]}>{"Error"}</Text>
          <Text style={styles.modalErr}>{this.state.broadcastErr}</Text>
          <KevaButton
            type='secondary'
            style={{margin:10, marginTop: 30}}
            caption={'Cancel'}
            onPress={async () => {
              this.setState({showDeleteModal: false});
            }}
          />
        </View>
      );
    } else {
      broadcastPage = (
        <View style={styles.modalDelete}>
          <BlueBigCheckmark style={{marginHorizontal: 50}}/>
          <KevaButton
            type='secondary'
            style={{margin:10, marginTop: 30}}
            caption={'Done'}
            onPress={async () => {
              this.setState({
                showDeleteModal: false,
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
          stepComponents={[deleteKeyPage, confirmPage, broadcastPage]}
          onFinish={this.NSCreationFinish}
          onNext={this.NSCreationNext}
          onCancel={this.NSCreationCancel}/>
      </View>
    );
  }

  onShow = (key, value) => {
    this.setState({
      isModalVisible: true,
      key, value
    });
  }

  render() {
    let {navigation, dispatch, keyValueList} = this.props;
    console.log('JWU keyValueList $$$$$$$$$$$$$')
    console.log(JSON.stringify(keyValueList))
    const namespaceId = navigation.getParam('namespaceId');
    const list = keyValueList.keyValues[namespaceId];
    return (
      <View style={styles.container}>
        <ActionSheet
           ref={ref => this._actionDelete = ref}
           title={'Delete this key?'}
           options={[loc.general.delete, loc.general.cancel]}
           cancelButtonIndex={1}
           destructiveButtonIndex={0}
           onPress={this.onDeleteConfirm}
        />
        {this.getKeyValueModal()}
        {
          list &&
          <SortableListView
            style={styles.listStyle}
            contentContainerStyle={{paddingBottom: 400}}
            data={list}
            sortingEnabled={false}
            onChangeOrder={this.onRowMoved}
            refreshControl={
              <RefreshControl onRefresh={() => this.refreshKeyValues()} refreshing={this.state.isRefreshing} />
            }
            renderRow={({data, active}) =>
              <Item data={data} dispatch={dispatch} onDelete={this.onDelete}
                onShow={this.onShow} namespaceId={namespaceId}
                active={active} navigation={navigation}
              />
            }
          />
        }
      </View>
    );
  }

}

function mapStateToProps(state) {
  return {
    keyValueList: state.keyValueList,
  }
}

export default KeyValuesScreen = connect(mapStateToProps)(KeyValues);

var styles = StyleSheet.create({
  container: {
    flex:1,
    backgroundColor: '#f8f8f8',
  },
  listStyle: {
    flex: 1,
    paddingTop:5,
    borderBottomWidth: 1,
    borderColor: KevaColors.cellBorder,
    backgroundColor: KevaColors.background
  },
  card: {
    backgroundColor:'#fff',
    marginVertical:3,
    borderTopWidth: utils.THIN_BORDER,
    borderBottomWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder,
  },
  keyDesc: {
    flex: 1,
    fontSize:16
  },
  valueDesc: {
    flex: 1,
    fontSize:15,
    marginBottom: 10,
    color: KevaColors.lightText
  },
  actionIcon: {
    color: KevaColors.icon,
    paddingHorizontal: 15,
    paddingVertical: 7
  },
  modal: {
    borderRadius:10,
    backgroundColor: KevaColors.backgroundLight,
    zIndex:999999,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    margin: 0,
  },
  modalHeader: {
    borderTopLeftRadius:10,
    borderTopRightRadius:10,
    flexDirection:'row',
    justifyContent:'space-between',
    backgroundColor: KevaColors.background,
    borderBottomWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    marginHorizontal: 20,
  },
  modalDelete: {
    height: 300,
    alignSelf: 'center',
    justifyContent: 'flex-start'
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
  codeErr: {
    marginTop: 10,
    marginHorizontal: 7,
    flexDirection: 'row'
  },
  codeErrText: {
    color: KevaColors.errColor
  },
  action: {
    fontSize: 17,
    paddingVertical: 10
  },
  inAction: {
    fontSize: 17,
    paddingVertical: 10,
    paddingHorizontal: 7,
    color: KevaColors.inactiveText
  },
});
