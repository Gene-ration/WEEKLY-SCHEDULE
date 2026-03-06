<template>
    <div class="row ma-0" style="height:100vh; overflow:hidden; width:100%; position:relative;">

        <!-- Video Player (60%) -->
        <div class="col-md-7 pa-0" style="height:100vh;">
            <VideoPlaylist @video-ended="showSplash" />
        </div>

        <!-- Announcement (40%) -->
        <div class="col-md-5 pa-0" style="height:100vh;">
            <Announcement />
        </div>

        <!-- Splash Image Overlay — covers entire screen -->
        <transition name="fade">
            <div
                v-if="splashVisible"
                style="
                    position:fixed;
                    inset:0;
                    z-index:9999;
                    background:#000;
                    display:flex;
                    align-items:center;
                    justify-content:center;"
                >
                <img
                    src="/Image/BMA March 2026.png"
                    style="max-width:100%; max-height:100%; object-fit:contain;"
                />
            </div>
        </transition>

    </div>
</template>

<script>
import VideoPlaylist from '@/components/VideoPlaylist.vue'
import Announcement from '@/components/Announcement.vue'

export default {
    name: 'HomePage',
    components: {
        VideoPlaylist,
        Announcement,
    },
    data() {
        return {
            splashVisible: false,
            splashTimer: null,
        }
    },
    methods: {
        showSplash() {
            // Show splash image
            this.splashVisible = true

            // Clear any existing timer
            if (this.splashTimer) clearTimeout(this.splashTimer)

            // Hide after 3 seconds — adjust as needed
            this.splashTimer = setTimeout(() => {
                this.splashVisible = false
            }, 120000)
        }
    },
    beforeUnmount() {
        if (this.splashTimer) clearTimeout(this.splashTimer)
    }
}
</script>

<style>
html, body {
    margin: 0;
    padding: 0;
    overflow: hidden !important;
    height: 100%;
}

/* Fade transition for splash */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>