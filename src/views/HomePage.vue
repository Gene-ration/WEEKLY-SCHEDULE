<template>
    <div class="row ma-0" style="height:100vh; overflow:hidden; width:100%; position:relative; background:#fff;">

        <!-- Splash Image Overlay -->
        <transition name="fade">
            <div v-if="splashVisible" style="
                    position:fixed;
                    inset:0;
                    z-index:9999;
                    background:#000;
                    display:flex;
                    align-items:center;
                    justify-content:center;">
                <img src="/Image/BMA March 2026.png" style="max-width:100%; max-height:100%; object-fit:contain;" />
            </div>
        </transition>

        <!-- Video Player (60%) — always mounted, just hidden during splash -->
        <div class="col-md-7 pa-0" style="height:100vh;" v-show="!splashVisible">
            <VideoPlaylist @video-ended="showSplash" :playList="playlist" />
        </div>

        <!-- Announcement (40%) — receives data from parent -->
        <div class="col-md-5 pa-0" style="height:100vh;" v-show="!splashVisible">
            <Announcement :announcementList="announcementList" />
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
            splashVisible: true,
            splashTimer: null,
        }
    },
    async mounted() {
        await this.fetchData()
    },
    methods: {
        showSplash() {
            this.splashVisible = true

            if (this.splashTimer) clearTimeout(this.splashTimer)

            this.splashTimer = setTimeout(() => {
                if (this.playlist.length || this.announcementList.length) {
                    this.splashVisible = false
                }
            }, 10000)
        },

        async fetchData() {
            try {
                const response = await api.get('/showData');
                const data = response.data;
                console.log('[fetchData] raw announcements:', data.announcements)

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

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>