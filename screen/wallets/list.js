import React, { Component } from 'react';
import { View, StatusBar, TouchableOpacity, Text, StyleSheet, InteractionManager, RefreshControl, SectionList, Alert } from 'react-native';
import { SafeBlueArea, WalletsCarousel, BlueHeaderDefaultMain, BlueTransactionListItem, BlueRoundIcon } from '../../BlueComponents';
import { NavigationEvents } from 'react-navigation';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import PropTypes from 'prop-types';
import { connect } from 'react-redux'
import { PlaceholderWallet } from '../../class';
import WalletImport from '../../class/walletImport';
import DeeplinkSchemaMatch from '../../class/deeplink-schema-match';
let EV = require('../../events');
/** @type {AppStorage} */
let BlueApp = require('../../BlueApp');
let loc = require('../../loc');
let BlueElectrum = require('../../BlueElectrum');
import { showStatus, hideStatus, enableStatus } from '../../util';

const WalletsListSections = { CAROUSEL: 'CAROUSEL', LOCALTRADER: 'LOCALTRADER', TRANSACTIONS: 'TRANSACTIONS' };

export default class WalletsList extends Component {
  walletsCarousel = React.createRef();
  viewPagerRef = React.createRef();

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      isFlatListRefreshControlHidden: true,
      wallets: BlueApp.getWallets().concat(false),
      lastSnappedTo: 0,
      timeElpased: 0,
      dataSource: [],
      cameraPreviewIsPaused: true,
      viewPagerIndex: 1,
    };
    EV(EV.enum.WALLETS_COUNT_CHANGED, () => this.redrawScreen(true));

    // here, when we receive TRANSACTIONS_COUNT_CHANGED we do not query
    // remote server, we just redraw the screen
    EV(EV.enum.TRANSACTIONS_COUNT_CHANGED, this.redrawScreen);
  }

  componentDidMount() {
    // the idea is that upon wallet launch we will refresh
    // all balances and all transactions here:
    InteractionManager.runAfterInteractions(async () => {
      try {
        let value = await BlueApp.isStatusEnabled();
        enableStatus(value);
        await BlueElectrum.waitTillConnected();
        let balanceStart = +new Date();
        await BlueApp.fetchWalletBalances();
        let balanceEnd = +new Date();
        console.log('fetch all wallet balances took', (balanceEnd - balanceStart) / 1000, 'sec');
        let start = +new Date();
        await BlueApp.fetchWalletTransactions();
        let end = +new Date();
        console.log('fetch all wallet txs took', (end - start) / 1000, 'sec');
      } catch (error) {
        console.log(error);
      }
    });
    this.interval = setInterval(() => {
      this.setState(prev => ({ timeElapsed: prev.timeElapsed + 1 }));
    }, 60000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  /**
   * Forcefully fetches TXs and balance for lastSnappedTo (i.e. current) wallet.
   * Triggered manually by user on pull-to-refresh.
   */
  refreshTransactions() {
    if (!(this.lastSnappedTo < BlueApp.getWallets().length) && this.lastSnappedTo !== undefined) {
      // last card, nop
      console.log('last card, nop');
      return;
    }
    this.setState(
      {
        isFlatListRefreshControlHidden: false,
      },
      () => {
        InteractionManager.runAfterInteractions(async () => {
          let noErr = true;
          try {
            await BlueElectrum.ping();
            await BlueElectrum.waitTillConnected();
            let balanceStart = +new Date();
            await BlueApp.fetchWalletBalances(this.lastSnappedTo || 0);
            let balanceEnd = +new Date();
            console.log('fetch balance took', (balanceEnd - balanceStart) / 1000, 'sec');
            let start = +new Date();
            await BlueApp.fetchWalletTransactions(this.lastSnappedTo || 0);
            let end = +new Date();
            console.log('fetch tx took', (end - start) / 1000, 'sec');
          } catch (err) {
            noErr = false;
            console.warn(err);
          }

          if (noErr) {
            let toast = showStatus("Saving to disk");
            await BlueApp.saveToDisk(); // caching
            hideStatus(toast);
          }

          this.redrawScreen();
        });
      },
    );
  }

  redrawScreen = (scrollToEnd = false) => {
    const wallets = BlueApp.getWallets().concat(false);
    if (scrollToEnd) {
      scrollToEnd = wallets.length > this.state.wallets.length;
    }

    this.setState(
      {
        isLoading: false,
        isFlatListRefreshControlHidden: true,
        dataSource: BlueApp.getTransactions(null, 10),
        wallets: BlueApp.getWallets().concat(false),
      },
      () => {
        if (scrollToEnd) {
          this.walletsCarousel.current.snapToItem(this.state.wallets.length - 2);
        }
      },
    );
  };

  txMemo(hash) {
    if (BlueApp.tx_metadata[hash] && BlueApp.tx_metadata[hash]['memo']) {
      return BlueApp.tx_metadata[hash]['memo'];
    }
    return '';
  }

  handleClick = index => {
    console.log('click', index);
    let wallet = BlueApp.wallets[index];
    if (wallet) {
      if (wallet.type === PlaceholderWallet.type) {
        Alert.alert(
          loc.wallets.add.details,
          'There was a problem importing this wallet.',
          [
            {
              text: loc.wallets.details.delete,
              onPress: () => {
                WalletImport.removePlaceholderWallet();
                EV(EV.enum.WALLETS_COUNT_CHANGED);
              },
              style: 'destructive',
            },
            {
              text: 'Try Again',
              onPress: () => {
                this.props.navigation.navigate('ImportWallet', { label: wallet.getSecret() });
                WalletImport.removePlaceholderWallet();
                EV(EV.enum.WALLETS_COUNT_CHANGED);
              },
              style: 'default',
            },
          ],
          { cancelable: false },
        );
      } else {
        this.props.navigation.navigate('WalletTransactions', {
          wallet: wallet,
          key: `WalletTransactions-${wallet.getID()}`,
        });
      }
    } else {
      // if its out of index - this must be last card with incentive to create wallet
      if (!BlueApp.getWallets().some(wallet => wallet.type === PlaceholderWallet.type)) {
        this.props.navigation.navigate('AddWallet');
      }
    }
  };

  onSnapToItem = index => {
    console.log('onSnapToItem', index);
    this.lastSnappedTo = index;
    this.setState({ lastSnappedTo: index });

    if (index < BlueApp.getWallets().length) {
      // not the last
    }

    if (this.state.wallets[index].type === PlaceholderWallet.type) {
      return;
    }

    // now, lets try to fetch balance and txs for this wallet in case it has changed
    this.lazyRefreshWallet(index);
  };

  /**
   * Decides whether wallet with such index shoud be refreshed,
   * refreshes if yes and redraws the screen
   * @param index {Integer} Index of the wallet.
   * @return {Promise.<void>}
   */
  async lazyRefreshWallet(index) {
    /** @type {Array.<AbstractWallet>} wallets */
    let wallets = BlueApp.getWallets();
    if (!wallets[index]) {
      return;
    }

    let oldBalance = wallets[index].getBalance();
    let noErr = true;
    let didRefresh = false;

    try {
      if (wallets && wallets[index] && wallets[index].type !== PlaceholderWallet.type && wallets[index].timeToRefreshBalance()) {
        console.log('snapped to, and now its time to refresh wallet #', index);
        await wallets[index].fetchBalance();
        if (oldBalance !== wallets[index].getBalance() || wallets[index].getUnconfirmedBalance() !== 0) {
          console.log('balance changed, thus txs too');
          // balance changed, thus txs too
          await wallets[index].fetchTransactions();
          this.redrawScreen();
          didRefresh = true;
        } else if (wallets[index].timeToRefreshTransaction()) {
          console.log(wallets[index].getLabel(), 'thinks its time to refresh TXs');
          await wallets[index].fetchTransactions();
          if (wallets[index].fetchPendingTransactions) {
            await wallets[index].fetchPendingTransactions();
          }
          if (wallets[index].fetchUserInvoices) {
            await wallets[index].fetchUserInvoices();
            await wallets[index].fetchBalance(); // chances are, paid ln invoice was processed during `fetchUserInvoices()` call and altered user's balance, so its worth fetching balance again
          }
          this.redrawScreen();
          didRefresh = true;
        } else {
          console.log('balance not changed');
        }
      }
    } catch (Err) {
      noErr = false;
      console.warn(Err);
    }

    if (noErr && didRefresh) {
      await BlueApp.saveToDisk(); // caching
    }
  }

  _keyExtractor = (_item, index) => index.toString();

  renderListHeaderComponent = () => {
    return (
      <View style={{ backgroundColor: '#FFFFFF' }}>
        <Text
          style={{
            paddingLeft: 16,
            fontWeight: 'bold',
            fontSize: 24,
            marginVertical: 8,
            color: BlueApp.settings.foregroundColor,
          }}
        >
          {loc.transactions.list.title}
        </Text>
      </View>
    );
  };

  handleLongPress = () => {
    if (BlueApp.getWallets().length > 1 && !BlueApp.getWallets().some(wallet => wallet.type === PlaceholderWallet.type)) {
      this.props.navigation.navigate('ReorderWallets');
    } else {
      ReactNativeHapticFeedback.trigger('notificationError', { ignoreAndroidSystemSettings: false });
    }
  };

  onPageSelected = e => {
    const index = e.nativeEvent.position;
    StatusBar.setBarStyle(index === 1 ? 'dark-content' : 'light-content');
    this.setState({ cameraPreviewIsPaused: index === 1 || index === undefined, viewPagerIndex: index });
  };

  onBarScanned = value => {
    DeeplinkSchemaMatch.navigationRouteFor({ url: value }, completionValue => {
      ReactNativeHapticFeedback.trigger('impactLight', { ignoreAndroidSystemSettings: false });
      this.props.navigation.navigate(completionValue);
    });
  };

  renderTransactionListsRow = data => {
    return (
      <View style={{ marginHorizontal: 4 }}>
        <BlueTransactionListItem item={data.item} itemPriceUnit={data.item.walletPreferredBalanceUnit} />
      </View>
    );
  };

  renderNavigationHeader = () => {
    return (
      <View style={{ height: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
        <TouchableOpacity
          testID="AddWalletButton"
          style={{ paddingHorizontal: 16, position: 'relative', right: -6, top: -3 }}
          onPress={() => {
            !BlueApp.getWallets().some(wallet => wallet.type === PlaceholderWallet.type)
              ? this.props.navigation.navigate('AddWallet')
              : null
          }}
        >
          <BlueRoundIcon color="#c83f6d" name="plus" />
        </TouchableOpacity>
      </View>
    );
  };

  renderWalletsCarousel = () => {
    return (
      <WalletsCarousel
        removeClippedSubviews={false}
        data={this.state.wallets}
        onPress={this.handleClick}
        handleLongPress={this.handleLongPress}
        onSnapToItem={this.onSnapToItem}
        ref={this.walletsCarousel}
      />
    );
  };

  renderSectionItem = item => {
    switch (item.section.key) {
      case WalletsListSections.CAROUSEL:
        return this.renderWalletsCarousel();
      case WalletsListSections.TRANSACTIONS:
        return this.renderTransactionListsRow(item);
      default:
        return null;
    }
  };

  renderSectionHeader = ({ section }) => {
    switch (section.key) {
      case WalletsListSections.CAROUSEL:
        return (
          <BlueHeaderDefaultMain
            leftText={loc.wallets.list.title}
            onNewWalletPress={
              !BlueApp.getWallets().some(wallet => wallet.type === PlaceholderWallet.type)
                ? () => this.props.navigation.navigate('AddWallet')
                : null
            }
          />
        );
      case WalletsListSections.TRANSACTIONS:
        return this.renderListHeaderComponent();
      default:
        return null;
    }
  };

  renderSectionFooter = ({ section }) => {
    switch (section.key) {
      case WalletsListSections.TRANSACTIONS:
        if (this.state.dataSource.length === 0 && !this.state.isLoading) {
          return (
            <View style={{ top: 80, height: 160 }}>
              <Text
                style={{
                  fontSize: 18,
                  color: '#9aa0aa',
                  textAlign: 'center',
                }}
              >
                {loc.wallets.list.empty_txs1}
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  color: '#9aa0aa',
                  textAlign: 'center',
                  fontWeight: '600',
                }}
              >
                {loc.wallets.list.empty_txs2}
              </Text>
            </View>
          );
        } else {
          return null;
        }
      default:
        return null;
    }
  };

  sectionListKeyExtractor = (item, index) => {
    return `${item}${index}}`;
  };

  render() {
    return (
      <SafeBlueArea>
        <NavigationEvents
          onDidFocus={(payload) => {
            const lastState = payload.lastState;
            if (lastState) {
              const routeName = lastState.routeName;
              if (routeName == 'Namespaces' || routeName == 'Settings') {
                return;
              }
            }
            setTimeout(() => {
              this.redrawScreen();
            }, 150);
          }}
        />
        <View
          style={styles.wrapper}
        >
          {/*
          <View style={styles.scanQRWrapper}>
            <ScanQRCode
              cameraPreviewIsPaused={this.state.cameraPreviewIsPaused}
              onBarScanned={this.onBarScanned}
              showCloseButton={false}
              initialCameraStatusReady={false}
              launchedBy={this.props.navigation.state.routeName}
            />
          </View>
          */}
          <View style={styles.walletsListWrapper}>
            {this.renderNavigationHeader()}
            <SectionList
              refreshControl={
                <RefreshControl onRefresh={() => this.refreshTransactions()} refreshing={!this.state.isFlatListRefreshControlHidden} />
              }
              renderItem={this.renderSectionItem}
              keyExtractor={this.sectionListKeyExtractor}
              renderSectionHeader={this.renderSectionHeader}
              renderSectionFooter={this.renderSectionFooter}
              sections={[
                { key: WalletsListSections.CAROUSEL, data: [WalletsListSections.CAROUSEL] },
                { key: WalletsListSections.LOCALTRADER, data: [WalletsListSections.LOCALTRADER] },
                { key: WalletsListSections.TRANSACTIONS, data: this.state.dataSource },
              ]}
            />
          </View>
        </View>
      </SafeBlueArea>
    );
  }
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  walletsListWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scanQRWrapper: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

WalletsList.propTypes = {
  navigation: PropTypes.shape({
    state: PropTypes.shape({
      routeName: PropTypes.string,
    }),
    navigate: PropTypes.func,
  }),
};
