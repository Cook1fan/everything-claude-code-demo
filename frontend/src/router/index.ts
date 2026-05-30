import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import VideoView from '@/views/VideoView.vue'
import PlayHistoryView from '@/views/PlayHistoryView.vue'
import FrameExtractView from '@/views/FrameExtractView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/video/:id',
      name: 'video',
      component: VideoView,
    },
    {
      path: '/history',
      name: 'history',
      component: PlayHistoryView,
    },
    {
      path: '/frame-extract',
      name: 'frameExtract',
      component: FrameExtractView,
    },
  ],
})

export default router
