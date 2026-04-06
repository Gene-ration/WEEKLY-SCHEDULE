<template>
    <div style="height:100vh; width:100%; background:#000; padding:12px; box-sizing:border-box;">
        <div style="height:100%; width:100%; border-radius:16px; overflow:hidden; position:relative;">

            <!-- ── YouTube Player — shown only when current video is a YouTube URL ── -->
            <div v-show="isYouTube" id="yt-player" style="height:100%; width:100%;"></div>

            <!-- ── Native Player — shown for direct mp4 / webm / any non-YouTube URL ── -->
            <video
                v-show="!isYouTube"
                ref="nativePlayer"
                style="height:100%; width:100%; object-fit:contain; background:#000;"
                autoplay
                @ended="playNext"
                @timeupdate="onNativeTimeUpdate"
                @loadedmetadata="onNativeMetadata"
            ></video>

            <!-- Loading overlay on top -->
            <div v-if="loading"
                style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#000;">
                <p style="color:white;">Loading playlist...</p>
            </div>

            <!-- Now Playing Info -->
            <div v-if="currentFile" style="position:absolute; bottom:16px; left:16px; background:rgba(0,0,0,0.6); color:white;
                padding:6px 12px; border-radius:8px; font-size:0.8rem;">
                🎬 {{ currentFile.title }} &nbsp;|&nbsp; {{ currentTimeDisplay }} / {{ durationDisplay }}
                &nbsp;|&nbsp; {{ currentVideoIndex + 1 }} / {{ playList.length }}
                &nbsp;|&nbsp;
                <span style="font-size:0.7rem; opacity:0.8;">{{ isYouTube ? '▶ YouTube' : '▶ Direct' }}</span>
            </div>

        </div>
    </div>
</template>

<script>
export default {
    name: "VideoPlaylist",

    emits: ['video-ended'],

    props: {
        playList: {
            type: Array,
            required: true
        }
    },

    data() {
        return {
            currentVideoIndex: 0,
            player: null,
            loading: true,
            refreshTimer: null,
            apiReady: false,
            currentTime: 0,
            duration: 0,
            timePollingInterval: null,
            lastVideoType: null,
        }
    },

    computed: {
        currentFile() {
            return this.playList[this.currentVideoIndex] || null
        },

        isYouTube() {
            return this.currentFile
                ? this.detectVideoType(this.currentFile.url) === 'youtube'
                : false
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
                    console.log(`[playList watcher] ${newVal.length} video(s) loaded — starting player`)
                    this.$nextTick(() => {
                        this.loadCurrentVideo()
                    })
                } else {
                    console.warn('[playList watcher] Playlist is empty or not yet loaded')
                }
            }
        }
    },

    mounted() {
        const savedIndex = localStorage.getItem("playIndex")
        if (savedIndex !== null) {
            this.currentVideoIndex = Number(savedIndex)
            console.log(`[Mounted] Restored index from localStorage: ${savedIndex}`)
        } else {
            console.log('[Mounted] No saved index — starting from 0')
        }

        this.startRefreshInterval()
    },

    beforeUnmount() {
        clearInterval(this.refreshTimer)
        clearInterval(this.timePollingInterval)

        if (this.player) {
            this.player.destroy()
            console.log('[beforeUnmount] YouTube player destroyed')
        }
    },

    methods: {

        // ── Video Type Detection ─────────────────────────────────

        detectVideoType(url) {
            if (!url) return null
            const isYT = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)/.test(url)
            return isYT ? 'youtube' : 'direct'
        },

        // ── Main Entry Point ─────────────────────────────────────

        loadCurrentVideo() {
            if (!this.playList || this.playList.length === 0) {
                console.warn('[loadCurrentVideo] Playlist is empty.')
                return
            }

            if (this.currentVideoIndex >= this.playList.length) {
                console.warn(`[loadCurrentVideo] Index ${this.currentVideoIndex} out of range — resetting to 0`)
                this.currentVideoIndex = 0
                localStorage.setItem("playIndex", 0)
            }

            const type = this.detectVideoType(this.currentFile?.url)
            console.log(`[loadCurrentVideo] type: ${type} | lastType: ${this.lastVideoType} | title: "${this.currentFile?.title}"`)

            if (type === 'youtube') {

                this.stopNativePlayer()
                this.loadYouTubeAPI()

            } else if (type === 'direct') {

                if (this.lastVideoType === 'youtube') {
                    this.destroyYouTubePlayer()
                } else {
                    this.stopYouTubePlayer()
                }
                this.loadDirectVideo()
            } else {
                console.warn('[loadCurrentVideo] Unknown video type for URL:', this.currentFile?.url)
            }

            this.lastVideoType = type
        },

        // ── YouTube Player ───────────────────────────────────────

        loadYouTubeAPI() {
            if (!this.playList || this.playList.length === 0) {
                console.warn('[loadYouTubeAPI] Playlist is empty.')
                return
            }

            console.log(`[loadYouTubeAPI] ${this.playList.length} video(s) in playlist`, this.playList)

            if (window.YT && window.YT.Player) {
                console.log('[loadYouTubeAPI] YouTube API already loaded — initializing player')
                this.apiReady = true
                this.initPlayer()
                return
            }

            console.log('[loadYouTubeAPI] Injecting YouTube IFrame API script...')
            const tag = document.createElement("script")
            tag.src = "https://www.youtube.com/iframe_api"
            document.body.appendChild(tag)

            window.onYouTubeIframeAPIReady = () => {
                console.log('[onYouTubeIframeAPIReady] YouTube API is ready')
                this.apiReady = true
                this.initPlayer()
            }
        },

        initPlayer() {
            if (!this.apiReady) {
                console.warn('[initPlayer] API not ready yet — aborting')
                return
            }

            if (this.currentVideoIndex >= this.playList.length) {
                console.warn(`[initPlayer] Index ${this.currentVideoIndex} out of range — resetting to 0`)
                this.currentVideoIndex = 0
                localStorage.setItem("playIndex", 0)
            }

            if (!this.currentFile || !this.currentFile.url) {
                console.warn("[initPlayer] No video found in playlist.")
                return
            }

            const firstVideoId = this.extractVideoId(this.currentFile.url)
            console.log(`[initPlayer] Starting video — title: "${this.currentFile.title}" | id: ${firstVideoId}`)

            if (!firstVideoId) {
                console.warn("[initPlayer] Invalid YouTube URL:", this.currentFile.url)
                return
            }

            // If player already exists, just swap the video — no need to recreate
            if (this.player) {
                console.log('[initPlayer] Player already exists — loading new video')
                this.player.loadVideoById(firstVideoId)
                this.loading = false
                return
            }

            this.player = new YT.Player("yt-player", {
                videoId: firstVideoId,
                playerVars: {
                    autoplay: 1,
                    /* mute: 1, */
                    origin: window.location.origin
                },
                events: {
                    onReady: (event) => {
                        this.loading = false
                        this.duration = event.target.getDuration()
                        console.log(`[onReady] Player ready — title: "${this.currentFile.title}" | duration: ${this.duration}s (${Math.floor(this.duration / 60)}m ${Math.floor(this.duration % 60)}s)`)

                        clearInterval(this.timePollingInterval)
                        this.timePollingInterval = setInterval(() => {
                            if (this.player && this.player.getCurrentTime) {
                                this.currentTime = Math.floor(this.player.getCurrentTime())
                            }
                        }, 1000)
                    },
                    onStateChange: this.onPlayerStateChange
                }
            })
        },

        stopYouTubePlayer() {
            clearInterval(this.timePollingInterval)
            if (this.player) {
                try {
                    this.player.stopVideo()
                    this.player.mute()  
                } catch (e) { /* ignore */ }
            }
            this.currentTime = 0
            this.duration = 0
        },

        destroyYouTubePlayer() {
            clearInterval(this.timePollingInterval)
            if (this.player) {
                try {
                    this.player.stopVideo()
                    this.player.destroy()
                    console.log('[destroyYouTubePlayer] YouTube player fully destroyed')
                } catch (e) { /* ignore */ }
                this.player = null
                this.apiReady = false 
            }
            this.currentTime = 0
            this.duration = 0
        },

        // ── Direct / Native Video Player ─────────────────────────

        loadDirectVideo() {
            this.$nextTick(() => {
                const video = this.$refs.nativePlayer
                if (!video) {
                    console.warn('[loadDirectVideo] Native player ref not found')
                    return
                }

                console.log(`[loadDirectVideo] Loading: ${this.currentFile.url}`)
                video.src = this.currentFile.url
                video.load()
                video.play().catch(err => {
                    console.warn('[loadDirectVideo] Autoplay blocked:', err)
                })

                this.loading = false
            })
        },

        stopNativePlayer() {
            const video = this.$refs.nativePlayer
            if (video) {
                video.pause()
                video.src = ''
            }
            this.currentTime = 0
            this.duration = 0
        },

        onNativeTimeUpdate() {
            const video = this.$refs.nativePlayer
            if (video) this.currentTime = Math.floor(video.currentTime)
        },

        onNativeMetadata() {
            const video = this.$refs.nativePlayer
            if (video) {
                this.duration = Math.floor(video.duration)
                console.log(`[Native onMetadata] title: "${this.currentFile?.title}" | duration: ${this.duration}s`)
            }
        },

        // ── Player Events ────────────────────────────────────────

        onPlayerStateChange(event) {
            const states = { '-1': 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' }
            console.log(`[onStateChange] State changed: ${states[event.data] || event.data}`)

            if (event.data === YT.PlayerState.ENDED) {
                this.playNext()
            }
        },

        // ── Playlist Controls ────────────────────────────────────

        playNext() {
            if (!this.playList.length) return

            this.$emit('video-ended')
            console.log('[playNext] emitted video-ended to parent')

            this.currentTime = 0
            this.duration = 0
            clearInterval(this.timePollingInterval)

            const prevIndex = this.currentVideoIndex
            this.currentVideoIndex = (this.currentVideoIndex + 1) % this.playList.length
            localStorage.setItem("playIndex", this.currentVideoIndex)

            console.log(`[playNext] ${prevIndex + 1} → ${this.currentVideoIndex + 1} of ${this.playList.length} | title: "${this.currentFile?.title}"`)

            this.loadCurrentVideo()
        },

        // ── Helpers ──────────────────────────────────────────────

        extractVideoId(url) {
            if (!url) return null

            const regExp = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^?&]+)/
            const match = url.match(regExp)

            if (!match) {
                console.warn('[extractVideoId] Could not extract ID from URL:', url)
                return null
            }

            return match[1]
        },

        formatTime(seconds) {
            const s = Math.floor(seconds)
            const m = Math.floor(s / 60)
            const h = Math.floor(m / 60)
            if (h > 0) {
                return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
            }
            return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
        },

        startRefreshInterval() {
            const intervalMs = (60 * 60 * 1000) / (this.playList.length || 1)
            console.log(`[startRefreshInterval] Refresh interval set to every ${Math.round(intervalMs / 1000 / 60)} min`)

            this.refreshTimer = setInterval(() => {
                console.log(`[Refresh] Playlist active — ${this.playList.length} video(s) | now playing: "${this.currentFile?.title}"`)
            }, intervalMs)
        }
    }
}
</script>