import React from 'react';
import {
  PixelRatio,
  Dimensions,
  View,
  Platform,
  Image,
} from 'react-native';

import Toast from 'react-native-root-toast';
import { NavigationActions } from 'react-navigation'
import OverlaySpinner from 'react-native-loading-spinner-overlay'
import KevaColors from './common/KevaColors';

export const IS_ANDROID = Platform.OS === 'android';

export const backAction = NavigationActions.back({
  key: null
});

let statusEnabled = true;

export function enableStatus(enabled) {
    statusEnabled = enabled;
}

export function isStatusEnable() {
    return statusEnabled;
}

export function showStatus(message, duration=60000) {
  if (!statusEnabled) {
      return;
  }
  return Toast.show(message, {
    duration: duration,
    position: Toast.positions.BOTTOM,
    backgroundColor: "#53DD6C",
    opacity: 0.9,
    shadow: true,
    animation: false,
    hideOnPress: true,
    delay: 0
  });
}

export function showStatusAlways(message, duration=60000) {
  return Toast.show(message, {
    duration: duration,
    position: Toast.positions.TOP,
    backgroundColor: "#53DD6C",
    opacity: 0.9,
    shadow: true,
    animation: false,
    hideOnPress: true,
    delay: 0
  });
}

export function hideStatus(toast) {
  if (toast) {
      Toast.hide(toast);
  }
}

export function toastError(message) {
  return Toast.show(message, {
    duration: Toast.durations.LONG,
    position: Toast.positions.TOP,
    backgroundColor: KevaColors.errColor,
    opacity: 0.9,
    shadow: true,
    animation: false,
    hideOnPress: true,
    delay: 0
  });
}

export const THIN_BORDER = 1 / PixelRatio.get();

export function getOverlaySpinner(visible) {
  return <OverlaySpinner visible={visible} textContent={''} color={"#ff8274"} overlayColor={'rgba(255,255,255,0.75)'}/>
}

export const SCREEN_WIDTH = Dimensions.get('window').width;

export const ModalHandle = <View style={{height: 6, width: 40, borderRadius: 3, backgroundColor: '#ddd', alignSelf: 'flex-start'}}/>;

export function timeConverter(UNIX_timestamp) {
  let a = new Date(UNIX_timestamp * 1000);
  let year = a.getFullYear();
  let month = a.getMonth() + 1;
  let date = a.getDate();
  let hour = a.getHours();
  let min = a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes();
  let sec = a.getSeconds() < 10 ? '0' + a.getSeconds() : a.getSeconds();
  let timeStr = year + '-' + month + '-' + date + ' ' + hour + ':' + min + ':' + sec ;
  return timeStr;
}

export function getImageSize(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => {
      console.log(`The image dimensions are ${width}x${height}`);
      resolve({width, height});
    }, error => {
      console.error(`Couldn't get the image size: ${error.message}`);
      reject(error);
    });
  });
}

export function stringToColor(str) {
  if (!str) {
    return '#aaa';
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color + 'bb';
}

export function getInitials(name) {
  if (!name) {
    return ' ';
  }
  const names = name.split(' ');
  let initials = names[0].substring(0, 1).toUpperCase();

  if (names.length > 1) {
      initials += names[names.length - 1].substring(0, 1).toUpperCase();
  }
  return initials;
}

export async function sleepAync(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
