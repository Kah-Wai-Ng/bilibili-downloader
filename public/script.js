// Global state management
class BilibiliDownloader {
    constructor() {
        this.videoInfo = null;
        this.isInteractiveVideo = false;
        this.branches = [];
        this.selectedBranches = [];
        this.selectedQuality = 80;
        this.downloads = new Map();
        this.socket = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.initWebSocket();
    }

    bindEvents() {
        // Parse button
        document.getElementById('parse-btn').addEventListener('click', () => {
            this.parseVideo();
        });

        // Enter key in URL input
        document.getElementById('video-url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.parseVideo();
            }
        });

        // Quality selection
        document.querySelectorAll('input[name="quality"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.selectedQuality = parseInt(e.target.value);
            });
        });

        // Branch selection buttons
        document.getElementById('select-all-branches').addEventListener('click', () => {
            this.selectAllBranches(true);
        });

        document.getElementById('clear-all-branches').addEventListener('click', () => {
            this.selectAllBranches(false);
        });

        // Download button
        document.getElementById('download-btn').addEventListener('click', () => {
            this.startDownload();
        });

        // Error modal close
        document.getElementById('close-error').addEventListener('click', () => {
            this.hideError();
        });

        // Click outside error modal to close
        document.getElementById('error-container').addEventListener('click', (e) => {
            if (e.target.id === 'error-container') {
                this.hideError();
            }
        });
    }

    initWebSocket() {
        // Only initialize WebSocket if running on server
        if (window.location.protocol !== 'file:') {
            try {
                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${wsProtocol}//${window.location.host}`;
                this.socket = new WebSocket(wsUrl);
                
                this.socket.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                };

                this.socket.onerror = (error) => {
                    console.warn('WebSocket connection failed, falling back to polling:', error);
                };
            } catch (error) {
                console.warn('WebSocket not available, running in standalone mode');
            }
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'progress':
                this.updateProgress(data.id, data.progress, data.status, data.details);
                break;
            case 'complete':
                this.updateProgress(data.id, 100, 'completed', data.details);
                break;
            case 'error':
                this.updateProgress(data.id, 0, 'error', data.details);
                break;
        }
    }

    async parseVideo() {
        const url = document.getElementById('video-url').value.trim();
        if (!url) {
            this.showError('請輸入有效的 Bilibili 視頻鏈接');
            return;
        }

        this.showLoading('正在解析視頻...');

        try {
            // Extract video ID from URL
            const videoId = this.extractVideoId(url);
            if (!videoId) {
                throw new Error('無法識別的視頻鏈接格式');
            }

            // Check if running in server mode or standalone mode
            if (window.location.protocol === 'file:' || !this.isServerMode()) {
                // Standalone mode - show demo data
                this.showDemoData(videoId);
            } else {
                // Server mode - make API request
                const response = await fetch('/api/parse', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url: videoId })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                this.handleParseResult(data);
            }
        } catch (error) {
            console.error('Parse error:', error);
            this.showError(`解析失敗: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    isServerMode() {
        // Check if we can access server endpoints
        return window.location.hostname !== '' && 
               window.location.protocol !== 'file:' &&
               window.location.port !== '';
    }

    extractVideoId(url) {
        // Extract BV号或av号 from various URL formats
        const patterns = [
            /(?:BV)([a-zA-Z0-9]+)/,
            /(?:av)(\d+)/,
            /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/,
            /bilibili\.com\/video\/(av\d+)/,
            /b23\.tv\/(\w+)/,
            /^(BV[a-zA-Z0-9]+)$/,
            /^(av\d+)$/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1] ? (pattern.source.includes('BV') ? 'BV' + match[1] : match[1]) : match[0];
            }
        }

        return null;
    }

    showDemoData(videoId) {
        // Show demo data for standalone mode
        const isInteractive = Math.random() > 0.5; // Randomly determine if interactive
        
        this.videoInfo = {
            title: '【互動視頻】命運石之門 - 多重結局探索',
            author: '示例UP主',
            description: '這是一個示例互動視頻，展示了本工具的完整功能。實際使用時需要連接到服務器端。',
            cover: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuekuuS+i+WbvueJhzwvdGV4dD48L3N2Zz4=',
            duration: '45:32',
            view: '123,456',
            like: '9,876',
            reply: '543',
            is_stein_gate: isInteractive
        };

        this.isInteractiveVideo = isInteractive;

        if (isInteractive) {
            this.branches = [
                {
                    id: 'branch_1',
                    title: '選擇1：調查真相',
                    description: '深入調查實驗室的秘密',
                    cid: '12345678'
                },
                {
                    id: 'branch_2', 
                    title: '選擇2：保護朋友',
                    description: '選擇保護身邊的人',
                    cid: '12345679'
                },
                {
                    id: 'branch_3',
                    title: '隱藏分支：真正結局',
                    description: '只有特定條件下才能解鎖的隱藏結局',
                    cid: '12345680'
                }
            ];
        }

        this.displayVideoInfo();
        this.displayQualityOptions();
        
        if (this.isInteractiveVideo) {
            this.displayBranches();
        }
        
        this.displayDownloadSection();
    }

    async handleParseResult(data) {
        this.videoInfo = data.videoInfo;
        this.isInteractiveVideo = data.isInteractiveVideo;
        this.branches = data.branches || [];

        this.displayVideoInfo();
        this.displayQualityOptions();
        
        if (this.isInteractiveVideo) {
            this.displayBranches();
            this.displayDiscoveryStats(data.discovery);
        }
        
        this.displayDownloadSection();
    }

    displayDiscoveryStats(discovery) {
        if (!discovery) return;
        
        const interactiveNotice = document.getElementById('interactive-notice');
        const noticeContent = interactiveNotice.querySelector('.notice-content p');
        
        noticeContent.innerHTML = `
            此視頻包含<strong>${discovery.totalBranches}</strong>個分支片段，包括：<br>
            • 主要分支：${discovery.mainBranches}個<br>
            • 隱藏分支：${discovery.hiddenBranches}個<br>
            • 最大深度：${discovery.maxDepth}層<br>
            我們已為您解析所有可用的分支路徑和隱藏內容。
        `;
    }

    displayVideoInfo() {
        if (!this.videoInfo) return;

        const section = document.getElementById('video-info');
        const interactiveNotice = document.getElementById('interactive-notice');

        // Update video info
        document.getElementById('video-cover').src = this.videoInfo.cover;
        document.getElementById('video-title').textContent = this.videoInfo.title;
        document.getElementById('video-author').textContent = this.videoInfo.author;
        document.getElementById('video-desc').textContent = this.videoInfo.description;
        document.getElementById('video-duration').textContent = this.videoInfo.duration;
        document.getElementById('video-view').textContent = this.videoInfo.view;
        document.getElementById('video-like').textContent = this.videoInfo.like;
        document.getElementById('video-reply').textContent = this.videoInfo.reply;

        // Show interactive notice if applicable
        if (this.isInteractiveVideo) {
            interactiveNotice.classList.remove('hidden');
        } else {
            interactiveNotice.classList.add('hidden');
        }

        section.classList.remove('hidden');
    }

    displayQualityOptions() {
        document.getElementById('quality-section').classList.remove('hidden');
    }

    displayBranches() {
        const section = document.getElementById('branch-section');
        const branchList = document.getElementById('branch-list');
        const branchTotal = document.getElementById('branch-total');

        branchList.innerHTML = '';
        branchTotal.textContent = this.branches.length;

        // Group branches by type for better organization
        const mainBranches = this.branches.filter(b => !b.isHidden && !b.fromStoryAPI && !b.fromNodeAPI);
        const hiddenBranches = this.branches.filter(b => b.isHidden);
        const discoveredBranches = this.branches.filter(b => b.fromStoryAPI || b.fromNodeAPI);

        // Display main branches first
        if (mainBranches.length > 0) {
            this.addBranchGroup(branchList, '主要分支', mainBranches, 'main-branches');
        }

        // Display hidden branches
        if (hiddenBranches.length > 0) {
            this.addBranchGroup(branchList, '隱藏分支', hiddenBranches, 'hidden-branches');
        }

        // Display discovered branches from alternative APIs
        if (discoveredBranches.length > 0) {
            this.addBranchGroup(branchList, '發現的其他片段', discoveredBranches, 'discovered-branches');
        }

        // Add event listeners for branch checkboxes
        document.querySelectorAll('.branch-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSelectedBranches();
            });
        });

        section.classList.remove('hidden');
    }

    addBranchGroup(container, groupTitle, branches, groupClass) {
        const groupDiv = document.createElement('div');
        groupDiv.className = `branch-group ${groupClass}`;
        
        const groupHeader = document.createElement('h4');
        groupHeader.className = 'branch-group-title';
        groupHeader.textContent = `${groupTitle} (${branches.length})`;
        groupDiv.appendChild(groupHeader);

        branches.forEach(branch => {
            const branchItem = document.createElement('div');
            branchItem.className = 'branch-item';
            
            // Add path information for better context
            const pathInfo = branch.path && branch.path !== 'root' ? `<div class="branch-path">路徑: ${branch.path}</div>` : '';
            const depthInfo = branch.depth !== undefined ? `<span class="branch-depth">深度: ${branch.depth}</span>` : '';
            const cidInfo = `<span class="branch-cid">CID: ${branch.cid}</span>`;
            const conditionInfo = branch.condition ? `<div class="branch-condition">條件: ${branch.condition}</div>` : '';
            
            branchItem.innerHTML = `
                <label>
                    <input type="checkbox" value="${branch.id}" class="branch-checkbox">
                    <div>
                        <div class="branch-title">
                            ${branch.title}
                            ${branch.isHidden ? '<span class="hidden-badge">隱藏</span>' : ''}
                            ${branch.isMain ? '<span class="main-badge">主線</span>' : ''}
                        </div>
                        <div class="branch-desc">${branch.description}</div>
                        ${pathInfo}
                        <div class="branch-meta">
                            ${depthInfo}
                            ${cidInfo}
                        </div>
                        ${conditionInfo}
                    </div>
                </label>
            `;

            groupDiv.appendChild(branchItem);
        });

        container.appendChild(groupDiv);
    }

    updateSelectedBranches() {
        const checked = document.querySelectorAll('.branch-checkbox:checked');
        this.selectedBranches = Array.from(checked).map(cb => cb.value);
    }

    selectAllBranches(select) {
        document.querySelectorAll('.branch-checkbox').forEach(checkbox => {
            checkbox.checked = select;
        });
        this.updateSelectedBranches();
    }

    displayDownloadSection() {
        document.getElementById('download-section').classList.remove('hidden');
    }

    async startDownload() {
        const mergeAudio = document.getElementById('merge-audio').checked;
        const downloadSubtitle = document.getElementById('download-subtitle').checked;

        if (this.isInteractiveVideo && this.selectedBranches.length === 0) {
            this.showError('請至少選擇一個分支進行下載');
            return;
        }

        // Prepare download data
        const downloadData = {
            videoInfo: this.videoInfo,
            quality: this.selectedQuality,
            branches: this.isInteractiveVideo ? this.selectedBranches : ['main'],
            options: {
                mergeAudio,
                downloadSubtitle
            }
        };

        // Show progress container
        document.getElementById('progress-container').classList.remove('hidden');

        if (window.location.protocol === 'file:' || !this.isServerMode()) {
            // Standalone mode - show demo progress
            this.simulateDownload(downloadData);
        } else {
            // Server mode - start actual download
            try {
                const response = await fetch('/api/download', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(downloadData)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                this.handleDownloadStart(result);
            } catch (error) {
                console.error('Download error:', error);
                this.showError(`下載失敗: ${error.message}`);
            }
        }
    }

    simulateDownload(downloadData) {
        const branches = downloadData.branches;
        const progressList = document.getElementById('progress-list');
        
        branches.forEach((branchId, index) => {
            const branchInfo = this.branches.find(b => b.id === branchId) || { title: '主視頻', description: '單分支視頻' };
            const progressId = `demo_${branchId}_${Date.now()}`;
            
            // Create progress item
            this.createProgressItem(progressId, branchInfo.title, branchInfo.description);
            
            // Simulate download progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    this.updateProgress(progressId, 100, 'completed', {
                        filename: `${branchInfo.title}.mp4`,
                        size: '256.7 MB',
                        speed: '完成'
                    });
                } else {
                    this.updateProgress(progressId, Math.floor(progress), 'downloading', {
                        filename: `${branchInfo.title}.mp4`,
                        size: `${Math.floor(progress * 2.567)} MB / 256.7 MB`,
                        speed: `${Math.floor(Math.random() * 5) + 2}.${Math.floor(Math.random() * 10)} MB/s`
                    });
                }
            }, 500 + index * 200);
        });
    }

    handleDownloadStart(result) {
        // Handle successful download start from server
        result.downloads.forEach(download => {
            this.createProgressItem(download.id, download.title, download.description);
        });
    }

    createProgressItem(id, title, description) {
        const progressList = document.getElementById('progress-list');
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.id = `progress-${id}`;
        progressItem.innerHTML = `
            <div class="progress-header">
                <div class="progress-title">${title}</div>
                <div class="progress-status downloading">下載中</div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-details">
                <span class="progress-filename">${description}</span>
                <span class="progress-speed">準備中...</span>
            </div>
        `;
        
        progressList.appendChild(progressItem);
        this.downloads.set(id, { element: progressItem, title, description });
    }

    updateProgress(id, progress, status, details) {
        const download = this.downloads.get(id);
        if (!download) return;

        const element = download.element;
        const progressFill = element.querySelector('.progress-fill');
        const progressStatus = element.querySelector('.progress-status');
        const progressFilename = element.querySelector('.progress-filename');
        const progressSpeed = element.querySelector('.progress-speed');

        // Update progress bar
        progressFill.style.width = `${progress}%`;

        // Update status
        progressStatus.className = `progress-status ${status}`;
        switch (status) {
            case 'downloading':
                progressStatus.textContent = '下載中';
                break;
            case 'completed':
                progressStatus.textContent = '已完成';
                break;
            case 'error':
                progressStatus.textContent = '錯誤';
                break;
        }

        // Update details
        if (details) {
            if (details.filename) {
                progressFilename.textContent = details.filename;
            }
            if (details.speed) {
                progressSpeed.textContent = details.speed;
            }
            if (details.size) {
                progressSpeed.textContent = `${details.speed} - ${details.size}`;
            }
        }
    }

    showLoading(text) {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        loadingText.textContent = text;
        overlay.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    showError(message) {
        const container = document.getElementById('error-container');
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = message;
        container.classList.remove('hidden');
    }

    hideError() {
        document.getElementById('error-container').classList.add('hidden');
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.downloader = new BilibiliDownloader();
    
    // Add some helpful console messages
    console.log('🎬 Bilibili 視頻下載器已初始化');
    
    if (window.location.protocol === 'file:') {
        console.log('📁 正在以獨立模式運行（僅演示功能）');
        console.log('🚀 要使用完整功能，請運行 Node.js 服務器版本');
    } else {
        console.log('🌐 正在以服務器模式運行');
    }
});