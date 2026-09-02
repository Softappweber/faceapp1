class FaceForgeApp {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.originalImage = null;
        this.processedImage = null;
        this.currentTransform = null;
        this.intensity = 50;
        this.currentModel = 'auto';
        this.history = [];
        this.faceDetected = false;
        this.faceData = null;
        
        this.initializeApp();
    }
    
    async initializeApp() {
        this.showLoadingScreen();
        await this.loadModels();
        this.hideLoadingScreen();
        this.initializeEventListeners();
        this.loadSavedSettings();
        this.loadHistory();
    }
    
    async loadModels() {
        try {
            // Initialize TensorFlow.js
            await tf.ready();
            await tf.setBackend('webgl');
            
            // Load face detection model
            this.updateLoadingStatus('Loading face detection model...');
            this.faceDetector = await this.loadFaceDetector();
            
            // Load face mesh
            this.updateLoadingStatus('Loading face mesh...');
            this.faceMesh = await this.loadFaceMesh();
            
            // Load transformation models
            this.updateLoadingStatus('Loading AI transformation models...');
            this.transformers = await this.loadTransformers();
            
            console.log('All models loaded successfully');
        } catch (error) {
            console.error('Error loading models:', error);
            alert('Failed to load AI models. Please check your internet connection and refresh.');
        }
    }
    
    async loadFaceDetector() {
        // Use MediaPipe Face Detection
        const faceDetection = new FaceDetection({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
            }
        });
        
        faceDetection.setOptions({
            model: 'short',
            minDetectionConfidence: 0.5
        });
        
        return faceDetection;
    }
    
    async loadFaceMesh() {
        // Use MediaPipe Face Mesh for detailed facial landmarks
        const faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        return faceMesh;
    }
    
    async loadTransformers() {
        const transformers = {};
        
        // Load StyleGAN3 model (if available)
        try {
            transformers.stylegan3 = await this.loadONNXModel('stylegan3-face-model.onnx');
        } catch (error) {
            console.warn('StyleGAN3 model not available:', error);
        }
        
        // Load GFPGAN for face restoration
        try {
            transformers.gfpgan = await this.loadONNXModel('gfpgan-face-restoration.onnx');
        } catch (error) {
            console.warn('GFPGAN model not available:', error);
        }
        
        return transformers;
    }
    
    async loadONNXModel(modelPath) {
        const session = await ort.InferenceSession.create(modelPath);
        return session;
    }
    
    initializeEventListeners() {
        // Upload handling
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        
        document.getElementById('fileInput').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.loadImage(e.target.files[0]);
            }
        });
        
        // Image overlay click
        document.getElementById('imageOverlay').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        
        // Drag and drop
        const imageContainer = document.getElementById('imageContainer');
        
        imageContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageContainer.style.borderColor = '#4ecdc4';
        });
        
        imageContainer.addEventListener('dragleave', () => {
            imageContainer.style.borderColor = '';
        });
        
        imageContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            imageContainer.style.borderColor = '';
            
            if (e.dataTransfer.files[0]) {
                this.loadImage(e.dataTransfer.files[0]);
            }
        });
        
        // Camera handling
        document.getElementById('cameraBtn').addEventListener('click', () => {
            this.openCamera();
        });
        
        document.getElementById('captureBtn').addEventListener('click', () => {
            this.capturePhoto();
        });
        
        document.getElementById('closeCameraBtn').addEventListener('click', () => {
            this.closeCamera();
        });
        
        // Transformation buttons
        document.querySelectorAll('.transform-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const transform = btn.dataset.transform;
                this.selectTransformation(transform);
            });
        });
        
        // Intensity slider
        document.getElementById('intensitySlider').addEventListener('input', (e) => {
            this.intensity = parseInt(e.target.value);
            document.getElementById('intensityValue').textContent = `${this.intensity}%`;
            
            if (this.processedImage) {
                this.applyTransformation();
            }
        });
        
        // Model selection
        document.getElementById('modelSelect').addEventListener('change', (e) => {
            this.currentModel = e.target.value;
        });
        
        // Apply button
        document.getElementById('applyBtn').addEventListener('click', () => {
            this.applyTransformation();
        });
        
        // Download
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadImage();
        });
        
        // Share
        document.getElementById('shareBtn').addEventListener('click', () => {
            this.shareImage();
        });
        
        // Save
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveToGallery();
        });
        
        // Reset
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetImage();
        });
        
        // Image controls
        document.getElementById('zoomInBtn').addEventListener('click', () => {
            this.zoomImage(1.2);
        });
        
        document.getElementById('zoomOutBtn').addEventListener('click', () => {
            this.zoomImage(0.8);
        });
        
        document.getElementById('rotateBtn').addEventListener('click', () => {
            this.rotateImage();
        });
        
        document.getElementById('flipBtn').addEventListener('click', () => {
            this.flipImage();
        });
        
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchView(btn.dataset.view);
            });
        });
        
        // Transformation tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchCategory(btn.dataset.category);
            });
        });
    }
    
    loadImage(file) {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            const img = new Image();
            
            img.onload = async () => {
                this.originalImage = img;
                this.canvas.width = img.width;
                this.canvas.height = img.height;
                this.ctx.drawImage(img, 0, 0);
                
                document.getElementById('imageOverlay').style.display = 'none';
                
                await this.detectFace();
                
                this.showNotification('Image loaded successfully!');
            };
            
            img.src = e.target.result;
        };
        
        reader.readAsDataURL(file);
    }
    
    async detectFace() {
        if (!this.faceDetector) return;
        
        try {
            const results = await this.faceDetector.send({image: this.canvas});
            
            if (results.detections && results.detections.length > 0) {
                this.faceDetected = true;
                this.faceData = results.detections[0];
                this.showFaceIndicator(this.faceData);
                this.showNotification('Face detected!');
            } else {
                this.faceDetected = false;
                this.faceData = null;
                document.getElementById('faceIndicator').style.display = 'none';
                this.showNotification('No face detected. Please try another photo.', 'warning');
            }
        } catch (error) {
            console.error('Face detection error:', error);
        }
    }
    
    showFaceIndicator(faceData) {
        const indicator = document.getElementById('faceIndicator');
        const bbox = faceData.boundingBox;
        
        indicator.style.display = 'block';
        indicator.style.left = `${bbox.xCenter - bbox.width / 2}px`;
        indicator.style.top = `${bbox.yCenter - bbox.height / 2}px`;
        indicator.style.width = `${bbox.width}px`;
        indicator.style.height = `${bbox.height}px`;
    }
    
    async applyTransformation() {
        if (!this.originalImage || !this.currentTransform) return;
        
        this.showProcessing();
        
        try {
            const startTime = performance.now();
            
            // Use different models based on selection
            const result = await this.processTransformation();
            
            const endTime = performance.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);
            
            this.processedImage = result;
            
            // Update canvas with result
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = result;
            
            // Save to history
            this.addToHistory(result, processingTime);
            
            this.hideProcessing();
            this.showNotification(`Transformation complete in ${processingTime}s!`);
            
        } catch (error) {
            console.error('Transformation error:', error);
            this.hideProcessing();
            this.showNotification('Error applying transformation. Please try again.', 'error');
        }
    }
    
    async processTransformation() {
        // Use Hugging Face API for actual AI transformation
        const apiService = new APIService();
        
        switch (this.currentTransform) {
            case 'young':
                return await apiService.applyStyleGAN(this.canvas, 'young');
            case 'old':
                return await apiService.applyStyleGAN(this.canvas, 'old');
            case 'smooth':
                return await apiService.applyGFPGAN(this.canvas);
            case 'anime':
                return await apiService.applyAnimeGAN(this.canvas);
            // Add more cases
            default:
                throw new Error('Unknown transformation');
        }
    }
    
    async openCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' }
            });
            
            const modal = document.getElementById('cameraModal');
            const video = document.getElementById('cameraVideo');
            
            video.srcObject = stream;
            modal.classList.add('active');
        } catch (error) {
            console.error('Camera error:', error);
            this.showNotification('Unable to access camera. Please check permissions.', 'error');
        }
    }
    
    capturePhoto() {
        const video = document.getElementById('cameraVideo');
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(video, 0, 0);
        
        const img = new Image();
        img.onload = async () => {
            this.originalImage = img;
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            this.ctx.drawImage(img, 0, 0);
            
            document.getElementById('imageOverlay').style.display = 'none';
            document.getElementById('cameraModal').classList.remove('active');
            
            await this.detectFace();
        };
        img.src = tempCanvas.toDataURL();
        
        // Stop camera stream
        const stream = video.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }
    
    closeCamera() {
        const modal = document.getElementById('cameraModal');
        const video = document.getElementById('cameraVideo');
        
        const stream = video.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        modal.classList.remove('active');
    }
    
    selectTransformation(transform) {
        this.currentTransform = transform;
        
        // Update UI
        document.querySelectorAll('.transform-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.transform === transform) {
                btn.classList.add('active');
            }
        });
        
        // Auto-apply if image is loaded
        if (this.originalImage) {
            this.applyTransformation();
        }
    }
    
    switchCategory(category) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            }
        });
        
        // Show selected category
        document.querySelectorAll('.transformation-grid').forEach(grid => {
            grid.style.display = 'none';
        });
        
        document.getElementById(`${category}Category`).style.display = 'grid';
    }
    
    switchView(view) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) {
                btn.classList.add('active');
            }
        });
        
        // Show selected view
        document.querySelectorAll('.view').forEach(v => {
            v.style.display = 'none';
        });
        
        document.getElementById(`${view}View`).style.display = 'block';
    }
    
    zoomImage(factor) {
        const currentWidth = this.canvas.style.width.replace('px', '');
        const currentHeight = this.canvas.style.height.replace('px', '');
        
        this.canvas.style.width = `${currentWidth * factor}px`;
        this.canvas.style.height = `${currentHeight * factor}px`;
    }
    
    rotateImage() {
        // Rotate canvas content
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.height;
        tempCanvas.height = this.canvas.width;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        tempCtx.rotate(Math.PI / 2);
        tempCtx.drawImage(this.canvas, -this.canvas.width / 2, -this.canvas.height / 2);
        
        this.canvas.width = tempCanvas.width;
        this.canvas.height = tempCanvas.height;
        this.ctx.drawImage(tempCanvas, 0, 0);
    }
    
    flipImage() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.translate(tempCanvas.width, 0);
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(this.canvas, 0, 0);
        
        this.ctx.drawImage(tempCanvas, 0, 0);
    }
    
    resetImage() {
        if (this.originalImage) {
            this.ctx.drawImage(this.originalImage, 0, 0);
            this.processedImage = null;
            this.currentTransform = null;
            
            document.querySelectorAll('.transform-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            this.showNotification('Image reset');
        }
    }
    
    downloadImage() {
        const link = document.createElement('a');
        link.download = `faceforge-${Date.now()}.png`;
        link.href = this.processedImage || this.canvas.toDataURL();
        link.click();
    }
    
    async shareImage() {
        if (!this.processedImage) return;
        
        try {
            if (navigator.share) {
                const blob = await (await fetch(this.processedImage)).blob();
                const file = new File([blob], 'faceforge.png', { type: 'image/png' });
                
                await navigator.share({
                    title: 'My Face Transformation',
                    files: [file]
                });
            } else {
                // Fallback to clipboard
                await navigator.clipboard.writeText(this.processedImage);
                this.showNotification('Image URL copied to clipboard!');
            }
        } catch (error) {
            console.error('Share error:', error);
        }
    }
    
    saveToGallery() {
        if (!this.processedImage) return;
        
        const gallery = JSON.parse(localStorage.getItem('faceforge-gallery') || '[]');
        gallery.push({
            id: Date.now(),
            image: this.processedImage,
            timestamp: new Date().toISOString(),
            transform: this.currentTransform
        });
        
        localStorage.setItem('faceforge-gallery', JSON.stringify(gallery));
        this.showNotification('Saved to gallery!');
    }
    
    addToHistory(imageData, processingTime) {
        this.history.unshift({
            image: imageData,
            time: processingTime,
            transform: this.currentTransform,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 20 items
        if (this.history.length > 20) {
            this.history.pop();
        }
        
        this.updateHistoryUI();
        
        // Save to localStorage
        if (this.settings.saveHistory) {
            localStorage.setItem('faceforge-history', JSON.stringify(this.history));
        }
    }
    
    updateHistoryUI() {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';
        
        this.history.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <img src="${item.image}" class="history-thumbnail" alt="History">
                <div>
                    <div>${item.transform || 'Transform'}</div>
                    <div style="font-size: 0.8em; color: #666;">${item.time}s ago</div>
                </div>
            `;
            
            historyItem.addEventListener('click', () => {
                const img = new Image();
                img.onload = () => {
                    this.ctx.drawImage(img, 0, 0);
                    this.processedImage = item.image;
                };
                img.src = item.image;
            });
            
            historyList.appendChild(historyItem);
        });
    }
    
    loadHistory() {
        const savedHistory = localStorage.getItem('faceforge-history');
        if (savedHistory) {
            this.history = JSON.parse(savedHistory);
            this.updateHistoryUI();
        }
    }
    
    loadSavedSettings() {
        this.settings = {
            defaultModel: localStorage.getItem('faceforge-model') || 'auto',
            quality: localStorage.getItem('faceforge-quality') || 'high',
            saveHistory: JSON.parse(localStorage.getItem('faceforge-save-history') || 'true')
        };
        
        document.getElementById('modelSelect').value = this.settings.defaultModel;
        document.getElementById('qualitySetting').value = this.settings.quality;
        document.getElementById('saveHistory').checked = this.settings.saveHistory;
    }
    
    showProcessing() {
        document.getElementById('processingOverlay').classList.add('active');
    }
    
    hideProcessing() {
        document.getElementById('processingOverlay').classList.remove('active');
    }
    
    showLoadingScreen() {
        document.getElementById('loadingScreen').style.display = 'flex';
    }
    
    hideLoadingScreen() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
    }
    
    updateLoadingStatus(message) {
        document.getElementById('loadingStatus').textContent = message;
        
        // Update progress bar
        const progressFill = document.getElementById('progressFill');
        const currentWidth = parseInt(progressFill.style.width || '0');
        const newWidth = Math.min(currentWidth + 25, 100);
        progressFill.style.width = `${newWidth}%`;
    }
    
    showNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new FaceForgeApp();
    window.app = app;
});
