import { createApp } from 'vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import App from './App.vue'
import router from './router'
import axios from 'axios'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
// Set the base URL
axios.defaults.baseURL =
    import.meta.env.PROD
        ? "http://one.bma.edu.ph/api/"
        : "http://localhost:7000/api/"


// Create the Vue app
const app = createApp(App)
const vuetify = createVuetify({
    components,
    directives,
})
// Attach axios to global properties
app.config.globalProperties.$axios = axios

// Use router and mount the app
app.use(router).use(vuetify).mount('#app')
