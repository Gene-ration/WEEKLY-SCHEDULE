<template>
    <div class="row ma-0" style="height:100vh; overflow:hidden; width:100%; position:relative; background:#fff;">

        <!-- ── Full Screen Splash Overlay ────────────────────────────────────── -->
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

        <!-- ── Video Player Column (60%) ─────────────────────────────────────── -->
        <div class="col-md-7 pa-0" style="height:100vh; position:relative;" v-show="!splashVisible">
            <VideoPlaylist @video-ended="showSplash" :playList="playlist" />

            <!-- ── Small Splash Preview Image ────────────────────────────────── -->
            <transition name="preview-fade">
                <div v-if="showPreview"
                    style="
                        position:absolute;
                        bottom:20px;
                        right:20px;
                        z-index:100;
                        width:160px;
                        height:90px;
                        border-radius:10px;
                        overflow:hidden;
                        box-shadow:0 4px 16px rgba(0,0,0,0.5);
                        border:2px solid rgba(255,255,255,0.4);
                        cursor:pointer;
                    "
                    @click="triggerSplash"
                    title="Click to show splash">
                    <img src="/Image/BMA March 2026.png"
                        style="width:100%; height:100%; object-fit:cover;" />
                </div>
            </transition>
        </div>

        <!-- ── Announcement Column (40%) ─────────────────────────────────────── -->
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
            splashVisible: true,  // controls full screen splash visibility
            splashTimer: null,    // timer that auto-hides the full screen splash
            showPreview: false,   // controls small preview image visibility
        }
    },
    async mounted() {
        await this.fetchData()
    },
    methods: {

        // ── showSplash ────────────────────────────────────────────────────────
        showSplash() {
            // Hide small preview while full splash is showing
            this.showPreview = false
            this.splashVisible = true

            // Clear any existing timer to avoid double-firing
            if (this.splashTimer) clearTimeout(this.splashTimer)

            // After 10 seconds hide the full splash and restore the preview
            this.splashTimer = setTimeout(() => {
                if (this.playlist.length || this.announcementList.length) {
                    this.splashVisible = false

                    // Preview stays permanently — no auto-hide timer
                    this.showPreview = true
                }
            }, 10000)
        },

        // ── triggerSplash ─────────────────────────────────────────────────────
        triggerSplash() {
            this.showSplash()
        },

        // ── fetchData ─────────────────────────────────────────────────────────
        async fetchData() {
            try {
                const response = await api.get('/showData');
                const data = response.data;

                console.log('[fetchData] raw links:', data.links)
                console.log('[fetchData] raw announcements:', data.announcements)
                console.log('[fetchData] full response:', data)

                // Map links into playlist format for VideoPlaylist
                this.playlist = (data.links || []).map(item => ({
                    title: item.title,
                    url: item.url
                }));

                // Map announcements including schedule for date display
                this.announcementList = (data.announcements || []).map(item => ({
                    title: item.title,
                    content: item.content,
                    schedule: item.schedule
                }));

                // Only hide splash if there is content to show
                if (this.playlist.length || this.announcementList.length) {
                    this.splashVisible = false

                    // Show small preview permanently after first data load
                    this.showPreview = true
                }

            } catch (e) {
                console.error("Failed to fetch data:", e);
            }
        }
    },

    beforeUnmount() {
        // Clean up timer to prevent memory leaks
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

/* Full screen splash — simple opacity fade in/out */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* Small preview image — fades in with a subtle scale effect */
.preview-fade-enter-active,
.preview-fade-leave-active {
    transition: opacity 0.4s ease, transform 0.4s ease;
}
.preview-fade-enter-from,
.preview-fade-leave-to {
    opacity: 0;
    transform: scale(0.85);
}
</style>