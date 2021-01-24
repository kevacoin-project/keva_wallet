import React from 'react';
import {
  Text,
  Image,
  View,
  TouchableOpacity,
  FlatList,
  InteractionManager,
} from 'react-native';
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
import { setKeyValueList, setMediaInfo, CURRENT_KEYVALUE_LIST_VERSION } from '../../actions'
import {
        fetchKeyValueList, getNamespaceScriptHash, parseSpecialKey,
        deleteKeyValue, mergeKeyValueList, getRepliesAndShares, getSpecialKeyText,
        getNamespaceInfoFromShortCode
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
    const {keyType} = parseSpecialKey(item.key);
    if (keyType) {
      displayKey = getSpecialKeyText(keyType);
    }
    const canEdit = !isOther && item.op !== 'KEVA_OP_NAMESPACE';

    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => onShow(namespaceId, displayName, item.key, item.value, item.tx, item.replies, item.shares, item.rewards, item.height, item.favorite)}>
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
            <Text style={styles.valueDesc} numberOfLines={3} ellipsizeMode="tail">{this.stripHtml(removeMedia(item.value))}</Text>
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
                <Image style={styles.previewImage} source={{uri: getImageGatewayURL(mediaCID)}} />
              )
            }
          </View>
        </TouchableOpacity>
        <View style={{flexDirection: 'row'}}>
          <TouchableOpacity onPress={() => onReply(item.tx)} style={{flexDirection: 'row'}}>
            <MIcon name="chat-bubble-outline" size={22} style={styles.talkIcon} />
            {(item.replies && item.replies.length > 0) && <Text style={styles.count}>{item.replies.length}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onShare(item.tx, item.key, item.value, item.height)} style={{flexDirection: 'row'}}>
            <MIcon name="cached" size={22} style={styles.shareIcon} />
            {(item.shares && item.shares.length > 0) && <Text style={styles.count}>{item.shares.length}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReward(item.tx, item.key, item.value, item.height)} style={{flexDirection: 'row'}}>
            {
              item.favorite ?
                <MIcon name="favorite" size={22} style={[styles.shareIcon, {color: KevaColors.favorite}]} />
              :
                <MIcon name="favorite-border" size={22} style={styles.shareIcon} />
            }
            {(item.rewards && item.rewards.length > 0) && <Text style={styles.count}>{item.rewards.length}</Text> }
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
        <Icon name="md-add" type="octicon" size={30} color={KevaColors.actionText} />
      </TouchableOpacity>
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

  fastFetchKeyValues = async (dispatch, namespaceId, history, kvList, cb) => {
    const {namespaceList} = this.props;
    const myNamespaces = namespaceList.namespaces;

    let keyValues = await fetchKeyValueList(BlueElectrum, history, kvList, true, cb);
    if (!keyValues) {
      return;
    }
    dispatch(setKeyValueList(namespaceId, keyValues));

    // Fetch replies.
    const {replies, shares, rewards} = await getRepliesAndShares(BlueElectrum, history);

    // Add the replies.
    for (let kv of keyValues) {
      const txReplies = replies.filter(r => kv.tx.startsWith(r.partialTxId));
      if (txReplies && txReplies.length > 0) {
        kv.replies = txReplies;
      }
    }

    // Add the rewards
    for (let kv of keyValues) {
      const txRewards = rewards.filter(r => kv.tx == r.partialTxId);
      if (txRewards && txRewards.length > 0) {
        kv.rewards = txRewards;
        kv.favorite = txRewards.find(r => Object.keys(myNamespaces).find(n => myNamespaces[n].id == r.rewarder.namespaceId));
      }
    }

    // Add the shares
    for (let kv of keyValues) {
      const txShares = shares.filter(r => kv.tx == r.sharedTxId);
      if (txShares && txShares.length > 0) {
        kv.shares = txShares;
      }
    }

    dispatch(setKeyValueList(namespaceId, keyValues));
  }

  fetchKeyValues = async () => {
    const {navigation, dispatch, keyValueList, namespaceList} = this.props;
    const myNamespaces = namespaceList.namespaces;
    let {namespaceId, shortCode} = navigation.state.params;

    if (!namespaceId && shortCode) {
      // We are here because user clicks on the short code.
      // There is no namespaceId yet.
      let nsData = await getNamespaceInfoFromShortCode(BlueElectrum, shortCode);
      if (!nsData) {
        return;
      }
      namespaceId = nsData.namespaceId;
      this.namespaceId = namespaceId;
      this.displayName = nsData.displayName;
    }

    let kvList = keyValueList.keyValues[namespaceId];
    let cb;

    const history = await BlueElectrum.blockchainScripthash_getHistory(getNamespaceScriptHash(namespaceId));
    if (!kvList || kvList.length == 0) {
      cb = this.progressCallback;
      // Show some results ASAP.
      await this.fastFetchKeyValues(dispatch, namespaceId, history, kvList, cb);
    }

    let keyValues = await fetchKeyValueList(BlueElectrum, history, kvList, false, cb);
    if (!keyValues) {
      return;
    }

    // Fetch replies.
    const {replies, shares, rewards} = await getRepliesAndShares(BlueElectrum, history);
    // Add the replies.
    for (let kv of keyValues) {
      const txReplies = replies.filter(r => kv.tx.startsWith(r.partialTxId));
      if (txReplies && txReplies.length > 0) {
        kv.replies = txReplies;
      }
    }

    // Add the rewards
    for (let kv of keyValues) {
      const txRewards = rewards.filter(r => kv.tx.startsWith(r.partialTxId));
      if (txRewards && txRewards.length > 0) {
        kv.rewards = txRewards;
        kv.favorite = txRewards.find(r => Object.keys(myNamespaces).find(n => myNamespaces[n].id == r.rewarder.namespaceId));
      }
    }

    // Add the shares
    for (let kv of keyValues) {
      const txShares = shares.filter(r => kv.tx == r.sharedTxId);
      if (txShares && txShares.length > 0) {
        kv.shares = txShares;
      }
    }
    dispatch(setKeyValueList(namespaceId, keyValues));
  }

  refreshKeyValues = async () => {
    try {
      this.setState({isRefreshing: true});
      await BlueElectrum.ping();
      await this.fetchKeyValues();
      this.setState({isRefreshing: false});
    } catch (err) {
      this.setState({isRefreshing: false});
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
    // Check the version of redux store KeyValue list version.
    // If not matched, nuke it and start over again.
    let {keyValueList, dispatch} = this.props;
    if (keyValueList.version != CURRENT_KEYVALUE_LIST_VERSION) {
      // Older version data, remove all of them.
      dispatch(setKeyValueList());
    }

    try {
      await this.refreshKeyValues();
    } catch (err) {
      Toast.show("Cannot fetch key-values");
    }
    this.isBiometricUseCapableAndEnabled = await Biometric.isBiometricUseCapableAndEnabled();
    this.subs = [
      this.props.navigation.addListener('willFocus', async (payload) => {
        const routeName = payload.lastState.routeName;
        if (routeName == "ShowKeyValue") {
          return;
        }
        let toast;
        try {
          this.setState({isRefreshing: true});
          toast = showStatusAlways(loc.namespaces.refreshing);
          await this.fetchKeyValues();
          this.setState({isRefreshing: false});
          hideStatus(toast);
        } catch (err) {
          hideStatus(toast);
          console.warn(err)
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
              await this.refreshKeyValues();
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

  onShow = (namespaceId, displayName, key, value, tx, replies, shares, rewards, height, favorite) => {
    const {navigation} = this.props;
    const isOther = navigation.getParam('isOther');
    const shortCode = navigation.getParam('shortCode');
    navigation.push('ShowKeyValue', {
      namespaceId,
      shortCode,
      displayName,
      key,
      value,
      replyTxid: tx,
      shareTxid: tx,
      rewardTxid: tx,
      replies,
      shares,
      rewards,
      favorite,
      isOther,
      height,
    });
  }

  onReply = (replyTxid) => {
    const {navigation, namespaceList} = this.props;
    const {rootAddress, namespaceId} = navigation.state.params;
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    navigation.navigate('ReplyKeyValue', {
      rootAddress,
      replyTxid
    })
  }

  onShare = (shareTxid, key, value) => {
    const {navigation, namespaceList} = this.props;
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    navigation.navigate('ShareKeyValue', {
      shareTxid,
      origKey: key,
      origValue: value
    })
  }

  onReward = (rewardTxid, key, value, height) => {
    const {navigation, namespaceList} = this.props;
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    const shortCode = navigation.getParam('shortCode');
    navigation.navigate('RewardKeyValue', {
      rewardTxid,
      origKey: key,
      origValue: value,
      origShortCode: shortCode,
      height,
    })
  }

  render() {
    let {navigation, dispatch, keyValueList, mediaInfoList} = this.props;
    let {isOther, namespaceId, displayName} = navigation.state.params;
    if (!namespaceId) {
      namespaceId = this.namespaceId;
    }
    if (!displayName) {
      displayName = this.displayName;
    }

    const list = keyValueList.keyValues[namespaceId] || [];
    const mergeListAll = mergeKeyValueList(list);
    let mergeList;
    if (isOther) {
      mergeList = mergeListAll.filter(m => {
        const {keyType} = parseSpecialKey(m.key);
        return !keyType || keyType === 'share';
      });
    } else {
      mergeList = mergeListAll;
    }

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
            data={mergeList}
            onRefresh={() => this.refreshKeyValues()}
            refreshing={this.state.isRefreshing}
            keyExtractor={(item, index) => item.key + index}
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
    mediaInfoList: state.mediaInfoList,
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
});
