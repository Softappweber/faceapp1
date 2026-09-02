class APIService {
    constructor() {
        // Hugging Face API (Free tier)
        this.huggingFaceToken = localStorage.getItem('hf_token') || 'YOUR_FREE_TOKEN_HERE';
        this.huggingFaceEndpoint = 'https://api-inference.huggingface.co/models';
        
        // Replicate API (Free tier)
        this.replicateToken = localStorage.getItem('replicate_token') || 'YOUR_FREE_TOKEN_HERE';
        this.replicateEndpoint = 'https://api.replicate.com/v1/predictions';
        
        // DeepAI API (Free tier)
        this.deepAIToken = localStorage.getItem('deepai_token') || 'YOUR_FREE_TOKEN_HERE';
        this.deepAIEndpoint = 'https://api.deepai.org/api';
    }
    
    async applyStyleGAN(imageCanvas, transform) {
        try {
            // Convert canvas to base64
            const imageData = imageCanvas.toDataURL('image/jpeg', 0.8);
            
            const response = await fetch(
                `${this.huggingFaceEndpoint}/NVlabs/stylegan3`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.huggingFaceToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: imageData,
                        parameters: {
                            transform: transform,
                        },
                    }),
                }
            );
            
            if (!response.ok) {
                throw new Error(`StyleGAN API error: ${response.status}`);
            }
            
            const result = await response.json();
            return result.output || result;
            
        } catch (error) {
            console.error('StyleGAN transformation failed:', error);
            
            // Fallback to basic transformation
            return this.applyBasicTransform(imageCanvas, transform);
        }
    }
    
    async applyGFPGAN(imageCanvas) {
        try {
            const imageData = imageCanvas.toDataURL('image/jpeg', 0.8);
            
            const response = await fetch(
                `${this.huggingFaceEndpoint}/TencentARC/GFPGANv1.4`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.huggingFaceToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: imageData,
                    }),
                }
            );
            
            if (!response.ok) {
                throw new Error(`GFPGAN API error: ${response.status}`);
            }
            
            const result = await response.json();
            return result.output || result;
            
        } catch (error) {
            console.error('GFPGAN transformation failed:', error);
            return this.applyBasicEnhancement(imageCanvas);
        }
    }
    
    async applyAnimeGAN(imageCanvas) {
        try {
            const imageData = imageCanvas.toDataURL('image/jpeg', 0.8);
            
            const response = await fetch(
                `${this.huggingFaceEndpoint}/akhaliq/AnimeGANv2`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.huggingFaceToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: imageData,
                    }),
                }
            );
            
            if (!response.ok) {
                throw new Error(`AnimeGAN API error: ${response.status}`);
            }
            
            const result = await response.json();
            return result.output || result;
            
        } catch (error) {
            console.error('AnimeGAN transformation failed:', error);
            return this.applyBasicStylization(imageCanvas);
        }
    }
    
    async applyReplicateModel(imageCanvas, modelName, version) {
        try {
            const imageData = imageCanvas.toDataURL('image/jpeg', 0.8);
            
            const response = await fetch(this.replicateEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${this.replicateToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    version: version,
                    input: {
                        image: imageData,
                    },
                }),
            });
            
            if (!response.ok) {
                throw new Error(`Replicate API error: ${response.status}`);
            }
            
            const prediction = await response.json();
            
            // Poll for result
            let result = prediction;
            while (result.status === 'processing' || result.status === 'starting') {
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const pollResponse = await fetch(
                    `${this.replicateEndpoint}/${prediction.id}`,
                    {
                        headers: {
                            'Authorization': `Token ${this.replicateToken}`,
                        },
                    }
                );
                
                result = await pollResponse.json();
            }
            
            if (result.status === 'succeeded') {
                return result.output;
            } else {
                throw new Error('Replicate processing failed');
            }
            
        } catch (error) {
            console.error('Replicate transformation failed:', error);
            throw error;
        }
    }
    
    applyBasicTransform(imageCanvas, transform) {
        // Fallback basic transformation using canvas operations
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageCanvas.width;
        tempCanvas.height = imageCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(imageCanvas, 0, 0);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        
        switch (transform) {
            case 'young':
                this.makeYounger(data);
                break;
            case 'old':
                this.makeOlder(data);
                break;
            case 'smooth':
                this.smoothSkin(data);
                break;
            default:
                break;
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        return tempCanvas.toDataURL();
    }
    
    makeYounger(data) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * 1.1);
            data[i + 1] = Math.min(255, data[i + 1] * 1.08);
            data[i + 2] = Math.min(255, data[i + 2] * 1.05);
        }
    }
    
    makeOlder(data) {
        for (let i = 0; i < data.length; i += 4) {
            const factor = (259 * (128 + 30)) / (128 * (259 - 30));
            data[i] = Math.min(255, factor * (data[i] - 128) + 128);
            data[i + 1] = Math.min(255, factor * (data[i + 1] - 128) + 128);
            data[i + 2] = Math.min(255, factor * (data[i + 2] - 128) + 128);
            
            // Slight desaturation
            const gray = 0.2989 * data[i] + 0.5870 * data[i + 1] + 0.1140 * data[i + 2];
            data[i] = data[i] * 0.85 + gray * 0.15;
            data[i + 1] = data[i + 1] * 0.85 + gray * 0.15;
            data[i + 2] = data[i + 2] * 0.85 + gray * 0.15;
        }
    }
    
    smoothSkin(data) {
        const tempData = new Uint8ClampedArray(data);
        
        for (let i = 4; i < data.length - 4; i += 4) {
            data[i] = (tempData[i - 4] + tempData[i] * 2 + tempData[i + 4]) / 4;
            data[i + 1] = (tempData[i - 3] + tempData[i + 1] * 2 + tempData[i + 5]) / 4;
            data[i + 2] = (tempData[i - 2] + tempData[i + 2] * 2 + tempData[i + 6]) / 4;
        }
    }
}
