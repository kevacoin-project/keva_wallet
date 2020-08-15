import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  View,
  TextInput,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  PixelRatio,
  Text,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  BlueNavigationStyle,
  BlueHeaderDefaultSub,
} from '../../BlueComponents';
import Modal from 'react-native-modal';
import ActionSheet from 'react-native-actionsheet';
import SortableListView from 'react-native-sortable-list'
import ElevatedView from 'react-native-elevated-view'
import { TabView, TabBar } from 'react-native-tab-view';
import { connect } from 'react-redux'
import {
  setNamespaceList, setOtherNamespaceList,
  setNamespaceOrder, setOtherNamespaceOrder,
} from '../../actions'

let BlueApp = require('../../BlueApp');
let loc = require('../../loc');
let BlueElectrum = require('../../BlueElectrum');
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER } from '../../util';
import Toast from 'react-native-root-toast';
import {
  createKevaNamespace, updateKeyValue, findMyNamespaces,
  findOtherNamespace,
} from '../../class/keva-ops';

const CLOSE_ICON = (<Icon name="ios-close" size={36} color="#fff" style={{ paddingVertical: 5, paddingHorizontal: 15 }} />)

class Namespace extends React.Component {

  constructor(props) {
    super(props);
    this.state = { loading: false, selectedImage: null };

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

  onPress() {
  }

  onEdit = () => {
    let namespace = this.props.data;
    this.props.onEdit(this.props.categoryId, namespace.displayName);
  }

  onKey = () => {
    let namespace = this.props.data;
    this.props.navigation.navigate('KeyValues', {
      namespaceId: namespace.id,
      shortCode: namespace.shortCode,
    });
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
    let namespace = this.props.data;
    let canDelete = this.props.canDelete;
    return (
      <Animated.View style={[this._style,]}>
        <ElevatedView elevation={1} style={styles.cardTitle}>
          <View style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 7, paddingTop: 5 }}>
            <View style={{ flex: 1 }} >
              <Text style={styles.cardTitleText}>{namespace.displayName}</Text>
            </View>
            <View style={styles.actionContainer}>
              <TouchableOpacity onPress={this.onEdit}>
                <Icon name="ios-create" size={22} style={styles.actionIcon} />
              </TouchableOpacity>
              { canDelete &&
              <TouchableOpacity onPress={() => this.props.onShowActions(this.props.categoryId)}>
                <Icon name="ios-trash" size={22} style={styles.actionIcon} />
              </TouchableOpacity>
              }
            </View>
          </View>
          <TouchableOpacity onPress={this.onKey}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* <Text style={styles.cardTitleTextSm}>{numberItems}</Text> */}
              <Icon name="ios-arrow-forward" size={22} color={KevaColors.actionText} style={{ paddingHorizontal: 7 }} />
            </View>
          </TouchableOpacity>
        </ElevatedView>
      </Animated.View>
    )
  }

}


class MyNamespaces extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      loaded: false, changes: false, nsName: '',
      namespaceId: null, saving: false,
      isLoading: true, isModalVisible: false,
      isRefreshing: false,
    };
  }

  onNSNameEdit = (namespaceId, nsName) => {
    this.setState({
      nsName: nsName,
      sectionId: namespaceId,
      codeErr: null,
      isModalVisible: true
    });
  }

  getNSModal() {
    const sectionId = this.state.sectionId;
    return (
      <Modal style={styles.modal} backdrop={true}
        swipeDirection="down"
        onSwipeComplete={this.closeModal}
        isVisible={this.state.isModalVisible} coverScreen>
        <View style={styles.modalHeader}>
          <Text style={{ alignSelf: 'center', fontSize: 18, color: '#fff' }}>Namespace Name</Text>
          <TouchableOpacity onPress={this.closeModal}>
            {CLOSE_ICON}
          </TouchableOpacity>
        </View>
        <View style={{ paddingVertical: 25 }}>
          <TextInput autoFocus
            style={styles.sectionInput}
            onChangeText={section => this.setState({ section: section })}
            value={this.state.section}
          />
          {this.state.codeErr &&
            <View style={styles.codeErr}>
              <Text style={styles.codeErrText}>{this.state.codeErr}</Text>
            </View>
          }
          <KevaButton
            type='secondary'
            loading={this.state.saving}
            style={{ padding: 10, marginTop: 10, marginBottom: 10 }}
            caption={sectionId ? 'Update' : 'Update'}
            onPress={sectionId ? this.onUpdateSection : this.onAddNamespace}
          />
        </View>
      </Modal>
    )
  }

  closeModal = () => {
    this.setState({ section: '', codeErr: null, isModalVisible: false });
  }

  onChangeOrder = async (order) => {
    const { dispatch } = this.props;
    dispatch(setNamespaceOrder(order));
  }

  onAddNamespace = async () => {
    const wallets = BlueApp.getWallets();
    if (this.state.nsName && this.state.nsName.length > 0) {
      return createKevaNamespace(wallets[0], 120, this.state.nsName);
    }
    return;
    return updateKeyValue(wallets[0], 120, 'NZY6DiPFeSXzXYG3UKA5ZdXNMALwB6CzTz', 'John 3:16 Bible', 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.');
    return getNamespaceUtxo(wallets[0], 'NZY6DiPFeSXzXYG3UKA5ZdXNMALwB6CzTz');

    return scanForNamespaces(wallets[0]);

    if (this.state.nsName && this.state.nsName.length > 0) {
      return createKevaNamespace(wallets[0], 120, this.state.nsName);
    }
  }

  fetchNamespaces = async () => {
    const { dispatch } = this.props;
    const wallets = BlueApp.getWallets();
    const namespaces = await findMyNamespaces(wallets[0], BlueElectrum);

    const order = this.props.namespaceList.order;
    for (let id of Object.keys(namespaces)) {
      if (!order.find(nsid => nsid == id)) {
        order.unshift(id);
      }
    }
    dispatch(setNamespaceList(namespaces, order));
  }

  async componentDidMount() {
    try {
      await this.fetchNamespaces();
    } catch (err) {
      // TODO: show status.
      console.error(err);
    }
  }

  refreshNamespaces = async () => {
    this.setState({isRefreshing: true});
    try {
      this.fetchNamespaces();
    } catch (err) {
      console.error(err);
      this.setState({isRefreshing: false});
    }
    this.setState({isRefreshing: false});
  }

  render() {
    const { navigation, namespaceList } = this.props;
    const canAdd = this.state.nsName && this.state.nsName.length > 0;
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
        {this.getNSModal()}
        <View style={{ paddingTop: 10, paddingLeft: 8, backgroundColor: '#fff', borderBottomWidth: THIN_BORDER, borderColor: KevaColors.cellBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10 }}>
          <TextInput
            onChangeText={nsName => this.setState({ nsName: nsName })}
            value={this.state.nsName}
            placeholder={"Name of new namespace"}
            multiline={false}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{ flex: 1, borderRadius: 4, backgroundColor: '#ececed', paddingTop: 5, paddingBottom: 5, paddingLeft: 7, paddingRight: 36 }}
          />
          {this.state.saving ?
            <ActivityIndicator size="small" color={KevaColors.actionText} style={{ width: 42, height: 42 }} />
            :
            <TouchableOpacity onPress={this.onAddNamespace} disabled={!canAdd}>
              <Icon name={'md-add-circle'}
                    style={[styles.addIcon, !canAdd && {color: KevaColors.inactiveText}]}
                    size={28} />
            </TouchableOpacity>
          }
        </View>
        {
          namespaceList &&
          <SortableListView
            style={styles.listStyle}
            contentContainerStyle={{paddingBottom: 400}}
            data={namespaceList.namespaces}
            order={namespaceList.order}
            onChangeOrder={this.onChangeOrder}
            refreshControl={
              <RefreshControl onRefresh={() => this.refreshNamespaces()} refreshing={this.state.isRefreshing} />
            }
            renderRow={({data, active}) => {
              return <Namespace onEdit={this.onNSNameEdit} data={data} active={active} navigation={navigation} />
            }}
          />
        }
      </View>
    );
  }

}

class OtherNamespaces extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      loaded: false, changes: false, nsName: '',
      namespaceId: null, saving: false,
      isLoading: true, isModalVisible: false,
      isRefreshing: false,
    };
  }

  onChangeOrder = async (order) => {
    this.props.dispatch(setOtherNamespaceOrder(order));
  }

  fetchOtherNamespaces = async () => {
    const { dispatch, otherNamespaceList } = this.props;
    try {
      const order = otherNamespaceList.order;
      const wallets = BlueApp.getWallets();
      const namespaces = otherNamespaceList.namespaces;
      for (let ns of Object.keys(namespaces)) {
        const namespace = await findOtherNamespace(wallets[0], BlueElectrum, namespaces[ns].rootTxid);
        dispatch(setOtherNamespaceList(namespace, order));
      }
    } catch (err) {
      Toast.show('Cannot find namespace');
      console.log(err);
    }
  }

  async componentDidMount() {
    try {
      await this.fetchOtherNamespaces();
    } catch (err) {
      // TODO: show status.
      console.error(err);
    }
  }

  refreshNamespaces = async () => {
    this.setState({isRefreshing: true});
    try {
      this.fetchOtherNamespaces();
    } catch (err) {
      console.error(err);
      this.setState({isRefreshing: false});
    }
    this.setState({isRefreshing: false});
  }

  onSearchNamespace =async () => {
    const { dispatch, otherNamespaceList } = this.props;
    try {
      const wallets = BlueApp.getWallets();
      const namespace = await findOtherNamespace(wallets[0], BlueElectrum, this.state.nsName);
      if (!namespace) {
        return;
      }
      const newId = Object.keys(namespace)[0];

      // Fix the order
      let order = [...otherNamespaceList.order];
      if (!order.find(nsid => nsid == newId)) {
        order.unshift(newId);
      }
      dispatch(setOtherNamespaceList(namespace, order));
      this.setState({nsName: ''});
    } catch (err) {
      Toast.show('Cannot find namespace');
      console.log(err);
    }
  }

  render() {
    const { navigation, otherNamespaceList } = this.props;
    const canSearch = this.state.nsName && this.state.nsName.length > 0;

    return (
      <View style={styles.container}>
        <ActionSheet
          ref={ref => this._actionSheet = ref}
          title={'Are you sure you want to delete it?'}
          options={[loc.general.delete, loc.general.cancel]}
          cancelButtonIndex={1}
          destructiveButtonIndex={0}
          onPress={this.onAction}
        />
        <View style={{ paddingTop: 10, paddingLeft: 8, backgroundColor: '#fff', borderBottomWidth: THIN_BORDER, borderColor: KevaColors.cellBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10 }}>
          <TextInput
            onChangeText={nsName => this.setState({ nsName: nsName })}
            value={this.state.nsName}
            placeholder={"Namespace short code or tx id"}
            multiline={false}
            underlineColorAndroid='rgba(0,0,0,0)'
            returnKeyType='search'
            clearButtonMode='while-editing'
            onSubmitEditing={this.onSearchNamespace}
            style={{ flex: 1, borderRadius: 4, backgroundColor: '#ececed', paddingTop: 5, paddingBottom: 5, paddingLeft: 7, paddingRight: 36 }}
          />
          {this.state.saving ?
            <ActivityIndicator size="small" color={KevaColors.actionText} style={{ width: 42, height: 42 }} />
            :
            <TouchableOpacity onPress={this.onSearchNamespace} disabled={!canSearch}>
              <Icon name={'md-search'}
                    style={[styles.addIcon, !canSearch && {color: KevaColors.inactiveText}]}
                    size={25} />
            </TouchableOpacity>
          }
        </View>
        {
          otherNamespaceList &&
          <SortableListView
            style={styles.listStyle}
            contentContainerStyle={{paddingBottom: 400}}
            data={otherNamespaceList.namespaces}
            order={otherNamespaceList.order}
            onChangeOrder={this.onChangeOrder}
            refreshControl={
              <RefreshControl onRefresh={() => this.refreshNamespaces()} refreshing={this.state.isRefreshing} />
            }
            renderRow={({data, active}) => {
              return <Namespace onEdit={this.onNSNameEdit} data={data} active={active} navigation={navigation} canDelete={true} />
            }}
          />
        }
      </View>
    );
  }

}

class Namespaces extends React.Component {

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    headerShown: false,
  });

  constructor(props) {
    super(props);
    this.state = {
      loaded: false, changes: false, nsName: '', namespaceId: null, saving: false ,
      isLoading: true, isModalVisible: false,
      index: 0,
      routes: [
        { key: 'first', title: 'My Namespaces' },
        { key: 'second', title: 'Others' }
      ]
    };
  }

  async componentDidMount() {
  }

  render() {
    const { dispatch, navigation, namespaceList, namespaceOrder, otherNamespaceList, otherNamespaceOrder } = this.props;
    return (
      <View style={styles.container}>
        <BlueHeaderDefaultSub leftText={/*loc.settings.header*/ 'Namespaces'} rightComponent={null} />
        <TabView
          navigationState={this.state}
          renderScene={({ route }) => {
            switch (route.key) {
              case 'first':
                return <MyNamespaces dispatch={dispatch} navigation={navigation} namespaceList={namespaceList} />;
              case 'second':
                return <OtherNamespaces dispatch={dispatch} navigation={navigation} otherNamespaceList={otherNamespaceList} />;
            }
          }}
          onIndexChange={index => this.setState({ index })}
          initialLayout={{ width: Dimensions.get('window').width }}
          renderTabBar={props =>
            <TabBar
              {...props}
              renderLabel={({ route, focused }) => (
                <Text style={{ color: focused ? KevaColors.actionText : KevaColors.inactiveText, margin: 0, fontSize: 16 }}>
                  {route.title}
                </Text>
              )}
              indicatorStyle={{ backgroundColor: KevaColors.actionText }}
              labelStyle={{ backgroundColor: '#fff', color: KevaColors.inactiveText }}
              style={{ backgroundColor: '#fff' }}
            />
          }
        />
      </View>
    );
  }

}

function mapStateToProps(state) {
  return {
    namespaceList: state.namespaceList,
    namespaceOrder: state.namespaceOrder,
    otherNamespaceList: state.otherNamespaceList,
    otherNamespaceOrder: state.otherNamespaceOrder,
  }
}

export default NamespacesScreen = connect(mapStateToProps)(Namespaces)

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
    flex: 1,
    paddingTop: 10,
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
    margin: 0,
  },
  modalHeader: {
    paddingLeft: 15,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: KevaColors.primaryLightColor,
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
  addIcon: {
    width: 42,
    height: 42,
    color: KevaColors.actionText,
    paddingVertical: 5,
    paddingHorizontal: 9,
    top: 1
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
