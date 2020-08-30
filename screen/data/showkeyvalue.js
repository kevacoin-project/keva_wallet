import React from 'react';
import {
  Text,
  View,
  ScrollView,
} from 'react-native';
import HTMLView from 'react-native-htmlview';
import { ButtonGroup } from 'react-native-elements';
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
      selectedIndex: 0,
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

  updateIndex = index => {
    this.setState({selectedIndex: index});
  }

  render() {
    const buttons = ['html', 'text']
    const selected = this.state.selectedIndex;
    return (
      <ScrollView style={styles.container}>
        <View style={styles.keyContainer}>
          <Text style={styles.key} selectable>{this.state.key}</Text>
        </View>
        <ButtonGroup
          onPress={this.updateIndex}
          selectedIndex={selected}
          buttons={buttons}
          containerStyle={{height: 30, width: 130, borderRadius: 6, alignSelf: 'center', borderColor: KevaColors.actionText}}
          selectedButtonStyle={{backgroundColor: KevaColors.actionText}}
          textStyle={{color: KevaColors.actionText}}
        />
        <View style={styles.valueContainer}>
          {(selected == 0) ?
            <HTMLView value={`<p>${this.state.value}</p>`}
              addLineBreaks={false}
              stylesheet={htmlStyles}
              nodeComponentProps={{selectable: true}}
          />
          :
          <Text style={styles.value} selectable>{this.state.value}</Text>
          }
        </View>
      </ScrollView>
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
  value: {
    fontSize: 16,
    color: KevaColors.darkText,
    lineHeight: 25,
  },
  valueContainer: {
    marginTop: 2,
    borderWidth: utils.THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    padding: 10,
  },
});

var htmlStyles = StyleSheet.create({
  div: {
    fontSize: 16,
    color: KevaColors.darkText,
    lineHeight: 25,
    padding: 0,
    marginBottom: 0,
  },
  p: {
    fontSize: 16,
    color: KevaColors.darkText,
    lineHeight: 25,
    padding: 0,
    marginBottom: 0,
  },
  br: {
    lineHeight: 0,
  }
});
