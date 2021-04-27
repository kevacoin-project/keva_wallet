import React from 'react';
import {
  Text,
} from 'react-native';
import { createAppContainer } from 'react-navigation';
import { createStackNavigator, TransitionPresets } from 'react-navigation-stack';
import { createBottomTabNavigator } from 'react-navigation-tabs';

import Settings from './screen/settings/settings';
import About from './screen/settings/about';
import ReleaseNotes from './screen/settings/releasenotes';
import Licensing from './screen/settings/licensing';
import Language from './screen/settings/language';
import Currency from './screen/settings/currency';
import EncryptStorage from './screen/settings/encryptStorage';
import PlausibleDeniability from './screen/plausibledeniability';
import ElectrumSettings from './screen/settings/electrumSettings';
import IPFSSettings from './screen/settings/IPFSSettings';
import GeneralSettings from './screen/settings/GeneralSettings';
import NetworkSettings from './screen/settings/NetworkSettings';
import DefaultView from './screen/settings/defaultView';

import WalletsList from './screen/wallets/list';
import WalletTransactions from './screen/wallets/transactions';
import AddWallet from './screen/wallets/add';
import PleaseBackup from './screen/wallets/pleaseBackup';
import ImportWallet from './screen/wallets/import';
import WalletDetails from './screen/wallets/details';
import WalletExport from './screen/wallets/export';
import WalletXpub from './screen/wallets/xpub';
import ReorderWallets from './screen/wallets/reorderWallets';
import SelectWallet from './screen/wallets/selectWallet';

import details from './screen/transactions/details';
import TransactionStatus from './screen/transactions/transactionStatus';
import cpfp from './screen/transactions/CPFP';
import rbfBumpFee from './screen/transactions/RBFBumpFee';
import rbfCancel from './screen/transactions/RBFCancel';

import receiveDetails from './screen/receive/details';

import sendDetails from './screen/send/details';
import ScanQRCode from './screen/send/ScanQRCode';
import sendCreate from './screen/send/create';
import Confirm from './screen/send/confirm';
import PsbtWithHardwareWallet from './screen/send/psbtWithHardwareWallet';
import Success from './screen/send/success';
import Broadcast from './screen/send/broadcast';
import Namespaces from './screen/data/namespaces';
import Explore from './screen/data/hashtagexplore';
import KeyValues from './screen/data/keyvalues';
import AddKeyValue from './screen/data/addkeyvalue';
import EditProfile from './screen/data/editprofile';
import SellNFT from './screen/data/sellnft';
import BuyNFT from './screen/data/buynft';
import OfferNFT from './screen/data/offernft';
import AcceptNFT from './screen/data/acceptnft';
import ManageLocked from './screen/data/managelocked';
import ReplyKeyValue from './screen/data/replykeyvalue';
import ShareKeyValue from './screen/data/sharekeyvalue';
import ShowKeyValue from './screen/data/showkeyvalue';
import RewardKeyValue from './screen/data/rewardkeyvalue';
import HashtagKeyValues from './screen/data/hashtagkeyvalues';
import TransferNamespace from './screen/data/transfernamespace';

import Ionicons from 'react-native-vector-icons/Ionicons';
let loc = require('./loc');

const StyleSheet = require('./PlatformStyleSheet');

const ReorderWalletsStackNavigator = createStackNavigator({
  ReorderWallets: {
    screen: ReorderWallets,
  },
});

const CreateWalletStackNavigator = createStackNavigator({
  AddWallet: {
    screen: AddWallet,
  },
  ImportWallet: {
    screen: ImportWallet,
    routeName: 'ImportWallet',
  },
  PleaseBackup: {
    screen: PleaseBackup,
  },
}, {
  defaultNavigationOptions: {
    headerBackTitleVisible: false,
    headerTitle: () => null,
  },
});

let styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  labelStyle: {
    android: {
      fontSize: 11,
      position: 'relative',
      top: -2
    }
  },
  tabStyle: {
    android: {
      backgroundColor: '#fbfbfb'
    }
  },
  style: {
    android: {
      backgroundColor: '#fbfbfb',
      height: 48
    }
  }
});

const KevaTabNavigator = createBottomTabNavigator({
    Wallets: {
      screen: WalletsList,
      path: 'wallets',
      navigationOptions: {
        headerShown: false,
      },
    },
    Namespaces: {
      screen: Namespaces,
      path: 'Namespaces',
      navigationOptions: {
        headerStyle: {
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 0,
          elevation: 0,
        },
        headerTintColor: '#0c2550',
      },
    },
    Explore: {
      screen: Explore,
      path: 'Explore',
      navigationOptions: {
        headerStyle: {
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 0,
          elevation: 0,
        },
        headerTintColor: '#0c2550',
      },
    },
    Settings: {
      screen: Settings,
      path: 'Settings',
      navigationOptions: {
        headerStyle: {
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 0,
          elevation: 0,
        },
        headerTintColor: '#0c2550',
      },
    },
  },
  {
    initialRouteName: 'Wallets',
    tabBarPosition: 'bottom',
    lazy: true,
    tabBarOptions: {
      activeTintColor: '#e91e63',
      inactiveTintColor: '#5E5959',
      showIcon: true,
      style: styles.style,
      labelStyle: styles.labelStyle,
      tabStyle: styles.tabStyle,
      labelPosition: 'below-icon',
    },
    defaultNavigationOptions: ({ navigation }) => ({
      tabBarIcon: ({ focused, horizontal, tintColor }) => {
        const { routeName } = navigation.state;
        let iconName;
        if (routeName === 'Wallets') {
          // Sometimes we want to add badges to some icons.
          // https://reactnavigation.org/docs/4.x/tab-based-navigation/
          // IconComponent = HomeIconWithBadge;
          iconName = 'md-wallet';
        } else if (routeName === 'Settings') {
          iconName = 'md-settings';
        } else if (routeName === 'Namespaces') {
          iconName = 'md-filing';
        } else if (routeName === 'Explore') {
          iconName = 'md-search';
        }
        return <Ionicons name={iconName} size={22} color={tintColor}/>;
      },
      tabBarLabel: ({tintColor}) => {
        const { routeName } = navigation.state;
        let label;
        if (routeName === 'Wallets') {
          label = loc.general.label_wallets;
        } else if (routeName === 'Settings') {
          label = loc.general.label_settings;
        } else if (routeName === 'Namespaces') {
          label = loc.general.label_data;
        } else if (routeName === 'Explore') {
          label = loc.general.label_explore;
        }
        return <Text style={{fontSize: 12, alignSelf: 'center', color: tintColor, position: 'relative', top: -2}}>{label}</Text>;
      },
    }),
    navigationOptions: ({ navigation }) => {
      return {
        headerShown: false,
      }
    },
  }
);

const CreateTransactionStackNavigator = createStackNavigator({
  SendDetails: {
    routeName: 'SendDetails',
    screen: sendDetails,
  },
  Confirm: {
    screen: Confirm,
  },
  PsbtWithHardwareWallet: {
    screen: PsbtWithHardwareWallet,
  },
  CreateTransaction: {
    screen: sendCreate,
    navigationOptions: {
      headerStyle: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 0,
      },
      headerTintColor: '#0c2550',
    },
  },
  Success: {
    screen: Success,
  },
  SelectWallet: {
    screen: SelectWallet,
    navigationOptions: {
      headerRight: null,
    },
  },
});

const HomeStackNavigator = createStackNavigator({
  Tabs: KevaTabNavigator,
  // Wallets
  WalletTransactions: {
    screen: WalletTransactions,
    path: 'WalletTransactions',
    routeName: 'WalletTransactions',
  },
  TransactionStatus: {
    screen: TransactionStatus,
  },
  TransactionDetails: {
    screen: details,
  },
  WalletDetails: {
    screen: WalletDetails,
  },
  CPFP: {
    screen: cpfp,
  },
  RBFBumpFee: {
    screen: rbfBumpFee,
  },
  RBFCancel: {
    screen: rbfCancel,
  },
  SelectWallet: {
    screen: SelectWallet,
  },
  DefaultView: {
    screen: DefaultView,
    path: 'DefaultView',
  },
  AddWallet: {
    screen: CreateWalletStackNavigator,
    path: 'addwallet',
    navigationOptions: {
      headerShown: false,
      ...TransitionPresets.ModalTransition,
    },
  },
  WalletExport: {
    screen: WalletExport,
  },
  WalletXpub: {
    screen: WalletXpub,
  },
  SendDetails: {
    routeName: 'SendDetails',
    screen: CreateTransactionStackNavigator,
    navigationOptions: {
      headerShown: false,
      ...TransitionPresets.ModalTransition,
    },
  },
  Confirm: {
    screen: Confirm,
  },
  PsbtWithHardwareWallet: {
    screen: PsbtWithHardwareWallet,
  },
  CreateTransaction: {
    screen: sendCreate
  },
  Success: {
    screen: Success,
  },
  SelectWallet: {
    screen: SelectWallet,
    navigationOptions: {
      headerRight: null,
    },
  },
  SelectWallet: {
    screen: SelectWallet,
    navigationOptions: {
      headerLeft: () => null,
    },
  },
  ReceiveDetails: {
    screen: receiveDetails,
  },
  ScanQRCode: {
    screen: ScanQRCode,
  },
  ReorderWallets: {
    screen: ReorderWalletsStackNavigator,
    navigationOptions: {
      headerShown: false,
    },
  },
  // Namespaces
  KeyValues: {
    screen: KeyValues,
  },
  AddKeyValue: {
    screen: AddKeyValue,
  },
  EditProfile: {
    screen: EditProfile,
  },
  SellNFT: {
    screen: SellNFT,
  },
  BuyNFT: {
    screen: BuyNFT,
  },
  OfferNFT: {
    screen: OfferNFT,
  },
  AcceptNFT: {
    screen: AcceptNFT,
  },
  ManageLocked: {
    screen: ManageLocked,
  },
  ReplyKeyValue: {
    screen: ReplyKeyValue,
  },
  ShareKeyValue: {
    screen: ShareKeyValue,
  },
  ShowKeyValue: {
    screen: ShowKeyValue,
  },
  RewardKeyValue: {
    screen: RewardKeyValue,
  },
  HashtagKeyValues: {
    screen: HashtagKeyValues,
  },
  TransferNamespace: {
    screen: TransferNamespace,
  },
  // Settings
  SelectWallet: {
    screen: SelectWallet,
  },
  Currency: {
    screen: Currency,
  },
  About: {
    screen: About,
    path: 'About',
  },
  ReleaseNotes: {
    screen: ReleaseNotes,
    path: 'ReleaseNotes',
  },
  Licensing: {
    screen: Licensing,
    path: 'Licensing',
  },
  DefaultView: {
    screen: DefaultView,
    path: 'DefaultView',
  },
  Language: {
    screen: Language,
    path: 'Language',
  },
  EncryptStorage: {
    screen: EncryptStorage,
    path: 'EncryptStorage',
  },
  GeneralSettings: {
    screen: GeneralSettings,
    path: 'GeneralSettings',
  },
  NetworkSettings: {
    screen: NetworkSettings,
    path: 'NetworkSettings',
  },
  PlausibleDeniability: {
    screen: PlausibleDeniability,
    path: 'PlausibleDeniability',
  },
  ElectrumSettings: {
    screen: ElectrumSettings,
    path: 'ElectrumSettings',
  },
  IPFSSettings: {
    screen: IPFSSettings,
    path: 'IPFSSettings',
  },
  Broadcast: {
    screen: Broadcast
  },
}, {
  headerMode: 'screen',
  defaultNavigationOptions: {
    headerBackTitleVisible: false,
    headerTitle: () => null,
  },
  navigationOptions: ({ navigation }) => {
    return {
      headerShown: false,
    }
  },
});

export default createAppContainer(HomeStackNavigator);
