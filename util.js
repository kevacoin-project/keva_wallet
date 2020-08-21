import React from 'react';
import {
  PixelRatio,
} from 'react-native';

import Toast from 'react-native-root-toast';
import { NavigationActions } from 'react-navigation'
import OverlaySpinner from 'react-native-loading-spinner-overlay'

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

  export function hideStatus(toast) {
    if (toast) {
        Toast.hide(toast);
    }
  }

  export const THIN_BORDER = 1 / PixelRatio.get();

  export function getOverlaySpinner(visible) {
    return <OverlaySpinner visible={visible} textContent={''} color={"#ff8274"} overlayColor={'rgba(255,255,255,0.75)'}/>
  }