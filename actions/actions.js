
export const SET_NAMESPACES = 'SET_NAMEPSACES'
export const SET_NAMESPACES_ORDER = 'SET_NAMEPSACES_ORDER'
export const SET_OTHER_NAMESPACES = 'SET_OTHER_NAMESPACES';
export const SET_OTHER_NAMESPACES_ORDER = 'SET_OTHER_NAMESPACES_ORDER';
export const DELETE_OTHER_NAMESPACE = 'DELETE_OTHER_NAMESPACE';
export const SET_KEYVALUE_LIST = 'SET_KEYVALUE_LIST';
export const SET_KEYVALUE_ORDER = 'SET_KEYVALUE_ORDER';

export function setNamespaceList(list, order) {
  return { type: SET_NAMESPACES, namespaceList: list, order }
}

export function setNamespaceOrder(order) {
  return { type: SET_NAMESPACES_ORDER, order }
}

export function deleteOtherNamespace(namespaceId) {
  return { type: DELETE_OTHER_NAMESPACE, namespaceId }
}

export function setOtherNamespaceList(list, order) {
  return { type: SET_OTHER_NAMESPACES, namespaceList: list, order }
}

export function setOtherNamespaceOrder(order) {
  return { type: SET_OTHER_NAMESPACES_ORDER, order }
}

export function setKeyValueList(namespaceId, keyValues, order) {
  return { type: SET_KEYVALUE_LIST, namespaceId,  keyValues, order }
}
