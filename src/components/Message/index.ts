import { createVNode, isVNode, render } from 'vue';
import { instances, skMessageTypes } from './instance';
import MessageConstructor from './message.vue';
import type { AppContext } from 'vue';
import type { SkMessageContext, SkMessageHandler, SkMessageOptions, SkMessageProps, SKMessageTypes } from './instance';
import { isFunction, isString } from '@/utils/typeUtil';

export type SkMessageParams = SkMessageOptions | SkMessageOptions['message'];

export type SkMessageFn = {
  (options?: SkMessageParams, appContext?: null | AppContext): SkMessageHandler;
  closeAll(type?: SKMessageTypes): void;
};

export type SkMessageParamWithType = Omit<SkMessageOptions, 'type'> | SkMessageOptions['message'];

export type MessageTypedFn = (options?: SkMessageParamWithType, appContext?: null | AppContext) => SkMessageHandler;

export type SkMessage = SkMessageFn & {
  info: MessageTypedFn;
  success: MessageTypedFn;
  warning: MessageTypedFn;
  error: MessageTypedFn;
  help: MessageTypedFn;
  default: MessageTypedFn;
};

export type SkMessageNormalOptions = Omit<SkMessageProps, 'id'> & {
  appendTo: HTMLElement;
};

// Count
let seed = 1;

// Create message
const createMessage = function ({ appendTo, ...options }: SkMessageNormalOptions, context?: AppContext | null) {
  const id = `message_${seed++}`;
  // User's close callback
  const handleUserClose = options.onClose;
  // Render container
  const container = document.createElement('div');
  // Component properties
  const props = {
    ...options,
    id,
    onClose: () => {
      handleUserClose?.();
      closeMessage(instance);
    },
    onDestroy: () => {
      render(null, container);
    }
  };
  // vue node VNode
  const vnode = createVNode(
    MessageConstructor,
    props,
    isFunction(props.message) || isVNode(props.message)
      ? {
          default: isFunction(props.message) ? props.message : () => props.message
        }
      : null
  );
  // Node context
  vnode.appContext = context || message._context;
  // Start rendering
  render(vnode, container);
  // Insert into page
  appendTo.appendChild(container.firstElementChild!);
  // Virtual node
  const vm = vnode.component!;
  // Handler function
  const handler: SkMessageHandler = {
    // Close
    close: () => {
      vm.exposed!.close();
    }
  };
  // Instance object
  const instance: SkMessageContext = {
    id,
    vnode,
    vm,
    handler,
    props: (vnode.component as any).props
  };

  return instance;
};

// Close message
const closeMessage = function (instance: SkMessageContext) {
  // Get current instance index
  const idx = instances.indexOf(instance);
  if (idx === -1) return;
  // Remove from collection
  instances.splice(idx, 1);
  // Get instance handler object
  const { handler } = instance;
  // Call close function
  handler.close();
};
// Close components of the same type
const closeAll = function (type?: SKMessageTypes) {
  const instancesToClose = [...instances];

  for (const instance of instancesToClose) {
    if (!type || type === instance.props.type) {
      instance.handler.close();
    }
  }
};

// Normalize options
const normalizeOptions = function (params: SkMessageParams) {
  const options: SkMessageOptions =
    !params || isString(params) || isVNode(params) || isFunction(params) ? { message: params } : params;

  const normalized = { ...options };
  if (!normalized.appendTo) {
    normalized.appendTo = document.body;
  } else if (isString(normalized.appendTo)) {
    const appendTo = document.querySelector<HTMLElement>(normalized.appendTo);
    if (!appendTo) {
      normalized.appendTo = document.body;
    } else {
      normalized.appendTo = appendTo;
    }
  }
  return normalized as SkMessageNormalOptions;
};
// Main interface
const message: SkMessageFn & Partial<SkMessage> & { _context: AppContext | null } = function (
  options = {},
  context = null
) {
  // Normalize options
  const normalized = normalizeOptions(options);
  // Create instance
  const instance = createMessage(normalized, context);
  // Add to collection
  instances.push(instance);
  // Return handler function
  return instance.handler;
};
// Bind type function
skMessageTypes.forEach(type => {
  message[type] = (options = {}, appContext) => {
    const normalized = normalizeOptions(options);
    return message({ ...normalized, type }, appContext);
  };
});

message.closeAll = closeAll;
message._context = null;

/**
 * Message component
 */
export default message as SkMessage;
