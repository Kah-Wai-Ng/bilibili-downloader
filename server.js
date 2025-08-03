const express = require('express');
const cors = require('cors');
const axios = require('axios');
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { URL } = require('url');

class BilibiliDownloader {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        this.downloads = new Map();
        this.clients = new Set();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.ensureDirectories();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.static('public'));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Serve main page
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Parse video API
        this.app.post('/api/parse', async (req, res) => {
            try {
                const { url } = req.body;
                console.log('Parsing video:', url);
                
                const result = await this.parseVideoInfo(url);
                res.json(result);
            } catch (error) {
                console.error('Parse error:', error);
                res.status(400).json({ 
                    error: error.message,
                    details: error.stack 
                });
            }
        });

        // Download API
        this.app.post('/api/download', async (req, res) => {
            try {
                const downloadData = req.body;
                console.log('Starting download:', downloadData);
                
                const result = await this.startDownload(downloadData);
                res.json(result);
            } catch (error) {
                console.error('Download error:', error);
                res.status(400).json({ 
                    error: error.message,
                    details: error.stack 
                });
            }
        });

        // Download progress API
        this.app.get('/api/progress/:id', (req, res) => {
            const downloadId = req.params.id;
            const download = this.downloads.get(downloadId);
            
            if (download) {
                res.json({
                    id: downloadId,
                    progress: download.progress,
                    status: download.status,
                    details: download.details
                });
            } else {
                res.status(404).json({ error: 'Download not found' });
            }
        });

        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                downloads: this.downloads.size
            });
        });

        // Error handler
        this.app.use((error, req, res, next) => {
            console.error('Server error:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message 
            });
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log('WebSocket client connected');
            this.clients.add(ws);
            
            ws.on('close', () => {
                console.log('WebSocket client disconnected');
                this.clients.delete(ws);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
    }

    broadcastProgress(data) {
        const message = JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                } catch (error) {
                    console.error('Failed to send WebSocket message:', error);
                    this.clients.delete(client);
                }
            }
        });
    }

    ensureDirectories() {
        const dirs = ['downloads', 'temp'];
        dirs.forEach(dir => {
            fs.ensureDirSync(path.join(__dirname, dir));
        });
    }

    async parseVideoInfo(videoId) {
        try {
            // Extract proper video ID
            const cleanId = this.extractVideoId(videoId);
            if (!cleanId) {
                throw new Error('Invalid video ID format');
            }

            // Get basic video info
            const videoInfo = await this.getVideoInfo(cleanId);
            
            // Check if it's an interactive video
            const isInteractiveVideo = videoInfo.is_stein_gate === 1;
            let branches = [];

            if (isInteractiveVideo) {
                branches = await this.getInteractiveBranches(videoInfo.bvid, videoInfo.cid);
            }

            return {
                videoInfo: {
                    title: videoInfo.title,
                    author: videoInfo.owner.name,
                    description: videoInfo.desc,
                    cover: videoInfo.pic,
                    duration: this.formatDuration(videoInfo.duration),
                    view: this.formatNumber(videoInfo.stat.view),
                    like: this.formatNumber(videoInfo.stat.like),
                    reply: this.formatNumber(videoInfo.stat.reply),
                    bvid: videoInfo.bvid,
                    aid: videoInfo.aid,
                    cid: videoInfo.cid,
                    is_stein_gate: isInteractiveVideo,
                    branches: branches // Include branches in videoInfo for frontend access
                },
                isInteractiveVideo,
                branches,
                branchCount: branches.length,
                discovery: {
                    totalBranches: branches.length,
                    mainBranches: branches.filter(b => !b.isHidden).length,
                    hiddenBranches: branches.filter(b => b.isHidden).length,
                    maxDepth: Math.max(...branches.map(b => b.depth || 0))
                }
            };
        } catch (error) {
            console.error('Parse video info error:', error);
            throw new Error(`Failed to parse video: ${error.message}`);
        }
    }

    async getVideoInfo(videoId) {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.bilibili.com',
            'Origin': 'https://www.bilibili.com'
        };

        let url;
        if (videoId.startsWith('BV')) {
            url = `https://api.bilibili.com/x/web-interface/view?bvid=${videoId}`;
        } else if (videoId.startsWith('av')) {
            const aid = videoId.substring(2);
            url = `https://api.bilibili.com/x/web-interface/view?aid=${aid}`;
        } else {
            throw new Error('Invalid video ID format');
        }

        console.log('Fetching video info from:', url);
        
        const response = await axios.get(url, { 
            headers,
            timeout: 10000
        });

        if (response.data.code !== 0) {
            throw new Error(`Bilibili API error: ${response.data.message}`);
        }

        const data = response.data.data;
        
        // Get the first page CID if not available
        if (!data.cid && data.pages && data.pages.length > 0) {
            data.cid = data.pages[0].cid;
        }

        return data;
    }

    async getInteractiveBranches(bvid, cid) {
        try {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.bilibili.com',
                'Origin': 'https://www.bilibili.com'
            };

            console.log(`Starting comprehensive branch discovery for bvid=${bvid}, root_cid=${cid}`);
            
            // Use comprehensive branch discovery
            const branches = await this.discoverAllBranches(bvid, cid, headers);
            
            console.log(`Discovered ${branches.length} total interactive branches`);
            return branches;
        } catch (error) {
            console.error('Error getting interactive branches:', error);
            return [];
        }
    }

    async discoverAllBranches(bvid, rootCid, headers) {
        const visitedCids = new Set();
        const allBranches = [];
        const cidQueue = [{ cid: rootCid, path: 'root', depth: 0 }];
        
        // Add main video as first branch
        allBranches.push({
            id: `main_${rootCid}`,
            title: '主線劇情',
            description: '默認播放的主線視頻',
            cid: rootCid,
            path: 'root',
            depth: 0,
            isMain: true
        });
        
        visitedCids.add(rootCid);
        
        while (cidQueue.length > 0 && visitedCids.size < 50) { // Limit to prevent infinite loops
            const { cid: currentCid, path: currentPath, depth } = cidQueue.shift();
            
            if (depth > 10) continue; // Prevent too deep recursion
            
            try {
                console.log(`Exploring CID ${currentCid} at depth ${depth}, path: ${currentPath}`);
                
                // Get edge info for current CID
                const edgeData = await this.getEdgeInfo(bvid, currentCid, headers);
                if (!edgeData) continue;
                
                // Process edges and questions
                const newBranches = this.processEdgeData(edgeData, currentPath, depth);
                
                for (const branch of newBranches) {
                    // Avoid duplicate branches
                    const existingBranch = allBranches.find(b => b.cid === branch.cid);
                    if (!existingBranch) {
                        allBranches.push(branch);
                        
                        // Add to queue for further exploration if not visited
                        if (!visitedCids.has(branch.cid)) {
                            visitedCids.add(branch.cid);
                            cidQueue.push({
                                cid: branch.cid,
                                path: `${currentPath} → ${branch.title}`,
                                depth: depth + 1
                            });
                        }
                    }
                }
                
                // Also try alternative API for this CID
                await this.exploreAlternativeAPIs(bvid, currentCid, headers, allBranches, visitedCids, currentPath, depth + 1);
                
            } catch (error) {
                console.warn(`Failed to explore CID ${currentCid}:`, error.message);
            }
            
            // Small delay to avoid rate limiting
            await this.delay(100);
        }
        
        // Try to get more branches using different methods
        await this.discoverHiddenSegments(bvid, headers, allBranches, visitedCids);
        
        return allBranches;
    }
    
    async getEdgeInfo(bvid, cid, headers) {
        try {
            const edgeUrl = `https://api.bilibili.com/x/stein/edgeinfo_v2?bvid=${bvid}&cid=${cid}`;
            const response = await axios.get(edgeUrl, { 
                headers,
                timeout: 8000
            });

            if (response.data.code !== 0) {
                console.warn(`Edge info failed for CID ${cid}:`, response.data.message);
                return null;
            }

            return response.data.data;
        } catch (error) {
            console.warn(`Error getting edge info for CID ${cid}:`, error.message);
            return null;
        }
    }
    
    processEdgeData(edgeData, currentPath, depth) {
        const branches = [];
        const edges = edgeData?.edges || [];
        
        // Process regular edges and questions
        for (const edge of edges) {
            if (edge.questions && edge.questions.length > 0) {
                for (const question of edge.questions) {
                    if (question.choices && question.choices.length > 0) {
                        for (const choice of question.choices) {
                            if (choice.cid) {
                                branches.push({
                                    id: `choice_${choice.id}_${choice.cid}`,
                                    title: choice.option || `選擇項 ${choice.id}`,
                                    description: `${question.title || '互動選擇'} - ${choice.option || '分支選項'}`,
                                    cid: choice.cid,
                                    path: currentPath,
                                    depth: depth + 1,
                                    condition: choice.condition || null,
                                    questionId: question.id,
                                    choiceId: choice.id
                                });
                            }
                        }
                    }
                }
            }
        }
        
        // Process hidden variables
        const hiddenVars = edgeData?.hidden_vars || [];
        for (const hiddenVar of hiddenVars) {
            if (hiddenVar.id_v2) {
                branches.push({
                    id: `hidden_${hiddenVar.id_v2}`,
                    title: `隱藏片段: ${hiddenVar.name || hiddenVar.id_v2}`,
                    description: '需要特定條件解鎖的隱藏內容',
                    cid: hiddenVar.id_v2,
                    path: currentPath,
                    depth: depth + 1,
                    condition: hiddenVar.condition || null,
                    isHidden: true,
                    hiddenVarId: hiddenVar.id_v2
                });
            }
        }
        
        return branches;
    }
    
    async exploreAlternativeAPIs(bvid, cid, headers, allBranches, visitedCids, currentPath, depth) {
        try {
            // Try getting story graph API
            const graphUrl = `https://api.bilibili.com/x/stein/nodeinfo?bvid=${bvid}&cid=${cid}`;
            const graphResponse = await axios.get(graphUrl, { 
                headers,
                timeout: 5000
            });
            
            if (graphResponse.data.code === 0 && graphResponse.data.data) {
                const nodeData = graphResponse.data.data;
                
                // Process node edges if available
                if (nodeData.edges && nodeData.edges.length > 0) {
                    for (const edge of nodeData.edges) {
                        if (edge.cid && !visitedCids.has(edge.cid)) {
                            visitedCids.add(edge.cid);
                            allBranches.push({
                                id: `node_${edge.cid}`,
                                title: edge.title || `節點分支 ${edge.cid}`,
                                description: edge.description || '從節點圖發現的分支',
                                cid: edge.cid,
                                path: `${currentPath} → 節點`,
                                depth: depth,
                                fromNodeAPI: true
                            });
                        }
                    }
                }
            }
        } catch (error) {
            // Silently fail for alternative APIs
            console.debug(`Alternative API exploration failed for CID ${cid}:`, error.message);
        }
    }
    
    async discoverHiddenSegments(bvid, headers, allBranches, visitedCids) {
        try {
            // Try to get the complete interactive video structure
            const storyUrl = `https://api.bilibili.com/x/stein/story?bvid=${bvid}`;
            const storyResponse = await axios.get(storyUrl, { 
                headers,
                timeout: 8000
            });
            
            if (storyResponse.data.code === 0 && storyResponse.data.data) {
                const storyData = storyResponse.data.data;
                
                // Extract any additional CIDs from story data
                if (storyData.story && storyData.story.nodes) {
                    for (const node of storyData.story.nodes) {
                        if (node.cid && !visitedCids.has(node.cid)) {
                            visitedCids.add(node.cid);
                            allBranches.push({
                                id: `story_${node.cid}`,
                                title: node.title || `故事節點 ${node.cid}`,
                                description: node.description || '從故事結構發現的片段',
                                cid: node.cid,
                                path: 'story',
                                depth: 0,
                                fromStoryAPI: true,
                                nodeId: node.node_id
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.debug('Story API exploration failed:', error.message);
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async startDownload(downloadData) {
        const { videoInfo, quality, branches, options } = downloadData;
        const downloads = [];

        for (const branchId of branches) {
            const downloadId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            let branchInfo;
            if (branchId === 'main') {
                branchInfo = {
                    title: videoInfo.title,
                    description: '主視頻',
                    cid: videoInfo.cid
                };
            } else {
                branchInfo = downloadData.videoInfo.branches?.find(b => b.id === branchId);
                if (!branchInfo) {
                    console.warn(`Branch ${branchId} not found, skipping`);
                    continue;
                }
            }

            const download = {
                id: downloadId,
                title: branchInfo.title,
                description: branchInfo.description,
                videoInfo: videoInfo,
                branchInfo: branchInfo,
                quality: quality,
                options: options,
                progress: 0,
                status: 'queued',
                details: {}
            };

            this.downloads.set(downloadId, download);
            downloads.push({
                id: downloadId,
                title: branchInfo.title,
                description: branchInfo.description
            });

            // Start download process asynchronously
            this.processDownload(downloadId).catch(error => {
                console.error(`Download ${downloadId} failed:`, error);
                this.updateDownloadStatus(downloadId, 0, 'error', { 
                    error: error.message 
                });
            });
        }

        return { downloads };
    }

    async processDownload(downloadId) {
        const download = this.downloads.get(downloadId);
        if (!download) return;

        try {
            this.updateDownloadStatus(downloadId, 0, 'downloading', {
                message: '正在獲取視頻流地址...'
            });

            // Get video stream URLs
            const streamData = await this.getVideoStream(
                download.videoInfo.bvid,
                download.branchInfo.cid,
                download.quality
            );

            this.updateDownloadStatus(downloadId, 10, 'downloading', {
                message: '開始下載視頻...'
            });

            // Download video and audio
            const filename = this.sanitizeFilename(download.title);
            const videoPath = await this.downloadFile(
                streamData.video.url, 
                `temp/${filename}_video.m4s`,
                downloadId,
                'video'
            );

            this.updateDownloadStatus(downloadId, 60, 'downloading', {
                message: '開始下載音頻...'
            });

            const audioPath = await this.downloadFile(
                streamData.audio.url,
                `temp/${filename}_audio.m4s`,
                downloadId,
                'audio'
            );

            if (download.options.mergeAudio) {
                this.updateDownloadStatus(downloadId, 80, 'downloading', {
                    message: '正在合併視頻和音頻...'
                });

                const outputPath = `downloads/${filename}.mp4`;
                await this.mergeVideoAudio(videoPath, audioPath, outputPath);

                // Clean up temporary files
                await fs.remove(videoPath);
                await fs.remove(audioPath);

                this.updateDownloadStatus(downloadId, 100, 'completed', {
                    filename: `${filename}.mp4`,
                    path: outputPath,
                    message: '下載完成！'
                });
            } else {
                this.updateDownloadStatus(downloadId, 100, 'completed', {
                    filename: `${filename}_video.m4s, ${filename}_audio.m4s`,
                    message: '下載完成！（未合併）'
                });
            }

        } catch (error) {
            console.error(`Download process error for ${downloadId}:`, error);
            this.updateDownloadStatus(downloadId, 0, 'error', {
                error: error.message
            });
        }
    }

    async getVideoStream(bvid, cid, quality) {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': `https://www.bilibili.com/video/${bvid}`,
            'Origin': 'https://www.bilibili.com',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };

        console.log(`Fetching stream for bvid=${bvid}, cid=${cid}, quality=${quality}`);
        
        // Try multiple approaches to get stream URL
        let streamData = null;
        
        // Approach 1: Standard playurl API with enhanced parameters
        try {
            streamData = await this.getStreamWithPlayurl(bvid, cid, quality, headers);
        } catch (error) {
            console.warn('Standard playurl API failed:', error.message);
        }
        
        // Approach 2: Try with different fnval parameters for interactive videos
        if (!streamData) {
            try {
                streamData = await this.getStreamWithEnhancedParams(bvid, cid, quality, headers);
            } catch (error) {
                console.warn('Enhanced params API failed:', error.message);
            }
        }
        
        // Approach 3: Try alternative API endpoint
        if (!streamData) {
            try {
                streamData = await this.getStreamWithAlternativeAPI(bvid, cid, quality, headers);
            } catch (error) {
                console.warn('Alternative API failed:', error.message);
            }
        }
        
        if (!streamData) {
            throw new Error('Unable to get video stream from any API endpoint');
        }
        
        return streamData;
    }
    
    async getStreamWithPlayurl(bvid, cid, quality, headers) {
        const params = new URLSearchParams({
            bvid: bvid,
            cid: cid,
            qn: quality,
            fnval: '4048', // Enhanced fnval for better compatibility
            fnver: '0',
            fourk: '1',
            session: this.generateSession(),
            otype: 'json',
            type: '',
            ps: '1'
        });
        
        const url = `https://api.bilibili.com/x/player/playurl?${params.toString()}`;
        console.log('Trying standard playurl API:', url);

        const response = await axios.get(url, { 
            headers,
            timeout: 15000
        });

        if (response.data.code !== 0) {
            throw new Error(`API error: ${response.data.message}`);
        }

        return this.parseStreamResponse(response.data.data, quality);
    }
    
    async getStreamWithEnhancedParams(bvid, cid, quality, headers) {
        const params = new URLSearchParams({
            bvid: bvid,
            cid: cid,
            qn: quality,
            fnval: '16', // Different fnval for interactive videos
            fnver: '0',
            fourk: '1',
            session: this.generateSession(),
            otype: 'json',
            high_quality: '1',
            platform: 'pc'
        });
        
        const url = `https://api.bilibili.com/x/player/playurl?${params.toString()}`;
        console.log('Trying enhanced params API:', url);

        const response = await axios.get(url, { 
            headers,
            timeout: 15000
        });

        if (response.data.code !== 0) {
            throw new Error(`API error: ${response.data.message}`);
        }

        return this.parseStreamResponse(response.data.data, quality);
    }
    
    async getStreamWithAlternativeAPI(bvid, cid, quality, headers) {
        // Try the PUGV (premium) API which sometimes works for interactive videos
        const params = new URLSearchParams({
            avid: '', // Will be resolved from bvid
            cid: cid,
            qn: quality,
            fnval: '4048',
            fnver: '0',
            fourk: '1',
            bvid: bvid
        });
        
        const url = `https://api.bilibili.com/pugv/player/web/playurl?${params.toString()}`;
        console.log('Trying alternative PUGV API:', url);

        const response = await axios.get(url, { 
            headers,
            timeout: 15000
        });

        if (response.data.code !== 0) {
            throw new Error(`PUGV API error: ${response.data.message}`);
        }

        return this.parseStreamResponse(response.data.data, quality);
    }
    
    parseStreamResponse(data, quality) {
        console.log('Parsing stream response, looking for DASH streams...');
        
        // Handle DASH format (preferred for high quality)
        if (data.dash && data.dash.video && data.dash.audio) {
            console.log(`Found DASH streams: ${data.dash.video.length} video, ${data.dash.audio.length} audio`);
            
            // Find best quality video that matches requested quality
            let video = data.dash.video.find(v => v.id === quality);
            if (!video) {
                // Fallback to highest available quality
                video = data.dash.video.sort((a, b) => b.id - a.id)[0];
                console.log(`Requested quality ${quality} not found, using ${video.id}`);
            }
            
            const audio = data.dash.audio[0]; // Use first audio stream
            
            return {
                video: { 
                    url: video.baseUrl || video.base_url,
                    quality: video.id,
                    codec: video.codecs
                },
                audio: { 
                    url: audio.baseUrl || audio.base_url,
                    quality: audio.id,
                    codec: audio.codecs
                }
            };
        }
        
        // Handle legacy FLV format as fallback
        if (data.durl && data.durl.length > 0) {
            console.log('Found FLV streams, using as fallback');
            const flvUrl = data.durl[0].url;
            
            return {
                video: { url: flvUrl, quality: quality },
                audio: { url: flvUrl, quality: quality } // Same URL for merged content
            };
        }
        
        throw new Error('No compatible video streams found in response');
    }
    
    generateSession() {
        // Generate a random session ID to potentially bypass some restrictions
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    async downloadFile(url, outputPath, downloadId, type) {
        return new Promise((resolve, reject) => {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.bilibili.com',
                'Origin': 'https://www.bilibili.com'
            };

            axios({
                method: 'GET',
                url: url,
                headers: headers,
                responseType: 'stream',
                timeout: 30000
            }).then(response => {
                const totalLength = parseInt(response.headers['content-length'], 10);
                let downloadedLength = 0;

                const writer = fs.createWriteStream(outputPath);
                
                response.data.on('data', (chunk) => {
                    downloadedLength += chunk.length;
                    const progress = Math.floor((downloadedLength / totalLength) * 100);
                    
                    // Update progress (video: 10-60%, audio: 60-80%)
                    let overallProgress;
                    if (type === 'video') {
                        overallProgress = 10 + (progress * 0.5);
                    } else {
                        overallProgress = 60 + (progress * 0.2);
                    }
                    
                    this.updateDownloadStatus(downloadId, Math.floor(overallProgress), 'downloading', {
                        message: `正在下載${type === 'video' ? '視頻' : '音頻'}... ${progress}%`,
                        speed: this.formatFileSize(downloadedLength / 1024) + '/s'
                    });
                });

                response.data.pipe(writer);

                writer.on('finish', () => {
                    resolve(outputPath);
                });

                writer.on('error', reject);
            }).catch(reject);
        });
    }

    async mergeVideoAudio(videoPath, audioPath, outputPath) {
        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(videoPath)
                .input(audioPath)
                .outputOptions([
                    '-c:v copy',
                    '-c:a aac',
                    '-strict experimental'
                ])
                .output(outputPath)
                .on('end', () => {
                    console.log('Video merge completed:', outputPath);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error('Video merge error:', err);
                    reject(err);
                })
                .run();
        });
    }

    updateDownloadStatus(downloadId, progress, status, details) {
        const download = this.downloads.get(downloadId);
        if (download) {
            download.progress = progress;
            download.status = status;
            download.details = { ...download.details, ...details };

            // Broadcast to WebSocket clients
            this.broadcastProgress({
                type: status === 'completed' ? 'complete' : status === 'error' ? 'error' : 'progress',
                id: downloadId,
                progress,
                status,
                details
            });
        }
    }

    extractVideoId(url) {
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

    sanitizeFilename(filename) {
        return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    formatNumber(num) {
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + '万';
        }
        return num.toLocaleString();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    start(port = 3000) {
        this.server.listen(port, () => {
            console.log('🎬 Bilibili 視頻下載器已啟動！');
            console.log(`🌐 訪問地址: http://localhost:${port}`);
            console.log('📁 下載目錄: ./downloads/');
            console.log('🔧 臨時目錄: ./temp/');
            console.log('🚀 WebSocket 實時進度已啟用');
        });

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n正在關閉服務器...');
            this.server.close(() => {
                console.log('服務器已關閉');
                process.exit(0);
            });
        });
    }
}

// Start the server
const downloader = new BilibiliDownloader();
const port = process.env.PORT || 3000;
downloader.start(port);

module.exports = BilibiliDownloader;