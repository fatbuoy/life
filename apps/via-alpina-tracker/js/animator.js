export class Animator {
    constructor(mapManager, updateUICallback) {
        this.mapManager = mapManager;
        this.updateUICallback = updateUICallback;
        this.coordinates = [];
        this.stages = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.speed = 100;
        this.animationFrameId = null;
        
        // Dynamic playback timeline boundaries
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
        // Clamp current index within the new scope bounds
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

        // Scale frame step jumps cleanly using the speed slider values
        const step = Math.ceil(this.speed / 3);
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
        
        // Determine whether to use isolation mode rendering based on timeline boundary locks
        const isGlobalTimeline = (this.startBound === 0 && this.endBound === this.coordinates.length - 1);
        const isolationIndex = isGlobalTimeline ? null : this.stages.indexOf(activeStage);

        this.mapManager.updatePlayback(index, this.stages, this.coordinates[index], isolationIndex);
        this.updateUICallback(index, this.coordinates.length, activeStage);
    }
}