<template>
    <div class="announcement-container">

        <!-- ── Monthly Poster  ────────────────────── -->
        <div class="poster-section">
            <img v-if="splashImage" :src="splashImage" class="poster-image" />
            <!-- Fallback placeholder if no image -->
            <div v-else class="poster-fallback">
                <p class="fallback-text">No poster available</p>
            </div>
        </div>

        <!-- ── Divider ────────────────────────────────────────────────────────── -->
        <div class="section-divider"></div>

        <!-- ── Announcements Label ────────────────────────────────────────────── -->
        <div class="label-wrapper">
            <p class="main-title">ANNOUNCEMENTS</p>
        </div>

        <!-- ── Announcements List (scrolls if overflow) ───────────────────────── -->
        <div ref="scrollWrapper" class="scroll-wrapper">

            <div ref="scrollContent" :class="shouldScroll ? 'scroll-track' : ''">

                <!-- Panel 1 -->
                <div ref="panel" class="scroll-panel">

                    <div v-if="weeklyAnnouncement.length">
                        <div v-for="(day, index) in weeklyAnnouncement" :key="index" class="day-group">
                            <p v-if="day.day" class="day-label">{{ day.day }}</p>
                            <template v-if="day.events && day.events.length">
                                <div v-for="(event, eIndex) in day.events" :key="eIndex" class="schedule-item">
                                    <p class="event-title">{{ event.title }}</p>
                                    <p class="event-content">{{ event.content }}</p>
                                </div>
                            </template>
                            <div v-else>
                                <p class="no-events-text">No events</p>
                            </div>
                        </div>
                    </div>

                    <div v-else>
                        <p class="empty-state-text">No announcements available.</p>
                    </div>

                    <div v-if="upcomingEvents.length" class="upcoming-section">
                        <p class="upcoming-title">Upcoming Events</p>
                        <div v-for="(event, index) in upcomingEvents" :key="index" class="schedule-item">
                            <p class="event-title">{{ event.title }}</p>
                            <p class="event-content">{{ event.content }}</p>
                        </div>
                    </div>

                </div>

                <!-- Panel 2 — duplicate for seamless loop -->
                <div v-if="shouldScroll" class="scroll-panel" aria-hidden="true">
                    <div v-if="weeklyAnnouncement.length">
                        <div v-for="(day, index) in weeklyAnnouncement" :key="index" class="day-group">
                            <p v-if="day.day" class="day-label">{{ day.day }}</p>
                            <template v-if="day.events && day.events.length">
                                <div v-for="(event, eIndex) in day.events" :key="eIndex" class="schedule-item">
                                    <p class="event-title">{{ event.title }}</p>
                                    <p class="event-content">{{ event.content }}</p>
                                </div>
                            </template>
                            <div v-else>
                                <p class="no-events-text">No events</p>
                            </div>
                        </div>
                    </div>

                    <div v-else>
                        <p class="empty-state-text">No announcements available.</p>
                    </div>

                    <div v-if="upcomingEvents.length" class="upcoming-section">
                        <p class="upcoming-title">Upcoming Events</p>
                        <div v-for="(event, index) in upcomingEvents" :key="index" class="schedule-item">
                            <p class="event-title">{{ event.title }}</p>
                            <p class="event-content">{{ event.content }}</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>

    </div>
</template>

<script>
export default {
    name: 'Announcement',

    props: {
        announcementList: {
            type: Array,
            default: () => []
        },
        splashImage: {
            type: String,
            default: null
        }
    },

    data() {
        return {
            upcomingEvents: [],
            shouldScroll: false,
        }
    },

    computed: {
        weeklyAnnouncement() {
            console.log('[Announcement] announcementList received:', this.announcementList)

            if (!this.announcementList.length) {
                console.log('[Announcement] Empty — showing empty state')
                return []
            }

            return this.announcementList.map(item => {
                console.log('[Announcement] raw schedule value:', item.schedule)
                const date = new Date(item.schedule)
                const isValidDate = item.schedule && !isNaN(date.getTime())

                return {
                    day: isValidDate
                        ? date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        })
                        : null,
                    events: [{ title: item.title, content: item.content }]
                }
            })
        },
    },

    watch: {
        weeklyAnnouncement() {
            this.$nextTick(() => this.checkOverflow())
        }
    },

    mounted() {
        this.$nextTick(() => this.checkOverflow())
    },

    methods: {
        checkOverflow() {
            const wrapper = this.$refs.scrollWrapper
            const panel = this.$refs.panel

            if (!wrapper || !panel) {
                console.warn('[Overflow Check] refs not ready')
                return
            }

            const wrapperHeight = wrapper.clientHeight
            const panelHeight = panel.scrollHeight

            this.shouldScroll = panelHeight > wrapperHeight
            console.log(`[Overflow Check] panel: ${panelHeight}px | wrapper: ${wrapperHeight}px | shouldScroll: ${this.shouldScroll}`)
        }
    }
}
</script>

<style scoped>
/* Main Container */
.announcement-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #fff;
    overflow: hidden;
}

/* Poster Section */
.poster-section {
    flex-shrink: 0;
    background: #fff;
}

.poster-image {
    width: 100%;
    height: 100%;
    max-height: 55vh;
    object-position: top;
}

.poster-fallback {
    height: 55vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
}

.fallback-text {
    color: #aaa;
    font-size: 0.9rem;
}

/* UI Elements */
.section-divider {
    height: 2px;
    background: #e0e0e0;
    flex-shrink: 0;
}

.label-wrapper {
    flex-shrink: 0;
    padding: 10px 16px 4px;
}

.main-title {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 800;
    color: #00611e;
    /* BMA Green */
    letter-spacing: 1px;
}

/* Scroller Logic */
.scroll-wrapper {
    flex-grow: 1;
    overflow: hidden;
    position: relative;
    padding: 0 16px;
}

.scroll-panel {
    /* Ensuring panels are consistent for the loop */
    display: block;
}

/* Content Styling */
.day-group {
    margin-bottom: 12px;
}

.day-label {
    margin: 0 0 4px;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 1px;
    color: #555;
    text-transform: uppercase;
}

.schedule-item {
    margin-bottom: 8px;
    /* Added slight spacing between event blocks */
}

.event-title {
    margin: 0;
    font-weight: 600;
    color: #1a1a1a;
    font-size: 0.9rem;
}

.event-content {
    margin: 0;
    color: #444;
    font-size: 0.82rem;
}

.no-events-text,
.empty-state-text {
    margin: 0;
    font-size: 0.82rem;
    color: #888;
}

/* Upcoming Events Section */
.upcoming-section {
    margin-top: 8px;
}

.upcoming-title {
    margin: 0 0 6px;
    font-size: 1.2rem;
    font-weight: 800;
    color: #1a1a1a;
}

.schedule-item {
    background-color: #f9f9f9;
    border-left: 3px solid #00611E;
    padding: 6px 10px;
    margin-bottom: 6px;
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.scroll-track {
    display: flex;
    flex-direction: column;
    animation: loopScroll 30s linear infinite;
}

.scroll-panel {
    width: 100%;
    flex-shrink: 0;
}

@keyframes loopScroll {
    0% {
        transform: translateY(0);
    }

    100% {
        transform: translateY(-50%);
    }
}
</style>