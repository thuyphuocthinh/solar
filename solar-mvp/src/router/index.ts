import { createRouter, createWebHistory } from 'vue-router'
import { ROUTER_NAMES } from '@/constant/router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import Home from '@/pages/Home.vue'

const routes = [
    {
        path: '/',
        component: DefaultLayout,
        children: [
            {
                path: '',
                name: ROUTER_NAMES.HOME,
                component: Home
            }
        ]
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
