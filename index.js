import 'intl';
import 'intl/locale-data/jsonp/en';
import React from 'react';
import './shim.js';
import { AppRegistry, StyleSheet, View, Text } from 'react-native';
import { initializeImageGateway } from './screen/data/mediaManager';
import { name as appName } from './app.json';
import App from './App';
import LottieView from 'lottie-react-native';
import UnlockWith from './UnlockWith.js';

if (!Error.captureStackTrace) {
  // captureStackTrace is only available when debugging
  Error.captureStackTrace = () => {};
}

class BlueAppComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = { isMigratingData: false, onAnimationFinished: false, successfullyAuthenticated: false };
  }

  async componentDidMount() {
    await initializeImageGateway();
  }

  setIsMigratingData = async () => {
    this.setState({ isMigratingData: false });
  };

  onAnimationFinish = () => {
    if (this.state.isMigratingData) {
      this.loadingSplash.play(0);
    } else {
      this.setState({ onAnimationFinished: true });
    }
  };

  onSuccessfullyAuthenticated = () => {
    this.setState({ successfullyAuthenticated: true });
  };

  render() {
    if (this.state.isMigratingData) {
      return (
        <LottieView
          ref={ref => (this.loadingSplash = ref)}
          onAnimationFinish={this.onAnimationFinish}
          source={require('./img/bluewalletsplash.json')}
          autoPlay
          loop={false}
        />
      );
    } else {
      if (this.state.onAnimationFinished) {
        return this.state.successfullyAuthenticated ? (
          <App />
        ) : (
          <UnlockWith onSuccessfullyAuthenticated={this.onSuccessfullyAuthenticated} />
        );
      } else {
        return (
          <View style={styles.lottieContainer}>
            <LottieView
              ref={ref => (this.loadingSplash = ref)}
              resizeMode="center"
              onAnimationFinish={this.onAnimationFinish}
              source={require('./img/bluewalletsplash.json')}
              autoPlay
              loop={false}
            />
            <Text style={styles.keva}>
              {"KEVA"}
            </Text>
          </View>
        );
      }
    }
  }
}

const styles = StyleSheet.create({
  lottieContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-end'
  },
  keva: {
    alignSelf: 'center',
    fontSize: 42,
    fontWeight: "100",
    marginBottom: 80,
    color: '#b1325d',
    letterSpacing: 16
  }
});

AppRegistry.registerComponent(appName, () => BlueAppComponent);
