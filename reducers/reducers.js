import { combineReducers } from 'redux'
import {
  SET_NAMESPACES,
} from '../actions'

function namespaceList(state = [], action) {
  switch (action.type) {
    case SET_NAMESPACES:
      if (!action.namepsaceList) {
        return [];
      }
      return [...action.namespaceList];
    default:
      return state;
  }
}

export const appReducer = combineReducers({
  namespaceList,
});
