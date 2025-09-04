<template>
  <div :class="`cast-type-btn is-${type} ${active ? 'actived' : ''}`" :title="typeTips[type]" @click="handleClick">
    <ChatIcon v-if="type === 'chat'" />
    <GiftIcon v-if="type === 'gift'" />
    <LikeIcon v-if="type === 'like'" />
    <MemberIcon v-if="type === 'member'" />
    <SocialIcon v-if="type === 'social'" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ChatIcon from './Icons/ChatIcon.vue';
import MemberIcon from './Icons/MemberIcon.vue';
import LikeIcon from './Icons/LikeIcon.vue';
import GiftIcon from './Icons/GiftIcon.vue';
import SocialIcon from './Icons/SocialIcon.vue';
import type { CastType } from './type';

interface CastTypeBtnProps {
  type?: CastType;
  defaultValue?: boolean;
}

const props = withDefaults(defineProps<CastTypeBtnProps>(), {
  type: 'chat',
  defaultValue: true
});

const emits = defineEmits(['change']);

const typeTips: Record<CastType, string> = {
  chat: 'Chat',
  gift: 'Gift',
  like: 'Like',
  member: 'Member',
  social: 'Social'
};

const active = ref(props.defaultValue);
/** Click button */
const handleClick = function () {
  let flag = !0;
  if (active.value) flag = !1;
  active.value = flag;
  emits('change', flag, props.type);
};
</script>

<style lang="scss" scoped>
.cast-type-btn {
  cursor: pointer;
  filter: grayscale(1);
  svg {
    width: 100%;
    height: 100%;
  }
  transition: filter 0.3s ease-in-out;
  &.actived {
    filter: grayscale(0);
  }
}
</style>
