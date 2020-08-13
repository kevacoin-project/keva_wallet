import { combineReducers } from 'redux'
import {
  SET_NAMESPACES,
  SET_NAMESPACES_ORDER,
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

export const appReducer = combineReducers({
  namespaceList,
  namespaceOrder,
});
