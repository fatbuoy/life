export class Animator {
    constructor(mapManager, updateUICallback) {
        this.mapManager = mapManager;
        this.updateUICallback = updateUICallback;
        this.coordinates = [];
        this.stages = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.speed = 60; // Shifted default slider value center point
        this.animationFrameId = null;
        
        this.startBound = 0;
        this.endBound = 0;
    }

    setCoordinates(coordinates, stages) {
        this.coordinates = coordinates;
        this.stages = stages;
        this.currentIndex = 0;
        this.startBound = 0;
        this.endBound = coordinates.length - 1;
    }

    setSpeed(value) {
        this.speed = parseInt(value);
    }

    setBounds(start, end) {
        this.startBound = start;
        this.endBound = end;
        if (this.currentIndex < start || this.currentIndex > end) {
            this.currentIndex = start;
        }
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.animate();
    }

    pause() {
        this.isPlaying = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    stop() {
        this.pause();
        this.currentIndex = this.startBound;
        this.triggerUIUpdate(this.currentIndex);
    }

    animate() {
        if (!this.isPlaying) return;

        const isGlobalTimeline = (this.startBound === 0 && this.endBound === this.coordinates.length - 1);
        let step = 1;

        if (isGlobalTimeline) {
            /* Optimized Cinematic Scaling Vector:
               Ensures that at minimum slider configurations (10), playback steps coordinate-by-coordinate (1),
               producing a perfectly smooth crawl, while scaling smoothly upwards when adjusted right.
            */
            const normalizedProgress = (this.speed - 10) / 110; // Maps 0.0 to 1.0
            const maxGlobalStride = Math.max(4, Math.ceil(this.coordinates.length / 450));
            step = Math.max(1, Math.round(1 + (normalizedProgress * maxGlobalStride)));
        } else {
            // Contextual pacing rules optimized for focused individual stage replays
            step = Math.max(1, Math.round(this.speed / 25));
        }

        this.currentIndex += step;

        if (this.currentIndex >= this.endBound) {
            this.currentIndex = this.endBound;
            this.triggerUIUpdate(this.currentIndex);
            this.pause();
            return;
        }

        this.triggerUIUpdate(this.currentIndex);
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    triggerUIUpdate(index) {
        if (this.coordinates.length === 0) return;
        
        const activeStage = this.stages.find(s => index >= s.startIndex && index <= s.endIndex);
        const isGlobalTimeline = (this.startBound === 0 && this.endBound === this.coordinates.length - 1);
        const isolationIndex = isGlobalTimeline ? null : this.stages.indexOf(activeStage);

        this.mapManager.updatePlayback(index, this.stages, this.coordinates[index], isolationIndex);
        this.updateUICallback(index, this.coordinates.length, activeStage);
    }
}