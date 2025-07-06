const { handleGetWhereUsed } = require('./dist/handlers/handleGetWhereUsed');

async function investigateZtable002Usage() {
    console.log('=== ZTABLE002 참조 객체 검사 ===\n');
    
    try {
        // 1. ZTABLE002 테이블의 Where Used 조회
        console.log('1. ZTABLE002 테이블 Where Used 조회...');
        const result = await handleGetWhereUsed({
            object_name: 'ZTABLE002',
            object_type: 'TABLE',
            max_results: 100
        });
        
        console.log('결과 상태:', result.isError ? 'ERROR' : 'SUCCESS');
        console.log('응답 상태 코드:', result.status);
        
        if (!result.isError && result.content && result.content.length > 0) {
            console.log('\n=== Where Used 정보 ===');
            result.content.forEach((item, index) => {
                if (item.type === 'text') {
                    console.log(`\n항목 ${index + 1}:\n${item.text}`);
                    
                    // 발견된 객체 수 계산
                    const objectCount = (item.text.match(/\d+\./g) || []).length;
                    if (objectCount > 0) {
                        console.log(`\n📊 발견된 관련 객체 수: ${objectCount}개`);
                    }
                }
            });
        } else {
            console.log('\n=== 오류 또는 결과 없음 ===');
            if (result.isError) {
                console.log('오류 정보:', JSON.stringify(result, null, 2));
            } else {
                console.log('결과가 없습니다. ZTABLE002가 존재하지 않거나 참조하는 객체가 없을 수 있습니다.');
            }
        }
        
        console.log('\n' + '='.repeat(60));
        
        // 2. 다른 객체 타입으로도 시도해보기
        console.log('\n2. 다른 검색 방법들 시도...');
        
        const searchVariations = [
            { name: 'ZTABLE002', type: 'STRUCTURE' },
            { name: 'ZTABLE002', type: 'TYPE' },
            { name: 'ZTABLE002', type: 'DDIC_OBJECT' }
        ];
        
        for (const variation of searchVariations) {
            console.log(`\n2.${searchVariations.indexOf(variation) + 1} ${variation.name} (${variation.type}) 검색 중...`);
            try {
                const varResult = await handleGetWhereUsed({
                    object_name: variation.name,
                    object_type: variation.type,
                    max_results: 50
                });
                
                if (!varResult.isError && varResult.content) {
                    let foundObjects = false;
                    varResult.content.forEach((item) => {
                        if (item.type === 'text' && (item.text.includes('Search results') || item.text.includes('Found objects'))) {
                            const objectCount = (item.text.match(/\d+\./g) || []).length;
                            if (objectCount > 0) {
                                console.log(`   ✅ ${variation.type}로 검색: ${objectCount}개 객체 발견`);
                                foundObjects = true;
                            }
                        }
                    });
                    if (!foundObjects) {
                        console.log(`   ❌ ${variation.type}로 검색: 결과 없음`);
                    }
                } else {
                    console.log(`   ❌ ${variation.type}로 검색: 실패`);
                }
            } catch (error) {
                console.log(`   ❌ ${variation.type} 검색 중 오류: ${error.message}`);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        
        // 3. 유사한 Z 테이블들 검색
        console.log('\n3. 유사한 Z 테이블들 검색...');
        const similarTables = ['ZTABLE001', 'ZTABLE003', 'ZTABLE', 'ZTEST'];
        
        for (const table of similarTables) {
            console.log(`\n3.${similarTables.indexOf(table) + 1} ${table} 검색 중...`);
            try {
                const similarResult = await handleGetWhereUsed({
                    object_name: table,
                    object_type: 'TABLE',
                    max_results: 30
                });
                
                if (!similarResult.isError && similarResult.content) {
                    let foundObjects = false;
                    similarResult.content.forEach((item) => {
                        if (item.type === 'text' && (item.text.includes('Search results') || item.text.includes('Found objects'))) {
                            const objectCount = (item.text.match(/\d+\./g) || []).length;
                            if (objectCount > 0) {
                                console.log(`   ✅ ${table}: ${objectCount}개 관련 객체 발견`);
                                foundObjects = true;
                            }
                        }
                    });
                    if (!foundObjects) {
                        console.log(`   ❌ ${table}: 결과 없음`);
                    }
                } else {
                    console.log(`   ❌ ${table}: 검색 실패`);
                }
            } catch (error) {
                console.log(`   ❌ ${table} 검색 중 오류`);
            }
        }
        
    } catch (error) {
        console.error('검사 중 전체 오류 발생:', error);
    }
    
    console.log('\n=== 검사 완료 ===');
    console.log('💡 참고사항:');
    console.log('- ZTABLE002가 존재하지 않을 수 있습니다');
    console.log('- 커스텀 테이블이므로 참조하는 객체가 적을 수 있습니다');
    console.log('- 더 정확한 Where Used 정보는 SAP GUI의 SE80을 사용하세요');
}

// 검사 실행
investigateZtable002Usage().then(() => {
    console.log('\n프로그램 종료');
    process.exit(0);
}).catch(error => {
    console.error('\n검사 실행 중 예외:', error);
    process.exit(1);
});
