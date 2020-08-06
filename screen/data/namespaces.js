import React from 'react';
import {
  ActivityIndicator,
  View,
  TextInput,
  Alert,
  StatusBar,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  ScrollView,
  PixelRatio,
  Text,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-community/async-storage';
import {
  BlueCreateTxNavigationStyle,
  BlueButton,
  BlueBitcoinAmount,
  BlueAddressInput,
  BlueDismissKeyboardInputAccessory,
  BlueLoading,
  BlueUseAllFundsButton,
  BlueListItem,
  BlueText,
  BlueNavigationStyle,
} from '../../BlueComponents';
import Slider from '@react-native-community/slider';
import PropTypes from 'prop-types';
import Modal from 'react-native-modal';
import NetworkTransactionFees, { NetworkTransactionFee } from '../../models/networkTransactionFees';
import BitcoinBIP70TransactionDecode from '../../bip70/bip70';
import { BitcoinUnit, Chain } from '../../models/bitcoinUnits';
import { AppStorage, HDSegwitBech32Wallet, LightningCustodianWallet, WatchOnlyWallet } from '../../class';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { BitcoinTransaction } from '../../models/bitcoinTransactionInfo';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import DeeplinkSchemaMatch from '../../class/deeplink-schema-match';
import SortableListView from 'react-native-sortable-listview'
import ElevatedView from 'react-native-elevated-view'

const bitcoin = require('bitcoinjs-lib');
const bip21 = require('../../bip21/bip21');
let BigNumber = require('bignumber.js');
const { width } = Dimensions.get('window');
let BlueApp: AppStorage = require('../../BlueApp');
let loc = require('../../loc');
let BlueElectrum = require('../../BlueElectrum');
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
const utils = require('../../util');

const ACTIVE_OPACITY = 0.7;
const CLOSE_ICON = (<Icon name="ios-close-circle-outline" size={36} color="#fff" style={{paddingVertical: 5, paddingHorizontal: 15}} />)

class Category extends React.Component {

  constructor(props) {
    super(props);
    this.state = { loading: false, selectedImage: null };
  }

  onPress() {
  }

  onEdit = () => {
    let namespace = this.props.namespace;
    this.props.onEdit(this.props.categoryId, namespace.name);
  }

  render() {
    let namespace = this.props.namespace;
    let numberItems = 100;

    return (
      <TouchableOpacity {...this.props.sortHandlers} onPress={() => this.onPress()} activeOpacity={ACTIVE_OPACITY}>
        <ElevatedView elevation={1} style={styles.cardTitle}>
          <View style={{flex: 1, justifyContent: 'space-between', paddingHorizontal: 7, paddingTop: 5}}>
            <View style={{flex: 1}} >
              <Text style={styles.cardTitleText}>{namespace.name}</Text>
            </View>
            <View style={styles.actionContainer}>
              <TouchableOpacity onPress={this.onEdit}>
                <Icon name="ios-create" size={22} style={styles.actionIcon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => this.props.onShowActions(this.props.categoryId)}>
                <Icon name="ios-trash" size={22} style={styles.actionIcon} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.cardTitleTextSm}>{numberItems}</Text>
            <Icon name="ios-arrow-forward" size={22} color={KevaColors.actionText} style={{paddingHorizontal: 7}}/>
          </View>
        </ElevatedView>
      </TouchableOpacity>
    )
  }

}


export default class Namespaces extends React.Component {

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    headerShown: false,
  });

  state = { isLoading: true, isModalVisible: false };

  constructor(props) {
    super(props);
    this.state = { loaded: false, changes: false, section: '', sectionId: null, saving: false};
  }

  async componentDidMount() {
  }

  componentWillUnmount() {
  }

  onSectionEdit = (sectionId, sectionText) => {
    this.setState({
      section: sectionText,
      sectionId: sectionId,
      codeErr: null,
      isModalVisible: true
    });
  }

  getSectionModal() {
    const sectionId = this.state.sectionId;
    return (
      <Modal style={styles.modal} backdrop={true} isVisible={this.state.isModalVisible} coverScreen>
        <View style={styles.modalHeader}>
          <Text style={{alignSelf:'center',fontSize:18,color:'#fff'}}>Section Name</Text>
          <TouchableOpacity onPress={this.closeModal}>
            {CLOSE_ICON}
          </TouchableOpacity>
        </View>
        <View style={{paddingVertical: 25}}>
        <TextInput autoFocus
                    style={styles.sectionInput}
                    onChangeText={section => this.setState({section: section})}
                    value={this.state.section}
        />
        { this.state.codeErr &&
          <View style={styles.codeErr}>
            <Text style={styles.codeErrText}>{this.state.codeErr}</Text>
          </View>
        }
        <KevaButton
          type='secondary'
          loading={this.state.saving}
          style={{padding:10,marginTop:10,marginBottom:10}}
          caption={sectionId ? 'Update' : 'Add'}
          onPress={sectionId ? this.onUpdateSection : this.onAddSection}
        />
        </View>
      </Modal>
    )
  }

  closeModal = () => {
    this.setState({section: '', codeErr: null, isModalVisible: false});
  }

  onChangeOrder = async (e) => {
    console.log(e);
  }

  render() {
    const { dispatch, navigation } = this.props;
    let namespaces = {
      0: {name: 'First Namespace'},
      1: {name: 'Second Namespace'},
      2: {name: 'Third Namespace'},
    };
    return (
      <View style={styles.container}>
        {/*
        <ActionSheet
          ref={ref => this._actionSheet = ref}
          title={'Are you sure you want to delete it?'}
          options={[Lang.general.delete, Lang.general.cancel]}
          cancelButtonIndex={1}
          destructiveButtonIndex={0}
          onPress={this.onAction}
        />
        */}
        { this.getSectionModal() }
        <View style={{paddingTop: 10, paddingLeft: 8, backgroundColor: '#fff', borderBottomWidth: utils.THIN_BORDER, borderColor: KevaColors.cellBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10}}>
          <TextInput
            onChangeText={section => this.setState({section: section})}
            value={this.state.section}
            placeholder={"Add a new namespace"}
            multiline={true}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{flex: 1, borderRadius: 4, backgroundColor: '#ececed', paddingTop: 10, paddingBottom: 10, paddingLeft: 7, paddingRight: 36}}
          />
          {this.state.saving ?
            <ActivityIndicator size="small" color={KevaColors.actionText} style={{width: 42, height: 42}}/>
            :
            <TouchableOpacity onPress={this.onAddSection}>
              <Icon name={'md-add-circle'} style={{width: 42, height: 42, color: KevaColors.actionText, paddingVertical: 5, paddingHorizontal: 9, top: 1}} size={28}/>
            </TouchableOpacity>
          }
        </View>
        {
          namespaces &&
          <SortableListView
            style={styles.listStyle}
            data={namespaces}
            onChangeOrder={this.onChangeOrder}
            renderRow={(namespace, active) => {
              return <Category onEdit={this.onSectionEdit} namespace={namespace} active={active} />
            }}
          />
        }
      </View>
    );
  }

}

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  sectionWrap: {
    marginBottom: 0
  },
  section: {
    backgroundColor: 'white',
    borderBottomWidth: 1 / PixelRatio.get(),
    borderBottomColor: '#e8e8e8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  schduleAndDetail: {
    flex: 1,
    left: 15
  },
  schedule: {
    color: KevaColors.actionText,
    fontSize: 17
  },
  detail: {
    color: '#5E5959',
    fontSize: 13,
    paddingTop: 3
  },
  sectionText: {
    color: '#5E5959',
    fontSize: 16,
  },
  resultText: {
    color: '#918C8C',
    fontSize: 15,
    top: -1,
    paddingRight: 5
  },
  listStyle: {
    paddingTop: 10
  },
  image: {
    width: 90,
    height: 90,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: "center",
    marginHorizontal: 7,
    backgroundColor: '#fff',
    borderRadius: 5,
    marginVertical: 7
  },
  cardTitleText: {
    fontSize: 16,
    color: '#5e5959'
  },
  cardTitleTextSm: {
    top: -1,
    fontSize: 16,
    color: KevaColors.actionText
  },
  cardContent: {
    backgroundColor: '#fff',
    padding: 5
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 5
  },
  itemDesc: {
    flex: 1,
    paddingLeft: 5
  },
  imgContainer: {
    backgroundColor: '#eae2e2',
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
    overflow: 'hidden'
  },
  img: {
    height: 90,
    width: 90,
  },
  addBlock: {
    marginTop: 0,
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: '#fc8274',
    padding: 5,
    paddingVertical: 7,
    marginLeft: 20,
    marginRight: 20
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  actionIcon: {
    color: KevaColors.arrowIcon,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  modal: {
    height: 800,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    zIndex: 999999,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
  },
  modalHeader: {
    paddingLeft: 15,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(247,129,102,0.6)'
  },
  sectionInput: {
    borderWidth: 1,
    borderRadius: 4,
    borderColor: KevaColors.inputBorder,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginHorizontal: 10,
    fontSize: 16
  },
  codeErr: {
    marginTop: 20,
    marginHorizontal: 20,
    flexDirection: 'row'
  },
  codeErrText: {
    color: KevaColors.errColor
  },
  retake: {
    height: 60,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    marginVertical: 10,
    marginHorizontal: 10,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff'
  },
  retakeTitle: {
    fontSize: 10,
    color: KevaColors.lightText
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    height: 50
  },
  photoIcon: {
    paddingHorizontal: 10,
    paddingHorizontal: 7
  },
  action: {
    fontSize: 16,
    color: KevaColors.actionText,
    paddingVertical: 10
  },
  overlay: {
    flex: 1,
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0.4,
    backgroundColor: 'black',
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
