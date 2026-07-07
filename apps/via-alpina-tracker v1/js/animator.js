export class Animator {
    constructor(mapManager, onProgressUpdate) {
        this.mapManager = mapManager;
        this.onProgressUpdate = onProgressUpdate; // Callback to update UI text
        
        this.coordinates = [];
        this.stageMetadata = []; // Tracks index windows for each stage
        this.currentIndex = 0;
        this.isPlaying = false;
        this.speed = 10; // Default rendering speed tier
        this.animationFrameId = null;
    }

    /**
     * Initializes coordinates and tracks stage boundaries
     */
    setCoordinates(coords, stageMetadata) {
        this.coordinates = coords;
        this.stageMetadata = stageMetadata;
        this.currentIndex = 0;
        this.stop(); // Safely references the explicit stop() method below
    }

    /**
     * Starts the animation loop
     */
    start() {
        if (this.isPlaying || this.coordinates.length === 0) return;
        this.isPlaying = true;
        this.animate();
    }

    /**
     * Pauses the rendering cycle
     */
    pause() {
        this.isPlaying = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    }

    /**
     * Halts animation completely and rolls positions back to the baseline origin
     */
    stop() {
        this.pause();
        this.currentIndex = 0;
        this.resetMapVisuals();
    }

    /**
     * Sets playback speed modifier
     */
    setSpeed(value) {
        this.speed = parseInt(value, 10);
    }

    /**
     * Resets visual layers back to starting layout states
     */
    resetMapVisuals() {
        if (this.coordinates.length > 0) {
            this.mapManager.updatePlayback([this.coordinates[0]], this.coordinates[0]);
            this.triggerUIUpdate(0);
        }
    }

    /**
     * Core animation runner executing via requestAnimationFrame loops
     */
    animate() {
        if (!this.isPlaying) return;

        this.currentIndex += this.speed;

        if (this.currentIndex >= this.coordinates.length - 1) {
            this.currentIndex = this.coordinates.length - 1;
            this.isPlaying = false;
        }

        const currentPoint = this.coordinates[Math.floor(this.currentIndex)];
        const completedPath = this.coordinates.slice(0, Math.floor(this.currentIndex) + 1);

        this.mapManager.updatePlayback(completedPath, currentPoint);
        this.triggerUIUpdate(Math.floor(this.currentIndex));

        if (this.isPlaying) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
        }
    }

    /**
     * Contextual lookup mapping tracking streams into current step intervals
     */
    triggerUIUpdate(index) {
        const activeStage = this.stageMetadata.find(stage => 
            index >= stage.startIndex && index <= stage.endIndex
        ) || this.stageMetadata[0];

        this.onProgressUpdate(index, this.coordinates.length, activeStage);
    }
}