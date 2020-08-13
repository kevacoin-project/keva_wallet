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

import Switch from 'react-native-switch-pro';
import Icon from 'react-native-vector-icons/Ionicons';
import SortableListView from 'react-native-sortable-list'
import Modal from 'react-native-modalbox';
import ActionSheet from 'react-native-actionsheet';
import ElevatedView from 'react-native-elevated-view';
import { connect } from 'react-redux'
import { setKeyValueList, setKeyValueOrder } from '../../actions'

const CLOSE_ICON    = <Icon name="ios-close" size={42} color={KevaColors.errColor}/>;
const CLOSE_ICON_MODAL = (<Icon name="ios-close" size={36} color={KevaColors.darkText} style={{paddingVertical: 5, paddingHorizontal: 15}} />)
const CHECK_ICON    = <Icon name="ios-checkmark" size={42} color={KevaColors.okColor}/>;
const LIBRARY_ICON  = <Icon name="ios-images" size={30} color={KevaColors.icon}/>;
const CAMERA_ICON   = <Icon name="ios-camera" size={30} color={KevaColors.icon}/>;

const ACTIVE_OPACITY = 0.7;
const IMAGE_SIZE = 1200;

const HEADER_HEIGHT = 64;

const IS_IOS = utils.IS_IOS;

class Item extends React.Component {

  constructor(props) {
    super(props);
    this.state = { loading: false, selectedImage: null, isRefreshing: false };

    this._active = new Animated.Value(0);
    this._style = {
      ...Platform.select({
        ios: {
          transform: [{
            rotate: this._active.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -0.04],
            }),
          }],
          shadowRadius: this._active.interpolate({
            inputRange: [0, 1],
            outputRange: [2, 10],
          }),
        },

        android: {
          transform: [{
            rotate: this._active.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -0.04],
            }),
          }],
          elevation: this._active.interpolate({
            inputRange: [0, 1],
            outputRange: [2, 6],
          }),
        },
      }),
      opacity: this._active.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.7],
      }),
    };
  }

  onSwitch = cb => {
    this.props.onSwitch(this.props.itemId, cb);
  }

  onEdit = () => {
    let item = this.props.item;
    this.props.onEdit(this.props.itemId, item.name, item.needPicture);
  }

  async onSelected(close) {
    const response = this.state.selectedImage;
    if (!response) {
      return close && close();
    }
    let image = response.uri;
    try {
      if (response.width > IMAGE_SIZE || response.height > IMAGE_SIZE) {
        let resizedImage = await ImageResizer.createResizedImage(image, IMAGE_SIZE, IMAGE_SIZE, 'JPEG', 90);
        image = resizedImage.uri;
      }
      const size = await utils.getImageSize(image);
      this.onPicture(image, size);
      close && close();
    } catch (err) {
      LOG(err);
    }
  }

  onClose(close) {
    close && close();
    if (this.state.selectedImage) {
      setTimeout(() => this.setState({selectedImage: null}), 50);
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.active !== nextProps.active) {
      Animated.timing(this._active, {
        duration: 100,
        easing: Easing.bounce,
        toValue: Number(nextProps.active),
      }).start();
    }
  }

  render() {
    let {data} = this.props;
    let item = data;

    return (
      <Animated.View style={[this._style,]}>
        <ElevatedView elevation={1} style={styles.card}>
          <View style={{flex:1,paddingHorizontal:10,paddingTop:7}}>
            <Text style={styles.itemDesc}>{item.name}</Text>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <View></View>
              <View style={{flexDirection: 'row', alignItems:'center',justifyContent:'flex-start'}}>
                <TouchableOpacity onPress={this.onEdit}>
                  <Icon name="ios-create" size={22} style={styles.actionIcon} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => this.props.onDelete(this.props.itemId)}>
                  <Icon name="ios-trash" size={22} style={styles.actionIcon} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ElevatedView>
      </Animated.View>
    )
  }
}

class KeyValues extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      changes: false,
      saving: false,
      item: '',
      needPicture: true,
      aniY: new Animated.Value(0),
      inputMode: false
    };
  }

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    title: '',
    tabBarVisible: false,
    headerShown: true,
  });

  componentDidMount() {
  }

  onSwitch = cb => {
    cb(true, value => this.setState({needPicture: value}));
  }

  getItemModal() {
    const itemId = this.state.itemId;
    return (
      <Modal style={styles.modal} backdrop={true} ref={ref => {this.modalCode = ref}} coverScreen backButtonClose>
        <View style={styles.modalHeader}>
          <Text style={{alignSelf:'center',fontSize:20,color:KevaColors.darkText,justifyContent:'center'}}>Item</Text>
          <TouchableOpacity onPress={this.closeModal}>
             {CLOSE_ICON_MODAL}
          </TouchableOpacity>
        </View>
        <View style={{paddingVertical: 25}}>
         <TextInput autoFocus style={styles.itemInput}
           underlineColorAndroid='transparent'
           onChangeText={item => this.setState({item: item})}
           multiline numberOfLines={3}
           value={this.state.item}
         />
         { this.state.codeErr &&
           <View style={styles.codeErr}>
            <Text style={styles.codeErrText}>{this.state.codeErr}</Text>
           </View>
         }
         <View style={styles.modalSwitch}>
           <Text style={{paddingRight:10,fontSize:14}}>Picture Required</Text>
           <Switch value={this.state.needPicture} onAsyncPress={this.onSwitch} backgroundActive={KevaColors.actionText}/>
         </View>
         <Text style={{fontSize: 12, color: KevaColors.lightText, paddingHorizontal: 7}}>
          If enabled, your checker must take a picture of this item.
         </Text>
         <KevaButton
           type='secondary'
           loading={this.state.saving}
           style={{margin:10, marginTop: 20}}
           caption={itemId ? 'Update' : 'Add'}
           onPress={itemId ? this.onUpdateItem: this.onAddItem}
         />
        </View>
      </Modal>
    )
  }

  closeModal = () => {
    this.modalCode.close();
    this.setState({item: '', codeErr: null})
  }

  addItem = () => {
    this.setState({item: '', itemId: null, codeErr: null})
    this.modalCode.open();
  }

  onAddItem = () => {
    const {navigation, userInfo, checklist} = this.props;
    const propertyId = navigation.state.params.propertyId;
    const categoryId = navigation.state.params.categoryId;
    if (this.state.item.length === 0) {
      return this.setState({codeErr: 'Item must have description.'})
    }
    this.setState({codeErr: null, saving: true});
    const checkListId = checklist[propertyId].id;
    this.props.dispatch(addItemAsync(propertyId, checkListId, categoryId, this.state.item, this.state.needPicture)).then(checklist => {
      LayoutAnimation.configureNext({
        duration: 300,
        update: {type: LayoutAnimation.Types.easeInEaseOut}
      });
      this.props.dispatch(setChecklist(propertyId, checklist));
      isPremium = this._isPremium(userInfo, checklist.checkList);
      this.closeModal();
    })
    .then(() => {
      return this.props.dispatch(getPropertiesAsync());
    })
    .catch(err => {
      console.log(err);
      utils.showToast('Failed to add. Check network connection.')
    })
    .then(() => {
      this.setState({saving: false});
      utils.showToast('Item Added');
      if (isPremium) {
        this.closeItemAni();
      }
    })
  }

  onUpdateItem = () => {
    const navigation = this.props.navigation;
    const propertyId = navigation.state.params.propertyId;
    const categoryId = navigation.state.params.categoryId;
    if (this.state.item.length === 0) {
      return this.setState({codeErr: 'Item must have description.'})
    }
    this.setState({codeErr: null, saving: true});
    const checkListId = this.props.checklist[propertyId].id;
    this.props.dispatch(updateItemAsync(propertyId, checkListId, categoryId, this.state.itemId, this.state.item, this.state.needPicture)).then(checklist => {
      this.props.dispatch(setChecklist(propertyId, checklist));
      this.closeModal();
    })
    .then(() => {
      this.props.dispatch(getPropertiesAsync());
    })
    .catch(err => {
      console.log(err);
      utils.showToast('Failed to update. Check network connection.')
    })
    .then(() => {
      this.setState({saving: false});
    })
  }

  onDelete = itemId => {
    this._itemId = itemId;
    this._actionDelete.show();
  }

  deleteItem(itemId) {
    const navigation = this.props.navigation;
    const propertyId = navigation.state.params.propertyId;
    let categoryId = navigation.state.params.categoryId;
    const checkListId = this.props.checklist[propertyId].id;
    this.props.dispatch(deleteItemAsync(propertyId, checkListId, categoryId, itemId)).then(checklist => {
      LayoutAnimation.configureNext({
        duration: 200,
        update: {type: LayoutAnimation.Types.easeInEaseOut}
      });
      this.props.dispatch(setChecklist(propertyId, checklist));
    })
    .then(() => {
      this.props.dispatch(getPropertiesAsync());
    })
    .catch(err => {
      console.log(err);
      utils.showToast('Failed to delete. Check network connection.')
    });
  }

  onDeleteConfirm = index => {
    if (index === 0 && this._itemId) {
      this.deleteItem(this._itemId);
    }
  }

  onItemSwitch = (itemId, cb) => {
    const navigation = this.props.navigation;
    const categoryId = navigation.state.params.categoryId;
    const propertyId = navigation.state.params.propertyId;
    const checkListId = this.props.checklist[propertyId].id;
    cb(true, value => {
      this.props.dispatch(updateItemAsync(propertyId, checkListId, categoryId, itemId, null, value)).then(checklist => {
        this.props.dispatch(setChecklist(propertyId, checklist));
      })
      .then(() => {
        this.props.dispatch(getPropertiesAsync());
      })
      .catch(err => {
        console.log(err);
        utils.showToast('Failed to update. Check network connection.');
      });
    });
  }

  onItemEdit = (itemId, itemText, needPicture) => {
    this.setState({
      item: itemText,
      itemId: itemId,
      codeErr: null, needPicture: needPicture
    });
    this.modalCode.open();
  }

  refreshKeyValues = async () => {
    this.setState({isRefreshing: true});
    this.setState({isRefreshing: false});
  }

  onRowMoved = async (e) => {
  }

  openItemAni = () => {
    LayoutAnimation.configureNext({
      duration: 100,
      update: {type: LayoutAnimation.Types.easeInEaseOut}
    });
    this.setState({inputMode: true});
    Animated.timing(this.state.aniY, {
      toValue: 1,
      duration: 200,
      easing: Easing.inOut(Easing.linear),
      useNativeDriver: true
    }).start();
  }

  closeItemAni = () => {
    LayoutAnimation.configureNext({
      duration: 100,
      update: {type: LayoutAnimation.Types.easeInEaseOut}
    });
    this.setState({inputMode: false});
    this._inputRef && this._inputRef.blur();
    this._inputRef && this._inputRef.clear();
    Animated.timing(this.state.aniY, {
      toValue: 0,
      duration: 200,
      easing: Easing.inOut(Easing.linear),
      useNativeDriver: true
    }).start();
  }

  _getItemCount(checkList) {
    let numItems = 0;
    checkList.order.forEach(categoryId => {
      numItems += checkList.data[categoryId].order.length;
    });
    return numItems;
  }

  render() {
    let {navigation} = this.props;
    let itemList = {
      0: { name: 'First Key' },
      1: { name: 'Second Key' },
      2: { name: 'Third Key' },
    };
    const inputMode = this.state.inputMode;
    return (
      <View style={styles.container}>
         { this.getItemModal() }
        {/*
        <ActionSheet
           ref={ref => this._actionDelete = ref}
           title={'Are you sure you want to delete it?'}
           options={[Lang.general.delete, Lang.general.cancel]}
           cancelButtonIndex={1}
           destructiveButtonIndex={0}
           onPress={this.onDeleteConfirm}
        />
        */}
        <SortableListView
          style={styles.listStyle}
          contentContainerStyle={{flex: 1}}
          data={itemList}
          onChangeOrder={this.onRowMoved}
          refreshControl={
            <RefreshControl onRefresh={() => this.refreshKeyValues()} refreshing={this.state.isRefreshing} />
          }
          renderRow={({data, active}) =>
            <Item data={data} dispatch={this.props.dispatch} onDelete={this.onDelete}
              active={active} onEdit={this.onItemEdit}
            />
          }
        />
      </View>
    );
  }

}

function mapStateToProps(state) {
  return {
    keyValueList: state.keyValueList,
    keyValueOrder: state.keyValueOrder,
  }
}

export default KeyValuesScreen = connect(mapStateToProps)(KeyValues);

var styles = StyleSheet.create({
  container: {
    flex:1,
    backgroundColor:'#fff'
  },
  listStyle: {
    flex: 1,
    paddingTop:5,
    borderBottomWidth: 1,
    borderColor: KevaColors.cellBorder,
    backgroundColor: KevaColors.background
  },
  card: {
    marginLeft:10,
    marginRight:10,
    backgroundColor:'#fff',
    borderRadius:5,
    marginVertical:7,
    flexDirection: 'row'
  },
  itemDesc: {
    flex: 1,
    fontSize:16
  },
  img: {
    width: 90,
    height: 90,
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5
  },
  actionIcon: {
    color: KevaColors.icon,
    paddingHorizontal: 15,
    paddingVertical: 7
  },
  modal: {
    height:500,
    borderTopLeftRadius:10,
    borderTopRightRadius:10,
    backgroundColor: KevaColors.backgroundLight,
    zIndex:999999
  },
  modalHeader: {
    paddingLeft: 15,
    borderTopLeftRadius:10,
    borderTopRightRadius:10,
    flexDirection:'row',
    justifyContent:'space-between',
    backgroundColor: KevaColors.background,
    overflow: 'hidden',
    borderBottomWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder
  },
  itemInput: {
    borderWidth: 1,
    borderRadius: 4,
    borderColor: KevaColors.cellBorder,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 7,
    marginHorizontal: 7,
    fontSize: 16,
    backgroundColor: '#fff'
  },
  codeErr: {
    marginTop: 10,
    marginHorizontal: 7,
    flexDirection: 'row'
  },
  codeErrText: {
    color: KevaColors.errColor
  },
  modalSwitch: {
    flexDirection: 'row',
    alignItems:'center',
    justifyContent:'flex-start',
    paddingHorizontal: 7,
    paddingTop: 15,
    paddingBottom: 10
  },
  activeImg: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderBottomWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    height: 50
  },
  action: {
    fontSize: 17,
    paddingVertical: 10
  },
  inAction: {
    fontSize: 17,
    paddingVertical: 10,
    paddingHorizontal: 7,
    color: KevaColors.inactiveText
  },
  navHeader: {
    borderBottomWidth:utils.THIN_BORDER,
    borderBottomColor:KevaColors.cellBorder,
    backgroundColor: 'white'
  },
  iconBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 90,
    width: 90
  },
  iconBtn: {
    height: 40,
    width: 40,
    backgroundColor: '#fff',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2
  },
});
