import React from 'react';
import {
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-root-toast';
import RNPickerSelect from 'react-native-picker-select';
import HTMLView from 'react-native-htmlview';
import Icon from 'react-native-vector-icons/Ionicons';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, SCREEN_WIDTH, toastError } from '../../util';
import { HDSegwitP2SHWallet, } from '../../class';
import { htmlStyles } from './showkeyvalue';
import {
  BlueNavigationStyle,
  BlueLoading,
  BlueBigCheckmark,
} from '../../BlueComponents';
const loc = require('../../loc');
let BlueApp = require('../../BlueApp');
let BlueElectrum = require('../../BlueElectrum');
import { FALLBACK_DATA_PER_BYTE_FEE } from '../../models/networkTransactionFees';
import { setMediaInfo, setKeyValue } from '../../actions'
import { TransitionPresets } from 'react-navigation-stack';
import { createThumbnail } from "react-native-create-thumbnail";
import VideoPlayer from 'react-native-video-player';

import { connect } from 'react-redux'
import { shareKeyValue, getNamespaceInfoFromTx } from '../../class/keva-ops';
import StepModal from "../../common/StepModalWizard";
import Biometric from '../../class/biometrics';
import { extractMedia, replaceMedia, getImageGatewayURL, constructMedia } from './mediaManager';

class ShareKeyValue extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      changes: false,
      saving: false,
      value: '',
      showKeyValueModal: false,
      createTransactionErr: null,
      CIDHeight: 1,
      CIDWidth: 1,
      thumbnail: null,
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
        <View style={{ borderRadius: 20, backgroundColor: KevaColors.actionText, paddingVertical: 4, paddingHorizontal: 15 }}>
          <Text style={{color: '#FFF', fontSize: 16}}>{loc.general.share}</Text>
        </View>
      </TouchableOpacity>
    ),
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
    const {mediaInfoList, dispatch} = this.props;
    const { shareTxid, origKey, origValue } = this.props.navigation.state.params;
    this.setState({
      shareTxid, origKey, origValue
    });

    this.props.navigation.setParams({
      onPress: this.onSave
    });
    this.isBiometricUseCapableAndEnabled = await Biometric.isBiometricUseCapableAndEnabled();

    const {mediaCID, mimeType} = extractMedia(origValue);
    if (!mimeType) {
      return;
    }

    const mediaInfo = mediaInfoList[mediaCID];
    if (mediaInfo) {
      if (mimeType.startsWith('image')) {
        this.setState({CIDHeight: mediaInfo.height, CIDWidth: mediaInfo.width});
      } else if (mimeType.startsWith('video')) {
        this.setState({thumbnail: mediaInfo.thumbnail, CIDWidth: mediaInfo.width, CIDHeight: mediaInfo.height});
      }
      return;
    }

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
  }

  onSave = async () => {
    const { namespaceList } = this.props;

    const wallets = BlueApp.getWallets();
    if (wallets.length == 0) {
      Toast.show("You don't have wallet");
      return;
    }

    const namespaces = namespaceList.namespaces;
    const defaultNamespaceId = namespaces[Object.keys(namespaces)[0]].id;

    this.setState({
      showKeyValueModal: true,
      currentPage: 0,
      showSkip: true,
      broadcastErr: null,
      isBroadcasting: false,
      fee: 0,
      createTransactionErr: null,
      currentPage: 0,
      namespaceId: this.state.namespaceId || defaultNamespaceId,
    });
  }

  KeyValueCreationFinish = () => {
    return this.setState({ showKeyValueModal: false });
  }

  KeyValueCreationCancel = () => {
    return this.setState({ showKeyValueModal: false });
  }

  KeyValueCreationNext = () => {
    return this.setState({
      currentPage: this.state.currentPage + 1
    });
  }

  getShareKeyValueModal = () => {
    const { namespaceList, keyValueList, dispatch } = this.props;
    const { shareTxid, origShortCode, namespaceId: origNamespaceId, index, type, hashtags, updateHashtag, onShareDone } = this.props.navigation.state.params;
    if (!this.state.showKeyValueModal) {
      return null;
    }

    const namespaces = namespaceList.namespaces;
    const items = Object.keys(namespaces).map(ns => ({ label: namespaces[ns].displayName, value: namespaces[ns].id }));
    let selectNamespacePage = (
      <View style={styles.modalNS}>
        <Text style={[styles.modalText, { textAlign: 'center', marginBottom: 20, color: KevaColors.darkText }]}>{"Choose a namespace"}</Text>
        <RNPickerSelect
          value={this.state.namespaceId}
          placeholder={{}}
          useNativeAndroidPickerStyle={false}
          style={{
            inputAndroid: styles.inputAndroid,
            inputIOS: styles.inputIOS,
          }}
          onValueChange={(namespaceId) => this.setState({ namespaceId })}
          items={items}
          Icon={() => <Icon name="ios-arrow-down" size={24} color={KevaColors.actionText} style={{ padding: 12 }} />}
        />
        {/* <Text style={[styles.modalFee, {textAlign: 'center', marginTop: 10}]}>{wallet.getBalance()/100000000 + ' KVA'}</Text> */}
        <KevaButton
          type='secondary'
          style={{ margin: 10, marginTop: 40 }}
          caption={'Next'}
          onPress={async () => {
            try {
              const { namespaceId, value } = this.state;
              const shortCode = namespaceList.namespaces[namespaceId].shortCode;
              if (!shortCode) {
                toastError(loc.namespaces.namespace_unconfirmed);
                throw new Error('Namespace not confirmed yet');
              }
              const walletId = namespaceList.namespaces[namespaceId].walletId;
              const wallets = BlueApp.getWallets();
              const wallet = wallets.find(w => w.getID() == walletId);
              if (!wallet) {
                throw new Error('Wallet not found');
              }
              // Make sure it is not single address wallet.
              if (wallet.type != HDSegwitP2SHWallet.type) {
                return alert(loc.namespaces.multiaddress_wallet);
              }
              this.setState({ showNSCreationModal: true, currentPage: 1 });

              const nsData = await getNamespaceInfoFromTx(BlueElectrum, shareTxid);
              let authorName = nsData.displayName;

              let actualValue;
              if (value.length > 0) {
                actualValue = value;
              } else {
                actualValue = `${loc.namespaces.default_share} ${authorName}@${origShortCode}`;
              }
              // Append image preview.
              const {mediaCID, mimeType} = extractMedia(this.state.origValue);
              if (mediaCID) {
                actualValue += constructMedia(mediaCID, mimeType);
              }

              const { tx, fee, cost } = await shareKeyValue(wallet, FALLBACK_DATA_PER_BYTE_FEE, namespaceId, actualValue, shareTxid);
              let feeKVA = (fee + cost) / 100000000;
              this.setState({ showNSCreationModal: true, currentPage: 2, fee: feeKVA });
              this.namespaceTx = tx;
            } catch (err) {
              console.warn(err);
              this.setState({ createTransactionErr: loc.namespaces.namespace_creation_err + ' [' + err.message + ']' });
            }
          }}
        />
      </View>
    );

    let createNSPage = (
      <View style={styles.modalNS}>
        {
          this.state.createTransactionErr ?
            <>
              <Text style={[styles.modalText, { color: KevaColors.errColor, fontWeight: 'bold' }]}>{"Error"}</Text>
              <Text style={styles.modalErr}>{this.state.createTransactionErr}</Text>
              <KevaButton
                type='secondary'
                style={{ margin: 10, marginTop: 30 }}
                caption={'Cancel'}
                onPress={async () => {
                  this.setState({ showKeyValueModal: false, createTransactionErr: null });
                }}
              />
            </>
            :
            <>
              <Text style={[styles.modalText, { alignSelf: 'center', color: KevaColors.darkText }]}>{loc.namespaces.creating_tx}</Text>
              <Text style={styles.waitText}>{loc.namespaces.please_wait}</Text>
              <BlueLoading style={{ paddingTop: 30 }} />
            </>
        }
      </View>
    );

    let confirmPage = (
      <View style={styles.modalNS}>
        <Text style={styles.modalText}>{"Transaction fee:  "}
          <Text style={styles.modalFee}>{this.state.fee + ' KVA'}</Text>
        </Text>
        <KevaButton
          type='secondary'
          style={{ margin: 10, marginTop: 40 }}
          caption={loc.namespaces.confirm}
          onPress={async () => {
            this.setState({ currentPage: 3, isBroadcasting: true });
            try {
              await BlueElectrum.ping();
              await BlueElectrum.waitTillConnected();
              if (this.isBiometricUseCapableAndEnabled) {
                if (!(await BiometrionShareDonec.unlockWithBiometrics())) {
                  this.setState({ isBroadcasting: false });
                  return;
                }
              }
              let result = await BlueElectrum.broadcast(this.namespaceTx);
              if (result.code) {
                // Error.
                return this.setState({
                  isBroadcasting: false,
                  broadcastErr: result.message,
                });
              }

              await BlueApp.saveToDisk();
              this.setState({ isBroadcasting: false, showSkip: false });
            } catch (err) {
              this.setState({ isBroadcasting: false });
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
          <BlueLoading style={{ paddingTop: 30 }} />
        </View>
      );
    } else if (this.state.broadcastErr) {
      broadcastPage = (
        <View style={styles.modalNS}>
          <Text style={[styles.modalText, { color: KevaColors.errColor, fontWeight: 'bold' }]}>{"Error"}</Text>
          <Text style={styles.modalErr}>{this.state.broadcastErr}</Text>
          <KevaButton
            type='secondary'
            style={{ margin: 10, marginTop: 30 }}
            caption={'Cancel'}
            onPress={async () => {
              this.setState({ showKeyValueModal: false });
            }}
          />
        </View>
      );
    } else {
      broadcastPage = (
        <View style={styles.modalNS}>
          <BlueBigCheckmark style={{ marginHorizontal: 50 }} />
          <KevaButton
            type='secondary'
            style={{ margin: 10, marginTop: 30 }}
            caption={'Done'}
            onPress={async () => {
              this.setState({
                showKeyValueModal: false,
                nsName: '',
              });
              Toast.show(loc.general.share_sent, {
                duration: Toast.durations.LONG,
                position: Toast.positions.TOP,
                backgroundColor: "#53DD6C",
              });

              // Update share count
              if (type == 'keyvalue') {
                let keyValue = (keyValueList.keyValues[origNamespaceId])[index];
                keyValue.shares = keyValue.shares + 1;
                dispatch(setKeyValue(origNamespaceId, index, keyValue));
              } else if (type == 'hashtag') {
                let keyValue = hashtags[index];
                keyValue.shares = keyValue.shares + 1;
                if (updateHashtag) {
                  updateHashtag(index, keyValue);
                }
              }
              if (onShareDone) {
                onShareDone();
              }
              this.props.navigation.goBack();
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
          stepComponents={[selectNamespacePage, createNSPage, confirmPage, broadcastPage]}
          onFinish={this.KeyValueCreationFinish}
          onNext={this.KeyValueCreationNext}
          onCancel={this.KeyValueCreationCancel} />
      </View>
    );
  }

  renderNode = (node, index) => {
    if (!node.prev && !node.next && !node.parent && node.type == 'text') {
      return (<Text key={index} style={{fontSize: 16, color: KevaColors.darkText, lineHeight: 25}}>{unescape(node.data)}</Text>);
    } else if (node.name == 'img') {
      const a = node.attribs;
      const width = Dimensions.get('window').width * 0.9;
      const height = (a.height && a.width) ? (a.height / a.width) * width : width;
      return (<Image style={{ width, height, alignSelf: 'center'}} source={{ uri: a.src }} key={index} resizeMode="contain"/>);
    } else if (node.name == 'video') {
      const { width, height, poster } = node.attribs; // <video width="320" height="240" poster="http://link.com/image.jpg">...</video>

      // Check if node has children
      if (node.children.length === 0) return;

      // Get all children <source> nodes
      // <video><source src="movie.mp4" type="video/mp4"><source src="movie.ogg" type="video/ogg"></video>
      const sourceNodes = node.children.filter((node) => node.type === 'tag' && node.name === 'source')
      // Get a list of source URLs (<source src="movie.mp4">)
      const sources = sourceNodes.map((node) => node.attribs.src);
      let displayWidth = Dimensions.get('window').width * 0.9;
      let displayHeight;
      if (height && width) {
        displayHeight = (Number(height) / Number(width)) * displayWidth;
      } else {
        displayHeight = (225/400)*displayWidth;
      }
      return (
        <VideoPlayer
          key={index}
          disableFullscreen={false}
          fullScreenOnLongPress={true}
          resizeMode="contain"
          video={{ uri: sources[0] }} // Select one of the video sources
          videoWidth={displayWidth}
          videoHeight={displayHeight}
          thumbnail={{uri: poster}}
          customStyles={{
            video : {backgroundColor: 'black'},
          }}
        />
      );
    }
  }

  getContent = () => {
    const {origValue, CIDHeight, CIDWidth, thumbnail} = this.state;
    let value = replaceMedia(origValue, CIDHeight, CIDWidth, thumbnail);

    const content = (
      <View style={styles.origContainer}>
        <HTMLView value={`${value}`}
          addLineBreaks={false}
          stylesheet={htmlStyles}
          nodeComponentProps={{ selectable: true }}
          renderNode={this.renderNode}
          style={{borderWidth: THIN_BORDER, borderColor: KevaColors.cellBorder, borderRadius: 6, padding: 10, width: "100%"}}
        />
      </View>
    );
    return content;
  }

  render() {
    let { navigation, dispatch } = this.props;
    return (
      <ScrollView style={styles.container}>
        {this.getShareKeyValueModal()}
        <View style={styles.inputValue}>
          <TextInput
            multiline={true}
            noBorder
            autoCorrect={true}
            value={this.state.value}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{ fontSize: 15, flex: 1, textAlignVertical: 'top' }}
            clearButtonMode="while-editing"
            onChangeText={value => { this.setState({ value }) }}
          />
        </View>
        { this.getContent() }
      </ScrollView>
    );
  }

}

function mapStateToProps(state) {
  return {
    namespaceList: state.namespaceList,
    mediaInfoList: state.mediaInfoList,
    shares: state.shares,
    keyValueList: state.keyValueList,
  }
}

export default ShareKeyValueScreen = connect(mapStateToProps)(ShareKeyValue);

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KevaColors.background,
  },
  inputKey: {
    height: 45,
    marginTop: 10,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    paddingHorizontal: 10
  },
  inputValue: {
    height: 100,
    marginTop: 10,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    paddingHorizontal: 10
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
    width: SCREEN_WIDTH * 0.8,
    color: KevaColors.lightText,
    textAlign: 'center',
    fontSize: 16,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.lightText,
    borderRadius: 4
  },
  inputIOS: {
    width: SCREEN_WIDTH * 0.8,
    color: KevaColors.lightText,
    textAlign: 'center',
    fontSize: 16,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.lightText,
    borderRadius: 4,
    height: 46,
  },
  origContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    backgroundColor: '#fff',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
});
