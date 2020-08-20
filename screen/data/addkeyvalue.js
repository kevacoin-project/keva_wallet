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
import Toast from 'react-native-root-toast';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
const KevaHeader = require('../../common/KevaHeader');
const utils = require('../../util');
import {
  BlueNavigationStyle,
  BlueLoading,
  BlueBigCheckmark,
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
import { updateKeyValue } from '../../class/keva-ops';
import FloatTextInput from '../../common/FloatTextInput';
import StepModal from "../../common/StepModalWizard";


class AddKeyValue extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      changes: false,
      saving: false,
      key: '',
      value: '',
      showKeyValueModal: false,
      valueOnly: false,
    };
  }

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    title: '',
    tabBarVisible: false,
    headerRight: () => (
      <TouchableOpacity
        style={{ marginHorizontal: 16, minWidth: 150, justifyContent: 'center', alignItems: 'flex-end' }}
        onPress={navigation.state.params.onPress}
      >
        <Text style={{color: KevaColors.actionText, fontSize: 16}}>Save</Text>
      </TouchableOpacity>
    ),
  });

  async componentDidMount() {
    const {namespaceId, walletId, key, value} = this.props.navigation.state.params;
    if (key && key.length > 0 && value && value.length > 0) {
      this.setState({
        key,
        value,
        valueOnly: true
      });
    }
    this.props.navigation.setParams({
      onPress: this.onSave
    });

  }

  onSave = async () => {
    const {namespaceId, walletId} = this.props.navigation.state.params;
    const {key, value} = this.state;
    if (key.length == 0 || value.length == 0) {
      Toast.show('Key and value must be set');
      return;
    }
    const wallets = BlueApp.getWallets();
    this.wallet = wallets.find(w => w.getID() == walletId);
    if (!this.wallet) {
      Toast.show('Cannot find wallet');
      return;
    }

    this.setState({
      showKeyValueModal: true,
      currentPage: 0,
      showSkip: true,
      broadcastErr: null,
      isBroadcasting: false,
      fee: 0,
    }, () => {
      setTimeout(async () => {
        const { tx, fee } = await updateKeyValue(this.wallet, 120, namespaceId, key, value);
        let feeKVA = fee / 100000000;
        this.setState({ showKeyValueModal: true, currentPage: 1, fee: feeKVA });
        this.namespaceTx = tx;
      }, 800);
    });
  }

  KeyValueCreationFinish = () => {
    return this.setState({showKeyValueModal: false});
  }

  KeyValueCreationCancel = () => {
    return this.setState({showKeyValueModal: false});
  }

  KeyValueCreationNext = () => {
    return this.setState({
      currentPage: this.state.currentPage + 1
    });
  }

  getKeyValueModal = () => {
    if (!this.state.showKeyValueModal) {
      return null;
    }

    let createNSPage = (
      <View style={styles.modalNS}>
        <Text style={styles.modalText}>{"Creating Transaction ..."}</Text>
        <BlueLoading style={{paddingTop: 30}}/>
      </View>
    );

    let confirmPage = (
      <View style={styles.modalNS}>
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
              let result = await BlueElectrum.broadcast(this.namespaceTx);
              if (result.code) {
                // Error.
                return this.setState({
                  isBroadcasting: false,
                  broadcastErr: result.message,
                });
              }
              console.log(result)
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
        <View style={styles.modalNS}>
          <Text style={styles.modalText}>{"Broadcasting Transaction ..."}</Text>
          <BlueLoading style={{paddingTop: 30}}/>
        </View>
      );
    } else if (this.state.broadcastErr) {
      broadcastPage = (
        <View style={styles.modalNS}>
          <Text style={[styles.modalText, {color: KevaColors.errColor, fontWeight: 'bold'}]}>{"Error"}</Text>
          <Text style={styles.modalErr}>{this.state.broadcastErr}</Text>
          <KevaButton
            type='secondary'
            style={{margin:10, marginTop: 30}}
            caption={'Cancel'}
            onPress={async () => {
              this.setState({showKeyValueModal: false});
            }}
          />
        </View>
      );
    } else {
      broadcastPage = (
        <View style={styles.modalNS}>
          <BlueBigCheckmark style={{marginHorizontal: 50}}/>
          <KevaButton
            type='secondary'
            style={{margin:10, marginTop: 30}}
            caption={'Done'}
            onPress={async () => {
              this.setState({
                showKeyValueModal: false,
                nsName: '',
              });
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
          stepComponents={[createNSPage, confirmPage, broadcastPage]}
          onFinish={this.KeyValueCreationFinish}
          onNext={this.KeyValueCreationNext}
          onCancel={this.KeyValueCreationCancel}/>
      </View>
    );
  }

  render() {
    let {navigation, dispatch} = this.props;
    return (
      <View style={styles.container}>
        {this.getKeyValueModal()}
        <View style={styles.inputKey}>
          <FloatTextInput
            editable={!this.state.valueOnly}
            noBorder
            autoCorrect={false}
            value={this.state.key}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{fontSize:15,flex:1}}
            placeholder={'Key'}
            clearButtonMode="while-editing"
            onChangeTextValue={key => {this.setState({key})}}
          />
        </View>
        <View style={styles.inputValue}>
          <FloatTextInput
            multiline={true}
            noBorder
            autoCorrect={false}
            value={this.state.value}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{fontSize:15,flex:1}}
            placeholder={'Value'}
            clearButtonMode="while-editing"
            onChangeTextValue={value => {this.setState({value})}}
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
  },
  modalNS: {
    height: 300,
    alignSelf: 'center',
    justifyContent: 'flex-start'
  },
  modalText: {
    fontSize: 18,
    color: KevaColors.lightText,
  },
  modalFee: {
    fontSize: 18,
    color: KevaColors.statusColor,
  },
  modalErr: {
    fontSize: 16,
    marginTop: 20,
  },
});
