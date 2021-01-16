import React from 'react';
import {
  Text,
  View,
  Image,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Clipboard,
  Modal,
  StatusBar,
  InteractionManager,
  ActivityIndicator,
} from 'react-native';
import HTMLView from 'react-native-htmlview';
import { createThumbnail } from "react-native-create-thumbnail";
const BlueElectrum = require('../../BlueElectrum');
import Toast from 'react-native-root-toast';
import MIcon from 'react-native-vector-icons/MaterialIcons';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, timeConverter, toastError, getInitials, stringToColor } from "../../util";
import {
  getRepliesAndShares, parseSpecialKey, getKeyValueFromTxid,
  getHeightFromShortCode, findNamespaceShortCode, getSpecialKeyText
} from '../../class/keva-ops';
import { setKeyValueList, setMediaInfo } from '../../actions'
import {
  BlueNavigationStyle,
  BlueLoading,
} from '../../BlueComponents';
import VideoPlayer from 'react-native-video-player';
import ImageViewer from 'react-native-image-zoom-viewer';
import { Avatar } from 'react-native-elements';
const loc = require('../../loc');
import { connect } from 'react-redux';
import { extractMedia, getImageGatewayURL, removeMedia, replaceMedia } from './mediaManager';

const MAX_TIME = 3147483647;

class Reply extends React.Component {

  constructor(props) {
    super(props);
    this.state = { };
  }

  copyString = (str) => {
    Clipboard.setString(str);
    Toast.show(loc.general.copiedToClipboard, {
      position: Toast.positions.TOP,
      backgroundColor: "#53DD6C",
    });
  }

  render() {
    let {item} = this.props;
    return (
      <View style={styles.reply}>
        <View style={styles.senderBar} />
        <View>
          <View style={{flexDirection: 'row'}}>
            <Text style={styles.sender} numberOfLines={1} ellipsizeMode="tail">
              {item.sender.displayName + ' '}
            </Text>
            <TouchableOpacity onPress={() => this.copyString(item.sender.shortCode)}>
              <Text style={styles.shortCode}>
                {`@${item.sender.shortCode}`}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.replyValue} selectable={true}>{item.value}</Text>
          {(item.height > 0) ?
            <Text style={styles.timestamp}>{timeConverter(item.time) + ' ' + item.height}</Text>
            :
            <Text style={styles.timestamp}>{loc.general.unconfirmed}</Text>
          }
        </View>
      </View>
    )
  }
}

class ShowKeyValue extends React.Component {

  constructor() {
    super();
    this.state = {
      isRefreshing: false,
      key: '',
      value: '',
      isRaw: false,
      CIDHeight: 1,
      CIDWidth: 1,
      showPicModal: false,
      thumbnail: null,
      opacity: 0,
    };
  }

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    title: '',
    tabBarVisible: false,
  });

  maybeHTML = value => {
    return /<(?=.*? .*?\/ ?>|br|hr|input|!--|wbr)[a-z]+.*?>|<([a-z]+).*?<\/\1>/i.test(value);
  }

  sortReplies = replies => {
    if (!replies) {
      return;
    }
    return replies.sort((a, b) => {
      const btime = b.time || MAX_TIME;
      const atime = a.time || MAX_TIME;
      return (btime - atime)
    });
  }

  async componentDidMount() {
    const {key, value, replies, shares, rewards, favorite, shortCode, displayName} = this.props.navigation.state.params;
    const {mediaCID, mimeType} = extractMedia(value);
    const {mediaInfoList, dispatch} = this.props;

    if (mediaCID) {
      const mediaInfo = mediaInfoList[mediaCID];
      if (mediaInfo) {
        if (mimeType.startsWith('image')) {
          this.setState({CIDHeight: mediaInfo.height, CIDWidth: mediaInfo.width});
        } else if (mimeType.startsWith('video')) {
          this.setState({thumbnail: mediaInfo.thumbnail, CIDWidth: mediaInfo.width, CIDHeight: mediaInfo.height});
        }
      } else {
        InteractionManager.runAfterInteractions(async () => {
          if (mimeType.startsWith('image')) {
            Image.getSize(getImageGatewayURL(mediaCID), (width, height) => {
              this.setState({CIDHeight: height, CIDWidth: width});
            });
          } else if (mimeType.startsWith('video')) {
            try {
              let response = await createThumbnail({
                url: getImageGatewayURL(mediaCID),
                timeStamp: 2000,
              });

              dispatch(setMediaInfo(mediaCID, {thumbnail: response.path, width: response.width, height: response.height}));
              this.setState({thumbnail: response.path, CIDHeight: response.height, CIDWidth: response.width});
            } catch (err) {
              console.warn(err);
            }
          }
        });
      }
    }

    this.setState({
      key,
      value,
      replies: this.sortReplies(replies),
      shares,
      rewards,
      favorite,
      shortCode,
      displayName
    });

    this.subs = [
      this.props.navigation.addListener('willFocus', async (payload) => {
        try {
          const routeName = payload.lastState.routeName;
          if (routeName == 'KeyValues' || routeName == 'ReplyKeyValue' || routeName == 'RewardKeyValue') {
            return;
          }
          this.setState({isRefreshing: true});
          await this.fetchReplies();
          this.setState({isRefreshing: false});
        } catch (err) {
          console.warn(err)
          this.setState({isRefreshing: false});
        }
      }),
    ];

    // Check if it is a shared post.
    const {partialTxId, keyType} = parseSpecialKey(key);
    if (keyType != 'share') {
      return;
    }

    try {
      const kevaResult = await getKeyValueFromTxid(BlueElectrum, partialTxId);
      let nsData = await findNamespaceShortCode(BlueElectrum, [], partialTxId);
      this.setState({
        shareKey: kevaResult.key,
        shareValue: kevaResult.value,
        shareTime: kevaResult.time,
        origShortCode: nsData.shortCode,
        origName: nsData.displayName,
      });

      const {mediaCID, mimeType} = extractMedia(kevaResult.value);
      if (mediaCID) {
        if (mimeType.startsWith('image')) {
          Image.getSize(getImageGatewayURL(mediaCID), (width, height) => {
            this.setState({CIDHeight: height, CIDWidth: width});
          });
        } else if (mimeType.startsWith('video')) {
          const mediaInfo = mediaInfoList[mediaCID];
          if (mediaInfo) {
            this.setState({thumbnail: mediaInfo.thumbnail, CIDWidth: mediaInfo.width, CIDHeight: mediaInfo.height});
            return;
          }

          try {
            let response = await createThumbnail({
              url: getImageGatewayURL(mediaCID),
              timeStamp: 2000,
            });
            dispatch(setMediaInfo(mediaCID, {thumbnail: response.path, width: response.width, height: response.height}));
            this.setState({thumbnail: response.path, CIDHeight: response.height, CIDWidth: response.width});
          } catch (err) {
            console.warn(err);
          }
        }
      }

    } catch (err) {
      console.warn(err);
    }
  }

  componentWillUnmount () {
    if (this.subs) {
      this.subs.forEach(sub => sub.remove());
    }
  }

  onToggleRaw = () => {
    this.setState({isRaw: !this.state.isRaw});
  }

  showModal = () => {
    this.setState({showPicModal: true});
    StatusBar.setHidden(true);
  }

  closeModal = () => {
    StatusBar.setHidden(false);
    this.setState({showPicModal: false});
  }

  onLoadStart = () => {
    this.setState({opacity: 1});
  }

  onLoad = () => {
    this.setState({opacity: 0});
  }

  onBuffer = ({isBuffering}) => {
    this.setState({opacity: isBuffering ? 1 : 0});
  }

  onHashtag = hashtag => {
    const {navigation} = this.props;
    navigation.push('HashtagKeyValues', {hashtag});
  }

  renderText = (text) => {
    const textList = text.split(/(#(?:\[[^\]]+\]|[\p{L}\p{N}\p{Pc}\p{M}]+))/u);
    return textList.map((t, i) => {
      if (t.startsWith('#')) {
        return (
          <Text selectable key={i} style={styles.htmlLink} onPress={() => this.onHashtag(t.toLowerCase())}>
            {t}
          </Text>
        )
      }

      return (
        <Text selectable key={i} style={styles.htmlText}>{t}</Text>
      )
    });
  }

  renderNode = (node, index) => {
    const isNewline = node.type == 'text' && node.data && node.data.trim().length === 0;
    if (isNewline) {
      return <Text key={index} selectable></Text>;
    }

    if (node.type == 'text') {
      return <Text key={index} selectable>{this.renderText(unescape(node.data), index)}</Text>;
    } else if (node.name == 'img') {
      const a = node.attribs;
      const width = Dimensions.get('window').width * 0.9;
      const height = (a.height && a.width) ? (a.height / a.width) * width : width;
      const images = [{
        url: a.src,
        width: width/0.9,
        height: height/0.9,
      }];
      return (
        <View key={index}>
          <Modal visible={this.state.showPicModal} transparent={true} onRequestClose={this.closeModal}>
            <ImageViewer key={index} imageUrls={images} onCancel={this.closeModal} enableSwipeDown={true} swipeDownThreshold={100}/>
          </Modal>
          <TouchableOpacity onPress={this.showModal}>
            <Image style={{ width, height, alignSelf: 'center'}} source={{ uri: a.src }} resizeMode="contain"/>
          </TouchableOpacity>
        </View>
      );
    } else if (node.name == 'video') {
      const { width, height, poster } = node.attribs; // <video width="320" height="240" poster="http://link.com/image.jpg">...</video>

      // Check if node has children
      if (node.children.length === 0) return;

      // Get all children <source> nodes
      // <video><source src="movie.mp4" type="video/mp4"><source src="movie.ogg" type="video/ogg"></video>
      const sourceNodes = node.children.filter((node) => node.type === 'tag' && node.name === 'source')
      // Get a list of source URLs (<source src="movie.mp4">)
      const sources = sourceNodes.map((node) => node.attribs.src);
      let displayWidth = Dimensions.get('window').width;
      let displayHeight;
      if (height && width) {
        displayHeight = (Number(height) / Number(width)) * displayWidth;
      } else {
        displayHeight = (225/400)*displayWidth;
      }
      return (
        <View key={index}>
          <VideoPlayer
            disableFullscreen={false}
            fullScreenOnLongPress={true}
            resizeMode="contain"
            video={{ uri: sources[0] }} // Select one of the video sources
            videoWidth={displayWidth}
            videoHeight={displayHeight}
            thumbnail={{uri: poster}}
            onBuffer={this.onBuffer}
            onLoadStart={this.onLoadStart}
            onLoad={this.onLoad}
            customStyles={{
              video : {backgroundColor: 'black'},
            }}
          />
          <View pointerEvents="none" style={styles.videoContainer}>
            <ActivityIndicator
              animating
              size="large"
              color="#ddd"
              style={[styles.activityIndicator, {opacity: this.state.opacity}]}
            />
          </View>
        </View>
      );
    }
  }

  // Go back from the reply screen.
  onGoBack = (reply) => {
    // Perform an instant update. We will still fetch
    // from the server.
    let replies = this.state.replies || [];
    replies.push(reply);
    this.setState({
      replies: this.sortReplies(replies),
    });
  }

  // Go back from the reward screen.
  onRewardGoBack = (reward) => {
    // Perform an instant update. We will still fetch
    // from the server.
    let rewards = this.state.rewards || [];
    rewards.push(reward);
    this.setState({
      rewards,
      favorite: true,
    });
  }

  onReply = () => {
    const {navigation, namespaceList} = this.props;
    const {rootAddress, replyTxid} = navigation.state.params;
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError('Create a namespace first');
      return;
    }

    navigation.navigate('ReplyKeyValue', {
      rootAddress,
      replyTxid,
      onGoBack: this.onGoBack,
    })
  }

  onReward = () => {
    const {navigation, namespaceList} = this.props;
    const {rootAddress, rewardTxid} = navigation.state.params;
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError('Create a namespace first');
      return;
    }

    navigation.navigate('RewardKeyValue', {
      rootAddress,
      rewardTxid,
      onGoBack: this.onRewardGoBack,
    })
  }

  fetchReplies = async () => {
    const {dispatch, navigation, keyValueList, namespaceList} = this.props;
    const {replyTxid, namespaceId} = navigation.state.params;
    const myNamespaces = namespaceList.namespaces;

    try {
      // Fetch replies.
      this.setState({isRefreshing: true});
      const {replies, shares, rewards} = await getRepliesAndShares(BlueElectrum, [{tx_hash: replyTxid}]);

      if (!namespaceId) {
        const favorite = !!rewards.find(r => Object.keys(myNamespaces).find(n => myNamespaces[n].shortCode == r.rewarder.shortCode));
        this.setState({
          isRefreshing: false,
          replies: this.sortReplies(replies),
          shares: shares,
          rewards: rewards,
          favorite: favorite,
        });
        return;
      }

      const keyValues = keyValueList.keyValues[namespaceId];

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
          kv.favorite = !!txRewards.find(r => Object.keys(myNamespaces).find(n => myNamespaces[n].shortCode == r.rewarder.shortCode));
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

      // Update the replies and shares for this.
      const thisKV = keyValues.find(kv => kv.tx == replyTxid);
      this.setState({
        isRefreshing: false,
        replies: this.sortReplies(thisKV.replies),
        shares: thisKV.shares,
        rewards: thisKV.rewards,
        favorite: thisKV.favorite,
      });

    } catch(err) {
      console.warn(err);
      this.setState({isRefreshing: false});
      toastError('Cannot fetch replies');
    }
  }

  copyString = (str) => {
    Clipboard.setString(str);
    Toast.show(loc.general.copiedToClipboard, {
      position: Toast.positions.TOP,
      backgroundColor: "#53DD6C",
    });
  }

  getShareContent = (key) => {
    const {keyType} = parseSpecialKey(key);
    if (keyType != 'share') {
      return null;
    }

    if (!this.state.shareValue) {
      return <BlueLoading style={{paddingTop: 30}}/>;
    }

    const {shareValue, shareTime, origName, origShortCode, CIDHeight, CIDWidth, thumbnail} = this.state;
    let displayValue = replaceMedia(shareValue, CIDHeight, CIDWidth, thumbnail);

    return (
      <View style={{backgroundColor: '#fff'}}>
        <View style={styles.shareContainer}>
          <View>
            <View style={{flexDirection: 'row'}}>
              <Text style={styles.sender} numberOfLines={1} ellipsizeMode="tail">
                {origName + ' '}
              </Text>
              <TouchableOpacity onPress={() => this.copyString(origShortCode)}>
                <Text style={styles.shortCode}>
                  {`@${origShortCode}`}
                </Text>
              </TouchableOpacity>
              {(shareTime > 0) ?
                <Text style={styles.timestamp}>{'  ' + timeConverter(shareTime)}</Text>
                :
                <Text style={styles.timestamp}>{loc.general.unconfirmed}</Text>
              }
            </View>
          </View>
          <HTMLView value={`${displayValue}`}
            addLineBreaks={false}
            stylesheet={htmlStyles}
            nodeComponentProps={{selectable: true}}
            renderNode={this.renderNode}
          />
        </View>
      </View>
    );
  }

  onShare = (key, value) => {
    const {navigation, namespaceList} = this.props;
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError(loc.namespaces.create_namespace_first);
      return;
    }

    const shareInfo = parseSpecialKey(key);
    if (!shareInfo) {
      // This is not a share post.
      const {rootAddress, shortCode, shareTxid, height} = navigation.state.params;
      navigation.navigate('ShareKeyValue', {
        rootAddress,
        shareTxid,
        origKey: key,
        origValue: value,
        origShortCode: shortCode,
        height,
      });
      return;
    }

    // This is a share post, share the shared post instead.
    const {txIdShortCode, origShortCode} = shareInfo;
    let {shareValue} = this.state;
    const height = getHeightFromShortCode(txIdShortCode);
    navigation.navigate('ShareKeyValue', {
      rootAddress: null, // Must get it from origShortCode.
      shareTxid: null, // Must get it from the txIdShortCode
      txIdShortCode,
      origValue: shareValue,
      origShortCode: origShortCode,
      height,
    });
  }

  render() {
    let {isRaw, value, key, replies, shares, rewards, favorite, CIDHeight, CIDWidth, thumbnail, shortCode, displayName} = this.state;
    const shareInfo = parseSpecialKey(key);
    if (shareInfo) {
      // The shareValue contains the shared media for preview.
      // We should remove it here otherwise it will be shown twice.
      value = removeMedia(value);
    }
    value = replaceMedia(value, CIDHeight, CIDWidth, thumbnail);

    let displayKey = key;
    const {keyType} = parseSpecialKey(key);
    if (keyType) {
      displayKey = getSpecialKeyText(keyType);
    }

    const listHeader = (
      <View style={styles.container}>
        <View style={styles.keyContainer}>
          <View style={{paddingRight: 10}}>
            <Avatar rounded size="medium" title={getInitials(displayName)} containerStyle={{backgroundColor: stringToColor(displayName)}}/>
          </View>
          <View style={{paddingRight: 10, flexShrink: 1}}>
            <View style={{flexDirection: 'row'}}>
              <Text style={styles.sender} numberOfLines={1} ellipsizeMode="tail">
                {displayName + ' '}
              </Text>
              <TouchableOpacity onPress={() => this.copyString(shortCode)}>
                <Text style={styles.shortCode}>
                  {`@${shortCode}`}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.key} selectable>{displayKey}</Text>
          </View>
        </View>
        <View style={styles.valueContainer}>
          { isRaw ?
            <Text style={styles.value} selectable>{value}</Text>
          :
            <HTMLView value={`${value}`}
              addLineBreaks={false}
              stylesheet={htmlStyles}
              nodeComponentProps={{selectable: true}}
              renderNode={this.renderNode}
            />
          }
        </View>
        { this.getShareContent(key) }
        <View style={styles.actionContainer}>
          <View style={{flexDirection: 'row'}}>
            <TouchableOpacity onPress={() => this.onReply()} style={{flexDirection: 'row'}}>
              <MIcon name="chat-bubble-outline" size={22} style={styles.talkIcon} />
              {(replies && replies.length > 0) && <Text style={styles.count}>{replies.length}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => this.onShare(key, value)} style={{flexDirection: 'row'}}>
              <MIcon name="cached" size={22} style={styles.shareIcon} />
              {(shares && shares.length > 0) && <Text style={styles.count}>{shares.length}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => this.onReward()} style={{flexDirection: 'row'}}>
              {
                favorite ?
                  <MIcon name="favorite" size={22} style={[styles.shareIcon, {color: KevaColors.favorite}]} />
                :
                  <MIcon name="favorite-border" size={22} style={styles.shareIcon} />
              }
              {(rewards && rewards.length > 0) && <Text style={styles.count}>{rewards.length}</Text>}
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => this.onToggleRaw()}>
            <MIcon name="format-clear" size={22} style={this.state.isRaw ? styles.rawIcon : styles.actionIcon} />
          </TouchableOpacity>
        </View>
      </View>
    );
    return (
      <FlatList
        style={styles.listStyle}
        ListHeaderComponent={listHeader}
        removeClippedSubviews={false}
        contentContainerStyle={{paddingBottom: 100}}
        data={replies}
        onRefresh={() => this.fetchReplies()}
        refreshing={this.state.isRefreshing}
        keyExtractor={(item, index) => item.key + index}
        renderItem={({item, index}) => <Reply item={item} />}
      />
    )
  }

}

function mapStateToProps(state) {
  return {
    keyValueList: state.keyValueList,
    namespaceList: state.namespaceList,
    mediaInfoList: state.mediaInfoList,
  }
}

export default ShowKeyValueScreen = connect(mapStateToProps)(ShowKeyValue);

var styles = StyleSheet.create({
  container: {
    backgroundColor: KevaColors.background,
  },
  keyContainer: {
    marginVertical: 10,
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
  value: {
    fontSize: 16,
    color: KevaColors.darkText,
    lineHeight: 25,
  },
  valueContainer: {
    marginTop: 2,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    padding: 10,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    padding: 10,
  },
  talkIcon: {
    color: KevaColors.arrowIcon,
    paddingLeft: 15,
    paddingRight: 2,
    paddingVertical: 2
  },
  shareIcon: {
    color: KevaColors.arrowIcon,
    paddingLeft: 15,
    paddingRight: 2,
    paddingVertical: 2
  },
  actionIcon: {
    color: KevaColors.arrowIcon,
    paddingHorizontal: 15,
    paddingVertical: 2
  },
  rawIcon: {
    color: KevaColors.actionText,
    paddingHorizontal: 15,
    paddingVertical: 2
  },
  count: {
    color: KevaColors.arrowIcon,
    paddingVertical: 2
  },
  reply: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor:'#fff',
    borderBottomWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
  },
  replyValue: {
    fontSize: 16,
    color: KevaColors.darkText,
    paddingVertical: 5,
    lineHeight: 25,
  },
  timestamp: {
    color: KevaColors.extraLightText,
    paddingTop: 5,
    fontSize: 13,
    alignSelf: 'flex-start'
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
  senderBar: {
    borderLeftWidth: 4,
    borderColor: KevaColors.cellBorder,
    width: 0,
    paddingLeft: 3,
    paddingRight: 7,
    height: '100%',
  },
  shareContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    borderRadius: 12,
    margin: 10,
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityIndicator: {
    position: 'absolute',
    top: 70,
    left: 70,
    right: 70,
    height: 50,
  },
  htmlText: {
    fontSize: 16,
    color: KevaColors.darkText,
    lineHeight: 23
  },
  htmlLink: {
    fontSize: 16,
    color: KevaColors.actionText,
    lineHeight: 23
  }
});

export const htmlStyles = StyleSheet.create({
  div: {
    fontSize: 16,
    color: KevaColors.darkText,
    lineHeight: 25,
    padding: 0,
    marginBottom: 0,
  },
  p: {
    fontSize: 16,
    color: KevaColors.darkText,
    lineHeight: 25,
    padding: 0,
    margin: 0,
  },
  h3: {
    fontSize: 20,
    fontWeight: '700',
    alignSelf: 'center',
    color: KevaColors.darkText,
    lineHeight: 25,
    paddingVertical: 20,
    textAlign: 'center',
  },
});
