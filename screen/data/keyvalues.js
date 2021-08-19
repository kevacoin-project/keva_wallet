import React from 'react';
import {
  Text,
  Image,
  View,
  TouchableOpacity,
  FlatList,
  InteractionManager,
  Clipboard,
} from 'react-native';
import { Button, Image as ImagePlaceholder  } from 'react-native-elements';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, showStatusAlways, hideStatus, toastError } from '../../util';
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
import MIcon from 'react-native-vector-icons/MaterialIcons';
import ActionSheet from 'react-native-actionsheet';
import { connect } from 'react-redux'
import { createThumbnail } from "react-native-create-thumbnail";
import { setKeyValueList, setMediaInfo,
         CURRENT_KEYVALUE_LIST_VERSION, setOtherNamespaceList,
         deleteOtherNamespace,
       } from '../../actions'
import {
        getNamespaceScriptHash, parseSpecialKey,
        deleteKeyValue, getSpecialKeyText,
        getNamespaceInfoFromShortCode, decodeBase64,
        findTxIndex, getNamespaceInfo,
        } from '../../class/keva-ops';
import Toast from 'react-native-root-toast';
import StepModal from "../../common/StepModalWizard";
import { timeConverter, getInitials, stringToColor } from "../../util";
import Biometric from '../../class/biometrics';
import { Avatar } from 'react-native-elements';
import { extractMedia, getImageGatewayURL, removeMedia } from './mediaManager';


const PLAY_ICON  = <MIcon name="play-arrow" size={50} color="#fff"/>;

class Item extends React.Component {

  constructor(props) {
    super(props);
    this.state = { loading: false, selectedImage: null, isRefreshing: false, thumbnail: null };
  }

  onEdit = () => {
    const {navigation, item} = this.props;
    const {walletId, namespaceId} = navigation.state.params;
    navigation.navigate('AddKeyValue', {
      walletId,
      namespaceId,
      key: item.key,
      value: item.value,
    })
  }

  onClose(close) {
    close && close();
    if (this.state.selectedImage) {
      setTimeout(() => this.setState({selectedImage: null}), 50);
    }
  }

  stripHtml = str => {
    return str.replace(/(<([^>]+)>)/gi, "").replace(/(\r\n|\n|\r)/gm, "");
  }

  async componentDidMount() {
    InteractionManager.runAfterInteractions(async () => {
      await this._componentDidMount();
    });
  }

  async _componentDidMount() {
    let {item, mediaInfoList, dispatch} = this.props;
    const {mediaCID, mimeType} = extractMedia(item.value);
    if (!mediaCID || !mimeType.startsWith('video')) {
      return;
    }

    const mediaInfo = mediaInfoList[mediaCID];
    if (mediaInfo) {
      this.setState({thumbnail: mediaInfo.thumbnail, width: mediaInfo.width, height: mediaInfo.height});
      return;
    }

    try {
      let response = await createThumbnail({
        url: getImageGatewayURL(mediaCID),
        timeStamp: 2000,
      });
      dispatch(setMediaInfo(mediaCID, {thumbnail: response.path, width: response.width, height: response.height}));
      this.setState({thumbnail: response.path});
    } catch (err) {
      console.warn(err);
    }
  }

  render() {
    let {item, onShow, onReply, onShare, onReward, namespaceId, displayName, navigation} = this.props;
    let {thumbnail} = this.state;
    const {isOther} = navigation.state.params;
    const {mediaCID, mimeType} = extractMedia(item.value);
    let displayKey = item.key;
    let displayValue = item.value;
    let isBid = false;
    const {keyType} = parseSpecialKey(item.key);
    if (keyType) {
      // TODO: fix this special hack for bidding.
      if (keyType == 'comment' && displayValue.startsWith('psbt')) {
        displayKey = loc.namespaces.make_offer;
        displayValue = '';
        isBid = true;
      } else {
        displayKey = getSpecialKeyText(keyType);
      }
    }
    if ((typeof displayKey) != 'string') {
      displayKey = 'Unknown ' + item.height;
    } else if (displayKey.startsWith('__WALLET_TRANSFER__')) {
      displayKey = loc.namespaces.ns_transfer_explain;
    }

    const canEdit = !isOther && item.type !== 'REG' && keyType != 'profile' && !isBid;

    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => onShow(namespaceId, displayName, item.key, item.value, item.tx_hash, item.shares, item.likes, item.height, item.favorite)}>
          <View style={{flex:1,paddingHorizontal:10,paddingTop:2}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <View style={{paddingRight: 10, paddingTop: 5, paddingBottom: 8}}>
                <Avatar rounded size="small" title={getInitials(displayName)} containerStyle={{backgroundColor: stringToColor(displayName)}}/>
              </View>
              <Text style={styles.keyDesc} numberOfLines={1} ellipsizeMode="tail">{displayKey}</Text>
              <View style={{flexDirection: 'row', alignItems:'center',justifyContent:'flex-start'}}>
                {
                  canEdit &&
                  <TouchableOpacity onPress={this.onEdit}>
                    <Icon name="ios-create" size={22} style={styles.actionIcon} />
                  </TouchableOpacity>
                }
                {
                  canEdit &&
                  <TouchableOpacity onPress={() => this.props.onDelete(namespaceId, item.key)}>
                    <Icon name="ios-trash" size={22} style={styles.actionIcon} />
                  </TouchableOpacity>
                }
                {
                  !canEdit && <View style={{height: 40}}/>
                }
              </View>
            </View>
            {(item.height > 0) ?
              <Text style={styles.timestamp}>{timeConverter(item.time) + '     ' + loc.namespaces.height + ' ' + item.height}</Text>
              :
              <Text style={styles.timestamp}>{loc.general.unconfirmed}</Text>
            }
            <Text style={styles.valueDesc} numberOfLines={3} ellipsizeMode="tail">{this.stripHtml(removeMedia(displayValue))}</Text>
            {
              mediaCID && (
                mimeType.startsWith('video') ?
                <View style={{width: 160, height: 120, marginBottom: 5}}>
                  <Image source={{uri: thumbnail}}
                    style={styles.previewVideo}
                  />
                  <View style={styles.playIcon}>
                    {PLAY_ICON}
                  </View>
                </View>
                :
                <ImagePlaceholder style={styles.previewImage} source={{uri: getImageGatewayURL(mediaCID)}} />
              )
            }
          </View>
        </TouchableOpacity>
        <View style={{flexDirection: 'row'}}>
          <TouchableOpacity onPress={() => onReply(item.tx_hash)} style={{flexDirection: 'row'}}>
            <MIcon name="chat-bubble-outline" size={22} style={styles.talkIcon} />
            {(item.replies > 0) && <Text style={styles.count}>{item.replies}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onShare(item.tx_hash, item.key, item.value, item.height)} style={{flexDirection: 'row'}}>
            <MIcon name="cached" size={22} style={styles.shareIcon} />
            {(item.shares > 0) && <Text style={styles.count}>{item.shares}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReward(item.tx_hash, item.key, item.value, item.height)} style={{flexDirection: 'row'}}>
            {
              item.favorite ?
                <MIcon name="favorite" size={22} style={[styles.shareIcon, {color: KevaColors.favorite}]} />
              :
                <MIcon name="favorite-border" size={22} style={styles.shareIcon} />
            }
            {(item.likes > 0) && <Text style={styles.count}>{item.likes}</Text> }
          </TouchableOpacity>
        </View>
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
      totalToFetch: 0,
      fetched: 0,
    };
    this.onEndReachedCalledDuringMomentum = true;
    this.min_tx_num = -1;
  }

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    title: '',
    tabBarVisible: false,
    headerRight: () => (!navigation.state.params.isOther &&
      <View style={{flexDirection: 'row', justifyContent: 'flex-end'}}>
        <TouchableOpacity
          style={{ marginHorizontal: 5, justifyContent: 'center', alignItems: 'flex-end', position: 'relative', top: 1 }}
          onPress={() =>
            navigation.navigate('ScanQRCode', {
              launchedBy: navigation.state.routeName,
              onBarScanned: navigation.state.params.onBarCodeRead,
            })
          }
        >
          <Icon name="md-qr-scanner" size={26} color={KevaColors.actionText} />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ marginHorizontal: 16, minWidth: 30, justifyContent: 'center', alignItems: 'flex-end' }}
          onPress={() =>
            navigation.navigate('AddKeyValue', {
              walletId: navigation.state.params.walletId,
              namespaceId: navigation.state.params.namespaceId,
            })
          }
        >
          <Icon name="md-add" size={30} color={KevaColors.actionText} />
        </TouchableOpacity>
      </View>
    ),
    headerStyle: { backgroundColor: '#fff', elevation:0, shadowColor: 'transparent', borderBottomWidth: THIN_BORDER, borderColor: KevaColors.cellBorder },
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

  progressCallback = (totalToFetch, fetched) => {
    this.setState({totalToFetch, fetched});
  }

  decodeKeyValueList = (keyValues) => {
    // Base64 decode
    let decodedKeyValues = keyValues.map(kv => {
      if (kv.displayName) {
        kv.displayName = decodeBase64(kv.displayName);
      }
      if (kv.key) {
        kv.key = decodeBase64(kv.key);
      }
      if (kv.value) {
        kv.value = Buffer.from(kv.value, 'base64').toString('utf-8');
      }
      return kv;
    });
    return decodedKeyValues;
  }

  fetchKeyValues = async (min_tx_num) => {
    const {navigation, dispatch, keyValueList, reactions} = this.props;
    let {namespaceId, shortCode} = navigation.state.params;

    let nsData;
    if (!namespaceId && shortCode) {
      // We are here because user clicks on the short code.
      // There is no namespaceId yet.
      nsData = await getNamespaceInfoFromShortCode(BlueElectrum, shortCode);
      if (!nsData) {
        return;
      }
      namespaceId = nsData.namespaceId;
      this.namespaceId = namespaceId;
      this.displayName = nsData.displayName;
    } else if (namespaceId) {
      nsData = await getNamespaceInfo(BlueElectrum, namespaceId, false);
      if (!nsData) {
        return;
      }
    }

    if (nsData.value) {
      const value = JSON.parse(nsData.value);
      const {price, desc, addr} = value;
      this.setState({
        price, desc, addr, saleTx: nsData.tx,
      });
    }

    const history = await BlueElectrum.blockchainKeva_getKeyValues(getNamespaceScriptHash(namespaceId), min_tx_num);
    if (history.keyvalues.length == 0) {
      return;
    }

    const keyValues = this.decodeKeyValueList(history.keyvalues);
    // Check if it is a favorite.
    for (let kv of keyValues) {
      const reaction = reactions[kv.tx_hash];
      kv.favorite = reaction && !!reaction['like'];
    }

    if (history.min_tx_num < this.min_tx_num) {
      const combined = keyValueList.keyValues[namespaceId].concat(keyValues);
      dispatch(setKeyValueList(namespaceId, combined));
    } else {
      dispatch(setKeyValueList(namespaceId, keyValues));
    }
    this.min_tx_num = history.min_tx_num;
  }

  refreshKeyValues = async (min_tx_num) => {
    try {
      this.setState({isRefreshing: true});
      await BlueElectrum.ping();
      await this.fetchKeyValues(min_tx_num);
      this.setState({isRefreshing: false});
    } catch (err) {
      this.setState({isRefreshing: false});
      console.warn(err);
      Toast.show('Failed to fetch key values');
    }
  }

  loadMoreKeyValues = async () => {
    if(this.onEndReachedCalledDuringMomentum) {
      return;
    }
    try {
      this.setState({isLoadingMore: true});
      await BlueElectrum.ping();
      await this.fetchKeyValues(this.min_tx_num);
      this.setState({isLoadingMore: false});
      this.onEndReachedCalledDuringMomentum = true;
    } catch (err) {
      this.onEndReachedCalledDuringMomentum = true;
      this.setState({isLoadingMore: false});
      console.warn(err);
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
    // NFT sale info.
    let {price, desc, addr, txid} = this.props.navigation.state.params;
    this.setState({price, desc, addr, saleTx: txid});

    // Check the version of redux store KeyValue list version.
    // If not matched, nuke it and start over again.
    let {keyValueList, dispatch} = this.props;
    if (keyValueList.version != CURRENT_KEYVALUE_LIST_VERSION) {
      // Older version data, remove all of them.
      dispatch(setKeyValueList());
    }

    try {
      await this.refreshKeyValues(-1);
    } catch (err) {
      Toast.show("Cannot fetch key-values");
    }
    this.isBiometricUseCapableAndEnabled = await Biometric.isBiometricUseCapableAndEnabled();

    this.props.navigation.setParams({
      onBarCodeRead: this.onBarCodeRead,
    });
  }

  onBarCodeRead = data => {
    const navigation = this.props.navigation;
    InteractionManager.runAfterInteractions(() => {
      let dataJSON;
      try {
        dataJSON = JSON.parse(data);
      } catch (e) {
        alert(loc.namespaces.qr_json_error);
        return;
      }
      const {key, value} = dataJSON;
      // Check the content, it must have both key and value field.
      if (!key || !value) {
        alert(loc.namespaces.qr_error);
        return;
      }
      navigation.navigate('AddKeyValue', {
        walletId: navigation.state.params.walletId,
        namespaceId: navigation.state.params.namespaceId,
        key, value: (typeof value === 'string') ? value : JSON.stringify(value),
      })
    });
  };

  componentWillUnmount() {
    if (this.subs) {
      this.subs.forEach(sub => sub.remove());
    }
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
              await this.refreshKeyValues(-1);
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

  onShow = (namespaceId, displayName, key, value, tx, shares, likes, height, favorite) => {
    const {dispatch, navigation, keyValueList} = this.props;
    const isOther = navigation.getParam('isOther');
    const shortCode = navigation.getParam('shortCode');
    const index = findTxIndex(keyValueList.keyValues[namespaceId], tx);
    navigation.push('ShowKeyValue', {
      namespaceId,
      index,
      type: 'keyvalue',
      shortCode,
      displayName,
      replyTxid: tx,
      shareTxid: tx,
      rewardTxid: tx,
      isOther,
      height,
    });
  }

  onReply = (replyTxid) => {
    const {navigation, namespaceList, keyValueList} = this.props;
    let {namespaceId} = navigation.state.params;
    if (!namespaceId) {
      // Try the resolved one.
      namespaceId = this.namespaceId;
    }
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    const index = findTxIndex(keyValueList.keyValues[namespaceId], replyTxid);
    if (index < 0) {
      return;
    }

    navigation.navigate('ReplyKeyValue', {
      namespaceId,
      index,
      type: 'keyvalue',
      replyTxid,
    })
  }

  onShare = (shareTxid, key, value) => {
    const {navigation, namespaceList, keyValueList} = this.props;
    let {namespaceId} = navigation.state.params;
    if (!namespaceId) {
      // Try the resolved one.
      namespaceId = this.namespaceId;
    }
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    const index = findTxIndex(keyValueList.keyValues[namespaceId], shareTxid);
    if (index < 0) {
      return;
    }

    navigation.navigate('ShareKeyValue', {
      namespaceId,
      index,
      type: 'keyvalue',
      shareTxid,
      origKey: key,
      origValue: value
    })
  }

  onReward = (rewardTxid, key, value, height) => {
    const {navigation, namespaceList, keyValueList} = this.props;
    let {namespaceId} = navigation.state.params;
    if (!namespaceId) {
      // Try the resolved one.
      namespaceId = this.namespaceId;
    }
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    const index = findTxIndex(keyValueList.keyValues[namespaceId], rewardTxid);
    if (index < 0) {
      return;
    }

    const shortCode = navigation.getParam('shortCode');
    navigation.navigate('RewardKeyValue', {
      namespaceId,
      index,
      type: 'keyvalue',
      rewardTxid,
      origKey: key,
      origValue: value,
      origShortCode: shortCode,
      height,
    });
  }

  onEditProfile = (namespaceId, namespaceInfo) => {
    const {navigation} = this.props;
    const {walletId} = navigation.state.params;
    navigation.navigate('EditProfile', {
      walletId,
      namespaceId,
      namespaceInfo,
    });
  }

  onUnfollow = (namespaceId) => {
    const {dispatch} = this.props;
    dispatch(deleteOtherNamespace(namespaceId));
  }

  onFollow = (namespaceId, namespaceInfo) => {
    const {otherNamespaceList, dispatch} = this.props;
    let order = [...otherNamespaceList.order];
    if (!order.find(nsid => nsid == namespaceId)) {
      order.unshift(namespaceId);
    }
    dispatch(setOtherNamespaceList(namespaceInfo, order));
  }

  copyString = str => {
    Clipboard.setString(str);
    Toast.show(loc.general.copiedToClipboard, {
      position: Toast.positions.TOP,
      backgroundColor: "#53DD6C",
    });
  }

  processKeyValueList = (origkeyValues) => {
    // Merge the results.
    let keyValues = [];
    const reverseKV = origkeyValues.slice().reverse();
    for (let kv of reverseKV) {
      if (kv.type === 'PUT') {
        // Override the existing one.
        const i = keyValues.findIndex(e => e.key == kv.key);
        if (i >= 0 && keyValues[i].type != 'REG') {
          keyValues[i] = kv;
        } else {
          keyValues.push(kv);
        }
      } else if (kv.type === 'DEL') {
        keyValues = keyValues.filter(e => {
          if (e.type == 'REG') {
            return true;
          }
          if ((typeof e.key) != (typeof kv.key)) {
            return true;
          }
          if ((typeof e.key) == 'string') {
            return e.key != kv.key;
          } else if ((typeof e.key) == 'object') {
            return JSON.stringify(e.key.data) != JSON.stringify(kv.key.data);
          }
          return false;
        });
      } else if (kv.type === 'REG') {
        // Special treatment for namespace creation.
        keyValues.push({key: kv.displayName, value: loc.namespaces.created, ...kv});
      }
    }
    return keyValues.reverse();
  }

  onSaleCreated = () => {
    setTimeout(() => {
      this.refreshKeyValues(-1);
    }, 1000);
  }

  onSellNFT = (namespaceId, namespaceInfo) => {
    const {navigation} = this.props;
    const {walletId} = navigation.state.params;
    navigation.navigate('SellNFT', {
      walletId,
      namespaceId,
      namespaceInfo,
      onSaleCreated: this.onSaleCreated,
    });
  }

  onCancelSale = () => {
    setTimeout(() => {
      this.refreshKeyValues(-1);
    }, 1000);
  }

  onBuy = (namespaceId, displayName, saleTx, price, desc, addr, profile) => {
    const {navigation, keyValueList} = this.props;
    const {isOther, shortCode, walletId, onSoldorOffer} = navigation.state.params;
    const index = findTxIndex(keyValueList.keyValues[namespaceId], saleTx);
    navigation.push('BuyNFT', {
      walletId,
      namespaceId,
      index,
      type: 'keyvalue',
      displayName,
      shortCode,
      replyTxid: saleTx,
      isOther,
      price,
      desc,
      addr,
      profile,
      onCancelSale: this.onCancelSale,
      onSoldorOffer,
    });
  }

  render() {
    let {navigation, dispatch, keyValueList, mediaInfoList, namespaceList, otherNamespaceList} = this.props;
    let {isOther, namespaceId, displayName, shortCode, profile} = navigation.state.params;
    if (!namespaceId) {
      namespaceId = this.namespaceId;
    }

    let namespace;
    if (!isOther) {
      namespace = namespaceList.namespaces[namespaceId];
      if (namespace) {
        displayName = namespace.displayName;
      }
    }

    if (!displayName) {
      displayName = this.displayName;
    }

    const list = keyValueList.keyValues[namespaceId] || [];
    const mergeListAll = this.processKeyValueList(list);
    let mergeList;
    if (isOther) {
      mergeList = mergeListAll.filter(m => {
        const {keyType} = parseSpecialKey(m.key);
        return !keyType || keyType === 'share';
      });
    } else {
      mergeList = mergeListAll;
    }

    const buyNFTBtn = (
      <Button
        type='solid'
        buttonStyle={{marginLeft: 15, borderRadius: 30, height: 28, width: 120, padding: 0, borderColor: KevaColors.okColor, backgroundColor: KevaColors.okColor}}
        title={ isOther ? loc.namespaces.buy_it : loc.namespaces.manage}
        titleStyle={{fontSize: 14, color: '#fff', marginLeft: 8}}
        onPress={()=>{this.onBuy(namespaceId, displayName, this.state.saleTx, this.state.price, this.state.desc, this.state.addr, profile)}}
        icon={
          <Icon
            name="ios-cart"
            size={20}
            color="#fff"
          />
        }
      />
    );

    let listHeader = null;
    if (mergeList) {
      const isFollowing = !!otherNamespaceList.namespaces[namespaceId];
      const namespaceInfo = {}
      namespaceInfo[namespaceId] = {
        id: namespaceId,
        displayName,
        shortCode,
      }
      listHeader = (
        <View style={styles.container}>
          <View style={styles.keyContainer}>
            <View style={{paddingRight: 20, alignSelf: 'center'}}>
              <Avatar rounded size="medium" title={getInitials(displayName)} containerStyle={{backgroundColor: stringToColor(displayName)}}/>
            </View>
            <View style={{paddingRight: 10, flexShrink: 1}}>
              <View style={{flexDirection: 'row', marginBottom: 5}}>
                <Text style={styles.sender} numberOfLines={1} ellipsizeMode="tail">
                  {displayName + ' '}
                </Text>
                <TouchableOpacity onPress={() => this.copyString(shortCode)}>
                  <Text style={styles.shortCode}>
                    {`@${shortCode}`}
                  </Text>
                </TouchableOpacity>
              </View>
              {
                isOther ?
                (isFollowing ?
                  <View style={{flexDirection: 'row'}}>
                    <Button
                      type='solid'
                      buttonStyle={{borderRadius: 30, height: 28, width: 120, borderColor: KevaColors.actionText, backgroundColor: KevaColors.actionText}}
                      title={loc.namespaces.following}
                      titleStyle={{fontSize: 14, color: '#fff'}}
                      onPress={()=>{this.onUnfollow(namespaceId)}}
                    />
                    { this.state.price && buyNFTBtn }
                  </View>
                  :
                  <View style={{flexDirection: 'row'}}>
                    <Button
                      type='outline'
                      buttonStyle={{borderRadius: 30, height: 28, width: 120, borderColor: KevaColors.actionText}}
                      title={loc.namespaces.follow}
                      titleStyle={{fontSize: 14, color: KevaColors.actionText}}
                      onPress={()=>{this.onFollow(namespaceId, namespaceInfo)}}
                    />
                    { this.state.price && buyNFTBtn }
                  </View>
                )
                :
                (
                <View style={{flexDirection: 'row'}}>
                  <Button
                    type='outline'
                    buttonStyle={{borderRadius: 30, height: 28, width: 100, padding: 0, borderColor: KevaColors.actionText}}
                    title={loc.namespaces.edit}
                    titleStyle={{fontSize: 14, color: KevaColors.actionText}}
                    onPress={()=>{this.onEditProfile(namespaceId, namespaceInfo[namespaceId])}}
                    disabled={!!this.state.price}
                  />
                  {
                    this.state.price ?
                    buyNFTBtn
                    :
                    <Button
                      type='solid'
                      buttonStyle={{marginLeft: 10, borderRadius: 30, height: 28, width: 100, padding: 0, borderColor: KevaColors.actionText, backgroundColor: KevaColors.actionText}}
                      title={loc.namespaces.sell_nft}
                      titleStyle={{fontSize: 14, color: '#fff'}}
                      onPress={()=>{this.onSellNFT(namespaceId, namespaceInfo[namespaceId])}}
                    />
                  }
                </View>
                )
            }
            </View>
          </View>
        </View>
      );
    }

    const footerLoader = this.state.isLoadingMore ? <BlueLoading style={{paddingTop: 30, paddingBottom: 400}} /> : null;
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
        {
          (list.length == 0) &&
          <Text style={{paddingTop: 20, alignSelf: 'center', color: KevaColors.okColor, fontSize: 16}}>
            {loc.namespaces.scanning_block} {/* this.state.fetched + ' / ' + this.state.totalToFetch */} ...
          </Text>
        }
        {
          mergeList &&
          <FlatList
            style={styles.listStyle}
            contentContainerStyle={{paddingBottom: 400}}
            ListHeaderComponent={listHeader}
            data={mergeList}
            onEndReached={() => {this.loadMoreKeyValues()}}
            onEndReachedThreshold={0.5}
            onMomentumScrollBegin={() => { this.onEndReachedCalledDuringMomentum = false; }}
            onRefresh={() => this.refreshKeyValues(-1)}
            refreshing={this.state.isRefreshing}
            keyExtractor={(item, index) => item.key + index}
            ListFooterComponent={footerLoader}
            renderItem={({item, index}) =>
              <Item item={item} key={index} dispatch={dispatch} onDelete={this.onDelete}
                onShow={this.onShow} namespaceId={namespaceId}
                displayName={displayName}
                onReply={this.onReply}
                onShare={this.onShare}
                onReward={this.onReward}
                navigation={navigation}
                mediaInfoList={mediaInfoList}
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
    namespaceList: state.namespaceList,
    otherNamespaceList: state.otherNamespaceList,
    mediaInfoList: state.mediaInfoList,
    reactions: state.reactions,
  }
}

export default KeyValuesScreen = connect(mapStateToProps)(KeyValues);

var styles = StyleSheet.create({
  container: {
    flex:1,
  },
  listStyle: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
  },
  card: {
    backgroundColor:'#fff',
    marginVertical:0,
    borderBottomWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
  },
  keyDesc: {
    flex: 1,
    fontSize:16,
    color: KevaColors.darkText,
  },
  valueDesc: {
    flex: 1,
    fontSize:15,
    marginBottom: 10,
    color: KevaColors.darkText
  },
  actionIcon: {
    color: KevaColors.arrowIcon,
    paddingHorizontal: 15,
    paddingVertical: 7
  },
  talkIcon: {
    color: KevaColors.arrowIcon,
    paddingLeft: 15,
    paddingRight: 2,
    paddingVertical: 7
  },
  shareIcon: {
    color: KevaColors.arrowIcon,
    paddingLeft: 15,
    paddingRight: 2,
    paddingVertical: 7
  },
  count: {
    color: KevaColors.arrowIcon,
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
    android: {
      marginTop: 20,
    },
    ios: {
      marginTop: 50,
    }
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
  },
  previewImage: {
    width: 90,
    height:90,
    alignSelf: 'flex-start',
    borderRadius: 6,
  },
  previewVideo: {
    width: 160,
    height: 120,
    alignSelf: 'flex-start',
    borderRadius: 0,
  },
  playIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  keyContainer: {
    marginBottom: 10,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    padding: 10,
    flexDirection: 'row',
  },
  key: {
    fontSize: 16,
    color: KevaColors.darkText,
    flex: 1,
    flexWrap: 'wrap',
  },
  sender: {
    fontSize: 16,
    fontWeight: '700',
    color: KevaColors.darkText,
    lineHeight: 25,
    paddingBottom: 5,
    maxWidth: 220,
  },
  shortCode: {
    fontSize: 16,
    fontWeight: '700',
    color: KevaColors.actionText,
    lineHeight: 25,
    paddingBottom: 5,
  },
});
