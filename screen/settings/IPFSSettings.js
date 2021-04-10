/* global alert */
import React, { Component } from 'react';
import { View, TextInput, TouchableWithoutFeedback } from 'react-native';
const StyleSheet = require('../../PlatformStyleSheet');
import {
  THIN_BORDER, SCREEN_WIDTH, sleepAync,
} from '../../util';
import { setImageGatewayURL, DefaultIPFSGateway } from '../data/mediaManager';
import Icon from 'react-native-vector-icons/Ionicons';
import { AppStorage } from '../../class';
import AsyncStorage from '@react-native-community/async-storage';
import { ScrollView } from 'react-native-gesture-handler';
import { BlueLoading, BlueSpacing20, BlueButton, SafeBlueArea, BlueNavigationStyle, BlueText, BlueListItem, } from '../../BlueComponents';
import PropTypes from 'prop-types';
import RNPickerSelect from 'react-native-picker-select';
import KevaColors from '../../common/KevaColors';
let loc = require('../../loc');

export default class IPFSSettings extends Component {
  static navigationOptions = () => ({
    ...BlueNavigationStyle(),
    title: loc.settings.electrum_settings,
  });

  constructor(props) {
    super(props);
    this.presets = [
      {
        name: 'Temporal',
        url: 'https://gateway.temporal.cloud/ipfs/',
      }, {
        name: 'Cloudflare',
        url: 'https://cloudflare-ipfs.com/ipfs/',
      }, {
        name: 'Ipfs',
        url: 'https://ipfs.io/ipfs/',
      }, {
        name: 'Infura',
        url: 'https://ipfs.infura.io/ipfs/'
      }, {
        name: 'Pinata',
        url: 'https://gateway.pinata.cloud/ipfs/'
      }
    ];

    this.state = {
      isLoading: true,
      url: '',
      useCustom: false,
    };
  }

  async componentDidMount() {
    const url = await AsyncStorage.getItem(AppStorage.IPFS_GATEWAY);
    const customUrl = await AsyncStorage.getItem(AppStorage.IPFS_CUSTOM_GATEWAY);
    const useCustom = this.isValidUrl(customUrl);

    this.setState({
      isLoading: false,
      useCustom,
      url: url || DefaultIPFSGateway,
      customUrl: customUrl || '',
    });

  }

  save = () => {
    this.setState({ isLoading: true }, async () => {
      try {
        if (this.state.useCustom) {
          await AsyncStorage.setItem(AppStorage.IPFS_CUSTOM_GATEWAY, this.state.customUrl);
          await AsyncStorage.setItem(AppStorage.IPFS_GATEWAY, '');
          setImageGatewayURL(this.state.customUrl);
        } else {
          await AsyncStorage.setItem(AppStorage.IPFS_GATEWAY, this.state.url);
          await AsyncStorage.setItem(AppStorage.IPFS_CUSTOM_GATEWAY, '');
          setImageGatewayURL(this.state.url);
        }
        await sleepAync(2000);
      } catch (e) {
        console.log(e);
      }
      this.setState({ isLoading: false });
    });
  };

  onCustom = isSelected => {
    if (isSelected) {
      this.setState({useCustom: true});
    } else {
      this.setState({useCustom: false, customUrl: ''});
    }
  }

  onPresetChange = preset => {
    this.setState({url: preset});
  }

  isValidUrl = url => {
    const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
      '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return !!pattern.test(url);
  }

  render() {
    const {useCustom, customUrl, isLoading, url} = this.state;
    const items = this.presets.map(p => ({label: p.name, value: p.url}));
    let canSave;
    if (useCustom) {
      canSave = this.isValidUrl(customUrl);
    } else {
      canSave = this.isValidUrl(url);
    }
    return (
      <SafeBlueArea forceInset={{ horizontal: 'always' }} style={{ flex: 1 }}>
        <ScrollView>
          <View style={{ padding: 20, paddingTop: 5 }}>
            <BlueText style={styles.title}>IPFS Gateway</BlueText>
            <RNPickerSelect
              disabled={useCustom}
              value={url}
              placeholder={{}}
              useNativeAndroidPickerStyle={false}
              style={{
                inputAndroid: [styles.inputAndroid, useCustom && {color: KevaColors.extraLightText}],
                inputIOS: [styles.inputIOS, useCustom && {color: KevaColors.extraLightText}],
              }}
              onValueChange={this.onPresetChange}
              items={items}
              Icon={() => <Icon name="ios-arrow-down" size={24} color={useCustom ? KevaColors.extraLightText : KevaColors.actionText} style={{ padding: 12 }} />}
            />
            <BlueSpacing20 />
            <BlueListItem
              bottomDivider={false}
              title={loc.settings.ipfs_settings_explain}
              Component={TouchableWithoutFeedback}
              switch={{ onValueChange: this.onCustom, value: useCustom }}
              style={{alignSelf: 'flex-start'}}
            />
            <View style={styles.input}>
              <TextInput
                placeholder={'e.g. https://ipfs.io/ipfs/'}
                value={customUrl}
                onChangeText={text => this.setState({ customUrl: text })}
                numberOfLines={1}
                style={{ flex: 1, marginHorizontal: 8, minHeight: 36, height: 36 }}
                editable={!isLoading && useCustom}
                underlineColorAndroid="transparent"
              />
            </View>
            <BlueSpacing20 />
            {isLoading ? <BlueLoading style={{paddingTop: 10}}/> : <BlueButton disabled={!canSave} onPress={this.save} title={loc.settings.save} />}
          </View>
        </ScrollView>
      </SafeBlueArea>
    );
  }
}

IPFSSettings.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func,
    goBack: PropTypes.func,
  }),
};

var styles = StyleSheet.create({
  title: {
    textAlign: 'center',
    color: KevaColors.darkText,
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 15
  },
  input: {
    flexDirection: 'row',
    borderColor: '#d2d2d2',
    borderBottomColor: '#d2d2d2',
    borderWidth: 1.0,
    borderBottomWidth: 0.5,
    backgroundColor: '#f5f5f5',
    minHeight: 44,
    height: 44,
    alignItems: 'center',
    borderRadius: 4,
  },
  inputAndroid: {
    width: SCREEN_WIDTH * 0.9,
    color: KevaColors.darkText,
    textAlign: 'center',
    fontSize: 16,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.lightText,
    borderRadius: 4
  },
  inputIOS: {
    width: SCREEN_WIDTH * 0.9,
    color: KevaColors.darkText,
    textAlign: 'center',
    fontSize: 16,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.lightText,
    borderRadius: 4,
    height: 46,
  },
  checkboxContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  checkbox: {
    alignSelf: "center",
  },
  label: {
    margin: 8,
  },
})
