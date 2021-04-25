import React from 'react';
import {
  Text,
  View,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Modal,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import HTMLView from 'react-native-htmlview';
const BlueElectrum = require('../../BlueElectrum');
const StyleSheet = require('../../PlatformStyleSheet');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, timeConverter, toastError, getInitials, stringToColor } from "../../util";
import {
  parseSpecialKey,
  getSpecialKeyText,
} from '../../class/keva-ops';
import { setKeyValue } from '../../actions'
import {
  BlueNavigationStyle,
} from '../../BlueComponents';
import VideoPlayer from 'react-native-video-player';
import ImageViewer from 'react-native-image-zoom-viewer';
import { Avatar, Button, Image } from 'react-native-elements';
const loc = require('../../loc');
import { connect } from 'react-redux';

const MAX_TIME = 3147483647;

class Reply extends React.Component {

  constructor(props) {
    super(props);
    this.state = { };
  }

  gotoShortCode = (shortCode) => {
    this.props.navigation.push('KeyValues', {
      namespaceId: null,
      shortCode,
      displayName: null,
      isOther: true,
    });
  }

  render() {
    let {item} = this.props;
    const displayName = item.sender.displayName;
    return (
      <View style={styles.reply}>
        <View style={styles.senderBar} />
        <View>
          <View style={{flexDirection: 'row'}}>
            <Avatar rounded size="small"
              title={getInitials(displayName)}
              containerStyle={{backgroundColor: stringToColor(displayName), marginRight: 5}}
              onPress={() => this.gotoShortCode(item.sender.shortCode)}
            />
            <Text style={styles.sender} numberOfLines={1} ellipsizeMode="tail" onPress={() => this.gotoShortCode(item.sender.shortCode)}>
              {displayName + ' '}
            </Text>
            <TouchableOpacity onPress={() => this.gotoShortCode(item.sender.shortCode)} style={{alignSelf: 'center'}}>
              <Text style={styles.shortCodeReply}>
                {`@${item.sender.shortCode}`}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.replyValue} selectable={true}>{item.value}</Text>
          {(item.height > 0) ?
            <Text style={styles.timestampReply}>{timeConverter(item.time) + ' ' + item.height}</Text>
            :
            <Text style={styles.timestampReply}>{loc.general.unconfirmed}</Text>
          }
        </View>
      </View>
    )
  }
}

class BuyNFT extends React.Component {

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
      replyCount: 0,
      replies: [],
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
    const {keyValueList} = this.props;
    const {shortCode, displayName, namespaceId, index, type, hashtags} = this.props.navigation.state.params;
    this.setState({
      shortCode, displayName, namespaceId, index, type
    });
    await this.fetchReplies();
  }

  componentWillUnmount () {
    if (this.subs) {
      this.subs.forEach(sub => sub.remove());
    }
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
    const {navigation, dispatch} = this.props;
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
    const isLink = node.parent && node.parent.name == 'a';
    if (isLink) {
      return;
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
            <Image style={{ width, height, alignSelf: 'center'}}
              source={{ uri: a.src }}
              resizeMode="contain"
              PlaceholderContent={this.LARGE_IMAGE_ICON}
              placeholderStyle={{backgroundColor: '#ddd', borderRadius: 10}}
            />
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

  updateReplies = (reply) => {
    const {index, type, hashtags, updateHashtag} = this.props.navigation.state.params;
    let currentLength = this.state.replies.length;
    this.setState({
      replies: [reply, ...this.state.replies]
    });

    if (type == 'hashtag' && updateHashtag) {
      let keyValue = hashtags[index];
      keyValue.replies = currentLength + 1;
      updateHashtag(index, keyValue);
    }
  }

  onOffer = () => {
    const {navigation, namespaceList} = this.props;
    const {replyTxid, namespaceId, index, type, hashtags, price, desc, addr} = navigation.state.params;
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      toastError('Create a namespace first');
      return;
    }

    navigation.navigate('OfferNFT', {
      replyTxid,
      namespaceId,
      index,
      type,
      price, desc, addr, // NFT related.
      //updateReplies: this.updateReplies,
      //hashtags,
    })
  }

  fetchReplies = async () => {
    const {dispatch, navigation, keyValueList, reactions} = this.props;
    const {replyTxid, namespaceId, index, type, hashtags} = navigation.state.params;

    try {
      this.setState({isRefreshing: true});
      const results = await BlueElectrum.blockchainKeva_getKeyValueReactions(replyTxid);
      const totalReactions = results.result;
      /*
        totalReactions format:
        {
          "key": "<key>",
          "value": "<value>",
          "displayName": <>,
          "shortCode": <>,
          "likes": <likes>,
          "replies": [{
            "height": <>,
            "key": <>,
            "value": <>,
            "time": <>,
            "sender": {
              shortCode: <>,
              displayName: <>
            }
          }],
          "shares": <shares>
          ...
        }
      */
      // Decode replies base64
      const replies = totalReactions.replies.map(r => {
        r.value = Buffer.from(r.value, 'base64').toString('utf-8');
        return r;
      });
      this.setState({replies});

      // Check if it is a favorite.
      const reaction = reactions[replyTxid];
      const favorite = reaction && !!reaction['like'] && totalReactions.likes > 0;

      // Update the replies, shares and favorite.
      if (type == 'keyvalue') {
        const keyValues = keyValueList.keyValues[namespaceId];
        let keyValue = keyValues[index];
        keyValue.favorite = favorite;
        keyValue.likes = totalReactions.likes;
        keyValue.shares = totalReactions.shares;
        keyValue.replies = totalReactions.replies.length;
        dispatch(setKeyValue(namespaceId, index, keyValue));
      } else if (type == 'hashtag') {
        let keyValue = hashtags[index];
        keyValue.favorite = favorite;
        keyValue.likes = totalReactions.likes;
        keyValue.shares = totalReactions.shares;
        keyValue.replies = totalReactions.replies.length;
        const newHashtags = [...hashtags];
        newHashtags[index] = keyValue;
        this.setState({
          hashtags: newHashtags,
        });
      }

      this.setState({
        isRefreshing: false
      });
    } catch(err) {
      console.warn(err);
      this.setState({isRefreshing: false});
      toastError('Cannot fetch replies');
    }
  }

  gotoShortCode = (shortCode) => {
    this.props.navigation.push('KeyValues', {
      namespaceId: null,
      shortCode,
      displayName: null,
      isOther: true,
    });
  }

  render() {
    const {keyValueList} = this.props;
    const {hashtags} = this.props.navigation.state.params;
    let {replies, isRaw, CIDHeight, CIDWidth, thumbnail} = this.state;
    const {shortCode, displayName, namespaceId, index, type} = this.state;
    if (!type) {
      return null;
    }

    let keyValue;
    if (type == 'keyvalue') {
      keyValue = (keyValueList.keyValues[namespaceId])[index];
    } else if (type == 'hashtag') {
      keyValue = hashtags[index];
    }

    const key = keyValue.key;
    let value = keyValue.value;
    const favorite = keyValue.favorite;
    const replyCount = keyValue.replies;
    const shareCount = keyValue.shares;
    const likeCount = keyValue.likes;

    let displayKey = key;
    const {keyType} = parseSpecialKey(key);
    if (keyType) {
      displayKey = getSpecialKeyText(keyType);
    }

    const listHeader = (
      <View style={styles.container}>
        <View style={styles.keyContainer}>
          <View style={{paddingRight: 10}}>
            <Avatar rounded size="medium" title={getInitials(displayName)}
              containerStyle={{backgroundColor: stringToColor(displayName)}}
              onPress={() => this.gotoShortCode(shortCode)}
            />
          </View>
          <View style={{paddingRight: 10, flexShrink: 1}}>
            <View style={{flexDirection: 'row'}}>
              <Text style={styles.sender} numberOfLines={1} ellipsizeMode="tail" onPress={() => this.gotoShortCode(shortCode)}>
                {displayName + ' '}
              </Text>
              <TouchableOpacity onPress={() => this.gotoShortCode(shortCode)}>
                <Text style={styles.shortCode}>
                  {`@${shortCode}`}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.key} selectable>{"For Sale"}</Text>
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
        <View style={styles.actionContainer}>
          <View style={{flexDirection: 'row'}}>
            <Button
              type='solid'
              buttonStyle={{borderRadius: 30, height: 28, width: 120, borderColor: KevaColors.actionText, backgroundColor: KevaColors.actionText}}
              title={"Make an Offer"}
              titleStyle={{fontSize: 14, color: '#fff'}}
              onPress={()=>{this.onOffer()}}
            />
          </View>
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
        renderItem={({item, index}) => <Reply item={item} navigation={this.props.navigation} />}
      />
    )
  }

}

function mapStateToProps(state) {
  return {
    keyValueList: state.keyValueList,
    namespaceList: state.namespaceList,
    mediaInfoList: state.mediaInfoList,
    reactions: state.reactions,
  }
}

export default BuyNFTScreen = connect(mapStateToProps)(BuyNFT);

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
    alignSelf: 'center',
    fontSize: 13,
  },
  timestampReply: {
    color: KevaColors.extraLightText,
    alignSelf: 'flex-start',
    fontSize: 13,
  },
  sender: {
    fontSize: 16,
    fontWeight: '700',
    color: KevaColors.darkText,
    alignSelf: 'center',
    maxWidth: 220,
  },
  shortCode: {
    fontSize: 16,
    fontWeight: '700',
    color: KevaColors.actionText,
  },
  shortCodeReply: {
    fontSize: 16,
    fontWeight: '700',
    color: KevaColors.actionText,
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
  a: {
    fontSize: 16,
    color: '#0000ee',
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
