import { McpError, ErrorCode } from '../lib/utils';
import { writeResultToFile } from '../lib/writeResultToFile';

export const TOOL_DEFINITION = {
  name: "GetAbapSemanticAnalysis",
  description: "Perform semantic analysis on ABAP code and return symbols, types, scopes, and dependencies.",
  inputSchema: {
    type: "object",
    properties: {
      code: { 
        type: "string", 
        description: "ABAP source code to analyze" 
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
}

interface AbapParameterInfo {
    name: string;
    type: 'importing' | 'exporting' | 'changing' | 'returning';
    dataType?: string;
    optional?: boolean;
    defaultValue?: string;
}

interface AbapSemanticAnalysisResult {
    symbols: AbapSymbolInfo[];
    dependencies: string[];
    errors: AbapParseError[];
    scopes: AbapScopeInfo[];
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

// Simplified semantic analyzer that doesn't depend on ANTLR until it's properly set up
class SimpleAbapSemanticAnalyzer {
    private symbols: AbapSymbolInfo[] = [];
    private scopes: AbapScopeInfo[] = [];
    private dependencies: string[] = [];
    private errors: AbapParseError[] = [];
    private currentScope: string = 'global';

    public analyze(code: string): AbapSemanticAnalysisResult {
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
        let currentClassScope: string | null = null;
        let currentMethodScope: string | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNumber = i + 1;
            
            if (line === '' || line.startsWith('*') || line.startsWith('"')) {
                continue; // Skip empty lines and comments
            }

            try {
                // Analyze different ABAP constructs
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
            this.pushScope(interfaceName, 'class', lineNumber); // Interface acts like class scope
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
            endLine: startLine, // Will be updated when scope is popped
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
        
        // Find parent scope
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
        
        // This is a simplified parameter extraction
        // In a real implementation, this would be more sophisticated
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

export async function handleGetAbapSemanticAnalysis(args: any) {
    try {
        if (!args?.code) {
            throw new McpError(ErrorCode.InvalidParams, 'ABAP code is required');
        }

        const analyzer = new SimpleAbapSemanticAnalyzer();
        const analysis = analyzer.analyze(args.code);

        const result = {
            isError: false,
            content: [
                {
                    type: "text",
                    text: JSON.stringify(analysis, null, 2)
                }
            ]
        };

        if (args.filePath) {
            writeResultToFile(JSON.stringify(analysis, null, 2), args.filePath);
        }

        return result;
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
