import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, SCREEN_WIDTH, toastError } from '../../util';
import {
  BlueNavigationStyle,
} from '../../BlueComponents';
const loc = require('../../loc');
import { TransitionPresets } from 'react-navigation-stack';
import { Button } from 'react-native-elements';

import { connect } from 'react-redux'
import { acceptNFTBid, decodePSBT } from '../../class/nft-ops';
import Biometric from '../../class/biometrics';

class AcceptNFT extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      saving: false,
    };
  }

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    title: 'Accept Offer',
    tabBarVisible: false,
    headerLeft: () => (
      <TouchableOpacity
        style={{ marginHorizontal: 16, minWidth: 150, justifyContent: 'center', alignItems: 'flex-start' }}
        onPress={() => navigation.goBack()}
      >
        <Text style={{ color: KevaColors.actionText, fontSize: 16 }}>{loc.general.cancel}</Text>
      </TouchableOpacity>
    ),
    ...TransitionPresets.ModalTransition,
  });

  async componentDidMount() {
    this.isBiometricUseCapableAndEnabled = await Biometric.isBiometricUseCapableAndEnabled();
  }

  render() {
    const { offerTx, price, addr } = this.props.navigation.state.params;
    return (
      <View style={styles.container}>
        <View style={styles.inputKey}>
          <Text style={{fontSize: 20, color: KevaColors.darkText, fontWeight: '700', textAlign: 'center'}}>{price + " KVA"}</Text>
          <Text style={{fontSize: 18, color: KevaColors.darkText, textAlign: 'center', marginVertical: 15}}>{"will be paid to your address"}</Text>
          <Text style={{fontSize: 16, color: KevaColors.darkText, textAlign: 'center'}}>{addr}</Text>

          <Button
            type='solid'
            buttonStyle={{alignSelf: 'center', marginTop: 30, borderRadius: 30, height: 40, width: 200, backgroundColor: KevaColors.actionText, borderColor: KevaColors.actionText}}
            title={"Accept and Sign"}
            titleStyle={{fontSize: 16, color: "#fff", marginLeft: 10}}
            icon={
              <Icon
                name="ios-checkmark"
                size={40}
                color="#fff"
              />
            }
            onPress={()=>{this.onAccept(item.value)}}
          />
        </View>
        <Text
          style={{
            flex: 1,
            borderColor: '#ebebeb',
            backgroundColor: '#d2f8d6',
            borderRadius: 4,
            color: '#37c0a1',
            fontWeight: '500',
            fontSize: 14,
            paddingHorizontal: 16,
            paddingBottom: 16,
            paddingTop: 16,
            height: 300,
          }}
          selectable
        >
          {decodePSBT(offerTx)}
        </Text>
      </View>
    );
  }

}

function mapStateToProps(state) {
  return {}
}

export default AcceptNFTScreen = connect(mapStateToProps)(AcceptNFT);

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KevaColors.background,
  },
  inputKey: {
    padding: 10,
    paddingVertical: 20,
    marginTop: 10,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
  },
  modalNS: {
    height: 300,
    alignSelf: 'center',
    justifyContent: 'flex-start',
  },
  modalText: {
    fontSize: 18,
    color: KevaColors.lightText,
  },
  waitText: {
    fontSize: 16,
    color: KevaColors.lightText,
    paddingTop: 10,
    alignSelf: 'center',
  },
  modalFee: {
    fontSize: 18,
    color: KevaColors.statusColor,
  },
  modalErr: {
    fontSize: 16,
    marginTop: 20,
  },
  inputAndroid: {
    width: SCREEN_WIDTH*0.8,
    color: KevaColors.lightText,
    textAlign: 'center',
    fontSize: 16,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.lightText,
    borderRadius: 4
  },
  inputIOS: {
    width: SCREEN_WIDTH*0.8,
    color: KevaColors.lightText,
    textAlign: 'center',
    fontSize: 16,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.lightText,
    borderRadius: 4,
    height: 46,
  },
});
