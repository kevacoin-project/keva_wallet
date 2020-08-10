import React from 'react';
import {
  Alert,
  Text,
  Button,
  View,
  ListView,
  Image,
  ScrollView,
  WebView,
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
} from 'react-native';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
const KevaHeader = require('../../common/KevaHeader');
const utils = require('../../util');

import Switch from 'react-native-switch-pro';
import Icon from 'react-native-vector-icons/Ionicons';
import SortableListView from 'react-native-sortable-listview'
import Modal from 'react-native-modalbox';
import ActionSheet from 'react-native-actionsheet';
import ElevatedView from 'react-native-elevated-view';

const CLOSE_ICON    = <Icon name="ios-close-outline" size={42} color={KevaColors.errColor}/>;
const CLOSE_ICON_MODAL = (<Icon name="ios-close-outline" size={36} color={KevaColors.darkText} style={{paddingVertical: 5, paddingHorizontal: 15}} />)
const CHECK_ICON    = <Icon name="ios-checkmark-outline" size={42} color={KevaColors.okColor}/>;
const LIBRARY_ICON  = <Icon name="ios-images" size={30} color={KevaColors.icon}/>;
const CAMERA_ICON   = <Icon name="ios-camera" size={30} color={KevaColors.icon}/>;

const ACTIVE_OPACITY = 0.7;
const IMAGE_SIZE = 1200;

const HEADER_HEIGHT = 64;

const IS_IOS = utils.IS_IOS;

class Item extends React.Component {

  constructor(props) {
    super(props);
    this.state = { loading: false, selectedImage: null };
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

  render() {
    let item = this.props.item;

    return (
      <TouchableOpacity {...this.props.sortHandlers} activeOpacity={ACTIVE_OPACITY}>
        <ElevatedView elevation={1} style={styles.card}>
          <View style={{flex:1,paddingHorizontal:10,paddingTop:7}}>
            <Text style={styles.itemDesc}>{item.name}</Text>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <View style={{flexDirection: 'row', alignItems:'center',justifyContent:'flex-start'}}>
                <TouchableOpacity onPress={this.onEdit}>
                  <Icon name="ios-create-outline" size={22} style={styles.actionIcon} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => this.props.onDelete(this.props.itemId)}>
                  <Icon name="ios-trash-outline" size={22} style={styles.actionIcon} />
                </TouchableOpacity>
              </View>
              <View style={{flexDirection: 'row', alignItems:'center',justifyContent:'flex-start'}}>
                <Text style={{paddingRight:7,fontSize:13,color:KevaColors.lightText}}>Picture</Text>
                <Switch width={36} height={20} value={item.needPicture} onAsyncPress={this.onSwitch} backgroundActive={KevaColors.actionText}/>
              </View>
            </View>
          </View>
        </ElevatedView>
      </TouchableOpacity>
    )
  }
}

export default class KeyValues extends React.Component {

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
    tabBarVisible: false,
    headerShown: false,
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

  onRowMoved = async (e) => {
    let {categoryId, propertyId} = this.props.navigation.state.params;
    try {
      let checkList = this.props.checklist[propertyId];
      const checkListId = checkList.id;
      let itemList = checkList.checkList.data[categoryId];
      itemList.order.splice(e.to, 0, itemList.order.splice(e.from, 1)[0]);
      this.props.dispatch(setChecklist(propertyId, checkList));
      await this.props.dispatch(updateItemOrderAsync(propertyId, checkListId, categoryId, itemList.order));
    } catch(err) {
      LOG(err);
    }
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
    //let {categoryId, propertyId} = navigation.state.params;
    //let checkList = this.props.checklist[propertyId];
    let itemList = {};
    let moveUpY = this.state.aniY.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -(IS_IOS ? HEADER_HEIGHT : KevaHeader.height + 5)],
      extrapolate: 'clamp',
    });
    const moveOffset = IS_IOS ? 20 : 15;
    let moveUpYPartial = this.state.aniY.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -HEADER_HEIGHT + moveOffset],
      extrapolate: 'clamp',
    });
    let moveUp = {transform: [{translateY: moveUpY}]}
    let moveUpPartial = {transform: [{translateY: moveUpYPartial}]}
    const inputMode = this.state.inputMode;
    return (
      <View style={styles.container}>
        <StatusBar
          translucent={true}
          backgroundColor="rgba(0, 0, 0, 0.2)"
          barStyle="default"
         />
         { this.getItemModal() }
        <View style={styles.topBar}>
          <View style={styles.space} />
          <Animated.View style={[{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, backgroundColor: '#fff'}, moveUpPartial]}>
            <TouchableOpacity onPress={this.closeItemAni}>
              <Text style={[{color: KevaColors.actionText, fontSize: 16, textAlign: 'left'}, inputMode && {paddingRight: 5}]}>
                {inputMode ? 'Cancel' : ''}
              </Text>
            </TouchableOpacity>
            <TextInput
              onFocus={this.openItemAni}
              onChangeText={item => this.setState({item: item})}
              value={this.state.item}
              ref={ref => this._inputRef = ref}
              placeholder={"Item, e.g. refrigerator, sink"}
              multiline={true}
              underlineColorAndroid='rgba(0,0,0,0)'
              style={{flex: 1, borderRadius: 4, backgroundColor: '#ececed', paddingTop: 5, paddingBottom: 5, paddingLeft: 7, paddingRight: 36}}
            />
            {this.state.saving ?
              <ActivityIndicator size="small" color={KevaColors.actionText} style={{width: 42, height: 42}}/>
              :
              <TouchableOpacity onPress={this.onAddItem}>
                <Icon name={'md-add-circle'} style={{width: 42, height: 42, color: KevaColors.actionText, paddingVertical: 5, paddingHorizontal: 9, top: 1}} size={28}/>
              </TouchableOpacity>
            }
          </Animated.View>
          <View style={styles.inputArea}>
            <View style={{paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between'}}>
              <Text style={{paddingRight:10, fontSize:16, color: KevaColors.lightText}}>Checker must take a picture</Text>
              <Switch value={this.state.needPicture} onAsyncPress={this.onSwitch} backgroundActive={KevaColors.actionText}/>
            </View>
          </View>
        </View>
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
          disableAnimatedScrolling
          style={styles.listStyle}
          data={itemList}
          activeOpacity={ACTIVE_OPACITY}
          sortRowStyle={{transform: [{rotate: '-5deg'}]}}
          onRowMoved={this.onRowMoved}
          renderFooter={() => <View style={{height: 100}}/>}
          renderRow={(key, active) =>
            <Item key={index} item={row} dispatch={this.props.dispatch} onDelete={this.onDelete}
                  propertyId={propertyId} checkListId={checkListId} categoryId={categoryId}
                  itemId={index} onSwitch={this.onItemSwitch} onEdit={this.onItemEdit}
            />
          }
        />
        <Animated.View style={[styles.navHeaderWarpper, moveUp]}>
          <KevaHeader
           style={styles.navHeader}
           foreground="dark"
           title={'Key Values'}
           leftItem={{
             icon: require('../../common/img/back.png'),
             layout: 'icon',
             onPress: () => this.props.navigation.dispatch(utils.backAction)
           }}
         />
       </Animated.View>
      </View>
    );
  }

}

var styles = StyleSheet.create({
  container: {
    flex:1,
    backgroundColor:'#fff'
  },
  space: {
    ios: {
      paddingTop: HEADER_HEIGHT
    },
    android: {
      paddingTop: KevaHeader.height
    }
  },
  listStyle: {
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
  imgContainer: {
    backgroundColor: '#eae2e2',
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
    justifyContent: 'center',
    width: 90,
    height: 90
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
  overlay: {
    flex: 1,
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0.4,
    backgroundColor: KevaColors.darkText,
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center'
  },
  activeImg: {
    flex: 1
  },
  retake: {
    height: 60,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: utils.THIN_BORDER,
    borderRadius: 4,
    marginVertical: 5,
    marginHorizontal: 10,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff'
  },
  photoIcon: {
    paddingHorizontal: 7
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
  navHeaderWarpper: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: 'blue'
  },
  inputArea: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingTop: 0,
    paddingBottom: 0,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    zIndex: -1,
    borderTopWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    marginHorizontal: 12
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
  topBar: {
    ios: {
      paddingTop: 10,
      paddingLeft: 8,
      backgroundColor: '#fff',
      borderBottomWidth: utils.THIN_BORDER,
      borderColor: KevaColors.cellBorder
    },
    android: {
      paddingTop: 10,
      paddingLeft: 8,
      backgroundColor: '#fff',
      borderBottomWidth: utils.THIN_BORDER,
      borderColor: KevaColors.cellBorder
    }
  }
});
