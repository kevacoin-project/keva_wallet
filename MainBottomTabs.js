import React from 'react';
import {
  Text,
  Platform,
} from 'react-native';
import { createAppContainer, getActiveChildNavigationOptions } from 'react-navigation';
import { createStackNavigator, TransitionPresets } from 'react-navigation-stack';
import { createBottomTabNavigator } from 'react-navigation-tabs';

import Settings from './screen/settings/settings';
import About from './screen/settings/about';
import ReleaseNotes from './screen/settings/releasenotes';
import Licensing from './screen/settings/licensing';
import Selftest from './screen/selftest';
import Language from './screen/settings/language';
import Currency from './screen/settings/currency';
import EncryptStorage from './screen/settings/encryptStorage';
import PlausibleDeniability from './screen/plausibledeniability';
import LightningSettings from './screen/settings/lightningSettings';
import ElectrumSettings from './screen/settings/electrumSettings';
import GeneralSettings from './screen/settings/GeneralSettings';
import NetworkSettings from './screen/settings/NetworkSettings';
import DefaultView from './screen/settings/defaultView';

import WalletsList from './screen/wallets/list';
import WalletTransactions from './screen/wallets/transactions';
import AddWallet from './screen/wallets/add';
import PleaseBackup from './screen/wallets/pleaseBackup';
import PleaseBackupLNDHub from './screen/wallets/pleaseBackupLNDHub';
import ImportWallet from './screen/wallets/import';
import WalletDetails from './screen/wallets/details';
import WalletExport from './screen/wallets/export';
import WalletXpub from './screen/wallets/xpub';
import HodlHodl from './screen/wallets/hodlHodl';
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
import KeyValues from './screen/data/keyvalues';
import AddKeyValue from './screen/data/addkeyvalue';

import Ionicons from 'react-native-vector-icons/Ionicons';
let loc = require('./loc');

const StyleSheet = require('./PlatformStyleSheet');
import { IS_ANDROID } from './util';

const ReorderWalletsStackNavigator = createStackNavigator({
  ReorderWallets: {
    screen: ReorderWallets,
  },
});

const WalletsStackNavigator = createStackNavigator(
  {
    Wallets: {
      screen: WalletsList,
      path: 'wallets',
      navigationOptions: {
        headerShown: false,
      },
    },
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
    HodlHodl: {
      screen: HodlHodl,
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
  },
  {
    defaultNavigationOptions: {
      headerBackTitleVisible: false,
      headerTitle: () => null,
      ...(IS_ANDROID ? TransitionPresets.SlideFromRightIOS : {}),
    },
    navigationOptions: ({ navigation }) => {
      let tabBarVisible = false;
      let routeName = navigation.state.routes[navigation.state.index].routeName;
      if (routeName == 'Wallets') {
          tabBarVisible = true;
      }
      return {
        tabBarVisible,
        headerShown: false,
      }
    }
  },
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
  PleaseBackupLNDHub: {
    screen: PleaseBackupLNDHub,
    swipeEnabled: false,
    gesturesEnabled: false,
    navigationOptions: {
      headerShown: false,
    },
  },
});


const HandleOffchainAndOnChainStackNavigator = createStackNavigator(
  {
    SelectWallet: {
      screen: SelectWallet,
    },

    ScanQRCode: {
      screen: ScanQRCode,
    },

    SendDetails: {
      screen: CreateTransactionStackNavigator,
      navigationOptions: {
        headerShown: false,
      },
    },
  },
  { headerBackTitleVisible: false },
);

const WalletNavigator = createStackNavigator(
  {
    Wallets: {
      screen: WalletsStackNavigator,
      path: 'wallets',
      navigationOptions: {
        headerShown: false,
      },
    },
    AddWallet: {
      screen: CreateWalletStackNavigator,
      navigationOptions: {
        headerShown: false,
      },
    },
    WalletExport: {
      screen: WalletExport,
    },
    WalletXpub: {
      screen: WalletXpub,
    },
    //
    SendDetails: {
      routeName: 'SendDetails',
      screen: CreateTransactionStackNavigator,
      navigationOptions: {
        headerShown: false,
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
    HandleOffchainAndOnChain: {
      screen: HandleOffchainAndOnChainStackNavigator,
      navigationOptions: {
        headerShown: false,
      },
    },
  },
  {
    mode: 'modal',
    navigationOptions: ({ navigation }) => {
      let tabBarVisible = false;
      let routeName = navigation.state.routes[navigation.state.index].routeName;
      if (routeName == 'Wallets') {
          tabBarVisible = true;
      }
      const childOptions = getActiveChildNavigationOptions(navigation);
      if (childOptions.tabBarVisible === false) {
        tabBarVisible = false;
      }
      return {
        tabBarVisible,
        headerShown: false,
      }
    }
  },
);

const SettingsStackNavigator = createStackNavigator(
  {
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
    Selftest: {
      screen: Selftest,
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
    LightningSettings: {
      screen: LightningSettings,
      path: 'LightningSettings',
    },
    ElectrumSettings: {
      screen: ElectrumSettings,
      path: 'ElectrumSettings',
    },
    Broadcast: {
      screen: Broadcast
    },
  },
  {
    defaultNavigationOptions: {
      headerBackTitleVisible: false,
      ...(IS_ANDROID ? TransitionPresets.SlideFromRightIOS : {}),
    },
    navigationOptions: ({ navigation }) => {
      let tabBarVisible = false;
      let routeName = navigation.state.routes[navigation.state.index].routeName;
      if (routeName == 'Settings') {
          tabBarVisible = true;
      }
      return {
        tabBarVisible,
        headerShown: false,
      }
    }
  },
);

const DataStackNavigator = createStackNavigator(
  {
    Namespaces: {
      screen: Namespaces,
      path: 'Data',
      navigationOptions: {
        headerStyle: {
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 0,
          elevation: 0,
        },
        headerTintColor: '#0c2550',
      },
    },
    KeyValues: {
      screen: KeyValues,
    },
    AddKeyValue: {
      screen: AddKeyValue,
    },
  },
  {
    defaultNavigationOptions: {
      headerBackTitleVisible: false,
      ...(IS_ANDROID ? TransitionPresets.SlideFromRightIOS : {}),
    },
    navigationOptions: ({ navigation }) => {
      let tabBarVisible = false;
      let routeName = navigation.state.routes[navigation.state.index].routeName;
      if (routeName == 'Namespaces') {
          tabBarVisible = true;
      }
      return {
        tabBarVisible,
        headerShown: false,
      }
    },
  },
);


const MAIN_TABS = {
  Wallets: {
    screen: WalletNavigator,
    path: 'WalletList',
    navigationOptions: {
      headerShown: false,
    },
  },
  Data: {
    screen: DataStackNavigator,
    path: 'Data',
    navigationOptions: {
      headerShown: false,
    },
  },
  Settings: {
    screen: SettingsStackNavigator,
    path: 'Settings',
    navigationOptions: {
      headerShown: false,
    },
  },
}

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

const KevaTabNavigator = createBottomTabNavigator(MAIN_TABS, {
  initialRouteName: 'Wallets',
  tabBarPosition: 'bottom',
  lazy: true,
  tabBarOptions: {
    activeTintColor: '#e91e63',
    inactiveTintColor: '#5E5959',
    showIcon: true,
    style: styles.style,
    labelStyle: styles.labelStyle,
    tabStyle: styles.tabStyle
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
      } else if (routeName === 'Data') {
        iconName = 'md-filing';
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
      } else if (routeName === 'Data') {
        label = loc.general.label_data;
      }
      return <Text style={{fontSize: 12, alignSelf: 'center', color: tintColor, position: 'relative', top: -2}}>{label}</Text>;
    },
  }),
});


export default createAppContainer(KevaTabNavigator);
