import React from 'react';
import {
  Text,
  View,
  Image,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Clipboard,
} from 'react-native';
import HTMLView from 'react-native-htmlview';
const BlueElectrum = require('../../BlueElectrum');
import Toast from 'react-native-root-toast';
import MIcon from 'react-native-vector-icons/MaterialIcons';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, timeConverter } from "../../util";
import { getRepliesAndShares, parseShareKey, getKeyValueFromTxid,
        getNamespaceInfoFromShortCode, getHeightFromShortCode,
        getTxIdFromShortCode } from '../../class/keva-ops';
import { setKeyValueList } from '../../actions'
import {
  BlueNavigationStyle,
} from '../../BlueComponents';
const loc = require('../../loc');

import { connect } from 'react-redux'

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
          <Text style={styles.replyValue}>{item.value}</Text>
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

  async componentDidMount() {
    const {key, value} = this.props.navigation.state.params;
    if (key && key.length > 0 && value && value.length > 0) {
      this.setState({
        key,
        value,
      });
    }

    this.subs = [
      this.props.navigation.addListener('willFocus', async (payload) => {
        try {
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
    const shareInfo = parseShareKey(key);
    if (!shareInfo) {
      return;
    }

    try {
      const {txIdShortCode, origShortCode, myShortCode} = shareInfo;
      const txId = await getTxIdFromShortCode(BlueElectrum, txIdShortCode);
      const kevaResult = await getKeyValueFromTxid(BlueElectrum, txId);
      const height = getHeightFromShortCode(txIdShortCode);
      const origInfo = await getNamespaceInfoFromShortCode(BlueElectrum, origShortCode);
      this.setState({
        shareKey: kevaResult.key,
        shareValue: kevaResult.value,
        shareTime: kevaResult.time,
        shareHeight: height,
        origShortCode,
        myShortCode,
        origName: origInfo.displayName,
      });
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

  renderNode = (node, index) => {
    if (!node.prev && !node.next && !node.parent && node.type == 'text') {
      return (<Text key={index} style={{fontSize: 16, color: KevaColors.darkText, lineHeight: 25}}>{unescape(node.data)}</Text>);
    } else if (node.name == 'img') {
      const a = node.attribs;
      const width = Dimensions.get('window').width;
      const height = (a.height && a.width) ? (a.height / a.width) * width : width;
      return (<Image style={{ width, height, alignSelf: 'center'}} source={{ uri: a.src }} key={index} resizeMode="contain"/>);
    }
  }

  onReply = () => {
    const {navigation, namespaceList} = this.props;
    const rootAddress = navigation.getParam('rootAddress');
    const replyTxid = navigation.getParam('replyTxid');
    // Must have a namespace.
    if (Object.keys(namespaceList).length == 0) {
      Toast.show('Create a namespace first');
      return;
    }

    navigation.navigate('ReplyKeyValue', {
      rootAddress,
      replyTxid
    })
  }

  fetchReplies = async () => {
    const {dispatch, navigation, keyValueList} = this.props;
    const namespaceId = navigation.getParam('namespaceId');
    const rootAddress = navigation.getParam('rootAddress');

    try {
      // Fetch replies.
      this.setState({isRefreshing: true});
      const {replies, shares} = await getRepliesAndShares(BlueElectrum, rootAddress, namespaceId);
      const keyValues = keyValueList.keyValues[namespaceId];

      // Add the replies.
      for (let kv of keyValues) {
        const txReplies = replies.filter(r => kv.tx.startsWith(r.partialTxId));
        if (txReplies && txReplies.length > 0) {
          kv.replies = txReplies;
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
      this.setState({isRefreshing: false});
    } catch(err) {
      console.warn(err);
      this.setState({isRefreshing: false});
      Toast.show('Cannot fetch replies');
    }
  }

  getShareContent = () => {
    if (!this.state.shareValue) {
      return null;
    }
    const {shareValue, shareTime, shareHeight, origName, origShortCode} = this.state;
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
          <HTMLView value={`${shareValue}`}
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
      Toast.show('Create a namespace first');
      return;
    }

    const shareInfo = parseShareKey(key);
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
    const {shareValue} = this.state;
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
    let {isRaw, value, key} = this.state;
    const replies = this.props.navigation.getParam('replies');
    const shares = this.props.navigation.getParam('shares');

    const listHeader = (
      <View style={styles.container}>
        <View style={styles.keyContainer}>
          <Text style={styles.key} selectable>{key}</Text>
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
        { this.getShareContent() }
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
        contentContainerStyle={{paddingBottom: 100}}
        data={replies}
        onRefresh={() => this.fetchReplies()}
        refreshing={this.state.isRefreshing}
        renderItem={({item, index}) =>
          <Reply item={item} key={index}/>
        }
      />
    )
  }

}

function mapStateToProps(state) {
  return {
    keyValueList: state.keyValueList,
    namespaceList: state.namespaceList,
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
  },
  key: {
    fontSize: 16,
    color: KevaColors.darkText,
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
