import React from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
} from 'react-native';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
const utils = require('../../util');
import {
  BlueNavigationStyle,
  BlueLoading,
  BlueBigCheckmark,
} from '../../BlueComponents';
const loc = require('../../loc');
let BlueApp = require('../../BlueApp');
let BlueElectrum = require('../../BlueElectrum');
import { FALLBACK_DATA_PER_BYTE_FEE } from '../../models/networkTransactionFees';

import Icon from 'react-native-vector-icons/Ionicons';
import Modal from 'react-native-modal';
import ActionSheet from 'react-native-actionsheet';
import { connect } from 'react-redux'
import { setKeyValueList } from '../../actions'
import { getKeyValuesFromShortCode, getKeyValuesFromTxid, deleteKeyValue } from '../../class/keva-ops';
import Toast from 'react-native-root-toast';
import StepModal from "../../common/StepModalWizard";
import { timeConverter } from "../../util";

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
    let {item, onShow, namespaceId, navigation} = this.props;
    const {isOther} = navigation.state.params;

    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => onShow(item.key, item.value)}>
          <View style={{flex:1,paddingHorizontal:10,paddingTop:2}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <Text style={styles.keyDesc} numberOfLines={1} ellipsizeMode="tail">{item.key}</Text>
              <View style={{flexDirection: 'row', alignItems:'center',justifyContent:'flex-start'}}>
                {
                  !isOther &&
                  <TouchableOpacity onPress={this.onEdit}>
                    <Icon name="ios-create" size={22} style={styles.actionIcon} />
                  </TouchableOpacity>
                }
                {
                  !isOther &&
                  <TouchableOpacity onPress={() => this.props.onDelete(namespaceId, item.key)}>
                    <Icon name="ios-trash" size={22} style={styles.actionIcon} />
                  </TouchableOpacity>
                }
                {
                  isOther && <View style={{height: 40}}/>
                }
              </View>
            </View>
            {(item.height > 0) ?
              <Text style={styles.timestamp}>{timeConverter(item.time) + '     ' + loc.namespaces.height + ' ' + item.height}</Text>
              :
              <Text style={styles.timestamp}>{loc.general.unconfirmed}</Text>
            }
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
      isRefreshing: false,
    };
  }

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    title: '',
    tabBarVisible: false,
    headerRight: () => (!navigation.state.params.isOther &&
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
    const walletId = this.props.navigation.getParam('walletId');
    const wallets = BlueApp.getWallets();
    this.wallet = wallets.find(w => w.getID() == walletId);
    if (!this.wallet) {
      Toast.show('Cannot find the wallet');
      return;
    }
    this.setState({
      showDeleteModal: true,
      currentPage: 0,
      showSkip: true,
      broadcastErr: null,
      isBroadcasting: false,
      createTransactionErr: null,
      fee: 0,
    }, () => {
      setTimeout(async () => {
        try {
          const { tx, fee } = await deleteKeyValue(wallets[0], FALLBACK_DATA_PER_BYTE_FEE, namespaceId, key);
          let feeKVA = fee / 100000000;
          this.setState({ showDeleteModal: true, currentPage: 1, fee: feeKVA });
          this.deleteKeyTx = tx;
        } catch (err) {
          this.setState({createTransactionErr: err.message});
        }
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
    let transactions = [];
    if (this.wallet) {
      await this.wallet.fetchBalance();
      await this.wallet.fetchTransactions();
      transactions = this.wallet.getTransactions();
    }
    if (shortCode) {
      keyValues = await getKeyValuesFromShortCode(BlueElectrum, transactions, shortCode.toString());
    } else if (txid) {
      keyValues = await getKeyValuesFromTxid(BlueElectrum, transactions, txid);
    }

    if (keyValues) {
      let order = keyValueList.order[namespaceId] || [];
      dispatch(setKeyValueList(namespaceId, keyValues, order));
    }
  }

  refreshKeyValues = async (additionalFetch) => {
    try {
      this.setState({isRefreshing: true});
      await BlueElectrum.ping();
      if (additionalFetch) {
        const wallet = this.getCurrentWallet();
        await wallet.fetchBalance();
        await wallet.fetchTransactions();
      }
      await this.fetchKeyValues();
      this.setState({isRefreshing: false});
    } catch (err) {
      this.setState({isRefreshing: false});
      Toast.show('Failed to fetch key values');
    }
  }

  getCurrentWallet = () => {
    const walletId = this.props.navigation.getParam('walletId');
    const wallets = BlueApp.getWallets();
    const wallet = wallets.find(w => w.getID() == walletId);
    return wallet;
  }

  async componentDidMount() {
    try {
      await this.refreshKeyValues();
    } catch (err) {
      Toast.show("Cannot fetch key-values");
    }
    this.subs = [
      this.props.navigation.addListener('willFocus', async () => {
        try {
          this.setState({isRefreshing: true});
          const wallet = this.getCurrentWallet();
          await wallet.fetchBalance();
          await wallet.fetchTransactions();
          await this.fetchKeyValues();
          this.setState({isRefreshing: false});
        } catch (err) {
          this.setState({isRefreshing: false});
        }
      }),
    ];
  }

  componentWillUnmount () {
    if (this.subs) {
      this.subs.forEach(sub => sub.remove());
    }
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
          <TouchableOpacity onPress={this.closeModal}>
            <Text style={{color: KevaColors.actionText, fontSize: 16, paddingVertical: 5}}>
              {loc.general.close}
            </Text>
          </TouchableOpacity>
          {utils.ModalHandle}
          <Text style={{color: '#fff', fontSize: 16}}>
              {loc.general.close}
          </Text>
        </View>
        <View style={{ paddingVertical: 5, marginHorizontal: 10, maxHeight:"90%"}}>
          <Text style={titleStyle}>{key}</Text>
          <ScrollView style={{flexGrow:0}}>
            <TouchableWithoutFeedback>
              <Text style={contentStyle}>{value}</Text>
            </TouchableWithoutFeedback>
          </ScrollView>
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
                  this.setState({showDeleteModal: false, createTransactionErr: null});
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
              await BlueApp.saveToDisk();
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
              });
              await this.refreshKeyValues(true);
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
          onFinish={this.keyDeleteFinish}
          onNext={this.keyDeleteNext}
          onCancel={this.keyDeleteCancel}/>
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
    const namespaceId = navigation.getParam('namespaceId');
    const list = keyValueList.keyValues[namespaceId] || [];
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
        {this.getDeleteModal()}
        {this.getKeyValueModal()}
        {
          list &&
          <FlatList
            style={styles.listStyle}
            contentContainerStyle={{paddingBottom: 400}}
            data={list}
            onRefresh={() => this.refreshKeyValues()}
            refreshing={this.state.isRefreshing}
            renderItem={({item, index}) =>
              <Item item={item} key={index} dispatch={dispatch} onDelete={this.onDelete}
                onShow={this.onShow} namespaceId={namespaceId}
                navigation={navigation}
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
    color: KevaColors.arrowIcon,
    paddingHorizontal: 15,
    paddingVertical: 7
  },
  modal: {
    borderRadius:10,
    backgroundColor: KevaColors.backgroundLight,
    zIndex:999999,
    flexDirection: 'column',
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
  modalDelete: {
    height: 300,
    alignSelf: 'center',
    justifyContent: 'flex-start'
  },
  modalText: {
    fontSize: 18,
    color: KevaColors.lightText,
  },
  waitText: {
    fontSize: 16,
    color: KevaColors.lightText,
    paddingTop: 10,
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
  timestamp: {
    color: KevaColors.extraLightText,
    fontSize: 13,
    position: 'relative',
    top: -5,
  }
});
