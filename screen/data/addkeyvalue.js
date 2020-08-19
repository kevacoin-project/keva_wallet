import React from 'react';
import {
  Alert,
  Text,
  Button,
  View,
  ListView,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  LayoutAnimation,
  UIManager,
  Dimensions,
  Animated,
  Easing,
  StatusBar,
  RefreshControl,
} from 'react-native';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
const KevaHeader = require('../../common/KevaHeader');
const utils = require('../../util');
import {
  BlueNavigationStyle,
} from '../../BlueComponents';
const loc = require('../../loc');
let BlueApp = require('../../BlueApp');
let BlueElectrum = require('../../BlueElectrum');

import Switch from 'react-native-switch-pro';
import Icon from 'react-native-vector-icons/Ionicons';
import SortableListView from 'react-native-sortable-list'
import Modal from 'react-native-modalbox';
import ActionSheet from 'react-native-actionsheet';
import ElevatedView from 'react-native-elevated-view';
import { connect } from 'react-redux'
import { setKeyValueList } from '../../actions'
import { getKeyValuesFromShortCode, getKeyValuesFromTxid } from '../../class/keva-ops';
import FloatTextInput from '../../common/FloatTextInput'

const CLOSE_ICON    = <Icon name="ios-close" size={42} color={KevaColors.errColor}/>;
const CLOSE_ICON_MODAL = (<Icon name="ios-close" size={36} color={KevaColors.darkText} style={{paddingVertical: 5, paddingHorizontal: 15}} />)
const CHECK_ICON    = <Icon name="ios-checkmark" size={42} color={KevaColors.okColor}/>;
const LIBRARY_ICON  = <Icon name="ios-images" size={30} color={KevaColors.icon}/>;
const CAMERA_ICON   = <Icon name="ios-camera" size={30} color={KevaColors.icon}/>;


class AddKeyValue extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      changes: false,
      saving: false,
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
            wallet: navigation.state.params.wallet,
          })
        }
      >
        <Text style={{color: KevaColors.actionText, fontSize: 16}}>Save</Text>
      </TouchableOpacity>
    ),
  });

  async componentDidMount() {
  }

  render() {
    let {navigation, dispatch} = this.props;
    return (
      <View style={styles.container}>
        {/* this.getItemModal() */}
        <View style={styles.inputKey}>
          <FloatTextInput
            noBorder
            autoCorrect={false}
            value={''}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{fontSize:15,flex:1}}
            placeholder={'Key'}
            clearButtonMode="while-editing"
            onChangeTextValue={() => {}}
          />
        </View>
        <View style={styles.inputValue}>
          <FloatTextInput
            multiline={true}
            noBorder
            autoCorrect={false}
            value={''}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{fontSize:15,flex:1}}
            placeholder={'Value'}
            clearButtonMode="while-editing"
            onChangeTextValue={() => {}}
          />
        </View>
      </View>
    );
  }

}

function mapStateToProps(state) {
  return {
    keyValueList: state.keyValueList,
  }
}

export default AddKeyValueScreen = connect(mapStateToProps)(AddKeyValue);

var styles = StyleSheet.create({
  container: {
    flex:1,
    backgroundColor: '#f8f8f8',
  },
  inputKey: {
    height:45,
    marginTop: 10,
    borderWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    paddingHorizontal: 10
  },
  inputValue: {
    height:145,
    marginTop: 10,
    borderWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    paddingHorizontal: 10
  }
});
