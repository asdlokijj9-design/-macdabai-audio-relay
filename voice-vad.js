/**
 * Mac大白 VAD语音活动检测器
 * Voice Activity Detection - 自动检测说话开始/结束
 */

class VADDetector {
    constructor(options = {}) {
        // 配置
        this.silenceThreshold = options.silenceThreshold || 20;  // 静默阈值 (0-255)
        this.silenceDuration = options.silenceDuration || 1.5;  // 静默超时(秒)
        this.minSpeechDuration = options.minSpeechDuration || 0.3; // 最短语音(秒)
        
        // 状态
        this.isListening = false;
        this.isSpeaking = false;
        this.speechStartTime = null;
        this.lastSpeechTime = null;
        this.audioContext = null;
        this.analyser = null;
        this.stream = null;
        this.animationFrame = null;
        
        // 回调
        this.onSpeechStart = options.onSpeechStart || (() => {});
        this.onSpeechEnd = options.onSpeechEnd || ((text) => {});
        this.onVolumeChange = options.onVolumeChange || ((vol) => {});
        this.onError = options.onError || ((err) => console.error(err));
    }
    
    async start() {
        try {
            // 获取麦克风权限
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            // 创建音频上下文
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.stream);
            
            // 创建分析器
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            
            // 状态
            this.isListening = true;
            this.isSpeaking = false;
            this.speechStartTime = null;
            this.lastSpeechTime = null;
            
            // 开始检测循环
            this.detectLoop();
            
            console.log('🎤 VAD检测器已启动');
            return true;
            
        } catch (err) {
            this.onError(err);
            return false;
        }
    }
    
    stop() {
        this.isListening = false;
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        console.log('🛑 VAD检测器已停止');
    }
    
    detectLoop() {
        if (!this.isListening) return;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        
        // 计算平均音量
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const volume = sum / dataArray.length;
        
        // 回调音量变化
        this.onVolumeChange(volume);
        
        const now = Date.now();
        
        // 检测到语音
        if (volume > this.silenceThreshold) {
            if (!this.isSpeaking) {
                // 说话开始
                this.isSpeaking = true;
                this.speechStartTime = now;
                this.onSpeechStart();
                console.log('🗣️ 检测到说话开始');
            }
            this.lastSpeechTime = now;
        } else {
            // 静默中
            if (this.isSpeaking) {
                const speechDuration = (now - this.lastSpeechTime) / 1000;
                
                // 检查是否真的结束了
                if (speechDuration >= this.minSpeechDuration) {
                    // 说话结束检测中...
                    // 等待silenceDuration秒确认结束
                    setTimeout(() => {
                        // 再次检查音量
                        if (!this.isSpeaking) return; // 已经在说话了
                        
                        const currentVol = this.getCurrentVolume();
                        if (currentVol <= this.silenceThreshold) {
                            this.isSpeaking = false;
                            const finalDuration = (now - this.speechStartTime) / 1000;
                            console.log(`🗣️ 检测到说话结束 (${finalDuration.toFixed(1)}秒)`);
                            this.onSpeechEnd();
                        }
                    }, this.silenceDuration * 1000);
                }
            }
        }
        
        // 继续循环
        this.animationFrame = requestAnimationFrame(() => this.detectLoop());
    }
    
    getCurrentVolume() {
        if (!this.analyser) return 0;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        return sum / dataArray.length;
    }
    
    // 调整灵敏度
    setSensitivity(threshold, duration) {
        this.silenceThreshold = threshold;
        this.silenceDuration = duration;
        console.log(`🎚️ VAD灵敏度已调整: 阈值=${threshold}, 静默=${duration}s`);
    }
}

// 导出
window.VADDetector = VADDetector;
