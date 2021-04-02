import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  InteractionManager,
  SafeAreaView,
  TextInput,
  LayoutAnimation,
  Keyboard,
  Image as RNImage,
  ActivityIndicator,
} from 'react-native';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, toastError } from '../../util';
import {
  BlueNavigationStyle,
  BlueLoading,
} from '../../BlueComponents';
const loc = require('../../loc');
let BlueApp = require('../../BlueApp');
let BlueElectrum = require('../../BlueElectrum');

import MIcon from 'react-native-vector-icons/MaterialIcons';
import Icon from 'react-native-vector-icons/Ionicons';
import { connect } from 'react-redux'
import { createThumbnail } from "react-native-create-thumbnail";
import { Avatar, Image } from 'react-native-elements';
import { setMediaInfo, } from '../../actions'
import {
  getHashtagScriptHash, parseSpecialKey, getSpecialKeyText, decodeBase64,
  findTxIndex,
} from '../../class/keva-ops';
import Toast from 'react-native-root-toast';
import { timeConverter, stringToColor, getInitials, SCREEN_WIDTH, } from "../../util";
import Biometric from '../../class/biometrics';
import { extractMedia, getImageGatewayURL, removeMedia } from './mediaManager';

const PLAY_ICON  = <MIcon name="play-arrow" size={50} color="#fff"/>;
const IMAGE_ICON = <Icon name="ios-image" size={50} color="#fff"/>;

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
        <TouchableOpacity onPress={() => onShow(item.tx, item.height, item.shortCode, item.displayName)}>
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
                <Image style={styles.previewImage}
                  source={{uri: getImageGatewayURL(mediaCID)}}
                  PlaceholderContent={IMAGE_ICON}
                  placeholderStyle={{backgroundColor: '#ddd'}}
                />
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
            {(item.likes > 0) && <Text style={styles.count}>{item.likes}</Text> }
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
      loaded: false,
      isModalVisible: false,
      currentPage: 0,
      showDeleteModal: false,
      isRefreshing: false,
      loading: false,
      isLoadingMore: false,
      min_tx_num: -1,
      totalToFetch: 0,
      fetched: 0,
      inputMode: false,
      hashtag: '',
      searched: false,
      hashtags: [],
    };
    this.onEndReachedCalledDuringMomentum = true;
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

  onSearchHashtag = async () => {
    Keyboard.dismiss();
    this.setState({min_tx_num: -1, loading: true, hashtags: []});
    await this.fetchHashtag(-1);
    this.setState({loading: false});
  }

  fetchHashtag = async (min_tx_num) => {
    const {reactions} = this.props;
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
    const {hashtags} = this.state;
    const hashtag = this.state.hashtag.trim();
    let history = await BlueElectrum.blockchainKeva_getHashtag(getHashtagScriptHash(hashtag), min_tx_num);
    if (history.hashtags.length == 0) {
      this.setState({searched: true});
      return;
    }

    const keyValues = history.hashtags.map(h => {
      const reaction = reactions[h.tx_hash];
      const favorite = reaction && !!reaction['like'];
      return {
        displayName: h.displayName,
        shortCode: h.shortCode,
        tx: h.tx_hash,
        replies: h.replies,
        shares: h.shares,
        likes: h.likes,
        height: h.height,
        time: h.time,
        namespaceId: h.namespace,
        key: decodeBase64(h.key),
        value: h.value ? Buffer.from(h.value, 'base64').toString() : '',
        favorite,
      }
    });

    if (history.min_tx_num < this.state.min_tx_num) {
      // TODO: optimize this, add appendHashtags to avoid
      // duplicating twice.
      this.setState({
        hashtags: [...hashtags, ...keyValues],
        min_tx_num: history.min_tx_num,
      });
    } else {
      this.setState({
        hashtags: [...keyValues],
        min_tx_num: history.min_tx_num,
      });
    }
  }

  refreshKeyValues = async () => {
    try {
      this.setState({isRefreshing: true});
      await BlueElectrum.ping();
      await this.fetchHashtag(-1);
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
      await this.fetchHashtag(this.state.min_tx_num);
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
    let hashtag = this.props.navigation.getParam('hashtag');
    if (hashtag.startsWith('#')) {
      hashtag = hashtag.substring(1);
    }
    this.setState({hashtag, hashtags: []});
    await this.refreshKeyValues();
    this.isBiometricUseCapableAndEnabled = await Biometric.isBiometricUseCapableAndEnabled();
  }

  onShow = (tx, height, shortCode, displayName) => {
    const {navigation} = this.props;
    const {hashtags} = this.state;
    const index = findTxIndex(hashtags, tx);
    if (index < 0) {
      return;
    }
    navigation.push('ShowKeyValue', {
      index,
      type: 'hashtag',
      shortCode,
      displayName,
      replyTxid: tx,
      shareTxid: tx,
      rewardTxid: tx,
      height,
      hashtags,
      updateHashtag: this.updateHashtag,
    });
  }

  updateHashtag = (index, keyValue) => {
    const {hashtags} = this.state;
    const newHashtags = [...hashtags];
    newHashtags[index] = keyValue;
    this.setState({
      hashtags: newHashtags
    })
  }

  onReply = (replyTxid) => {
    const {navigation, namespaceList} = this.props;
    const {hashtags} = this.state;
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    const index = findTxIndex(hashtags, replyTxid);
    if (index < 0) {
      return;
    }

    navigation.navigate('ReplyKeyValue', {
      index,
      type: 'hashtag',
      replyTxid,
      hashtags,
      updateHashtag: this.updateHashtag,
    })
  }

  onShare = (shareTxid, key, value, blockHeight) => {
    const {navigation, namespaceList} = this.props;
    const {hashtags} = this.state;
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    const index = findTxIndex(hashtags, shareTxid);
    if (index < 0) {
      return;
    }

    const shortCode = navigation.getParam('shortCode');
    navigation.navigate('ShareKeyValue', {
      index,
      type: 'hashtag',
      shareTxid,
      origKey: key,
      origValue: value,
      origShortCode: shortCode,
      height: blockHeight,
      hashtags,
      updateHashtag: this.updateHashtag,
    })
  }

  onReward = (rewardTxid, key, value, height) => {
    const {navigation, namespaceList} = this.props;
    const {hashtags} = this.state;
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    const shortCode = navigation.getParam('shortCode');
    const index = findTxIndex(hashtags, rewardTxid);
    if (index < 0) {
      return;
    }
    navigation.navigate('RewardKeyValue', {
      index,
      type: 'hashtag',
      rewardTxid,
      origKey: key,
      origValue: value,
      origShortCode: shortCode,
      height,
      hashtags,
      updateHashtag: this.updateHashtag,
    })
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
    this.setState({inputMode: false, hashtag: '', searched: false});
    this._inputRef && this._inputRef.blur();
    this._inputRef && this._inputRef.clear();
  }

  render() {
    let {navigation, dispatch, mediaInfoList} = this.props;
    const {inputMode, hashtag, loading, searched, hashtags} = this.state;
    const mergeList = hashtags;
    const canSearch = hashtag && hashtag.length > 0;

    if (this.state.isRefreshing && (!mergeList || mergeList.length == 0)) {
      return <BlueLoading />
    }
    const footerLoader = this.state.isLoadingMore ? <BlueLoading style={{paddingTop: 30, paddingBottom: 400}} /> : null;

    return (
      <SafeAreaView style={styles.topContainer}>
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={this.closeItemAni}>
            <Text style={[{color: KevaColors.actionText, fontSize: 16, textAlign: 'left'}, inputMode && {paddingRight: 5}]}>
              {inputMode ? loc.general.cancel : ''}
            </Text>
          </TouchableOpacity>
          <TextInput
            onFocus={this.openItemAni}
            ref={ref => this._inputRef = ref}
            onChangeText={hashtag => this.setState({ hashtag: hashtag, searched: false })}
            value={hashtag}
            placeholder={loc.namespaces.search_hashtag}
            multiline={false}
            underlineColorAndroid='rgba(0,0,0,0)'
            returnKeyType='search'
            clearButtonMode='while-editing'
            onSubmitEditing={this.onSearchHashtag}
            style={styles.textInput}
            returnKeyType={ 'done' }
            clearButtonMode='while-editing'
          />
          {loading ?
            <ActivityIndicator size="small" color={KevaColors.actionText} style={{ width: 42, height: 42 }} />
            :
            <TouchableOpacity onPress={this.onSearchHashtag} disabled={!canSearch}>
              <Icon name={'md-search'}
                    style={[styles.searchIcon, !canSearch && {color: KevaColors.inactiveText}]}
                    size={25} />
            </TouchableOpacity>
          }
        </View>
        {
          (mergeList && mergeList.length > 0 ) ?
          <FlatList
            style={styles.listStyle}
            contentContainerStyle={{paddingBottom: 400, backgroundColor: '#fff'}}
            data={mergeList}
            onRefresh={() => this.refreshKeyValues()}
            onEndReached={() => {this.loadMoreKeyValues()}}
            onEndReachedThreshold={0.1}
            onMomentumScrollBegin={() => { this.onEndReachedCalledDuringMomentum = false; }}
            refreshing={this.state.isRefreshing}
            keyExtractor={(item, index) => item.key + index}
            ListFooterComponent={footerLoader}
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
            <RNImage source={require('../../img/other_no_data.png')} style={{ width: SCREEN_WIDTH*0.33, height: SCREEN_WIDTH*0.33, marginTop: 50, marginBottom: 10 }} />
            <Text style={{padding: 10, fontSize: 24, textAlign: 'center', color: KevaColors.darkText}}>
              {(searched && hashtag.length > 0) ? (loc.namespaces.no_hashtag + hashtag) : loc.namespaces.hashtag_help}
            </Text>
          </View>
        }
      </SafeAreaView>
    );
  }

}

function mapStateToProps(state) {
  return {
    namespaceList: state.namespaceList,
    mediaInfoList: state.mediaInfoList,
    reactions: state.reactions,
  }
}

export default HashtagKeyValuesScreen = connect(mapStateToProps)(HashtagKeyValues);

var styles = StyleSheet.create({
  topContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
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
  inputContainer: {
    paddingBottom: 5,
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
      paddingTop: 3,
      paddingBottom: 3,
    },
    ios: {
      paddingTop: 8,
      paddingBottom: 8,
    },
    paddingLeft: 7,
    paddingRight: 36,
    fontSize: 15,
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
});
