import React from 'react';
import {
  StatusBar,
  View,
  Image,
  TouchableOpacity,
  TouchableNativeFeedback,
  Platform,
  StyleSheet,
} from 'react-native';

var { Text } = require('./KevaText');
var KevaColors = require('./KevaColors');

const IS_IOS = Platform.OS === 'ios';

class F8HeaderGeneric extends React.Component {
  static height;

  render() {
    const {leftItem, title, rightItem, foreground} = this.props;
    const titleColor = foreground === 'dark' ? KevaColors.darkText : 'white';
    const itemsColor = foreground === 'dark' ? KevaColors.actionText : 'white';
    const content = React.Children.count(this.props.children) === 0
      ? <Text style={[styles.titleText, {color: titleColor}]}>
          {title}
        </Text>
      : this.props.children;
    const tightLayout = !!(rightItem && rightItem.icon);
    return (
      <View style={[styles.header, this.props.style]}>
        <View style={[styles.leftItem, tightLayout && {flex: 1.2}]}>
          <ItemWrapper color={itemsColor} item={leftItem}/>
        </View>
        <View
          accessible={true}
          accessibilityLabel={title}
          accessibilityTraits="header"
          style={styles.centerItem}>
          {content}
        </View>
        <View style={[styles.rightItem, tightLayout && {flex: 1.2}]}>
          <ItemWrapper color={itemsColor} item={rightItem}/>
        </View>
      </View>
    );
  }

}

class ItemWrapper extends React.Component {

  render() {
    const {item, color} = this.props;
    if (!item) {
      return null;
    }

    let content;
    const {title, icon, layout, onPress, foreground,btnDisable} = item;
    const tintColor = foreground === 'light' ? 'white' : KevaColors.actionText;
    if (layout !== 'icon' && title) {
      content = (
        <Text style={[styles.itemText, {color}, btnDisable && {opacity:0.4}]}>
          {title.toUpperCase()}
        </Text>
      );
    } else if (icon) {
      if (typeof icon === 'number') {
        // It is an image resource.
        content = <Image source={icon} style={{tintColor:tintColor}}/>;
      } else {
        // It must be a vector icon.
        content = icon;
      }
    }

    if (IS_IOS) {
      return (
        <TouchableOpacity
          disabled={btnDisable}
          accessibilityLabel={title}
          accessibilityTraits="button"
          onPress={onPress}
          style={styles.itemWrapper}>
          {content}
        </TouchableOpacity>
      );
    }
    return (
      <TouchableNativeFeedback onPress={onPress}>
        <View style={styles.itemWrapperAndroid}>
          {content}
        </View>
      </TouchableNativeFeedback>
    );
  }
}


var STATUS_BAR_HEIGHT = IS_IOS ? 20 : StatusBar.currentHeight;
var HEADER_HEIGHT = IS_IOS ? 44 + STATUS_BAR_HEIGHT : 56 + STATUS_BAR_HEIGHT;

var styles = StyleSheet.create({
  toolbar: {
    height: HEADER_HEIGHT - STATUS_BAR_HEIGHT,
  },
  header: {
    backgroundColor: 'transparent',
    paddingTop: STATUS_BAR_HEIGHT,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  titleText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 17,
    textAlign: 'center'
  },
  leftItem: {
    flex: 1.8,
    alignItems: 'flex-start',
  },
  centerItem: {
    flex: 4,
    alignItems: 'center'
  },
  rightItem: {
    flex: 1.8,
    alignItems: 'flex-end',
  },
  itemWrapper: {
    paddingHorizontal: 15,
    paddingVertical: 12
  },
  itemWrapperAndroid: {
    paddingHorizontal: 25,
    paddingVertical: 12
  },
  itemText: {
    fontWeight:'500',
    fontSize: 13,
    color: 'white',
  },
});

const Header = F8HeaderGeneric;

Header.height = HEADER_HEIGHT;

module.exports = Header;
