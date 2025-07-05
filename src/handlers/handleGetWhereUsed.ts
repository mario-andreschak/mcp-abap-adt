import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

// 타입 정의
interface GetWhereUsedArgs {
    object_name: string;
    object_type?: 'CLASS' | 'INTERFACE' | 'PROGRAM' | 'FUNCTION' | 'TABLE' | 'STRUCTURE';
    max_results?: number;
}

/**
 * ABAP 객체의 Where Used 정보를 조회합니다.
 * @param args - Where Used 조회 매개변수
 * @returns Where Used 정보
 */
export async function handleGetWhereUsed(args: GetWhereUsedArgs) {
    try {
        if (!args?.object_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Object name is required');
        }

        const objectType = args.object_type || 'CLASS';
        const maxResults = args.max_results || 100;

        // Where Used 조회를 위한 다양한 시도
        let whereUsedInfo = '';
        
        try {
            // 1. ADT Where Used API 시도
            const whereUsedUrl = `${await getBaseUrl()}/sap/bc/adt/repository/whereused/${objectType.toLowerCase()}/${args.object_name}?maxResults=${maxResults}`;
            const whereUsedResponse = await makeAdtRequest(whereUsedUrl, 'GET', 30000);
            
            if (whereUsedResponse.data) {
                whereUsedInfo = `=== ${args.object_name} (${objectType}) Where Used 정보 ===\n\n${whereUsedResponse.data}`;
            }
        } catch (whereUsedError) {
            console.log('ADT Where Used API not available, trying alternative approach...');
            
            // 2. 대안: 검색 API를 통한 참조 찾기
            try {
                const searchUrl = `${await getBaseUrl()}/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodeURIComponent(args.object_name)}&maxResults=${maxResults}`;
                const searchResponse = await makeAdtRequest(searchUrl, 'GET', 30000);
                
                whereUsedInfo = `=== ${args.object_name} (${objectType}) 참조 검색 결과 ===

⚠️  전용 Where Used API를 사용할 수 없어 검색 결과로 대체합니다.
더 정확한 Where Used 정보를 위해서는 ADT IDE를 사용하세요.

검색된 객체 목록:
${searchResponse.data}

=== Where Used 정보 개선 방법 ===
1. SAP GUI에서 SE80 > 유틸리티 > Where Used List 사용
2. ADT Eclipse에서 우클릭 > References > Find References
3. 커스텀 Where Used 서비스 구현 고려

요청된 최대 결과 수: ${maxResults}`;
            } catch (searchError) {
                // 3. 모든 API 실패 시 가이드 제공
                whereUsedInfo = `=== ${args.object_name} (${objectType}) Where Used 조회 제한 ===

현재 시스템에서는 ${args.object_name}의 Where Used 정보를 자동으로 조회할 수 없습니다.

=== 대안적 Where Used 조회 방법 ===

1. **SAP GUI 사용:**
   - SE80 트랜잭션 실행
   - ${args.object_name} 객체 선택
   - 유틸리티 > Where Used List 선택

2. **ADT Eclipse 사용:**
   - ${args.object_name} 객체 우클릭
   - References > Find References 선택

3. **수동 검색:**
   - SE11에서 테이블/구조 참조 확인
   - SE38에서 프로그램 내 사용 검색
   - SE37에서 함수 모듈 참조 확인

4. **개발자 도구:**
   - Code Inspector (SCI) 사용
   - ABAP Test Cockpit (ATC) 활용

=== 지원되는 객체 타입 ===
- CLASS: ABAP 클래스
- INTERFACE: ABAP 인터페이스  
- PROGRAM: ABAP 프로그램
- FUNCTION: 함수 모듈
- TABLE: 데이터베이스 테이블
- STRUCTURE: DDIC 구조

요청 정보:
- 객체명: ${args.object_name}
- 객체 타입: ${objectType}
- 최대 결과 수: ${maxResults}

💡 팁: 더 정확한 Where Used 분석을 위해서는 ADT Eclipse 환경을 사용하는 것을 권장합니다.`;
            }
        }

        const response: AxiosResponse = {
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
            data: whereUsedInfo
        };

        return return_response(response);
        
    } catch (error) {
        const fallbackMessage = `❌ ${args.object_name} Where Used 조회 실패

가능한 원인:
1. 객체가 존재하지 않음
2. 접근 권한 부족
3. SAP 시스템 연결 문제
4. Where Used API 미지원

해결 방법:
- 객체명 철자 확인
- 객체 타입 정확성 확인
- SAP GUI 또는 ADT Eclipse에서 수동 조회`;

        const fallbackError = new McpError(
            ErrorCode.InternalError,
            fallbackMessage
        );

        return return_error(fallbackError);
    }
}
