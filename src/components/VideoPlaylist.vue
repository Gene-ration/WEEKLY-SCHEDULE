<template>
    <div style="height:100vh; width:100%; background:#000; padding:12px; box-sizing:border-box;">
        <div style="height:100%; width:100%; border-radius:16px; overflow:hidden; position:relative;">

            <template v-if="!loading && currentFile">

                <!-- YouTube Player Container -->
                <div v-if="isYouTube(currentFile.url)" id="yt-player" style="height:100%; width:100%;"></div>

                <!-- Direct MP4 Video Player -->
                <video
                    v-else
                    ref="videoPlayer"
                    style="height:100%; width:100%; object-fit:contain;"
                    autoplay
                    muted
                    @ended="playNext"
                    @timeupdate="onTimeUpdate"
                    @loadedmetadata="onMetadataLoaded"
                >
                    <source :src="currentFile.url" type="video/mp4" />
                </video>

                <!-- Now Playing Info -->
                <div style="position:absolute; bottom:16px; left:16px; background:rgba(0,0,0,0.6); color:white;
                    padding:6px 12px; border-radius:8px; font-size:0.8rem;">
                    🎬 {{ currentFile.title }} &nbsp;|&nbsp;
                    <span v-if="!isYouTube(currentFile.url)">
                        {{ currentTimeDisplay }} / {{ durationDisplay }} &nbsp;|&nbsp;
                    </span>
                    {{ currentVideoIndex + 1 }} / {{ playList.length }}
                </div>

            </template>

            <template v-else>
                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#000;">
                    <p style="color:white; font-size:1rem;">Loading playlist...</p>
                </div>
                <div v-if="error"
                    style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#111;">
                    <p style="color:red; font-size:1rem;">{{ error }}</p>
                </div>
            </template>

        </div>
    </div>
</template>

<script>
export default {
    name: 'VideoPlaylist',
    emits: ['video-ended'],
    props: {
        playList: {
            type: Array,
            default: () => []
        }
    },
    data() {
        return {
            currentVideoIndex: 0,
            loading: true,
            error: null,
            currentTime: 0,
            duration: 0,
            refreshTimer: null,
            ytPlayer: null,
            ytReady: false,
            ytDurationTimer: null,
            isAdvancing: false,
        }
    },
    computed: {
        currentFile() {
            return this.playList[this.currentVideoIndex] || null
        },
        currentTimeDisplay() {
            return this.formatTime(this.currentTime)
        },
        durationDisplay() {
            return this.formatTime(this.duration)
        },
    },
    watch: {
        playList: {
            immediate: true,
            handler(newVal) {
                console.log('[playList watcher] received:', newVal)
                if (newVal && newVal.length > 0) {
                    this.loading = false
                    console.log(`[Playlist] Loaded ${newVal.length} video(s)`, newVal)
                    console.log(`[Now Playing] ${this.currentFile?.title} — ${this.currentFile?.url}`)
                    if (this.isYouTube(this.currentFile?.url) && this.ytReady) {
                        this.$nextTick(() => this.initYouTubePlayer())
                    }
                }
            }
        },
        currentVideoIndex() {
            this.currentTime = 0
            this.duration = 0
            this.isAdvancing = false
            clearTimeout(this.ytDurationTimer)

            console.log(`[Index Changed] Now at index ${this.currentVideoIndex} — ${this.currentFile?.title}`)

            this.$nextTick(() => {
                if (this.isYouTube(this.currentFile?.url)) {
                    this.destroyYouTubePlayer()
                    this.$nextTick(() => this.initYouTubePlayer())
                } else {
                    this.destroyYouTubePlayer()
                    this.$refs.videoPlayer?.load()
                    this.$refs.videoPlayer?.play()
                }
            })
        }
    },
    async mounted() {
        const checkIndex = localStorage.getItem('playIndex')
        if (checkIndex) {
            this.currentVideoIndex = Number(checkIndex)
        }
        console.log('[Mounted] playList on mount:', this.playList)
        this.loading = false
        this.startRefreshInterval()
        this.loadYouTubeAPI()
    },
    beforeUnmount() {
        clearInterval(this.refreshTimer)
        clearTimeout(this.ytDurationTimer)
        this.destroyYouTubePlayer()
    },
    methods: {
        // ── YouTube Helpers ──

        isYouTube(url) {
            return url && (url.includes('youtube.com') || url.includes('youtu.be'))
        },

        getYouTubeVideoId(url) {
            const patterns = [
                /youtube\.com\/watch\?v=([^&]+)/,
                /youtu\.be\/([^?]+)/,
                /youtube\.com\/embed\/([^?]+)/,
            ]
            for (const pattern of patterns) {
                const match = url.match(pattern)
                if (match) return match[1]
            }
            return null
        },

        destroyYouTubePlayer() {
            if (this.ytPlayer) {
                this.ytPlayer.destroy()
                this.ytPlayer = null
            }
        },

        loadYouTubeAPI() {
            if (window.YT && window.YT.Player) {
                this.ytReady = true
                if (this.isYouTube(this.currentFile?.url)) {
                    this.$nextTick(() => this.initYouTubePlayer())
                }
                return
            }
            const tag = document.createElement('script')
            tag.src = 'https://www.youtube.com/iframe_api'
            document.head.appendChild(tag)
            window.onYouTubeIframeAPIReady = () => {
                this.ytReady = true
                if (this.isYouTube(this.currentFile?.url)) {
                    this.$nextTick(() => this.initYouTubePlayer())
                }
            }
        },

        initYouTubePlayer() {
            if (!this.ytReady || !this.currentFile) return
            const videoId = this.getYouTubeVideoId(this.currentFile.url)
            if (!videoId) return

            this.destroyYouTubePlayer()

            this.ytPlayer = new window.YT.Player('yt-player', {
                videoId,
                playerVars: { autoplay: 1, mute: 1, controls: 0, rel: 0, modestbranding: 1 },
                events: {
                    onReady: (event) => {
                        const duration = event.target.getDuration()
                        console.log(`[YouTube] Duration: ${duration}s`)
                        clearTimeout(this.ytDurationTimer)
                        this.ytDurationTimer = setTimeout(() => {
                            console.log('[YouTube] Duration timer fired — playing next')
                            this.playNext()
                        }, duration * 1000)
                    },
                    onStateChange: (event) => {
                        if (event.data === window.YT.PlayerState.ENDED) {
                            clearTimeout(this.ytDurationTimer)
                            this.playNext()
                        }
                    },
                },
            })
        },

        // ── Playlist Controls ──

        startRefreshInterval() {
            const intervalMs = (60 * 60 * 1000) / (this.playList.length || 1)
            this.refreshTimer = setInterval(() => {
                console.log(`[Refresh] ${this.playList.length} video(s) in playlist`)
            }, intervalMs)
        },

        playNext() {
            if (this.isAdvancing) {
                console.log('[playNext] already advancing — skipped')
                return
            }
            if (this.playList.length === 0) return

            this.isAdvancing = true
            console.log(`[playNext] advancing from index ${this.currentVideoIndex}`)
            this.$emit('video-ended')

            setTimeout(() => {
                this.currentVideoIndex = (this.currentVideoIndex + 1) % this.playList.length
                console.log(`[PlayNext] now at ${this.currentVideoIndex + 1} / ${this.playList.length} — ${this.currentFile?.title}`)
            }, 3000)
        },

        // ── MP4 Time Tracking ──
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