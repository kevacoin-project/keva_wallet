import React from 'react';
import {
  Text,
  View,
  ScrollView,
  Image,
  Dimensions,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import HTMLView from 'react-native-htmlview';
import { ButtonGroup } from 'react-native-elements';
import MIcon from 'react-native-vector-icons/MaterialIcons';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, timeConverter } from "../../util";
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

  render() {
    let {item} = this.props;
    return (
      <View style={styles.reply}>
        <View style={styles.senderBar} />
        <View>
          <View style={{flexDirection: 'row'}}>
            <Text style={styles.sender} numberOfLines={1} ellipsizeMode="tail">
              {item.sender.displayName}
            </Text>
            <Text style={styles.shortCode}>
              {`@${item.sender.shortCode}`}
            </Text>
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
      loaded: false,
      key: '',
      value: '',
      selectedIndex: 0,
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
        selectedIndex: this.maybeHTML(value) ? 0 : 1,
      });
    }
  }

  updateIndex = index => {
    this.setState({selectedIndex: index});
  }

  renderNode = (node, index) => {
    if (node.name == 'img') {
      const a = node.attribs;
      const width = Dimensions.get('window').width * 0.9;
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

  render() {
    const buttons = ['html', 'text']
    let {selectedIndex, value, key} = this.state;
    const replies = this.props.navigation.getParam('replies');

    const listHeader = (
      <View style={styles.container}>
        <View style={styles.keyContainer}>
          <Text style={styles.key} selectable>{key}</Text>
        </View>
        <ButtonGroup
          onPress={this.updateIndex}
          selectedIndex={selectedIndex}
          buttons={buttons}
          containerStyle={{height: 30, width: 130, borderRadius: 6, alignSelf: 'center', borderColor: KevaColors.actionText}}
          selectedButtonStyle={{backgroundColor: KevaColors.actionText}}
          innerBorderStyle={{width:0, color: '#000'}}
          textStyle={{color: KevaColors.actionText}}
        />
        <View style={styles.valueContainer}>
          {(selectedIndex == 0) ?
            <HTMLView value={`${value}`}
              addLineBreaks={false}
              stylesheet={htmlStyles}
              nodeComponentProps={{selectable: true}}
              renderNode={this.renderNode}
          />
          :
          <Text style={styles.value} selectable>{value}</Text>
          }
        </View>
        <View style={styles.actionContainer}>
          <TouchableOpacity onPress={() => this.onReply()} style={{flexDirection: 'row'}}>
            <MIcon name="chat-bubble-outline" size={22} style={styles.talkIcon} />
            {(replies && replies.length > 0) && <Text style={styles.count}>{replies.length}</Text>}
          </TouchableOpacity>
          {/*
            <TouchableOpacity onPress={() => {}}>
              <MIcon name="card-giftcard" size={22} style={styles.actionIcon} />
            </TouchableOpacity>
          */}
        </View>
      </View>
    );

    return (
      <FlatList
        style={styles.listStyle}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{paddingBottom: 100}}
        data={replies}
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
  }
});

var htmlStyles = StyleSheet.create({
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
