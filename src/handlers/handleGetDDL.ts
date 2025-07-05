import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

// 타입 정의
interface GetDdlArgs {
    cds_name: string;
}

// 상수 정의
const CONSTANTS = {
    TIMEOUT: {
        DEFAULT: 30000
    },
    PACKAGE: {
        TEMP: '$TMP'
    },
    MESSAGES: {
        TEMP_PACKAGE_WARNING: '⚠️  임시 패키지($TMP)에 있음 - 아직 전송되지 않은 개발 오브젝트'
    }
} as const;

// 헬퍼 함수들
/**
 * CDS 뷰의 소스 코드를 조회합니다.
 * @param cdsName CDS 뷰 이름
 * @returns ADT API 응답
 */
async function getDdlSource(cdsName: string): Promise<AxiosResponse> {
    const baseUrl = await getBaseUrl();
    const sourceUrl = `${baseUrl}/sap/bc/adt/ddic/ddl/sources/${cdsName}/source/main`;
    return makeAdtRequest(sourceUrl, 'GET', CONSTANTS.TIMEOUT.DEFAULT);
}

/**
 * CDS 뷰의 메타데이터를 조회합니다.
 * @param cdsName CDS 뷰 이름
 * @returns ADT API 응답
 */
async function getDdlMetadata(cdsName: string): Promise<AxiosResponse> {
    const baseUrl = await getBaseUrl();
    const metadataUrl = `${baseUrl}/sap/bc/adt/ddic/ddl/sources/${cdsName}`;
    return makeAdtRequest(metadataUrl, 'GET', CONSTANTS.TIMEOUT.DEFAULT);
}

function extractPackageInfo(metadataXml: string): { packageInfo: string; additionalInfo: string } {
    let packageInfo = '';
    let additionalInfo = '';
    
    const packageMatch = metadataXml.match(/adtcore:packageName="([^"]+)"/);
    if (packageMatch) {
        packageInfo = `패키지: ${packageMatch[1]}`;
        if (packageMatch[1] === CONSTANTS.PACKAGE.TEMP) {
            additionalInfo += `\n${CONSTANTS.MESSAGES.TEMP_PACKAGE_WARNING}`;
        }
    }
    
    return { packageInfo, additionalInfo };
}

/**
 * CDS 뷰의 패키지 정보를 조회합니다.
 * @param cdsName CDS 뷰 이름
 * @returns 패키지 정보 문자열
 */
async function getDdlInfo(cdsName: string): Promise<string> {
    try {
        const metadataResponse = await getDdlMetadata(cdsName);
        
        if (metadataResponse.data && typeof metadataResponse.data === 'string') {
            const metadataXml = metadataResponse.data;
            const { packageInfo, additionalInfo } = extractPackageInfo(metadataXml);
            
            return `\n\n=== CDS 뷰 정보 ===\n${packageInfo}${additionalInfo}\n`;
        }
        
        return `\n\n=== CDS 뷰 정보 ===\n메타데이터 조회 실패\n`;
    } catch (metadataError) {
        return `\n\n=== CDS 뷰 정보 ===\n패키지 정보 조회 불가\n`;
    }
}

export async function handleGetDDL(args: GetDdlArgs) {
    try {
        if (!args?.cds_name) {
            throw new McpError(ErrorCode.InvalidParams, 'CDS name is required');
        }
        
        const sourceResponse = await getDdlSource(args.cds_name);
        
        // CDS View의 패키지 정보 조회
        const cdsInfo = await getDdlInfo(args.cds_name);
        
        const combinedResponse = {
            ...sourceResponse,
            data: sourceResponse.data + cdsInfo
        };
        
        return return_response(combinedResponse);
    } catch (error) {
        return return_error(error);
    }
}
