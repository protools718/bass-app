<template>
  <div
    class="swiper"
    @mousedown="swipe.start"
    @touchstart="swipe.start"
    @xwheel="scroll"
  >
    <div class="swiper-header">
      <div class="header-panel">
        <slot name="header-panel">4<br />4</slot>
      </div>
      <div
        class="slides-container top flex"
        :class="{animate: animate}"
        :style="{transform: `translate3d(${translate}px, 0, 0)`}"
        @transitionend="swipe.after">

        <swiper-slide
          v-for="(item, i) in slides"
          :key="i"
          :style="slideStyle"
          :class="{last: i === items.length - 1}">
          <slot
            name="header"
            :item="item"
            v-if="i >= visible.first && i <= visible.last">
          </slot>
        </swiper-slide>
      </div>
    </div>

    <scroll-area
      overflow="vertical"
      content-class="layout column swiper-content"
      @wheel.native.stop=""
    >
      <v-layout>
        <div class="instrument-panel">
          <slot name="instrument"/>
        </div>
        <div
          class="slides-container"
          :class="{animate: animate}"
          :style="{transform: `translate3d(${translate}px, 0, 0)`}">

          <swiper-slide
            v-for="(item, i) in slides"
            ref="slides"
            :key="'c'+i"
            :style="slideStyle"
            :class="{last: i === items.length - 1}">
            <slot
              name="content"
              :item="item"
              v-if="i >= visible.first && i <= visible.last">
            </slot>
          </swiper-slide>

        </div>
      </v-layout>
      <slot name="bottom"/>
    </scroll-area>
    <!-- <p><small>Show: {{ visible.first + 1 }} - {{ visible.last + 1 }} (width: {{ width }})</small></p> -->
  </div>
</template>

<script>
import Swiper from './Base.js'

export default {
  name: 'dual-swiper',
  mixins: [Swiper]
}
</script>

<style lang="scss">
.swiper {
  user-select: none;
  overflow: hidden;

  .swiper-header {
    margin-left: 3em;
    margin-right: 0.25em;
    display: flex;
    flex: 1 0 auto;
    .header-panel {
      min-width: 3em;
      max-width: 3em;
      margin-left: -3em;
      z-index:1;
    }
  }
  .simplebar-content {
    overflow: hidden;
  }
  .slides-container {
    display: flex;
    flex-direction: row;
    position: relative;
    flex: 1;
    &.animate {
      transition: transform .4s ease;
    }
  }
  .instrument-panel {
    position: relative;
    min-width: 3em;
    z-index: 1;
  }
}
</style>
