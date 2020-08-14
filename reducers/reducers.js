import { combineReducers } from 'redux'
import {
  SET_NAMESPACES,
  SET_NAMESPACES_ORDER,
  SET_OTHER_NAMESPACES,
  SET_OTHER_NAMESPACES_ORDER,
  SET_KEYVALUE_LIST,
  SET_KEYVALUE_ORDER,
} from '../actions'

function namespaceList(state = {}, action) {
  switch (action.type) {
    case SET_NAMESPACES:
      if (!action.namespaceList) {
        return {};
      }
      return {...action.namespaceList};
    default:
      return state;
  }
}

function namespaceOrder(state = [], action) {
  switch (action.type) {
    case SET_NAMESPACES_ORDER:
      if (!action.namespaceOrder) {
        return [];
      }
      return [...action.namespaceOrder];
    default:
      return state;
  }
}

function otherNamespaceList(state = {}, action) {
  switch (action.type) {
    case SET_OTHER_NAMESPACES:
      if (!action.namespaceList) {
        return {};
      }
      return {...action.namespaceList};
    default:
      return state;
  }
}

function otherNamespaceOrder(state = [], action) {
  switch (action.type) {
    case SET_OTHER_NAMESPACES_ORDER:
      if (!action.namespaceOrder) {
        return [];
      }
      return [...action.namespaceOrder];
    default:
      return state;
  }
}

function keyValueList(state = {}, action) {
  switch (action.type) {
    case SET_KEYVALUE_LIST:
      if (action.namespaceId && action.keyValues) {
        return {
          ...state,
          [action.namespaceId] : action.keyValues,
        };
      }
      return state;
    default:
      return state;
  }
}

function keyValueOrder(state = {}, action) {
  switch (action.type) {
    case SET_KEYVALUE_ORDER:
      if (action.namespaceId && action.keyValueOrder) {
        return {
          ...state,
          [action.namespaceId] : action.keyValueOrder,
        };
      }
      return state;
    default:
      return state;
  }
}

export const appReducer = combineReducers({
  namespaceList,
  namespaceOrder,
  otherNamespaceList,
  otherNamespaceOrder,
  keyValueList,
  keyValueOrder,
});
