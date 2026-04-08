<template>
    <!-- ── Full Screen Splash Overlay ────────────────────────────────────── -->
    <transition name="fade">
        <div v-if="splashVisible" class="splash-overlay">
            <img v-if="splashImage" :src="splashImage" style="width:100%; height:100%; object-fit:contain;" />
        </div>
    </transition>

    <div class="homepage-wrapper">

        <!-- ── Left Column (60%) — Logo + Video + Date/Time ──────────────────── -->
        <div v-show="!splashVisible"
            style="width:60%; height:100vh; display:flex; flex-direction:column; background:#fff;">
            <VideoPlaylist @video-ended="showSplash" :playList="playlist" />
        </div>

        <!-- ── Right Column (40%) — Monthly Poster + Announcements ──────────── -->
        <div v-show="!splashVisible"
            style="width:40%; height:100vh; display:flex; flex-direction:column; border-left:1px solid #e0e0e0;">
            <Announcement :announcementList="announcementList" :splashImage="splashImage" />
        </div>

    </div>
</template>

<script>
import VideoPlaylist from '@/components/VideoPlaylist.vue'
import Announcement from '@/components/Announcement.vue'
import api from '../api';

export default {
    name: 'HomePage',
    components: {
        VideoPlaylist,
        Announcement,
    },
    data() {
        return {
            playlist: [],
            announcementList: [],
            splashImage: null,
            splashVisible: true,
            splashTimer: null,
            showPreview: false,
        }
    },
    async mounted() {
        await this.fetchData()
    },
    methods: {

        showSplash() {
            this.showPreview = false
            this.splashVisible = true

            if (this.splashTimer) clearTimeout(this.splashTimer)

            this.splashTimer = setTimeout(() => {
                if (this.playlist.length || this.announcementList.length) {
                    this.splashVisible = false
                    this.showPreview = true
                }
            }, 5000)
        },

        async fetchData() {
            try {
                const response = await api.get('/showData');
                const data = response.data;

                console.log('[fetchData] raw links:', data.links)
                console.log('[fetchData] raw announcements:', data.announcements)
                console.log('[fetchData] raw monthlyPosters:', data.monthlyPosters)
                console.log('[fetchData] full response:', data)

                this.splashImage = data.monthlyPosters?.url || null

                this.playlist = (data.links || []).map(item => ({
                    title: item.title,
                    url: item.url
                }));

                this.announcementList = (data.announcements || []).map(item => ({
                    title: item.title,
                    content: item.content,
                    schedule: item.schedule
                }));

                if (this.playlist.length || this.announcementList.length) {
                    this.splashVisible = false
                    this.showPreview = true
                }

            } catch (e) {
                console.error("Failed to fetch data:", e);
            }
        }
    },

    beforeUnmount() {
        if (this.splashTimer) clearTimeout(this.splashTimer)
    }
}
</script>

<style>
html,
body {
    margin: 0;
    padding: 0;
    overflow: hidden !important;
    height: 100%;
    background: #ffffff;
}

.homepage-wrapper {
    height: 100%;
    overflow: hidden;
    width: 100%;
    display: flex;
    background: #fff;
}

.splash-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>