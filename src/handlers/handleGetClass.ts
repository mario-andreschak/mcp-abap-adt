import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

// 타입 정의
interface GetClassArgs {
    class_name: string;
}

/**
 * ABAP 클래스의 소스 코드를 조회합니다.
 * @param args - 클래스 조회 매개변수
 * @returns 클래스 소스 코드
 */
export async function handleGetClass(args: GetClassArgs) {
    try {
        if (!args?.class_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Class name is required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/oo/classes/${args.class_name}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}