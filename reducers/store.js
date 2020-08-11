import { applyMiddleware, createStore, compose } from 'redux';
import { offline } from '@redux-offline/redux-offline';
import offlineConfig from '@redux-offline/redux-offline/lib/defaults';
import thunk from 'redux-thunk';
import { appReducer } from './reducers';

export function configureStore() {
  const store = createStore(
    appReducer,
    {},
    compose(
      applyMiddleware(thunk),
      offline(offlineConfig)
    ),
  );
  return store;
}
