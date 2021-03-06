// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
// import Vue from 'vue-dev/dist/vue'
// import Vue from 'vue-dev/dist/vue.runtime.esm'
import App from './App'
import Services from './ServicesPlugin'

import Icon from './ui/Icon'
import ScrollArea from './ui/ScrollArea2'
import TextSeparator from './ui/TextSeparator'

import Vuetify from 'vuetify'
import 'material-icons/iconfont/material-icons.scss'
import 'vuetify/dist/vuetify.min.css'
import colors from 'vuetify/es5/util/colors'

Vue.use(Vuetify)
Vue.use(Services)

function requireAll (requireContext) {
  return requireContext.keys().map(requireContext)
}
requireAll(require.context('../icons', false, /.*\.svg$/))
requireAll(require.context('../icons/musical', false, /.*\.svg$/))
requireAll(require.context('../icons/percussion', false, /.*\.svg$/))

// Disable ripple ink effect by overriding Vuetify's directive
Vue.directive('ripple', (el, binding) => {})
Vue.component('icon', Icon)
Vue.component('scroll-area', ScrollArea)
Vue.component('text-separator', TextSeparator)

Vue.config.productionTip = false

/* eslint-disable no-new */
new Vue({
  el: '#app',
  components: { App },
  data () {
    return {
      player: {
        loopMode: false,
        loading: false,
        countdown: false,
        screenLock: false
      },
      editor: {
        sectionIndex: null
      },
      viewer: {
        playlistIndex: null,
        playlist: null,
        playlistEditor: false
      },
      mode: 'editor',
      label: 'name',
      track: null
    }
  },
  render: h => h(App),
  created () {
    Vue.prototype.$store = this.$data
    // Vue.util.defineReactive(this, 'services', {})
    // this.services = {}
    if (process.env.NODE_ENV === 'development') {
      // this.$data.$services = this.$services
      this.$options.computed = this.$options.computed || {}
      this.$options.computed.$services = this.$services
    }
  }
})
