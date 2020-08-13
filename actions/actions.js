
export const SET_NAMESPACES = 'SET_NAMEPSACES'
export const SET_NAMESPACES_ORDER = 'SET_NAMEPSACES_ORDER'

export function setNamespaceList(list) {
  return { type: SET_NAMESPACES, namespaceList: list }
}

export function setNamespaceOrder(order) {
  return { type: SET_NAMESPACES_ORDER, namespaceOrder: order }
}
