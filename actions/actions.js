
export const SET_NAMESPACES = 'SET_NAMEPSACES'
export const SET_NAMESPACES_ORDER = 'SET_NAMEPSACES_ORDER'
export const SET_OTHER_NAMESPACES = 'SET_OTHER_NAMESPACES';
export const SET_OTHER_NAMESPACES_ORDER = 'SET_OTHER_NAMESPACES_ORDER';
export const DELETE_OTHER_NAMESPACE = 'DELETE_OTHER_NAMESPACE';
export const SET_KEYVALUE_LIST = 'SET_KEYVALUE_LIST';
export const SET_KEYVALUE = 'SET_KEYVALUE';
export const SET_MEDIA_INFO = 'SET_MEDIA_INFO';
export const SET_REACTION = 'SET_REACTION';
export const SET_ALL_REACTIONS = 'SET_ALL_REACTIONS';
export const SET_HASHTAGS = 'SET_HASHTAGS';
export const SET_HASHTAG_ENTRY = 'SET_HASHTAG_ENTRY';
export const SET_REPLIES = 'SET_REPLIES';
export const ADD_REPLY_ENTRY = 'ADD_REPLY_ENTRY';

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

export function setKeyValue(namespaceId, index, keyValue) {
  return { type: SET_KEYVALUE, namespaceId, index, keyValue }
}

export function setMediaInfo(CID, info) {
  return { type: SET_MEDIA_INFO, CID, info }
}

export function setReaction(tx_hash, info) {
  return { type: SET_REACTION, tx_hash, info }
}

export function setAllReactions(reactions) {
  return { type: SET_ALL_REACTIONS, reactions }
}
