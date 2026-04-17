<template>
    <!-- ── Full Screen Splash Overlay ────────────────────────────────────── -->
    <transition name="fade">
        <div v-if="splashVisible" class="splash-overlay">
            <img v-if="splashImage" :src="splashImage" style="width:100%; height:100%; object-fit:contain;" />
        </div>
    </transition>

    <div class="homepage-wrapper">

        <!-- ── Left Column (60%) ─────────────────────────────────────────────── -->
        <div v-show="!splashVisible"
            style="width:60%; height:100vh; display:flex; flex-direction:column; background:#fff;">
            <VideoPlaylist
                ref="videoPlaylist"
                @video-ended="onVideoEnded"
                :playList="playlist"
            />
        </div>

        <!-- ── Right Column (40%) ────────────────────────────────────────────── -->
        <div v-show="!splashVisible"
            style="width:40%; height:100vh; display:flex; flex-direction:column; border-left:1px solid #e0e0e0;">
            <Announcement :announcementList="announcementList" :splashImage="splashImage" />
        </div>

    </div>
</template>

<script>
import VideoPlaylist from '@/components/VideoPlaylist.vue'
import Announcement  from '@/components/Announcement.vue'
import api           from '../api'

export default {
    name: 'HomePage',

    components: { VideoPlaylist, Announcement },

    data() {
        return {
            playlist:         [],
            announcementList: [],
            splashImage:      null,
            splashVisible:    true,
            splashTimer:      null,
            pendingIndex:     null,
        }
    },

    async mounted() {
        await this.fetchData()
    },

    beforeUnmount() {
        if (this.splashTimer) clearTimeout(this.splashTimer)
    },

    methods: {

        onVideoEnded(nextIndex) {
            console.log(`[HomePage] video-ended — queuing index ${nextIndex} after splash`)

            this.pendingIndex  = nextIndex
            this.splashVisible = true

            if (this.splashTimer) clearTimeout(this.splashTimer)

            // After 5 seconds hide splash and tell VideoPlaylist to play the next index
            this.splashTimer = setTimeout(() => {
                this.splashVisible = false
                this.$nextTick(() => {
                    if (this.pendingIndex !== null) {
                        console.log(`[HomePage] Splash done — playing index ${this.pendingIndex}`)
                        this.$refs.videoPlaylist?.playItem(this.pendingIndex)
                        this.pendingIndex = null
                    }
                })
            }, 5000)
        },

        async fetchData() {
            try {
                const response = await api.get('/showData')
                const data     = response.data

                console.log('[fetchData] raw links:',         data.links)
                console.log('[fetchData] raw announcements:', data.announcements)
                console.log('[fetchData] raw monthlyPosters:', data.monthlyPosters)

                this.splashImage = data.monthlyPosters?.url || null

                this.playlist = (data.links || []).map(item => ({
                    title: item.title,
                    url:   item.url,
                }))

                this.announcementList = (data.announcements || []).map(item => ({
                    title:    item.title,
                    content:  item.content,
                    schedule: item.schedule,
                }))

                if (this.playlist.length || this.announcementList.length) {
                    this.splashVisible = false
                }

            } catch (e) {
                console.error('[fetchData] Failed:', e)
            }
        }
    },
}
</script>

<style>
html, body {
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