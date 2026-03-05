<template>
    <div style="height:100vh; width:100%; background:#000; padding:12px; box-sizing:border-box;">
        <div style="height:100%; width:100%; border-radius:16px; overflow:hidden; position:relative;">

            <!-- Video Player -->
            <video
                v-if="currentVideoSrc && !loading"
                :key="currentVideoIndex"
                ref="videoPlayer"
                style="height:100%; width:100%; object-fit:contain;"
                autoplay
                muted
                @ended="playNext"
                @timeupdate="onTimeUpdate"
                @loadedmetadata="onMetadataLoaded"
            >
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
                🎬 {{ currentFile.name }} &nbsp;|&nbsp; {{ currentTimeDisplay }} / {{ durationDisplay }} &nbsp;|&nbsp; {{ currentVideoIndex + 1 }} / {{ playlist.length }}
            </div>

        </div>
    </div>
</template>

<script>
export default {
    name: 'VideoPlaylist',
    data() {
        return {
            playlist: [],
            currentVideoIndex: 0,
            loading: true,
            error: null,
            currentTime: 0,
            duration: 0,
        }
    },
    computed: {
        currentFile() {
            return this.playlist[this.currentVideoIndex] || null
        },
        currentVideoSrc() {
            if (!this.currentFile) return null
            if (this.currentFile.url) return this.currentFile.url
            if (this.currentFile.file) return `/videos/${this.currentFile.file}`
            return null
        },
        currentTimeDisplay() {
            return this.formatTime(this.currentTime)
        },
        durationDisplay() {
            return this.formatTime(this.duration)
        },
    },
    async mounted() {
        await this.loadPlaylist()
    },
    watch: {
        currentVideoIndex() {
            this.currentTime = 0
            this.duration = 0
            this.$nextTick(() => {
                this.$refs.videoPlayer?.load()
                this.$refs.videoPlayer?.play()
            })
        }
    },
    methods: {
        async loadPlaylist() {
            try {
                const response = await fetch('/data/playlist.json')
                const data = await response.json()
                this.playlist = data.playlist || []
                console.log(`[Playlist] Loaded ${this.playlist.length} video(s)`)
                this.loading = false
            } catch (e) {
                this.error = 'Failed to load playlist.'
                this.loading = false
                console.error(e)
            }
        },
        playNext() {
            if (this.playlist.length === 0) return
            this.currentVideoIndex = (this.currentVideoIndex + 1) % this.playlist.length
            console.log(`[PlayNext] ${this.currentVideoIndex + 1} / ${this.playlist.length} — ${this.currentFile?.name}`)
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