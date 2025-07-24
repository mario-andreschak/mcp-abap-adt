import { McpError, ErrorCode } from '../lib/utils';
import { writeResultToFile } from '../lib/writeResultToFile';
import { handleGetClass } from './handleGetClass';
import { handleGetFunction } from './handleGetFunction';
import { handleGetInterface } from './handleGetInterface';
import { handleGetObjectInfo } from './handleGetObjectInfo';

export const TOOL_DEFINITION = {
  name: "GetAbapSystemSymbols",
  description: "Resolve ABAP symbols from semantic analysis with SAP system information including types, scopes, descriptions, and packages.",
  inputSchema: {
    type: "object",
    properties: {
      code: { 
        type: "string", 
        description: "ABAP source code to analyze and resolve symbols for" 
      },
      filePath: {
        type: "string",
        description: "Optional file path to write the result to"
      }
    },
    required: ["code"]
  }
} as const;

interface AbapSymbolInfo {
    name: string;
    type: 'class' | 'method' | 'function' | 'variable' | 'constant' | 'type' | 'interface' | 'form' | 'program' | 'report' | 'include';
    scope: string;
    line: number;
    column: number;
    description?: string;
    package?: string;
    visibility?: 'public' | 'protected' | 'private';
    dataType?: string;
    parameters?: AbapParameterInfo[];
    systemInfo?: AbapSystemInfo;
}

interface AbapParameterInfo {
    name: string;
    type: 'importing' | 'exporting' | 'changing' | 'returning';
    dataType?: string;
    optional?: boolean;
    defaultValue?: string;
}

interface AbapSystemInfo {
    exists: boolean;
    objectType?: string;
    description?: string;
    package?: string;
    responsible?: string;
    lastChanged?: string;
    sapRelease?: string;
    techName?: string;
    methods?: string[];
    interfaces?: string[];
    superClass?: string;
    attributes?: string[];
    error?: string;
}

interface AbapSystemSymbolsResult {
    symbols: AbapSymbolInfo[];
    dependencies: string[];
    errors: AbapParseError[];
    scopes: AbapScopeInfo[];
    systemResolutionStats: {
        totalSymbols: number;
        resolvedSymbols: number;
        failedSymbols: number;
        resolutionRate: string;
    };
}

interface AbapParseError {
    message: string;
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
}

interface AbapScopeInfo {
    name: string;
    type: 'global' | 'class' | 'method' | 'form' | 'function' | 'local';
    startLine: number;
    endLine: number;
    parent?: string;
}

// Import semantic analyzer from the previous handler
class SimpleAbapSemanticAnalyzer {
    private symbols: AbapSymbolInfo[] = [];
    private scopes: AbapScopeInfo[] = [];
    private dependencies: string[] = [];
    private errors: AbapParseError[] = [];
    private currentScope: string = 'global';

    public analyze(code: string): { symbols: AbapSymbolInfo[], dependencies: string[], errors: AbapParseError[], scopes: AbapScopeInfo[] } {
        // Reset state
        this.symbols = [];
        this.scopes = [];
        this.dependencies = [];
        this.errors = [];
        this.currentScope = 'global';

        try {
            this.analyzeCode(code);
        } catch (error) {
            this.errors.push({
                message: error instanceof Error ? error.message : String(error),
                line: 1,
                column: 1,
                severity: 'error'
            });
        }

        return {
            symbols: this.symbols,
            dependencies: this.dependencies,
            errors: this.errors,
            scopes: this.scopes
        };
    }

    private analyzeCode(code: string): void {
        const lines = code.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNumber = i + 1;
            
            if (line === '' || line.startsWith('*') || line.startsWith('"')) {
                continue;
            }

            try {
                this.analyzeClassDefinition(line, lineNumber);
                this.analyzeClassImplementation(line, lineNumber);
                this.analyzeMethodDefinition(line, lineNumber);
                this.analyzeMethodImplementation(line, lineNumber);
                this.analyzeDataDeclaration(line, lineNumber);
                this.analyzeConstantsDeclaration(line, lineNumber);
                this.analyzeTypesDeclaration(line, lineNumber);
                this.analyzeFormDefinition(line, lineNumber);
                this.analyzeFunctionDefinition(line, lineNumber);
                this.analyzeIncludeStatement(line, lineNumber);
                this.analyzeInterfaceDefinition(line, lineNumber);
                this.analyzeScopeEnders(line, lineNumber);
            } catch (error) {
                this.errors.push({
                    message: `Error analyzing line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`,
                    line: lineNumber,
                    column: 1,
                    severity: 'warning'
                });
            }
        }
    }

    private analyzeClassDefinition(line: string, lineNumber: number): void {
        const classDefMatch = line.toLowerCase().match(/^class\s+([a-zA-Z0-9_]+)\s+definition/);
        if (classDefMatch) {
            const className = classDefMatch[1].toUpperCase();
            this.addSymbol({
                name: className,
                type: 'class',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
                visibility: this.extractVisibility(line)
            });
            this.pushScope(className, 'class', lineNumber);
        }
    }

    private analyzeClassImplementation(line: string, lineNumber: number): void {
        const classImplMatch = line.toLowerCase().match(/^class\s+([a-zA-Z0-9_]+)\s+implementation/);
        if (classImplMatch) {
            const className = classImplMatch[1].toUpperCase();
            this.pushScope(`${className}_IMPL`, 'class', lineNumber);
        }
    }

    private analyzeMethodDefinition(line: string, lineNumber: number): void {
        const methodMatch = line.toLowerCase().match(/^(methods|class-methods)\s+([a-zA-Z0-9_]+)/);
        if (methodMatch) {
            const methodName = methodMatch[2].toUpperCase();
            const isStatic = methodMatch[1] === 'class-methods';
            
            this.addSymbol({
                name: methodName,
                type: 'method',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
                visibility: this.extractVisibility(line),
                description: isStatic ? 'Static method' : 'Instance method',
                parameters: this.extractMethodParameters(line)
            });
        }
    }

    private analyzeMethodImplementation(line: string, lineNumber: number): void {
        const methodImplMatch = line.toLowerCase().match(/^method\s+([a-zA-Z0-9_~\->]+)/);
        if (methodImplMatch) {
            const methodName = methodImplMatch[1].toUpperCase();
            this.pushScope(methodName, 'method', lineNumber);
        }
    }

    private analyzeDataDeclaration(line: string, lineNumber: number): void {
        const dataMatches = [
            line.toLowerCase().match(/^data:?\s+([a-zA-Z0-9_]+)/),
            line.toLowerCase().match(/^class-data:?\s+([a-zA-Z0-9_]+)/),
            line.toLowerCase().match(/^statics:?\s+([a-zA-Z0-9_]+)/)
        ];

        for (const match of dataMatches) {
            if (match) {
                const varName = match[1].toUpperCase();
                this.addSymbol({
                    name: varName,
                    type: 'variable',
                    scope: this.currentScope,
                    line: lineNumber,
                    column: 1,
                    dataType: this.extractDataType(line),
                    visibility: this.extractVisibility(line)
                });
                break;
            }
        }
    }

    private analyzeConstantsDeclaration(line: string, lineNumber: number): void {
        const constantMatch = line.toLowerCase().match(/^constants:?\s+([a-zA-Z0-9_]+)/);
        if (constantMatch) {
            const constName = constantMatch[1].toUpperCase();
            this.addSymbol({
                name: constName,
                type: 'constant',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
                dataType: this.extractDataType(line),
                visibility: this.extractVisibility(line)
            });
        }
    }

    private analyzeTypesDeclaration(line: string, lineNumber: number): void {
        const typeMatch = line.toLowerCase().match(/^types:?\s+([a-zA-Z0-9_]+)/);
        if (typeMatch) {
            const typeName = typeMatch[1].toUpperCase();
            this.addSymbol({
                name: typeName,
                type: 'type',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
                dataType: this.extractDataType(line),
                visibility: this.extractVisibility(line)
            });
        }
    }

    private analyzeFormDefinition(line: string, lineNumber: number): void {
        const formMatch = line.toLowerCase().match(/^form\s+([a-zA-Z0-9_]+)/);
        if (formMatch) {
            const formName = formMatch[1].toUpperCase();
            this.addSymbol({
                name: formName,
                type: 'form',
                scope: this.currentScope,
                line: lineNumber,
                column: 1
            });
            this.pushScope(formName, 'form', lineNumber);
        }
    }

    private analyzeFunctionDefinition(line: string, lineNumber: number): void {
        const functionMatch = line.toLowerCase().match(/^function\s+([a-zA-Z0-9_]+)/);
        if (functionMatch) {
            const functionName = functionMatch[1].toUpperCase();
            this.addSymbol({
                name: functionName,
                type: 'function',
                scope: this.currentScope,
                line: lineNumber,
                column: 1
            });
            this.pushScope(functionName, 'function', lineNumber);
        }
    }

    private analyzeIncludeStatement(line: string, lineNumber: number): void {
        const includeMatch = line.toLowerCase().match(/^include\s+([a-zA-Z0-9_/<>]+)/);
        if (includeMatch) {
            const includeName = includeMatch[1].toUpperCase();
            this.dependencies.push(includeName);
            this.addSymbol({
                name: includeName,
                type: 'include',
                scope: this.currentScope,
                line: lineNumber,
                column: 1
            });
        }
    }

    private analyzeInterfaceDefinition(line: string, lineNumber: number): void {
        const interfaceMatch = line.toLowerCase().match(/^interface\s+([a-zA-Z0-9_]+)/);
        if (interfaceMatch) {
            const interfaceName = interfaceMatch[1].toUpperCase();
            this.addSymbol({
                name: interfaceName,
                type: 'interface',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
                visibility: this.extractVisibility(line)
            });
            this.pushScope(interfaceName, 'class', lineNumber);
        }
    }

    private analyzeScopeEnders(line: string, lineNumber: number): void {
        const lowerLine = line.toLowerCase();
        if (lowerLine.match(/^(endclass|endmethod|endform|endfunction|endinterface)\.?$/)) {
            this.popScope(lineNumber);
        }
    }

    private addSymbol(symbol: AbapSymbolInfo): void {
        this.symbols.push(symbol);
    }

    private pushScope(name: string, type: AbapScopeInfo['type'], startLine: number): void {
        const scope: AbapScopeInfo = {
            name,
            type,
            startLine,
            endLine: startLine,
            parent: this.currentScope !== 'global' ? this.currentScope : undefined
        };
        
        this.scopes.push(scope);
        this.currentScope = name;
    }

    private popScope(endLine: number): void {
        const currentScopeInfo = this.scopes.find(s => s.name === this.currentScope);
        if (currentScopeInfo) {
            currentScopeInfo.endLine = endLine;
        }
        
        const parentScope = this.scopes.find(s => s.name === currentScopeInfo?.parent);
        this.currentScope = parentScope?.name || 'global';
    }

    private extractVisibility(line: string): 'public' | 'protected' | 'private' {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('private')) return 'private';
        if (lowerLine.includes('protected')) return 'protected';
        return 'public';
    }

    private extractDataType(line: string): string | undefined {
        const typeMatches = [
            line.toLowerCase().match(/type\s+([a-zA-Z0-9_]+)/),
            line.toLowerCase().match(/like\s+([a-zA-Z0-9_]+)/),
            line.toLowerCase().match(/type\s+ref\s+to\s+([a-zA-Z0-9_]+)/)
        ];

        for (const match of typeMatches) {
            if (match) {
                return match[1].toUpperCase();
            }
        }

        return undefined;
    }

    private extractMethodParameters(line: string): AbapParameterInfo[] {
        const parameters: AbapParameterInfo[] = [];
        const paramTypes = ['importing', 'exporting', 'changing', 'returning'];
        
        for (const paramType of paramTypes) {
            const regex = new RegExp(`${paramType}\\s+([a-zA-Z0-9_\\s,]+)`, 'gi');
            const match = regex.exec(line);
            if (match) {
                const paramNames = match[1].split(',').map(p => p.trim());
                for (const paramName of paramNames) {
                    if (paramName) {
                        parameters.push({
                            name: paramName.toUpperCase(),
                            type: paramType as any,
                            optional: line.toLowerCase().includes('optional')
                        });
                    }
                }
            }
        }
        
        return parameters;
    }
}

class AbapSystemSymbolResolver {
    public async resolveSymbols(symbols: AbapSymbolInfo[]): Promise<{ resolvedSymbols: AbapSymbolInfo[], stats: any }> {
        const resolvedSymbols: AbapSymbolInfo[] = [];
        let resolvedCount = 0;
        let failedCount = 0;

        for (const symbol of symbols) {
            try {
                const resolved = await this.resolveSymbol(symbol);
                resolvedSymbols.push(resolved);
                if (resolved.systemInfo?.exists) {
                    resolvedCount++;
                } else {
                    failedCount++;
                }
            } catch (error) {
                // If resolution fails, add original symbol with error info
                resolvedSymbols.push({
                    ...symbol,
                    systemInfo: {
                        exists: false,
                        error: error instanceof Error ? error.message : String(error)
                    }
                });
                failedCount++;
            }
        }

        const stats = {
            totalSymbols: symbols.length,
            resolvedSymbols: resolvedCount,
            failedSymbols: failedCount,
            resolutionRate: `${((resolvedCount / symbols.length) * 100).toFixed(1)}%`
        };

        return { resolvedSymbols, stats };
    }

    private async resolveSymbol(symbol: AbapSymbolInfo): Promise<AbapSymbolInfo> {
        try {
            switch (symbol.type) {
                case 'class':
                    return await this.resolveClassSymbol(symbol);
                case 'function':
                    return await this.resolveFunctionSymbol(symbol);
                case 'interface':
                    return await this.resolveInterfaceSymbol(symbol);
                default:
                    return await this.resolveGenericSymbol(symbol);
            }
        } catch (error) {
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    private async resolveClassSymbol(symbol: AbapSymbolInfo): Promise<AbapSymbolInfo> {
        try {
            const classInfo = await handleGetClass({ class_name: symbol.name });
            
            if (classInfo.isError) {
                return {
                    ...symbol,
                    systemInfo: {
                        exists: false,
                        error: 'Class not found in SAP system'
                    }
                };
            }

            // Parse the response to extract information
            const responseText = (classInfo.content[0] as any)?.text || '';
            let classData;
            
            try {
                classData = JSON.parse(responseText);
            } catch {
                // If not JSON, treat as plain text
                classData = { source: responseText };
            }

            return {
                ...symbol,
                systemInfo: {
                    exists: true,
                    objectType: 'CLAS',
                    description: classData.description || `ABAP Class ${symbol.name}`,
                    package: classData.package || 'Unknown',
                    methods: classData.methods || [],
                    interfaces: classData.interfaces || [],
                    superClass: classData.superClass,
                    attributes: classData.attributes || []
                }
            };
        } catch (error) {
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    private async resolveFunctionSymbol(symbol: AbapSymbolInfo): Promise<AbapSymbolInfo> {
        try {
            const functionInfo = await handleGetFunction({ function_name: symbol.name });
            
            if (functionInfo.isError) {
                return {
                    ...symbol,
                    systemInfo: {
                        exists: false,
                        error: 'Function not found in SAP system'
                    }
                };
            }

            const responseText = (functionInfo.content[0] as any)?.text || '';
            let functionData;
            
            try {
                functionData = JSON.parse(responseText);
            } catch {
                functionData = { source: responseText };
            }

            return {
                ...symbol,
                systemInfo: {
                    exists: true,
                    objectType: 'FUNC',
                    description: functionData.description || `ABAP Function ${symbol.name}`,
                    package: functionData.package || 'Unknown',
                    techName: functionData.name || symbol.name
                }
            };
        } catch (error) {
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    private async resolveInterfaceSymbol(symbol: AbapSymbolInfo): Promise<AbapSymbolInfo> {
        try {
            const interfaceInfo = await handleGetInterface({ interface_name: symbol.name });
            
            if (interfaceInfo.isError) {
                return {
                    ...symbol,
                    systemInfo: {
                        exists: false,
                        error: 'Interface not found in SAP system'
                    }
                };
            }

            const responseText = (interfaceInfo.content[0] as any)?.text || '';
            let interfaceData;
            
            try {
                interfaceData = JSON.parse(responseText);
            } catch {
                interfaceData = { source: responseText };
            }

            return {
                ...symbol,
                systemInfo: {
                    exists: true,
                    objectType: 'INTF',
                    description: interfaceData.description || `ABAP Interface ${symbol.name}`,
                    package: interfaceData.package || 'Unknown',
                    methods: interfaceData.methods || []
                }
            };
        } catch (error) {
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    private async resolveGenericSymbol(symbol: AbapSymbolInfo): Promise<AbapSymbolInfo> {
        try {
            // For generic symbols, we don't have a specific handler
            // Return symbol with basic system info indicating it exists locally
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    objectType: 'LOCAL',
                    description: `Local ${symbol.type} ${symbol.name}`,
                    package: 'LOCAL',
                    error: 'No system resolution available for this symbol type'
                }
            };
        } catch (error) {
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
}

export async function handleGetAbapSystemSymbols(args: any) {
    try {
        if (!args?.code) {
            throw new McpError(ErrorCode.InvalidParams, 'ABAP code is required');
        }

        // First, perform semantic analysis
        const analyzer = new SimpleAbapSemanticAnalyzer();
        const semanticResult = analyzer.analyze(args.code);

        // Then, resolve symbols with SAP system information
        const resolver = new AbapSystemSymbolResolver();
        const { resolvedSymbols, stats } = await resolver.resolveSymbols(semanticResult.symbols);

        const result: AbapSystemSymbolsResult = {
            symbols: resolvedSymbols,
            dependencies: semanticResult.dependencies,
            errors: semanticResult.errors,
            scopes: semanticResult.scopes,
            systemResolutionStats: stats
        };

        const response = {
            isError: false,
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };

        if (args.filePath) {
            writeResultToFile(JSON.stringify(result, null, 2), args.filePath);
        }

        return response;
    } catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: error instanceof Error ? error.message : String(error)
                }
            ]
        };
    }
}
