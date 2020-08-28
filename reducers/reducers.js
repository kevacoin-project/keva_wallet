import { combineReducers } from 'redux'
import {
  SET_NAMESPACES,
  SET_NAMESPACES_ORDER,
  SET_OTHER_NAMESPACES,
  DELETE_OTHER_NAMESPACE,
  SET_OTHER_NAMESPACES_ORDER,
  SET_KEYVALUE_LIST,
} from '../actions'

const initNamespaceList = {namespaces: {}, order: []};

function namespaceList(state = initNamespaceList, action) {
  switch (action.type) {
    case SET_NAMESPACES:
      if (!action.namespaceList) {
        return {...initNamespaceList};
      }
      return {
        namespaces: {...state.namespaces, ...action.namespaceList},
        order: [...action.order]
      }
    case SET_NAMESPACES_ORDER:
      if (!action.order) {
        return state;
      }
      return {
        ...state,
        order: [...action.order]
      }
    default:
      return state;
  }
}

const initOtherNamespaceList = {namespaces: {}, order: []};

function otherNamespaceList(state = initOtherNamespaceList, action) {
  switch (action.type) {
    case SET_OTHER_NAMESPACES:
      if (!action.namespaceList) {
        return {...initOtherNamespaceList};
      }
      return {
        namespaces: {...state.namespaces, ...action.namespaceList},
        order: [...action.order]
      }
    case SET_OTHER_NAMESPACES_ORDER:
      if (!action.order) {
        return state;
      }
      return {
        ...state,
        order: [...action.order]
      }
    case DELETE_OTHER_NAMESPACE:
      if (!action.namespaceId) {
        return state;
      }
      let resultNamespaces = {...state.namespaces};
      delete resultNamespaces[action.namespaceId];
      return {
        namespaces: resultNamespaces,
        order: state.order.filter(id => id != action.namespaceId),
      }
    default:
      return state;
  }
}

const initKeyValueList = {keyValues: {}, order: {}, addressList: {}};

function keyValueList(state = initKeyValueList, action) {
  switch (action.type) {
    case SET_KEYVALUE_LIST:
      if (action.namespaceId && action.keyValues) {
        return {
          keyValues: {...state.keyValues, [action.namespaceId]: action.keyValues},
          order: {...state.order, [action.namespaceId]: action.order},
          addressList: {...state.addressList, [action.namespaceId]: action.addressList}
        }
      } else if (action.namespaceId && !action.keyValues) {
        // Delete the key values for the given namespace.
        let resultkeyValues = {...state.keyValues};
        delete resultkeyValues[action.namespaceId];
        let resultOrder = {...state.order};
        delete resultOrder[action.namespaceId];
        let resultAddressList = {...state.addressList}
        delete resultAddressList[action.namespaceId];
        return {
          keyValues: resultkeyValues,
          order: resultOrder,
        }
      }
      return {...initKeyValueList};
    default:
      return state;
  }
}

export const appReducer = combineReducers({
  namespaceList,
  otherNamespaceList,
  keyValueList,
});
