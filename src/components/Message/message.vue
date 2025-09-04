<template>
  <Transition
    name="sk-message-fade"
    @before-enter="isStartTransition = true"
    @before-leave="handleClose"
    @after-leave="handleDestory">
    <div
      :class="{
        'sk-message': true,
        'sk-message-closeable': closeable,
        [`sk-message-${type}`]: type,
        [`sk-message-${pos}`]: pos,
        [customClass]: customClass
      }"
      v-show="visible"
      ref="elRef"
      :style="customStyle"
      role="alert"
      @mouseenter="clearTimer"
      @mouseleave="startTimer">
      <i v-if="type !== 'default'" :class="`sk-message-icon ${typeIcon}`"></i>
      <slot>
        <p class="sk-message-content">
          {{ message }}
        </p>
      </slot>
      <div v-if="closeable || !duration" class="sk-message-close" @click.stop="close">
        <i class="ice-close"></i>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { computed, nextTick, onMounted, ref } from 'vue';
import { getLastOffset, getOffsetOrSpace } from './instance';
import type { CSSProperties } from 'vue';
import type { SkMessageProps } from './instance';

// Component properties
const props = withDefaults(defineProps<SkMessageProps>(), {
  id: '',
  type: 'default',
  duration: 3000,
  offset: 16,
  customClass: '',
  closeable: false,
  pos: 'center'
});

// Emit events
const emit = defineEmits<{
  (e: 'destroy'): void;
}>();

// Whether to start the transition
const isStartTransition = ref(false);
// Main element DOM
const elRef = ref<HTMLDivElement>();
// Whether it is visible
const visible = ref(false);
const height = ref(0);
// Listen for component changes
useResizeObserver(elRef, () => {
  height.value = elRef.value!.getBoundingClientRect().height;
});

const TypeIcons = {
  info: 'ice-info',
  success: 'ice-success',
  warning: 'ice-warn',
  error: 'ice-error',
  help: 'ice-help',
  default: ''
};
// Type icon
const typeIcon = computed(() => {
  if (props.icon) return props.icon;
  else return TypeIcons[props.type];
});
// The vertical coordinate of the bottom of the previous message component in the visible window
const lastOffset = computed(() => getLastOffset(props.id));
// The vertical coordinate of the top of the current component
const offset = computed(() => getOffsetOrSpace(props.id, props.offset) + lastOffset.value);
// The vertical coordinate of the bottom of the current component
const bottom = computed(() => height.value + offset.value);
// Style
const customStyle = computed<CSSProperties>(() => ({
  top: `${offset.value}px`,
  zIndex: props.zIndex
}));
// Component loaded
onMounted(() => {
  // Start timing
  startTimer();
  // Start transition display
  visible.value = true;
});
// Timer
let timer: ReturnType<typeof setTimeout> | null = null;
// Start timing
const startTimer = () => {
  if (props.duration === 0) return;
  stopTimer();
  timer = setTimeout(() => {
    timer = null;
    // Close
    close();
  }, props.duration);
};
// Clear timer
const clearTimer = () => {
  stopTimer();
};
// Stop timer
const stopTimer = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};

// Close component
const close = function () {
  visible.value = false;
  nextTick(() => {
    // If the component has not started the transition, destroy it directly
    if (!isStartTransition.value) {
      props.onClose?.();
      emit('destroy');
    }
  });
};

// Handle close
const handleClose = function () {
  props.onClose?.();
};

// Handle destroy
const handleDestory = function () {
  // Notify destruction
  emit('destroy');
};

// Export to make it accessible externally
defineExpose({
  visible,
  bottom,
  close
});
</script>

<style lang="scss" scoped>
@use 'sass:color';

$info: #9aa7b1;
$warning: #f6ad49;
$error: #e83929;
$success: #38b48b;
$help: #a67eb7;
$cancel: #108b96;
$white: #fff;
$black: #000;
$none: #bdcbd2;
$whiteWeight: 20%;
$blackWeight: 90%;

$borderRadius: 5px;
$borderColor: $none;
$bg: color.mix($none, $white, $whiteWeight);
$mainText: color.mix($none, $black, $blackWeight);

$lrMargin: 12px;

.sk-message {
  width: fit-content;
  max-width: calc(100% - 32px);
  box-sizing: border-box;
  border-radius: $borderRadius;
  border: 1px solid $borderColor;
  position: fixed;
  left: 50%;
  top: 20px;
  transform: translate(-50%);
  background-color: $bg;
  transition: opacity 0.3s, transform 0.4s, top 0.4s;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  // 固定层级
  z-index: 9999;
  &.sk-message-info {
    border-color: $info;
    background-color: color.mix($info, $white, $whiteWeight);
    .sk-message-content {
      color: color.mix($info, $black, $blackWeight);
    }
    .sk-message-icon {
      color: color.mix($info, $black, $blackWeight);
      svg {
        fill: color.mix($info, $black, $blackWeight);
      }
    }
  }
  &.sk-message-success {
    border-color: $success;
    background-color: color.mix($success, $white, $whiteWeight);
    .sk-message-content {
      color: color.mix($success, $black, $blackWeight);
    }
    .sk-message-icon {
      color: color.mix($success, $black, $blackWeight);
      svg {
        fill: color.mix($success, $black, $blackWeight);
      }
    }
  }
  &.sk-message-warning {
    border-color: $warning;
    background-color: color.mix($warning, $white, $whiteWeight);
    .sk-message-content {
      color: color.mix($warning, $black, $blackWeight);
    }
    .sk-message-icon {
      color: color.mix($warning, $black, $blackWeight);
      svg {
        fill: color.mix($warning, $black, $blackWeight);
      }
    }
  }
  &.sk-message-error {
    border-color: $error;
    background-color: color.mix($error, $white, $whiteWeight);
    .sk-message-content {
      color: color.mix($error, $black, $blackWeight);
    }
    .sk-message-icon {
      color: color.mix($error, $black, $blackWeight);
      svg {
        fill: color.mix($error, $black, $blackWeight);
      }
    }
  }
  &.sk-message-help {
    border-color: $help;
    background-color: color.mix($help, $white, $whiteWeight);
    .sk-message-content {
      color: color.mix($help, $black, $blackWeight);
    }
    .sk-message-icon {
      color: color.mix($help, $black, $blackWeight);
      svg {
        fill: color.mix($help, $black, $blackWeight);
      }
    }
  }
  &.sk-message-left {
    left: $lrMargin;
    transform: translate(0);
  }
  &.sk-message-right {
    left: auto;
    right: $lrMargin;
    transform: translate(0);
  }
}

.sk-message-content {
  font-size: 14px;
  margin: 0;
  padding: 0;
  overflow-wrap: break-word;
  color: $mainText;
  line-height: 1;
}

.sk-message-icon {
  width: 1em;
  height: 1em;
  color: $mainText;
  svg {
    width: 1em;
    height: 1em;
    fill: $mainText;
  }
}

.sk-message-close {
  width: 1em;
  height: 1em;
  color: $none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.3s ease-in-out;
  cursor: pointer;
  svg {
    width: 1em;
    height: 1em;
    fill: $none;
    transition: fill 0.3s ease-in-out;
  }
  &:hover {
    color: $error;
    svg {
      fill: $error;
    }
  }
}

.sk-message-fade-enter-from,
.sk-message-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -100%);
}

@media (max-width: 768px) {
  .sk-message-content {
    text-align: center;
    // width: min-content;
  }
}
</style>
