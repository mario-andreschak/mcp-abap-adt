const { handleGetWhereUsed } = require('./dist/handlers/handleGetWhereUsed');

async function testZtable002Enhanced() {
    console.log('=== ZTABLE002 개선된 Where Used 검사 ===\n');
    
    try {
        console.log('1. 개선된 ZTABLE002 Where Used 조회 (코드 검색 포함)...');
        const result = await handleGetWhereUsed({
            object_name: 'ZTABLE002',
            object_type: 'TABLE',
            max_results: 100
        });
        
        console.log('결과 상태:', result.isError ? 'ERROR' : 'SUCCESS');
        
        if (!result.isError && result.content && result.content.length > 0) {
            console.log('\n=== 개선된 Where Used 정보 ===');
            result.content.forEach((item, index) => {
                if (item.type === 'text') {
                    console.log(`\n항목 ${index + 1}:\n${item.text}`);
                    
                    // ZPTEST004 프로그램을 찾았는지 확인
                    if (item.text.includes('ZPTEST004')) {
                        console.log('\n🎯 SUCCESS! ZPTEST004 프로그램을 찾았습니다!');
                    }
                    
                    // 발견된 객체 수 계산
                    const objectCount = (item.text.match(/\d+\./g) || []).length;
                    if (objectCount > 0) {
                        console.log(`\n📊 발견된 관련 객체 수: ${objectCount}개`);
                    }
                }
            });
        } else {
            console.log('\n=== 오류 또는 결과 없음 ===');
            console.log('결과:', JSON.stringify(result, null, 2));
        }
        
        console.log('\n' + '='.repeat(60));
        
        // 2. 직접 ZPTEST004 프로그램에서 ZTABLE002 검색
        console.log('\n2. ZPTEST004 프로그램 검증...');
        
        // MCP 도구를 사용할 수 없으므로 일반적인 코드 검색으로 시도
        const zptest004Search = await handleGetWhereUsed({
            object_name: 'ZPTEST004',
            object_type: 'PROGRAM',
            max_results: 50
        });
        
        if (!zptest004Search.isError && zptest004Search.content) {
            console.log('✅ ZPTEST004 프로그램 정보:');
            zptest004Search.content.forEach((item) => {
                if (item.type === 'text') {
                    console.log(item.text.substring(0, 500) + '...');
                }
            });
        } else {
            console.log('❌ ZPTEST004 프로그램 정보를 가져올 수 없습니다');
        }
        
    } catch (error) {
        console.error('테스트 중 오류 발생:', error);
    }
    
    console.log('\n=== 분석 ===');
    console.log('만약 ZPTEST004가 여전히 검색되지 않는다면:');
    console.log('1. ADT API의 코드 검색 기능이 제한적일 수 있습니다');
    console.log('2. 인덱싱이 완료되지 않았을 수 있습니다');
    console.log('3. 권한 문제일 수 있습니다');
    console.log('4. 코드 검색 API 엔드포인트가 다를 수 있습니다');
    console.log('\n권장 해결책:');
    console.log('- SAP GUI SE80에서 수동 Where Used List 실행');
    console.log('- ADT Eclipse에서 Find References 사용');
    console.log('- SE16에서 직접 데이터 확인');
}

// 테스트 실행
testZtable002Enhanced().then(() => {
    console.log('\n프로그램 종료');
    process.exit(0);
}).catch(error => {
    console.error('\n테스트 실행 중 예외:', error);
    process.exit(1);
});
