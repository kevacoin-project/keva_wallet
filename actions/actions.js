
export const SET_NAMESPACES = 'SET_NAMEPSACES'
export const SET_NAMESPACES_ORDER = 'SET_NAMEPSACES_ORDER'
export const SET_OTHER_NAMESPACES = 'SET_OTHER_NAMESPACES';
export const SET_OTHER_NAMESPACES_ORDER = 'SET_OTHER_NAMESPACES_ORDER';
export const SET_KEYVALUE_LIST = 'SET_KEYVALUE_LIST';
export const SET_KEYVALUE_ORDER = 'SET_KEYVALUE_ORDER';

export function setNamespaceList(list) {
  return { type: SET_NAMESPACES, namespaceList: list }
}

export function setNamespaceOrder(order) {
  return { type: SET_NAMESPACES_ORDER, namespaceOrder: order }
}

export function setOtherNamespaceList(list) {
  return { type: SET_OTHER_NAMESPACES, namespaceList: list }
}

export function setOtherNamespaceOrder(order) {
  return { type: SET_OTHER_NAMESPACES_ORDER, namespaceOrder: order }
}

export function setKeyValueList(namespaceId, keyValues) {
  return { type: SET_KEYVALUE_LIST, namespaceId,  keyValues}
}

export function setKeyValueOrder(namespaceId, keyValueOrder) {
  return { type: SET_KEYVALUE_ORDER, namespaceId, keyValueOrder }
}
