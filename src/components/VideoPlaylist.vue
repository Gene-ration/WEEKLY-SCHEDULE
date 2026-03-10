<template>
    <div style="height:100vh; width:100%; background:#000; padding:12px; box-sizing:border-box;">
        <div style="height:100%; width:100%; border-radius:16px; overflow:hidden; position:relative;">

            <!-- Video Player -->
            <video v-if="currentVideoSrc && !loading" :key="currentVideoIndex" ref="videoPlayer"
                style="height:100%; width:100%; object-fit:contain;" autoplay muted @ended="playNext"
                @timeupdate="onTimeUpdate" @loadedmetadata="onMetadataLoaded">
                <source :src="currentVideoSrc" type="video/mp4" />
            </video>

            <!-- Loading State -->
            <div v-if="loading"
                style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#000;">
                <p style="color:white; font-size:1rem;">Loading playlist...</p>
            </div>

            <!-- Error State -->
            <div v-if="error"
                style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#111;">
                <p style="color:red; font-size:1rem;">{{ error }}</p>
            </div>

            <!-- Now Playing Info -->
            <div v-if="!loading && currentFile"
                style="position:absolute; bottom:16px; left:16px; background:rgba(0,0,0,0.6); color:white; padding:6px 12px; border-radius:8px; font-size:0.8rem;">
                🎬 {{ currentFile.name }} &nbsp;|&nbsp; {{ currentTimeDisplay }} / {{ durationDisplay }} &nbsp;|&nbsp;
                {{ currentVideoIndex + 1 }} / {{ playlist.length }}
            </div>

        </div>
    </div>
</template>

<script>
import api from '@/api.js'; // adjust path
export default {
    name: 'VideoPlaylist',
    emits: ['video-ended'],
    data() {
        return {
            currentVideoIndex: 0,
            loading: true,
            error: null,
            currentTime: 0,
            duration: 0,
        }
    },
    props: {
        playlist: Object
    },
    computed: {
        currentFile() {
            return this.playlist[this.currentVideoIndex] || null
        },
        currentVideoSrc() {
            return this.currentFile
        },
        currentTimeDisplay() {
            return this.formatTime(this.currentTime)
        },
        durationDisplay() {
            return this.formatTime(this.duration)
        },
    },
    async mounted() {
        console.log(this.playlist)
        const checkIndex = localStorage.getItem('playIndex')
        if (checkIndex) {
            this.currentVideoIndex = checkIndex
        }
        this.startRefreshInterval();
    },
    beforeUnmount() {
        clearInterval(this.refreshTimer);
    },

    methods: {
        startRefreshInterval() {
            // Calculate interval: 1 hour divided by number of videos
            const intervalMs = (60 * 60 * 1000) / (this.playlist.length || 1);

            this.refreshTimer = setInterval(async () => {
                console.log(`[Refresh] Playlist reloaded — ${this.playlist.length} video(s)`);
            }, intervalMs);
        },

        playNext() {
            if (this.playlist.length === 0) return
            this.$emit('video-ended')
            setTimeout(() => {
                this.currentVideoIndex = (this.currentVideoIndex + 1) % this.playlist.length
                console.log(`[PlayNext] ${this.currentVideoIndex + 1} / ${this.playlist.length} — ${this.currentFile?.name}`)
            }, 3000)
        },
        onTimeUpdate() {
            this.currentTime = this.$refs.videoPlayer?.currentTime || 0
        },
        onMetadataLoaded() {
            this.duration = this.$refs.videoPlayer?.duration || 0
        },
        formatTime(seconds) {
            const s = Math.floor(seconds)
            const m = Math.floor(s / 60)
            const h = Math.floor(m / 60)
            if (h > 0) {
                return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
            }
            return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
        }
    }
}
</script>