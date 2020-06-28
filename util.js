import Toast from 'react-native-root-toast';

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
      backgroundColor: "#107E7D",
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