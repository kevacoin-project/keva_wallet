import React, { Component } from 'react';
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

class Category extends React.Component {

  constructor(props) {
    super(props);
    this.state = { loading: false, selectedImage: null };
  }

  onPress() {
    this.props.navigation.navigate('ItemList',
    {
      title: this.props.title,
      propertyId: this.props.propertyId,
      categoryId: this.props.categoryId
    })
  }

  onEdit = () => {
    let category = this.props.category;
    this.props.onEdit(this.props.categoryId, category.name);
  }

  onPicture = (uri, size) => {
    this.setState({loading: true});
    const {checkListId, categoryId} = this.props;
    this.props.dispatch(uploadSectionPictureAsync(checkListId, categoryId, uri, size)).then(() => {
      this.props.dispatch(getChecklistAsync(checkListId)).then(checkList => {
        this.props.dispatch(setChecklist(this.props.propertyId, checkList));
      })
    })
    .catch(err => {
      console.log(err);
      utils.showToast('Failed to upload. Check network connection.')
    })
    .then(() => {
      this.setState({loading: false, selectedImage: null});
    })
  }

  onCamera = () => {
    ImagePicker.launchCamera(this.pickerOptions, response => this._onImage(response));
  }

  onLibrary = () => {
    ImagePicker.launchImageLibrary(this.pickerOptions, response => this._onImage(response));
  }

  async _onImage(response) {
    if (response.didCancel) {
      return console.log('User cancelled image picker');
    }
    else if (response.error) {
      return console.log('ImagePicker Error: ', response.error);
    }
    try {
      const size = await utils.getImageSize(response.uri);
      this.setState({selectedImage: response, selectedImageSize: size});
    } catch(err) {
      LOG(err);
    }
  }

  async onSelected(close) {
    const response = this.state.selectedImage;
    if (!response) {
      return close();
    }
    let image = response.uri;
    try {
      if (response.width > IMAGE_SIZE || response.height > IMAGE_SIZE) {
        let resizedImage = await ImageResizer.createResizedImage(image, IMAGE_SIZE, IMAGE_SIZE, 'JPEG', 90);
        image = resizedImage.uri;
      }
      const size = await utils.getImageSize(image);
      this.onPicture(image, size);
      close();
    } catch (err) {
      LOG(err);
    }
  }

  onClose(close) {
    this.state.selectedImage && this.setState({selectedImage: null});
    close();
  }

  render() {
    let category = this.props.category;
    let numberItems = (category.order && category.order.length) || 0;
    const footer = () => (
      <View style={{flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 15}}>
        <TouchableOpacity onPress={this.onLibrary} style={styles.retake}>
          {LIBRARY_ICON}
          <Text style={styles.retakeTitle}>Library</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={this.onCamera} style={styles.retake}>
          {CAMERA_ICON}
          <Text style={styles.retakeTitle}>Camera</Text>
        </TouchableOpacity>
      </View>
    )
    const header = close => (
      <View style={styles.header}>
        <TouchableOpacity onPress={() => this.onClose(close)} style={styles.photoIcon}>
          <Text style={styles.action}>Cancel</Text>
        </TouchableOpacity>
        <Text style={{fontSize: 16}}>
          Select Image
        </Text>
        <TouchableOpacity onPress={() => this.onSelected(close)} style={styles.photoIcon}>
          <Text style={styles.action}>Save</Text>
        </TouchableOpacity>
      </View>
    )
    let image;
    let width;
    let height;
    if (this.state.selectedImage) {
      image = <Image resizeMode="cover" style={styles.img} source={{uri: this.state.selectedImage.uri}} />
      width = this.state.selectedImageSize.width;
      height = this.state.selectedImageSize.height;
    } else if (category.picture && category.picture.uri) {
      const pic = category.picture;
      image = <Image resizeMode="cover" style={styles.img} source={{uri: pic.uri}} />
      width = pic.width;
      height = pic.height;
    } else {
      image = <Image resizeMode="cover" style={styles.img} source={require('./img/add.png')} />
    }
    const boxWidth = utils.SCREEN_WIDTH;
    const boxHeight = (width && height) ? Math.round(height / width * boxWidth) : 0;
    return (
      <TouchableOpacity {...this.props.sortHandlers} onPress={() => this.onPress()} activeOpacity={ACTIVE_OPACITY}>
        <ElevatedView elevation={1} style={styles.cardTitle}>
          <View style={styles.imgContainer}>
            <Lightbox
              targetHeight={boxHeight} renderFooter={footer}
              renderHeader={header} activeProps={{style: {flex: 1, opacity: boxHeight ? 1 : 0}}}
              backgroundColor='#f8f8f8'
            >
              { image }
            </Lightbox>
            {this.state.loading &&
              <View style={styles.overlay}>
                <ActivityIndicator size="large" color='#fff' style={{padding: 2}}/>
              </View>
            }
          </View>
          <View style={{flex: 1, justifyContent: 'space-between', paddingHorizontal: 7, paddingTop: 5}}>
            <View style={{flex: 1}} >
              <Text style={styles.cardTitleText}>{category.name}</Text>
            </View>
            <View style={styles.actionContainer}>
              <TouchableOpacity onPress={this.onEdit}>
                <Icon name="ios-create-outline" size={22} style={styles.actionIcon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => this.props.onShowActions(this.props.categoryId)}>
                <Icon name="ios-trash-outline" size={22} style={styles.actionIcon} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.cardTitleTextSm}>{numberItems}</Text>
            <Icon name="ios-arrow-forward-outline" size={22} color={F8Colors.arrowIcon} style={{paddingHorizontal: 7}}/>
          </View>
        </ElevatedView>
      </TouchableOpacity>
    )
  }

}


export default class Namespaces extends Component {

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    headerShown: false,
  });

  state = { isLoading: true };

  constructor(props) {
    super(props);
  }

  async componentDidMount() {
  }

  componentWillUnmount() {
  }

  render() {
    const { dispatch, navigation } = this.props;
    const propertyId = navigation.state.params.propertyId;
    let checkList;
    let checkListId;
    if (this.props.checklist[propertyId]) {
      checkList = this.props.checklist[propertyId].checkList;
      checkListId = this.props.checklist[propertyId].id;
    }
    return (
      <View style={styles.container}>
        <StatusBar
          translucent={true}
          backgroundColor="rgba(0, 0, 0, 0.2)"
          barStyle="default"
        />
        <ActionSheet
          ref={ref => this._actionSheet = ref}
          title={'Are you sure you want to delete it?'}
          options={[Lang.general.delete, Lang.general.cancel]}
          cancelButtonIndex={1}
          destructiveButtonIndex={0}
          onPress={this.onAction}
        />
        {this.getSectionModal()}
        <View style={styles.sectionWrap}>
          <TouchableOpacity onPress={() => navigation.navigate('SelectSchedule', { propertyId })}>
            <View style={styles.section}>
              <View>
                <Image source={require('../img/4-1.png')} width={75} height={66} />
              </View>
              <View style={styles.schduleAndDetail}>
                <Text style={styles.schedule}>When to check?</Text>
                <Text style={styles.detail}>
                  {this.getScheduleDesc(propertyId)}
                </Text>
              </View>
              <View>
                <Icon name="ios-arrow-forward-outline" size={22} color={KevaColors.arrowIcon} style={{ paddingLeft: 7, paddingRight: 10 }} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
        <KevaButton caption={"+ Section"} type='secondary'
          style={{ paddingTop: 15, paddingHorizontal: 5 }}
          onPress={this.addSection}
        />
        {
          (checkList && checkList.order && checkList.order.length > 0) &&
          <SortableListView
            style={styles.listStyle}
            removeClippedSubviews={false}
            data={checkList.data}
            order={checkList.order}
            activeOpacity={ACTIVE_OPACITY}
            onRowMoved={this.onRowMoved}
            sortRowStyle={{ transform: [{ rotate: '-5deg' }] }}
            renderRow={(row, section, index) =>
              <Category key={index} onShowActions={this.onShowActions} title={row.name} category={row}
                propertyId={propertyId}
                checkListId={checkListId}
                categoryId={index} checkList={checkList} navigation={navigation}
                dispatch={dispatch}
                onEdit={this.onSectionEdit}
              />
            }
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
    color: '#5e5959'
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
    height: 500,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    zIndex: 999999
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
