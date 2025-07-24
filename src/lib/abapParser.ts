import { ANTLRInputStream, CommonTokenStream } from 'antlr4ts';
import { AbapLexer } from '../generated/AbapLexer';
import { AbapParser } from '../generated/AbapParser';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { AbapParserVisitor } from '../generated/AbapParserVisitor';
import { ParseTree } from 'antlr4ts/tree/ParseTree';

export interface AbapSymbolInfo {
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

export interface AbapParameterInfo {
    name: string;
    type: 'importing' | 'exporting' | 'changing' | 'returning';
    dataType?: string;
    optional?: boolean;
    defaultValue?: string;
}

export interface AbapSemanticAnalysisResult {
    symbols: AbapSymbolInfo[];
    dependencies: string[];
    errors: AbapParseError[];
    scopes: AbapScopeInfo[];
}

export interface AbapParseError {
    message: string;
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
}

export interface AbapScopeInfo {
    name: string;
    type: 'global' | 'class' | 'method' | 'form' | 'function' | 'local';
    startLine: number;
    endLine: number;
    parent?: string;
}

export class AbapASTGenerator {
    public parseToAST(code: string): any {
        try {
            const inputStream = new ANTLRInputStream(code);
            const lexer = new AbapLexer(inputStream);
            const tokenStream = new CommonTokenStream(lexer);
            const parser = new AbapParser(tokenStream);
            
            // Disable error recovery for cleaner AST
            parser.removeErrorListeners();
            
            const tree = parser.abapSource();
            return this.convertParseTreeToJSON(tree);
        } catch (error) {
            throw new Error(`Failed to parse ABAP code: ${error.message}`);
        }
    }

    private convertParseTreeToJSON(tree: ParseTree): any {
        const result: any = {
            type: tree.constructor.name,
            text: tree.text,
            children: []
        };

        if (tree.childCount > 0) {
            for (let i = 0; i < tree.childCount; i++) {
                const child = tree.getChild(i);
                result.children.push(this.convertParseTreeToJSON(child));
            }
        }

        return result;
    }
}

export class AbapSemanticAnalyzer extends AbstractParseTreeVisitor<any> implements AbapParserVisitor<any> {
    private symbols: AbapSymbolInfo[] = [];
    private scopes: AbapScopeInfo[] = [];
    private currentScope: string = 'global';
    private dependencies: string[] = [];
    private errors: AbapParseError[] = [];
    private currentLine: number = 1;
    private currentColumn: number = 1;

    public analyze(code: string): AbapSemanticAnalysisResult {
        try {
            const inputStream = new ANTLRInputStream(code);
            const lexer = new AbapLexer(inputStream);
            const tokenStream = new CommonTokenStream(lexer);
            const parser = new AbapParser(tokenStream);
            
            const tree = parser.abapSource();
            
            // Reset state
            this.symbols = [];
            this.scopes = [];
            this.dependencies = [];
            this.errors = [];
            this.currentScope = 'global';
            
            // Walk the tree
            ParseTreeWalker.DEFAULT.walk(this, tree);
            
            return {
                symbols: this.symbols,
                dependencies: this.dependencies,
                errors: this.errors,
                scopes: this.scopes
            };
        } catch (error) {
            this.errors.push({
                message: error.message,
                line: this.currentLine,
                column: this.currentColumn,
                severity: 'error'
            });
            
            return {
                symbols: this.symbols,
                dependencies: this.dependencies,
                errors: this.errors,
                scopes: this.scopes
            };
        }
    }

    protected defaultResult(): any {
        return null;
    }

    // Implement visitor methods for different ABAP constructs
    visitClassDef(ctx: any): any {
        const className = ctx.ID(0)?.text || 'UnknownClass';
        
        this.addSymbol({
            name: className,
            type: 'class',
            scope: this.currentScope,
            line: ctx.start?.line || 1,
            column: ctx.start?.charPositionInLine || 0
        });

        this.pushScope(className, 'class', ctx.start?.line || 1);
        this.visitChildren(ctx);
        this.popScope();
        
        return null;
    }

    visitMethodDecl(ctx: any): any {
        const methodName = ctx.ID()?.text || 'UnknownMethod';
        
        this.addSymbol({
            name: methodName,
            type: 'method',
            scope: this.currentScope,
            line: ctx.start?.line || 1,
            column: ctx.start?.charPositionInLine || 0,
            visibility: this.getCurrentVisibility(ctx)
        });

        this.visitChildren(ctx);
        return null;
    }

    visitDataDecl(ctx: any): any {
        const varName = ctx.ID()?.text || ctx.dataItem()?.ID()?.text || 'UnknownVariable';
        
        this.addSymbol({
            name: varName,
            type: 'variable',
            scope: this.currentScope,
            line: ctx.start?.line || 1,
            column: ctx.start?.charPositionInLine || 0,
            dataType: this.extractDataType(ctx)
        });

        this.visitChildren(ctx);
        return null;
    }

    visitIncludeStmt(ctx: any): any {
        const includeName = ctx.ID()?.text || ctx.LT_ID()?.text || ctx.SLASH_ID()?.text;
        if (includeName) {
            this.dependencies.push(includeName);
        }
        
        this.visitChildren(ctx);
        return null;
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

    private popScope(): void {
        const currentScopeInfo = this.scopes.find(s => s.name === this.currentScope);
        if (currentScopeInfo) {
            currentScopeInfo.endLine = this.currentLine;
        }
        
        // Find parent scope
        const parentScope = this.scopes.find(s => s.name === currentScopeInfo?.parent);
        this.currentScope = parentScope?.name || 'global';
    }

    private getCurrentVisibility(ctx: any): 'public' | 'protected' | 'private' {
        // This is a simplified implementation
        // In a real implementation, you'd traverse up the context to find visibility modifiers
        return 'public';
    }

    private extractDataType(ctx: any): string | undefined {
        // Extract data type from typeSpecifier
        const typeSpec = ctx.typeSpecifier?.();
        if (typeSpec) {
            return typeSpec.qualifiedName?.()?.text || typeSpec.builtInType?.()?.text;
        }
        return undefined;
    }
}

export class AbapSystemSymbolResolver {
    // This would integrate with existing ADT tools to get symbol information from SAP system
    public async resolveSymbols(symbols: AbapSymbolInfo[]): Promise<AbapSymbolInfo[]> {
        const resolvedSymbols: AbapSymbolInfo[] = [];
        
        for (const symbol of symbols) {
            const resolved = await this.resolveSymbol(symbol);
            resolvedSymbols.push(resolved);
        }
        
        return resolvedSymbols;
    }

    private async resolveSymbol(symbol: AbapSymbolInfo): Promise<AbapSymbolInfo> {
        // This would use existing handlers like handleGetClass, handleGetFunction, etc.
        // to get additional information from the SAP system
        
        try {
            switch (symbol.type) {
                case 'class':
                    return await this.resolveClassSymbol(symbol);
                case 'function':
                    return await this.resolveFunctionSymbol(symbol);
                default:
                    return symbol;
            }
        } catch (error) {
            // If resolution fails, return original symbol
            return symbol;
        }
    }

    private async resolveClassSymbol(symbol: AbapSymbolInfo): Promise<AbapSymbolInfo> {
        // Use handleGetClass to get class information
        // This is a placeholder - would integrate with actual handlers
        return {
            ...symbol,
            description: `Class ${symbol.name}`,
            package: 'UNKNOWN' // Would be resolved from SAP system
        };
    }

    private async resolveFunctionSymbol(symbol: AbapSymbolInfo): Promise<AbapSymbolInfo> {
        // Use handleGetFunction to get function information
        return {
            ...symbol,
            description: `Function ${symbol.name}`,
            package: 'UNKNOWN' // Would be resolved from SAP system
        };
    }
}
