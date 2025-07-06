const { handleGetWhereUsed } = require('./dist/handlers/handleGetWhereUsed');

async function testSbookWhereUsed() {
    console.log('=== SBOOK 테이블 Where Used 테스트 ===\n');
    
    try {
        console.log('SBOOK 테이블의 Where Used 정보 조회 중...\n');
        
        const result = await handleGetWhereUsed({
            object_name: 'SBOOK',
            object_type: 'TABLE',
            max_results: 50
        });
        
        console.log('결과 상태:', result.isError ? 'ERROR' : 'SUCCESS');
        console.log('응답 상태 코드:', result.status);
        
        if (!result.isError && result.content && result.content.length > 0) {
            console.log('\n=== Where Used 정보 ===');
            result.content.forEach((item, index) => {
                if (item.type === 'text') {
                    console.log(`\n항목 ${index + 1}:\n${item.text}`);
                }
            });
        } else {
            console.log('\n=== 오류 정보 ===');
            console.log(JSON.stringify(result, null, 2));
        }
        
    } catch (error) {
        console.error('\n=== 예외 발생 ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

// 테스트 실행
testSbookWhereUsed().then(() => {
    console.log('\n테스트 완료');
    process.exit(0);
}).catch(error => {
    console.error('\n테스트 실행 중 예외:', error);
    process.exit(1);
});
