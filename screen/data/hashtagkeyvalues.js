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
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, showStatusAlways, hideStatus, toastError } from '../../util';
import {
  BlueNavigationStyle,
  BlueLoading,
} from '../../BlueComponents';
const loc = require('../../loc');
let BlueApp = require('../../BlueApp');
let BlueElectrum = require('../../BlueElectrum');

import MIcon from 'react-native-vector-icons/MaterialIcons';
import { connect } from 'react-redux'
import { createThumbnail } from "react-native-create-thumbnail";
import { Avatar } from 'react-native-elements';
import { setMediaInfo, } from '../../actions'
import {
        fetchKeyValueList, getHashtagScriptHash, parseSpecialKey,
        getNamespaceInfo, getRepliesAndShares, getSpecialKeyText,
        } from '../../class/keva-ops';
import Toast from 'react-native-root-toast';
import { timeConverter, stringToColor, getInitials, SCREEN_WIDTH, } from "../../util";
import Biometric from '../../class/biometrics';
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
    let {item, onShow, onReply, onShare, onReward} = this.props;
    let {thumbnail} = this.state;
    const {mediaCID, mimeType} = extractMedia(item.value);
    let displayKey = item.key;
    const {keyType} = parseSpecialKey(item.key);
    if (keyType) {
      displayKey = getSpecialKeyText(keyType);
    }

    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => onShow(item.key, item.value, item.tx, item.replies, item.shares, item.rewards, item.height, item.favorite, item.shortCode, item.displayName)}>
          <View style={{flex:1,paddingHorizontal:10,paddingTop:2}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <View style={{paddingRight: 10}}>
                <Avatar rounded size="small" title={getInitials(item.displayName)} containerStyle={{backgroundColor: stringToColor(item.displayName)}}/>
              </View>
              <Text style={styles.keyDesc} numberOfLines={1} ellipsizeMode="tail">{displayKey}</Text>
              <View style={{flexDirection: 'row', alignItems:'center',justifyContent:'flex-start'}}>
                <View style={{height: 50}}/>
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
            {(item.replies > 0) && <Text style={styles.count}>{item.replies}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onShare(item.tx, item.key, item.value, item.height)} style={{flexDirection: 'row'}}>
            <MIcon name="cached" size={22} style={styles.shareIcon} />
            {(item.shares > 0) && <Text style={styles.count}>{item.shares}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReward(item.tx, item.key, item.value, item.height)} style={{flexDirection: 'row'}}>
            {
              item.favorite ?
                <MIcon name="favorite" size={22} style={[styles.shareIcon, {color: KevaColors.favorite}]} />
              :
                <MIcon name="favorite-border" size={22} style={styles.shareIcon} />
            }
            {(item.rewards > 0) && <Text style={styles.count}>{item.rewards}</Text> }
          </TouchableOpacity>
        </View>
      </View>
    )
  }
}

class HashtagKeyValues extends React.Component {

  constructor() {
    super();
    this.state = {
      hashtagkeyValueList: [],
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
    headerStyle: { backgroundColor: '#fff', elevation:0, shadowColor: 'transparent', borderBottomWidth: THIN_BORDER, borderColor: KevaColors.cellBorder },
  });

  progressCallback = (totalToFetch, fetched) => {
    this.setState({totalToFetch, fetched});
  }

  fetchHashtag = async () => {
    const {navigation, namespaceList} = this.props;
    const myNamespaces = namespaceList.namespaces;
    const {hashtag} = navigation.state.params;

    /*
      Data returned by ElectrumX API
      {
        hashtags: [{
          'tx_hash': hash_to_hex_str(tx_hash),
          'displayName': display_name,
          'height': height, 'shortCode': shortCode,
          'time': timestamp,
          'replies': replies, 'shares': shares, 'likes': likes,
          'namespace': namespaceId,
          'key': key,
          'value': value,
          'type': REG|PUT|DEL|UNK
        }],
        min_tx_num: 123
      }
    */
    let history = await BlueElectrum.blockchainKeva_getHashtag(getHashtagScriptHash(hashtag));
    if (history.hashtags.length == 0) {
        return [];
    }
    const keyValues = history.hashtags.map(h => {
      return {
        displayName: h.displayName,
        shortCode: h.shortCode,
        tx: h.tx_hash,
        replies: h.replies,
        shares: h.shares,
        rewards: h.likes,
        height: h.height,
        time: h.time,
        namespaceId: h.namespace,
        key: Buffer.from(h.key, 'base64').toString(),
        value: h.value ? Buffer.from(h.value, 'base64').toString() : '',
        favorite: false //TODO: fix this.
      }
    });
    this.setState({hashtagkeyValueList: keyValues});
  }

  refreshKeyValues = async () => {
    try {
      this.setState({isRefreshing: true});
      await BlueElectrum.ping();
      await this.fetchHashtag();
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
          await this.fetchHashtag();
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

  onShow = (key, value, tx, replies, shares, rewards, height, favorite, shortCode, displayName) => {
    const {navigation} = this.props;
    const rootAddress = navigation.getParam('rootAddress');
    const namespaceId = navigation.getParam('namespaceId');
    navigation.push('ShowKeyValue', {
      namespaceId,
      shortCode,
      displayName,
      key,
      value,
      rootAddress,
      replyTxid: tx,
      shareTxid: tx,
      rewardTxid: tx,
      replies: [], //replies,
      shares: [], //shares,
      rewards: [], //rewards,
      favorite,
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

  onShare = (shareTxid, key, value, blockHeight) => {
    const {navigation, namespaceList} = this.props;
    const rootAddress = navigation.getParam('rootAddress');
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    const shortCode = navigation.getParam('shortCode');
    navigation.navigate('ShareKeyValue', {
      rootAddress,
      shareTxid,
      origKey: key,
      origValue: value,
      origShortCode: shortCode,
      height: blockHeight,
    })
  }

  onReward = (rewardTxid, key, value, height) => {
    const {navigation, namespaceList} = this.props;
    const rootAddress = navigation.getParam('rootAddress');
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    const shortCode = navigation.getParam('shortCode');
    navigation.navigate('RewardKeyValue', {
      rootAddress,
      rewardTxid,
      origKey: key,
      origValue: value,
      origShortCode: shortCode,
      height,
    })
  }

  render() {
    let {navigation, dispatch, mediaInfoList} = this.props;
    const mergeList = this.state.hashtagkeyValueList;

    if (this.state.isRefreshing && (!mergeList || mergeList.length == 0)) {
      return <BlueLoading />;
    }

    return (
      <View style={styles.container}>
        {
          (mergeList && mergeList.length > 0 ) ?
          <FlatList
            style={styles.listStyle}
            contentContainerStyle={{paddingBottom: 400}}
            data={mergeList}
            onRefresh={() => this.refreshKeyValues()}
            refreshing={this.state.isRefreshing}
            keyExtractor={(item, index) => item.key + index}
            renderItem={({item, index}) =>
              <Item item={item} key={index} dispatch={dispatch} onDelete={this.onDelete}
                onShow={this.onShow}
                onReply={this.onReply}
                onShare={this.onShare}
                onReward={this.onReward}
                navigation={navigation}
                mediaInfoList={mediaInfoList}
              />
            }
          />
          :
          <View style={{justifyContent: 'center', alignItems: 'center'}}>
            <Image source={require('../../img/other_no_data.png')} style={{ width: SCREEN_WIDTH*0.33, height: SCREEN_WIDTH*0.33, marginVertical: 50 }} />
            <Text style={{padding: 20, fontSize: 24, textAlign: 'center', color: KevaColors.lightText}}>
              {loc.namespaces.no_hashtag}
            </Text>
          </View>
        }
      </View>
    );
  }

}

function mapStateToProps(state) {
  return {
    namespaceList: state.namespaceList,
    mediaInfoList: state.mediaInfoList,
  }
}

export default HashtagKeyValuesScreen = connect(mapStateToProps)(HashtagKeyValues);

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
    color: KevaColors.lightText
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
