import { combineReducers } from 'redux'
import {
  SET_NAMESPACES,
  SET_NAMESPACES_ORDER,
  SET_OTHER_NAMESPACES,
  DELETE_OTHER_NAMESPACE,
  SET_OTHER_NAMESPACES_ORDER,
  SET_KEYVALUE_LIST,
  SET_KEYVALUE,
  SET_MEDIA_INFO,
  CURRENT_KEYVALUE_LIST_VERSION,
  SET_REACTION,
  SET_ALL_REACTIONS,
  SET_HASHTAGS,
  SET_HASHTAG_ENTRY,
  SET_REPLIES,
  ADD_REPLY_ENTRY,
} from '../actions'

const initNamespaceList = {namespaces: {}, order: []};

function namespaceList(state = initNamespaceList, action) {
  switch (action.type) {
    case SET_NAMESPACES:
      if (!action.namespaceList) {
        return {...initNamespaceList};
      }
      return {
        namespaces: {...action.namespaceList},
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

const initKeyValueList = {keyValues: {}, version: CURRENT_KEYVALUE_LIST_VERSION};

function keyValueList(state = initKeyValueList, action) {
  switch (action.type) {
    case SET_KEYVALUE_LIST:
      if (action.namespaceId && action.keyValues) {
        return {
          keyValues: {...state.keyValues, [action.namespaceId]: action.keyValues},
          version: CURRENT_KEYVALUE_LIST_VERSION
        }
      } else if (action.namespaceId && !action.keyValues) {
        // Delete the key values for the given namespace.
        let resultkeyValues = {...state.keyValues};
        delete resultkeyValues[action.namespaceId];
        return {
          keyValues: resultkeyValues,
          version: CURRENT_KEYVALUE_LIST_VERSION
        }
      }
      // Remove all the old data.
      return {...initKeyValueList};
    case SET_KEYVALUE:
      if (action.namespaceId && action.index >= 0 && action.keyValue) {
        let newKeyValues = [...state.keyValues[action.namespaceId]];
        newKeyValues[action.index] = {...newKeyValues[action.index], ...action.keyValue}
        return {
          keyValues: {...state.keyValues, [action.namespaceId]: newKeyValues},
          version: CURRENT_KEYVALUE_LIST_VERSION
        }
      }
      return state;
    default:
      return state;
  }
}

const initMediaInfoList = {};

function mediaInfoList(state = initMediaInfoList, action) {
  switch (action.type) {
    case SET_MEDIA_INFO:
      if (action.CID) {
        if (action.info) {
          return {...state, [action.CID]: action.info}
        } else {
          let resultList = {...state};
          delete resultList[action.CID];
          return resultList;
        }
      }
      // Remove all the old data
      return {}
    default:
      return state;
  }
}

const initReactions = {populated: false}

// Store our own reactions, e.g. comments, rewards, shares.
function reactions(state = initReactions, action) {
  switch (action.type) {
    case SET_REACTION:
      if (action.tx_hash) {
        if (action.info) {
          return {...state, [action.tx_hash]: action.info}
        } else {
          // Delete the reactions of given tx_hash
          let resultList = {...state};
          delete resultList[action.tx_hash];
          return resultList;
        }
      }
      return state;
    case SET_ALL_REACTIONS:
      if (action.reactions) {
        return {populated: true, ...action.reactions};
      }
      // Remove all the old data
      return {...initReactions}
    default:
      return state;
  }
}


export const appReducer = combineReducers({
  namespaceList,
  otherNamespaceList,
  keyValueList,
  mediaInfoList,
  reactions,
});
