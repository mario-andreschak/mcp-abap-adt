import { handleGetWhereUsed } from './src/handlers/handleGetWhereUsed';

async function testSbookWhereUsed() {
    console.log('=== SBOOK 테이블 Where Used 조사 ===\n');
    
    try {
        console.log('1. SBOOK 테이블의 Where Used 정보 조회...');
        const result = await handleGetWhereUsed({
            object_name: 'SBOOK',
            object_type: 'TABLE',
            max_results: 100
        });
        
        console.log('결과 상태:', result.isError ? 'ERROR' : 'SUCCESS');
        
        if (!result.isError && result.content && result.content.length > 0) {
            console.log('\n=== Where Used 정보 ===');
            result.content.forEach((item: any, index: number) => {
                if (item.type === 'text') {
                    console.log(`\n${index + 1}. ${item.text}`);
                }
            });
        } else {
            console.log('Where Used 정보를 가져올 수 없습니다.');
            if (result.isError) {
                console.log('오류:', result);
            }
        }
        
    } catch (error) {
        console.error('테스트 실행 중 오류 발생:', error);
    }
}

// 테스트 실행
testSbookWhereUsed();
