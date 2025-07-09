import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, logger } from '../lib/utils';
import { writeResultToFile } from '../lib/writeResultToFile';

/**
 * Interface for SQL query execution response
 */
export interface SqlQueryResponse {
    sql_query: string;
    row_number: number;
    execution_time?: number;
    total_rows?: number;
    columns: Array<{
        name: string;
        type: string;
        description?: string;
        length?: number;
    }>;
    rows: Array<Record<string, any>>;
}

/**
 * Parse SAP ADT XML response from freestyle SQL query and convert to JSON format
 * @param xmlData - Raw XML response from ADT
 * @param sqlQuery - Original SQL query
 * @param rowNumber - Number of rows requested
 * @returns Parsed SQL query response
 */
function parseSqlQueryXml(xmlData: string, sqlQuery: string, rowNumber: number): SqlQueryResponse {
    try {
        // Extract basic information
        const totalRowsMatch = xmlData.match(/<dataPreview:totalRows>(\d+)<\/dataPreview:totalRows>/);
        const totalRows = totalRowsMatch ? parseInt(totalRowsMatch[1]) : 0;
        
        const queryTimeMatch = xmlData.match(/<dataPreview:queryExecutionTime>([\d.]+)<\/dataPreview:queryExecutionTime>/);
        const queryExecutionTime = queryTimeMatch ? parseFloat(queryTimeMatch[1]) : 0;
        
        // Extract column metadata
        const columns: Array<{name: string, type: string, description?: string, length?: number}> = [];
        const columnMatches = xmlData.match(/<dataPreview:metadata[^>]*>/g);
        
        if (columnMatches) {
            columnMatches.forEach(match => {
                const nameMatch = match.match(/dataPreview:name="([^"]+)"/);
                const typeMatch = match.match(/dataPreview:type="([^"]+)"/);
                const descMatch = match.match(/dataPreview:description="([^"]+)"/);
                const lengthMatch = match.match(/dataPreview:length="(\d+)"/);
                
                if (nameMatch) {
                    columns.push({
                        name: nameMatch[1],
                        type: typeMatch ? typeMatch[1] : 'UNKNOWN',
                        description: descMatch ? descMatch[1] : '',
                        length: lengthMatch ? parseInt(lengthMatch[1]) : undefined
                    });
                }
            });
        }
        
        // Extract row data
        const rows: Array<Record<string, any>> = [];
        
        // Find all column sections
        const columnSections = xmlData.match(/<dataPreview:columns>.*?<\/dataPreview:columns>/gs);
        
        if (columnSections && columnSections.length > 0) {
            // Extract data for each column
            const columnData: Record<string, (string | null)[]> = {};
            
            columnSections.forEach((section, index) => {
                if (index < columns.length) {
                    const columnName = columns[index].name;
                    const dataMatches = section.match(/<dataPreview:data[^>]*>(.*?)<\/dataPreview:data>/g);
                    
                    if (dataMatches) {
                        columnData[columnName] = dataMatches.map(match => {
                            const content = match.replace(/<[^>]+>/g, '');
                            return content || null;
                        });
                    } else {
                        columnData[columnName] = [];
                    }
                }
            });
            
            // Convert column-based data to row-based data
            const maxRowCount = Math.max(...Object.values(columnData).map(arr => arr.length), 0);
            
            for (let rowIndex = 0; rowIndex < maxRowCount; rowIndex++) {
                const row: Record<string, any> = {};
                columns.forEach(column => {
                    const columnValues = columnData[column.name] || [];
                    row[column.name] = columnValues[rowIndex] || null;
                });
                rows.push(row);
            }
        }
        
        return {
            sql_query: sqlQuery,
            row_number: rowNumber,
            execution_time: queryExecutionTime,
            total_rows: totalRows,
            columns,
            rows
        };
        
    } catch (parseError) {
        logger.error('Failed to parse SQL query XML:', parseError);
        
        // Return basic structure on parse error
        return {
            sql_query: sqlQuery,
            row_number: rowNumber,
            columns: [],
            rows: [],
            error: 'Failed to parse XML response'
        } as any;
    }
}

/**
 * Handler to execute freestyle SQL queries via SAP ADT Data Preview API
 * 
 * @param args - Tool arguments containing sql_query and optional row_number parameter
 * @returns Response with parsed SQL query results or error
 */
export async function handleGetSqlQuery(args: any) {
    try {
        logger.info('handleGetSqlQuery called with args:', args);
        
        if (!args?.sql_query) {
            throw new McpError(ErrorCode.InvalidParams, 'SQL query is required');
        }
        
        const sqlQuery = args.sql_query;
        const rowNumber = args.row_number || 100; // Default to 100 rows if not specified
        
        logger.info('Executing SQL query', { sqlQuery, rowNumber });
        
        // Build URL for freestyle data preview with rowNumber parameter
        const url = `${await getBaseUrl()}/sap/bc/adt/datapreview/freestyle?rowNumber=${rowNumber}`;
        
        logger.info(`Making SQL query request to: ${url}`);
        
        // Execute POST request with SQL query in body
        const response = await makeAdtRequestWithTimeout(url, 'POST', 'long', sqlQuery);
        
        if (response.status === 200 && response.data) {
            logger.info('SQL query request completed successfully', { status: response.status });
            
            // Parse the XML response
            const parsedData = parseSqlQueryXml(response.data, sqlQuery, rowNumber);
            
            logger.info('Parsed SQL query data', { 
                totalRows: parsedData.total_rows, 
                columnsCount: parsedData.columns.length,
                rowsCount: parsedData.rows.length,
                executionTime: parsedData.execution_time
            });
            
            const result = {
                isError: false,
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(parsedData, null, 2)
                    }
                ]
            };
            if (args.filePath) {
                writeResultToFile(result, args.filePath);
            }
            return result;
        } else {
            throw new McpError(ErrorCode.InternalError, `Failed to execute SQL query. Status: ${response.status}`);
        }
        
    } catch (error) {
        return return_error(error);
    }
}
