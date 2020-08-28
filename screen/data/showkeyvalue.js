import React from 'react';
import {
  Text,
  View,
} from 'react-native';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaColors = require('../../common/KevaColors');
const utils = require('../../util');
import {
  BlueNavigationStyle,
} from '../../BlueComponents';
const loc = require('../../loc');

import { connect } from 'react-redux'

class ShowKeyValue extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      key: '',
      value: '',
    };
  }

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    title: '',
    tabBarVisible: false,
  });

  async componentDidMount() {
    const {key, value} = this.props.navigation.state.params;
    if (key && key.length > 0 && value && value.length > 0) {
      this.setState({
        key,
        value,
        valueOnly: true
      });
    }
  }

  render() {
    return (
      <View style={styles.container}>
        <View style={styles.keyContainer}>
          <Text style={styles.key}>{this.state.key}</Text>
        </View>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{this.state.value}</Text>
        </View>
      </View>
    );
  }

}

function mapStateToProps(state) {
  return {
    keyValueList: state.keyValueList,
  }
}

export default ShowKeyValueScreen = connect(mapStateToProps)(ShowKeyValue);

var styles = StyleSheet.create({
  container: {
    flex:1,
    backgroundColor: KevaColors.background,
  },
  keyContainer: {
    marginVertical: 10,
    borderWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    padding: 10,
  },
  key: {
    fontSize: 16,
    color: KevaColors.darkText,
  },
  valueContainer: {
    marginVertical: 10,
    borderWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    padding: 10,
  },
  value: {
    fontSize: 16,
    color: KevaColors.darkText,
    lineHeight: 25,
  },
});
