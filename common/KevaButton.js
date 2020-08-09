/**
 * Copyright 2016 Facebook, Inc.
 *
 * You are hereby granted a non-exclusive, worldwide, royalty-free license to
 * use, copy, modify, and distribute this software in source code or binary
 * form for use in connection with the web services and APIs provided by
 * Facebook.
 *
 * As with any software that integrates with the Facebook platform, your use
 * of this software is subject to the Facebook Developer Principles and
 * Policies [http://developers.facebook.com/policy/]. This copyright notice
 * shall be included in all copies or substantial portions of the software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE
 *
 */

// Modified from F8Button.js.

import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
var { Text } = require('./KevaText');

const VOID = () => {}
const PRIMARY_COLOR = '#c83f6d';

class KevaButton extends React.Component {

  static defaultProps = {
    type: 'primary',
  };

  render() {
    const {type, disabled, loading} = this.props;
    let caption;
    if (loading) {
      let color = (type === 'bordered') ? PRIMARY_COLOR : '#fff';
      caption = <ActivityIndicator size="small" color={color}/>
    } else {
      caption = this.props.caption;
    }
    let icon;
    if (this.props.icon) {
      icon = <Image source={this.props.icon} style={styles.icon} />;
    }
    let content;
    if (type === 'primary') {
      content = (
        <LinearGradient
          start={{x: 0.5, y: 1}} end={{x: 1, y: 1}}
          colors={['#fff', '#fff']}
          style={[styles.button, styles.primaryButton]}>
          {icon}
          {
            loading ? caption :
            <Text style={[styles.caption, styles.primaryCaption]}>
              {caption}
            </Text>
          }
        </LinearGradient>
      );
    }
    else if (type === 'secondary') {
      content = (
        <View style={[styles.button, styles.secondaryButton, disabled && styles.disabled]}>
          {icon}
          {
            loading ? caption :
            <Text style={[styles.caption, styles.secondaryCaption]}>
              {caption}
            </Text>
          }
        </View>
      );
    } else {
      const border = (type === 'bordered') && styles.border;
      content = (
        <View style={[styles.button, border, disabled && styles.disabled]}>
          {icon}
          {
            loading ? caption :
            <Text style={[styles.caption, styles.borderCaption]}>
              {caption}
            </Text>
          }
        </View>
      );
    }
    return (
      <TouchableOpacity
        disabled={disabled}
        accessibilityTraits="button"
        onPress={loading ? VOID :  this.props.onPress}
        activeOpacity={0.8}
        style={[styles.container, this.props.style]}>
        {content}
      </TouchableOpacity>
    );
  }
}

const HEIGHT = 40;

var styles = StyleSheet.create({
  button: {
    height: 40,
    alignItems:'center',
    justifyContent: 'center'
  },
  border: {
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    borderRadius: 5
  },
  primaryButton: {
    borderRadius: HEIGHT / 2,
    backgroundColor: 'transparent'
  },
  secondaryButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 5
  },
  icon: {
    marginRight: 12
  },
  caption: {
    letterSpacing: 1,
    fontSize: 16
  },
  primaryCaption: {
    color: '#57555a'
  },
  secondaryCaption: {
    color: '#fff'
  },
  borderCaption:{
    color: PRIMARY_COLOR
  },
  disabled: {
    opacity: 0.2
  }
});

module.exports = KevaButton;
