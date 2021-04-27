import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
let BlueApp = require('../../BlueApp');
const StyleSheet = require('../../PlatformStyleSheet');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, SCREEN_WIDTH, toastError } from '../../util';
import {
  BlueNavigationStyle,
} from '../../BlueComponents';
const loc = require('../../loc');
import { TransitionPresets } from 'react-navigation-stack';
import { Button } from 'react-native-elements';

import { connect } from 'react-redux'

class ManageLocked extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      lockedFund: {},
    };
  }

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    title: 'Manage Locked Fund',
    tabBarVisible: false,
    headerLeft: () => (
      <TouchableOpacity
        style={{ marginHorizontal: 16, minWidth: 150, justifyContent: 'center', alignItems: 'flex-start' }}
        onPress={() => navigation.goBack()}
      >
        <Text style={{ color: KevaColors.actionText, fontSize: 16 }}>{loc.general.close}</Text>
      </TouchableOpacity>
    ),
    ...TransitionPresets.ModalTransition,
  });

  async componentDidMount() {
    const {lockedFund} = this.props.navigation.state.params;
    this.setState({lockedFund});
  }

  confirmClear = (onSuccess, onFailure = () => {}) => {
    Alert.alert(
      'Unlock Fund',
      'If you unlock fund, the offer you have submitted may become invalid. Unlock?',
      [
        { text: 'Yes', onPress: onSuccess, style: 'cancel' },
        {
          text: 'No',
          onPress: onFailure,
        },
      ],
      { cancelable: false },
    );
  };


  onClear = (namespaceId) => {
    const {onLockedChange} = this.props.navigation.state.params;
    this.confirmClear(async () => {
      await BlueApp.removeNamespaceLockedFund(namespaceId);
      const lockedFund = await BlueApp.getLockedFund();
      await onLockedChange();
      this.setState({lockedFund});
    });
  }

  render() {
    const {lockedFund} = this.state;
    const {otherNamespaceList, namespaceList} = this.props;
    const otherNS = otherNamespaceList.namespaces;
    const myNS = namespaceList.namespaces;

    let nsFund = {};
    for (let f of Object.keys(lockedFund)) {
      const ns = lockedFund[f].namespaceId;
      if (!nsFund[ns]) {
        nsFund[ns] = 0;
      }
      nsFund[ns] += lockedFund[f].fund;
    }

    let listFund = [];
    for (let n of Object.keys(nsFund)) {
      const ns = myNS[n] || otherNS[n];
      const nsInfo = ns ? (ns.displayName + '@' + ns.shortCode) : '';
      listFund.push(
        <View style={styles.inputContainer} key={n}>
          <View style={styles.inputKey}>
            <Text style={styles.textFund}>{nsFund[n]/100000000 + ' KVA'}</Text>
            <Button
              type='solid'
              buttonStyle={styles.buttonStyle}
              title={"Unlock"}
              titleStyle={{fontSize: 16, color: "#fff"}}
              onPress={()=>{this.onClear(n)}}
            />
          </View>
          <View>
            <Text style={styles.explain}>
              Locked for <Text style={styles.nft}>{nsInfo}</Text>
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {listFund}
      </View>
    );
  }

}

function mapStateToProps(state) {
  return {
    namespaceList: state.namespaceList,
    otherNamespaceList: state.otherNamespaceList,
  }
}

export default ManageLockedScreen = connect(mapStateToProps)(ManageLocked);

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KevaColors.background,
  },
  inputContainer: {
    flexDirection: 'column',
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
  },
  inputKey: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#fff',
  },
  textFund: {
    alignSelf: 'center',
    fontSize: 16,
    color: '#37c0a1',
  },
  explain: {
    fontSize: 16,
    marginLeft: 15,
    color: KevaColors.darkText,
  },
  nft: {
    fontSize: 16,
    marginLeft: 15,
    color: KevaColors.actionText,
  },
  buttonStyle: {
    alignSelf: 'center',
    marginRight: 10,
    borderRadius: 40,
    height: 30,
    width: 100,
    backgroundColor: KevaColors.actionText,
    borderColor: KevaColors.actionText
  }
});
