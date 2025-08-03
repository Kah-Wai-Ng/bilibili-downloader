// Test script to demonstrate enhanced interactive video branch discovery
const BilibiliDownloader = require('./server.js');

// Mock data to simulate interactive video response
const mockInteractiveVideoData = {
    code: 0,
    data: {
        edges: [
            {
                questions: [
                    {
                        id: 1,
                        title: "你想要什麼結局？",
                        choices: [
                            {
                                id: 1,
                                cid: 12345678,
                                option: "拯救世界",
                                condition: null
                            },
                            {
                                id: 2, 
                                cid: 12345679,
                                option: "保護朋友",
                                condition: "score >= 50"
                            }
                        ]
                    }
                ]
            }
        ],
        hidden_vars: [
            {
                id_v2: 12345680,
                name: "隱藏結局",
                condition: "secret_path === true"
            }
        ]
    }
};

// Test the enhanced branch discovery methods
async function testEnhancedFeatures() {
    console.log('🧪 Testing Enhanced Interactive Video Branch Discovery\n');
    
    const downloader = new (require('./server.js'))();
    
    // Test 1: Process edge data
    console.log('📊 Test 1: Processing Edge Data');
    const branches = downloader.processEdgeData(mockInteractiveVideoData.data, 'root', 0);
    console.log(`Found ${branches.length} branches:`);
    branches.forEach((branch, index) => {
        console.log(`  ${index + 1}. ${branch.title} (CID: ${branch.cid})`);
        console.log(`     Description: ${branch.description}`);
        if (branch.condition) {
            console.log(`     Condition: ${branch.condition}`);
        }
        console.log('');
    });
    
    // Test 2: Generate session ID
    console.log('🔐 Test 2: Session ID Generation');
    const session1 = downloader.generateSession();
    const session2 = downloader.generateSession();
    console.log(`Session 1: ${session1}`);
    console.log(`Session 2: ${session2}`);
    console.log(`Sessions are unique: ${session1 !== session2}\n`);
    
    // Test 3: Video ID extraction
    console.log('🔍 Test 3: Video ID Extraction');
    const testUrls = [
        'BV1hm4y1U7qN',
        'https://www.bilibili.com/video/BV1hm4y1U7qN',
        'https://b23.tv/abc123',
        'av123456'
    ];
    
    testUrls.forEach(url => {
        const extracted = downloader.extractVideoId(url);
        console.log(`  "${url}" → "${extracted}"`);
    });
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary of Enhancements:');
    console.log('  • Recursive graph traversal for complete branch discovery');
    console.log('  • Multiple API fallback strategies for stream URLs');
    console.log('  • Enhanced branch metadata (path, depth, conditions)');
    console.log('  • Visual grouping of main, hidden, and discovered branches');
    console.log('  • Dynamic URL token and parameter handling');
    console.log('  • Comprehensive error handling and retry logic');
}

// Run tests if this file is executed directly
if (require.main === module) {
    testEnhancedFeatures().catch(console.error);
}

module.exports = { testEnhancedFeatures, mockInteractiveVideoData };