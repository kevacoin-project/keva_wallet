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
import ElevatedView from 'react-native-elevated-view';
import { connect } from 'react-redux'
import { setKeyValueList } from '../../actions'
import { getKeyValuesFromShortCode, getKeyValuesFromTxid } from '../../class/keva-ops';

const CLOSE_ICON    = <Icon name="ios-close" size={42} color={KevaColors.errColor}/>;
const CLOSE_ICON_MODAL = (<Icon name="ios-close" size={36} color={KevaColors.darkText} style={{paddingVertical: 5, paddingHorizontal: 15}} />)
const CHECK_ICON    = <Icon name="ios-checkmark" size={42} color={KevaColors.okColor}/>;
const LIBRARY_ICON  = <Icon name="ios-images" size={30} color={KevaColors.icon}/>;
const CAMERA_ICON   = <Icon name="ios-camera" size={30} color={KevaColors.icon}/>;

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
    let {data, onShow} = this.props;
    let item = data;

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
                <TouchableOpacity onPress={() => this.props.onDelete(this.props.itemId)}>
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

  onDelete = itemId => {
    this._itemId = itemId;
    this._actionDelete.show();
  }

  deleteItem(itemId) {
    const navigation = this.props.navigation;
    const propertyId = navigation.state.params.propertyId;
    let categoryId = navigation.state.params.categoryId;
    const checkListId = this.props.checklist[propertyId].id;
    this.props.dispatch(deleteItemAsync(propertyId, checkListId, categoryId, itemId)).then(checklist => {
      LayoutAnimation.configureNext({
        duration: 200,
        update: {type: LayoutAnimation.Types.easeInEaseOut}
      });
      this.props.dispatch(setChecklist(propertyId, checklist));
    })
    .then(() => {
      this.props.dispatch(getPropertiesAsync());
    })
    .catch(err => {
      console.log(err);
      utils.showToast('Failed to delete. Check network connection.')
    });
  }

  onDeleteConfirm = index => {
    if (index === 0 && this._itemId) {
      this.deleteItem(this._itemId);
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

  getNSModal() {
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

  onShow = (key, value) => {
    this.setState({
      isModalVisible: true,
      key, value
    });
  }

  render() {
    let {navigation, dispatch, keyValueList} = this.props;
    const namespaceId = navigation.getParam('namespaceId');
    const list = keyValueList.keyValues[namespaceId];
    return (
      <View style={styles.container}>
        {/*
        <ActionSheet
           ref={ref => this._actionDelete = ref}
           title={'Are you sure you want to delete it?'}
           options={[Lang.general.delete, Lang.general.cancel]}
           cancelButtonIndex={1}
           destructiveButtonIndex={0}
           onPress={this.onDeleteConfirm}
        />
        */}
        {this.getNSModal()}
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
                onShow={this.onShow}
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
