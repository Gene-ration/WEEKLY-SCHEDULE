<template>
    <div style="height:100vh; display:flex; flex-direction:column; background:#fff;">

        <!-- ── Logo Header ──────────────────────────────────────────────────── -->
        <div class="logoHeader">
            <img src="/Image/bma-logo.png" alt="Logo" class="logo" />
            <span class="textLogo">Baliwag Maritime Academy</span>
            <span class="textDesc">Knowledge · Discipline · Excellence</span>
        </div>

        <!-- ── Video Player ─────────────────────────────────────────────────── -->
        <div class="videoPlayer">

            <!-- YouTube: div target for IFrame API -->
            <div
                v-if="currentItem && currentItem.type === 'youtube'"
                :key="'yt-' + currentIndex"
                id="yt-player"
                style="height:100%; width:100%;"
            ></div>

            <!-- Direct video: always in DOM via v-show so ref is always available -->
            <video
                ref="nativePlayer"
                v-show="currentItem && currentItem.type === 'direct'"
                style="height:100%; width:100%; object-fit:contain; background:#000;"
                @ended="onVideoEnded"
                @timeupdate="onNativeTimeUpdate"
                @loadedmetadata="onNativeMetadata"
                @error="onNativeError"
            ></video>

            <!-- Loading overlay -->
            <div v-if="loading" class="loading">
                <p style="color:white; font-size:1rem;">Loading...</p>
            </div>

            <!-- Now Playing Info -->
            <div v-if="currentItem" class="nowPlaying">
                🎬 {{ currentItem.title }}
                &nbsp;|&nbsp; {{ currentTimeDisplay }} / {{ durationDisplay }}
                &nbsp;|&nbsp; {{ currentIndex + 1 }} / {{ queue.length }}
                &nbsp;|&nbsp; {{ currentItem.type === 'youtube' ? 'YouTube' : 'Direct' }}
            </div>

        </div>

        <!-- ── Date & Time Bar ──────────────────────────────────────────────── -->
        <div class="dtBar">
            <div>
                <p class="dateStatus">{{ formattedDate }}</p>
                <p class="time">{{ formattedTime }}</p>
            </div>
            <p class="dateStatus">{{ timeStatus }}</p>
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
        },
    },

    data() {
        return {
            queue:        [],
            currentIndex: 0,

            player:   null,
            apiReady: false,

            currentTime: 0,
            duration:    0,

            timePollingInterval: null,
            refreshTimer:        null,
            clockTimer:          null,

            loading:           true,
            currentTime_clock: new Date(),
        }
    },

    computed: {
        currentItem() {
            return this.queue[this.currentIndex] || null
        },

        currentTimeDisplay() { return this.formatTime(this.currentTime) },
        durationDisplay()    { return this.formatTime(this.duration) },

        formattedDate() {
            return this.currentTime_clock.toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
            }).toUpperCase()
        },
        formattedTime() {
            return this.currentTime_clock.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: true
            })
        },
        timeStatus() {
            const h = this.currentTime_clock.getHours()
            if (h < 12) return 'GOOD MORNING'
            if (h < 18) return 'GOOD AFTERNOON'
            return 'GOOD EVENING'
        }
    },

    watch: {
        playList: {
            immediate: true,
            handler(newVal) {
                console.log('[playList watcher] received:', newVal)
                if (newVal && newVal.length > 0) {
                    this.buildQueue(newVal)
                } else {
                    console.warn('[playList watcher] Playlist empty or not loaded yet')
                }
            }
        },
    },

    mounted() {
        const saved = localStorage.getItem("playIndex")
        if (saved !== null) {
            this.currentIndex = Number(saved)
            console.log(`[Mounted] Restored index: ${saved}`)
        }

        this.clockTimer = setInterval(() => {
            this.currentTime_clock = new Date()
        }, 1000)

        this.startRefreshInterval()
    },

    beforeUnmount() {
        this.stopAll()
        clearInterval(this.refreshTimer)
        clearInterval(this.clockTimer)
    },

    methods: {

        // ── Queue Builder ──────────────────────────────────────────

        buildQueue(list) {
            this.queue = list.map(item => {
                const type = this.resolveType(item.url)
                console.log(`[buildQueue] "${item.title}" → type: ${type}`)
                return {
                    type,
                    title: item.title,
                    url:   item.url,
                }
            })

            console.log(`[buildQueue] ${this.queue.length} item(s) ready`)

            if (this.currentIndex >= this.queue.length) {
                console.warn(`[buildQueue] Index ${this.currentIndex} out of range — reset to 0`)
                this.currentIndex = 0
                localStorage.setItem("playIndex", 0)
            }

            this.$nextTick(() => this.playItem(this.currentIndex))
        },

        // ── Type Resolution ────────────────────────────────────────

        resolveType(url) {
            if (!url) return 'direct'
            if (/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)/.test(url)) return 'youtube'
            return 'direct'
        },

        // ── Play Item (PUBLIC — called by HomePage after splash) ───

        playItem(index) {
            // Stop everything currently running and reset state
            this.stopAll()

            this.currentTime  = 0
            this.duration     = 0
            this.loading      = true
            this.currentIndex = index

            localStorage.setItem("playIndex", index)

            const item = this.queue[index]
            if (!item) {
                console.warn('[playItem] No item at index', index)
                return
            }

            console.log(`[playItem] #${index + 1} | type: ${item.type} | "${item.title}"`)

            this.$nextTick(() => {
                if (item.type === 'youtube') {
                    this.initYouTube(item)
                } else {
                    this.loadDirectVideo(item)
                }
            })
        },
        
        // ── Video Ended ────────────────────────────────────────────
        onVideoEnded() {
            if (!this.queue.length) return

            const next = (this.currentIndex + 1) % this.queue.length
            console.log(`[onVideoEnded] current: ${this.currentIndex + 1} → next: ${next + 1} of ${this.queue.length}`)

            this.stopAll()

            this.$emit('video-ended', next)
        },

        // ── Stop Everything ────────────────────────────────────────
        stopAll() {
            clearInterval(this.timePollingInterval)
            this.timePollingInterval = null

            if (this.player) {
                try { this.player.stopVideo(); this.player.destroy() } catch (e) {}
                this.player   = null
                this.apiReady = false
            }

            const v = this.$refs.nativePlayer
            if (v) {
                try {
                    v.pause()
                    v.removeAttribute('src')
                    v.load()
                } catch (e) {}
            }

            this.currentTime = 0
            this.duration    = 0
        },

        // ── YouTube ────────────────────────────────────────────────
        initYouTube(item) {
            const videoId = this.extractYouTubeId(item.url)
            if (!videoId) {
                console.warn('[initYouTube] Bad URL:', item.url)
                this.onVideoEnded()
                return
            }

            const mount = () => {
                if (this.currentItem?.url !== item.url) {
                    console.warn('[initYouTube] Item changed before mount — aborting')
                    return
                }

                console.log(`[initYouTube] Mounting for "${item.title}" | id: ${videoId}`)

                this.player = new YT.Player('yt-player', {
                    videoId,
                    playerVars: { autoplay: 1, origin: window.location.origin },
                    events: {
                        onReady: (e) => {
                            this.loading  = false
                            this.duration = Math.floor(e.target.getDuration())
                            console.log(`[YT onReady] "${item.title}" | duration: ${this.duration}s`)
                            this.startYouTubePolling()
                        },
                        onStateChange: (e) => {
                            const labels = { '-1':'unstarted', 0:'ended', 1:'playing', 2:'paused', 3:'buffering', 5:'cued' }
                            console.log(`[YT state] ${labels[e.data] || e.data}`)

                            if (e.data === YT.PlayerState.PLAYING && this.duration === 0) {
                                const dur = this.player?.getDuration?.()
                                if (dur > 0) {
                                    this.duration = Math.floor(dur)
                                    console.log(`[YT] Duration on PLAYING: ${this.duration}s`)
                                }
                            }

                            if (e.data === YT.PlayerState.ENDED) this.onVideoEnded()
                        }
                    }
                })
            }

            if (window.YT && window.YT.Player) {
                mount()
            } else {
                if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
                    const tag = document.createElement('script')
                    tag.src = 'https://www.youtube.com/iframe_api'
                    document.body.appendChild(tag)
                }
                window.onYouTubeIframeAPIReady = mount
            }
        },

        startYouTubePolling() {
            clearInterval(this.timePollingInterval)
            this.timePollingInterval = setInterval(() => {
                if (!this.player?.getCurrentTime) return
                this.currentTime = Math.floor(this.player.getCurrentTime())
                if (this.duration === 0) {
                    const dur = this.player.getDuration?.()
                    if (dur > 0) {
                        this.duration = Math.floor(dur)
                        console.log(`[YT polling] Got duration: ${this.duration}s`)
                    }
                }
            }, 500)
        },

        // ── Direct Video ───────────────────────────────────────────
        loadDirectVideo(item) {
            const v = this.$refs.nativePlayer
            if (!v) {
                console.warn('[loadDirectVideo] nativePlayer ref not found')
                return
            }

            console.log(`[loadDirectVideo] Loading: ${item.url}`)

            v.src = item.url
            v.load()

            v.play()
                .then(() => {
                    console.log(`[loadDirectVideo] Playing: "${item.title}"`)
                    this.loading = false
                })
                .catch(err => {
                    console.warn('[loadDirectVideo] Autoplay blocked:', err)
                    this.loading = false
                })
        },

        // ── Native Video Events ────────────────────────────────────
        onNativeTimeUpdate() {
            const v = this.$refs.nativePlayer
            if (v) this.currentTime = Math.floor(v.currentTime)
        },

        onNativeMetadata() {
            const v = this.$refs.nativePlayer
            if (v) {
                this.duration = Math.floor(v.duration)
                this.loading  = false
                console.log(`[Native onMetadata] "${this.currentItem?.title}" | duration: ${this.duration}s`)
            }
        },

        onNativeError() {
            const v    = this.$refs.nativePlayer
            const code = v?.error?.code
            console.error(`[Native error] code: ${code} | url: ${this.currentItem?.url}`)
            setTimeout(() => this.onVideoEnded(), 3000)
        },

        // ── Helpers ───────────────────────────────────────────────
        extractYouTubeId(url) {
            if (!url) return null
            const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^?&]+)/)
            return m ? m[1] : null
        },

        formatTime(sec) {
            const s = Math.floor(sec)
            const m = Math.floor(s / 60)
            const h = Math.floor(m / 60)
            if (h > 0) return `${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'00')}:${String(s%60).padStart(2,'0')}`
            return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
        },

        startRefreshInterval() {
            this.refreshTimer = setInterval(() => {
                console.log(`[Refresh] ${this.queue.length} item(s) | now: "${this.currentItem?.title}"`)
            }, 60 * 60 * 1000)
        }
    }
}
</script>

<style scoped>
@font-face {
    font-family: 'AllrounderMonumentTest-Medium';
    src: url(./public/assets/AllrounderMonumentTest-Medium.otf) format('opentype');
    font-weight: normal;
    font-style: normal;
}

.logoHeader {
    flex-direction: column;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 9px;
    border-bottom: 1px solid #e0e0e0;
}

.videoPlayer {
    flex-grow: 1;
    background: #000;
    position: relative;
    overflow: hidden;
}

.nowPlaying {
    position: absolute;
    bottom: 10px;
    left: 12px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.75rem;
}

.loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
}

.logo {
    width: 50px;
}

.textLogo {
    font-family: 'AllrounderMonumentTest-Medium', sans-serif;
    color: #00611E;
}

.textDesc {
    font-family: 'AllrounderMonumentTest-Medium', sans-serif;
    color: #00611E;
    font-size: 7px;
    letter-spacing: 0.1em;
    word-spacing: 2em;
    text-transform: uppercase;
}

.dtBar {
    font-family: 'DM Sans', sans-serif;
    font-weight: 700;
    background: #00611E;
    color: #fff;
    padding: 20px 20px;
    display: flex;
    align-items: normal;
    letter-spacing: 0.30em;
    justify-content: space-between;
}

.dateStatus {
    margin: 0;
    font-size: 0.9rem;
    letter-spacing: 1px;
}

.time {
    margin: 0;
    font-size: 2rem;
    line-height: 1.1;
}
</style>