<template>
    <div style="height:100vh; width:100%; background:#000; padding:12px; box-sizing:border-box;">
        <div style="height:100%; width:100%; border-radius:16px; overflow:hidden; position:relative;">

            <template v-if="!loading && currentFile">
                <div id="yt-player" style="height:100%; width:100%;"></div>
            </template>

            <template v-else>
                <div
                    style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#000;">
                    <p style="color:white;">Loading playlist...</p>
                </div>
            </template>

        </div>
    </div>
</template>

<script>
import api from '@/api.js'; // adjust path
export default {
    name: "VideoPlaylist",
    props: {
        playList: {
            type: Array,
            required: true,
            immediate: true,
            handler(newVal) {
                if (newVal && newVal.length > 0) {
                    this.$nextTick(() => {
                        this.loadYouTubeAPI()
                    })
                }
            }
        }
    },
    data() {
        return {
            currentVideoIndex: 0,
            player: null,
            loading: true,
            refreshTimer: null
        }
    },
    computed: {
        currentFile() {
            return this.playList[this.currentVideoIndex] || null
        }
    },
    mounted() {
        const savedIndex = localStorage.getItem("playIndex")
        if (savedIndex) {
            this.currentVideoIndex = Number(savedIndex)
        }

        this.startRefreshInterval()
    },
    beforeUnmount() {
        clearInterval(this.refreshTimer)
        if (this.player) {
            this.player.destroy()
        }
    },
    methods: {
        loadYouTubeAPI() {
            if (!this.playList || this.playList.length === 0) {
                console.warn("Playlist not ready yet.")
                return
            }

            if (window.YT && window.YT.Player) {
                this.initPlayer()
                return
            }

            const tag = document.createElement("script")
            tag.src = "https://www.youtube.com/iframe_api"
            document.body.appendChild(tag)

            window.onYouTubeIframeAPIReady = () => {
                this.initPlayer()
            }
        },
        initPlayer() {
            if (!this.currentFile || !this.currentFile.url) {
                console.warn("No valid video found.")
                return
            }

            const firstVideoId = this.extractVideoId(
                this.currentFile.url
            )

            if (!firstVideoId) {
                console.warn("Invalid YouTube URL.")
                return
            }

            this.player = new YT.Player("yt-player", {
                videoId: firstVideoId,
                playerVars: {
                    autoplay: 1,
                    mute: 1
                },
                events: {
                    onReady: () => {
                        this.loading = false
                    },
                    onStateChange: this.onPlayerStateChange
                }
            })
        },
        /* Makes the Youtube video to playnext */
        onPlayerStateChange(event) {
            if (event.data === YT.PlayerState.ENDED) {
                this.playNext()
            }
        },
        /* Helper Method that helps extract the link into link_id */
        extractVideoId(url) {
            if (!url) return null
            const regExp =
                /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^?&]+)/
            const match = url.match(regExp)
            return match ? match[1] : null
        },
        playNext() {
            this.currentVideoIndex =
                (this.currentVideoIndex + 1) % this.playList.length

            localStorage.setItem("playIndex", this.currentVideoIndex)

            const nextVideoId = this.extractVideoId(
                this.currentFile.url
            )

            if (this.player && nextVideoId) {
                this.player.loadVideoById(nextVideoId)
            }
        },
        startRefreshInterval() {
            const intervalMs = (60 * 60 * 1000) / (this.playList.length || 1)

            this.refreshTimer = setInterval(() => {
                console.log(`[Refresh] Playlist active — ${this.playList.length} videos`)
            }, intervalMs)
        }
    }
}
</script>