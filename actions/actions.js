
export const SET_NAMESPACES = 'SET_NAMEPSACES'
export const SET_NAMESPACES_ORDER = 'SET_NAMEPSACES_ORDER'
export const SET_OTHER_NAMESPACES = 'SET_OTHER_NAMESPACES';
export const SET_OTHER_NAMESPACES_ORDER = 'SET_OTHER_NAMESPACES_ORDER';
export const DELETE_OTHER_NAMESPACE = 'DELETE_OTHER_NAMESPACE';
export const SET_KEYVALUE_LIST = 'SET_KEYVALUE_LIST';
export const SET_MEDIA_INFO = 'SET_MEDIA_INFO';

export const CURRENT_KEYVALUE_LIST_VERSION = 3;

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

export function setKeyValueList(namespaceId, keyValues) {
  return { type: SET_KEYVALUE_LIST, namespaceId, keyValues }
}

export function setMediaInfo(CID, info) {
  return { type: SET_MEDIA_INFO, CID, info }
}
