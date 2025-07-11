const { handleGetWhereUsed } = require('./dist/handlers/handleGetWhereUsed');

async function investigateSbookUsage() {
    console.log('=== SBOOK 테이블 참조 객체 상세 조사 ===\n');
    
    try {
        // 1. 기본 Where Used 조회
        console.log('1. SBOOK 테이블 Where Used 조회...');
        const basicResult = await handleGetWhereUsed({
            object_name: 'SBOOK',
            object_type: 'TABLE',
            max_results: 100
        });
        
        if (!basicResult.isError && basicResult.content) {
            console.log('✅ 기본 Where Used 결과:');
            basicResult.content.forEach((item, index) => {
                if (item.type === 'text') {
                    console.log(item.text);
                }
            });
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // 2. 관련 객체들 개별 조사
        const relatedObjects = [
            { name: 'SBOOK', type: 'SEARCH_HELP' },
            { name: 'SAPBC_DATAMODEL', type: 'PACKAGE' },
            { name: 'SAPBC_DATAMODEL_SERVICE', type: 'PACKAGE' },
            { name: 'SAPBC_IBF_SBOOK', type: 'PACKAGE' }
        ];
        
        for (const obj of relatedObjects) {
            console.log(`2.${relatedObjects.indexOf(obj) + 1} ${obj.name} (${obj.type}) 조사 중...`);
            try {
                const result = await handleGetWhereUsed({
                    object_name: obj.name,
                    object_type: obj.type,
                    max_results: 50
                });
                
                if (!result.isError && result.content) {
                    result.content.forEach((item) => {
                        if (item.type === 'text' && item.text.includes('Search results')) {
                            console.log(`   ✅ 발견: ${obj.name} 관련 객체들`);
                            // 간단한 요약만 출력
                            const lines = item.text.split('\n').slice(0, 10);
                            lines.forEach(line => {
                                if (line.trim() && !line.includes('Raw XML') && !line.includes('<?xml')) {
                                    console.log(`   ${line}`);
                                }
                            });
                        }
                    });
                } else {
                    console.log(`   ❌ ${obj.name} 정보 조회 실패`);
                }
            } catch (error) {
                console.log(`   ❌ ${obj.name} 조사 중 오류: ${error.message}`);
            }
            console.log('');
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // 3. 일반적인 SAP 비행 관련 객체들 검색
        console.log('3. SAP 비행 관련 일반 객체들 검색...');
        const flightObjects = ['SFLIGHT', 'SPFLI', 'SCARR', 'SAPLANE', 'BOOKING'];
        
        for (const flightObj of flightObjects) {
            console.log(`3.${flightObjects.indexOf(flightObj) + 1} ${flightObj} 조사 중...`);
            try {
                const result = await handleGetWhereUsed({
                    object_name: flightObj,
                    object_type: 'TABLE',
                    max_results: 30
                });
                
                if (!result.isError && result.content) {
                    result.content.forEach((item) => {
                        if (item.type === 'text' && (item.text.includes('Search results') || item.text.includes('Found objects'))) {
                            const objectCount = (item.text.match(/\d+\./g) || []).length;
                            console.log(`   ✅ ${flightObj}: ${objectCount}개 관련 객체 발견`);
                        }
                    });
                } else {
                    console.log(`   ❌ ${flightObj} 정보 없음`);
                }
            } catch (error) {
                console.log(`   ❌ ${flightObj} 조사 중 오류`);
            }
        }
        
    } catch (error) {
        console.error('조사 중 전체 오류 발생:', error);
    }
    
    console.log('\n=== 조사 완료 ===');
    console.log('더 자세한 Where Used 정보는 SAP GUI의 SE80 > 유틸리티 > Where Used List를 사용하세요.');
}

// 조사 실행
investigateSbookUsage().then(() => {
    console.log('\n프로그램 종료');
    process.exit(0);
}).catch(error => {
    console.error('\n조사 실행 중 예외:', error);
    process.exit(1);
});
