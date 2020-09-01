import React from 'react';
import {
  Text,
  View,
  ScrollView,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import HTMLView from 'react-native-htmlview';
import { ButtonGroup } from 'react-native-elements';
import MIcon from 'react-native-vector-icons/MaterialIcons';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaColors = require('../../common/KevaColors');
const utils = require('../../util');
import {
  BlueNavigationStyle,
} from '../../BlueComponents';
const loc = require('../../loc');

import { connect } from 'react-redux'

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

    return (
      <ScrollView style={styles.container}>
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
      </ScrollView>
    );
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
    borderWidth: utils.THIN_BORDER,
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
    borderWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    padding: 10,
  },
  actionContainer: {
    flexDirection: 'row',
    borderBottomWidth: utils.THIN_BORDER,
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
