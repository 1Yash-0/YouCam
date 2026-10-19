/**
 * DOM polyfill for Node-based Vitest execution of React 19 Client Roots & Next.js Image
 */

if (typeof (global as any).Element === 'undefined') {
  ;(global as any).Element = class {}
}
if (typeof (global as any).HTMLElement === 'undefined') {
  ;(global as any).HTMLElement = class extends (global as any).Element {}
}
if (typeof (global as any).HTMLIFrameElement === 'undefined') {
  ;(global as any).HTMLIFrameElement = class extends (global as any).HTMLElement {}
}
if (typeof (global as any).SVGElement === 'undefined') {
  ;(global as any).SVGElement = class extends (global as any).Element {}
}
;(global as any).IS_REACT_ACT_ENVIRONMENT = true

if (typeof (global as any).StorageEvent === 'undefined') {
  ;(global as any).StorageEvent = class StorageEvent extends Event {
    key: string | null
    constructor(type: string, init?: { key?: string | null }) {
      super(type)
      this.key = init?.key ?? null
    }
  }
}

export function createMockElement(tag = 'div') {
  const element: any = {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    tagName: tag.toUpperCase(),
    childNodes: [] as any[],
    style: {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild(child: any) {
      element.childNodes.push(child)
      return child
    },
    removeChild(child: any) {
      const idx = element.childNodes.indexOf(child)
      if (idx >= 0) element.childNodes.splice(idx, 1)
      return child
    },
    insertBefore(child: any) {
      element.childNodes.push(child)
      return child
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    ownerDocument: null as any,
  }
  return element
}

export const mockDoc: any = {
  nodeType: 9,
  createElement: (tag: string) => {
    const el = createMockElement(tag)
    el.ownerDocument = mockDoc
    return el
  },
  createTextNode: (text: string) => ({ nodeType: 3, nodeValue: text }),
  addEventListener: () => {},
  removeEventListener: () => {},
  defaultView: null as any,
  activeElement: null,
  body: createMockElement('body'),
}
mockDoc.body.ownerDocument = mockDoc

// Set globals
;(global as any).document = mockDoc
;(global as any).location = new URL('http://localhost:3000')
;(global as any).window = (global as any)
mockDoc.defaultView = (global as any)
