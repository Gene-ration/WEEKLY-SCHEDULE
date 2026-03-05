import { createRouter, createWebHashHistory } from "vue-router";
const routes = [
  {
    path: "/",
    name: 'home',
    component: () => import("@/views/HomePage.vue"), // adjust the path based on your project structure
  }
];
const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;