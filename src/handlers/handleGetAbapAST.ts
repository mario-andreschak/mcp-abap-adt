import { McpError, ErrorCode } from '../lib/utils';
import { writeResultToFile } from '../lib/writeResultToFile';

export const TOOL_DEFINITION = {
  name: "GetAbapAST",
  description: "Parse ABAP code and return AST (Abstract Syntax Tree) in JSON format.",
  inputSchema: {
    type: "object",
    properties: {
      code: { 
        type: "string", 
        description: "ABAP source code to parse" 
      },
      filePath: {
        type: "string",
        description: "Optional file path to write the result to"
      }
    },
    required: ["code"]
  }
} as const;

// Simplified AST generator that doesn't depend on ANTLR until it's properly set up
class SimpleAbapASTGenerator {
    public parseToAST(code: string): any {
        try {
            // This is a placeholder implementation until ANTLR is properly configured
            // It provides basic structure analysis
            const lines = code.split('\n');
            const ast = {
                type: 'abapSource',
                sourceLength: code.length,
                lineCount: lines.length,
                structures: this.analyzeStructures(code),
                includes: this.findIncludes(code),
                classes: this.findClasses(code),
                methods: this.findMethods(code),
                dataDeclarations: this.findDataDeclarations(code),
                forms: this.findForms(code)
            };
            
            return ast;
        } catch (error) {
            throw new Error(`Failed to parse ABAP code: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private analyzeStructures(code: string): any[] {
        const structures: any[] = [];
        const lines = code.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim().toLowerCase();
            
            if (line.startsWith('class ')) {
                structures.push({
                    type: 'class',
                    line: i + 1,
                    content: lines[i].trim()
                });
            } else if (line.startsWith('method ')) {
                structures.push({
                    type: 'method',
                    line: i + 1,
                    content: lines[i].trim()
                });
            } else if (line.startsWith('form ')) {
                structures.push({
                    type: 'form',
                    line: i + 1,
                    content: lines[i].trim()
                });
            } else if (line.startsWith('function ')) {
                structures.push({
                    type: 'function',
                    line: i + 1,
                    content: lines[i].trim()
                });
            }
        }
        
        return structures;
    }

    private findIncludes(code: string): string[] {
        const includeRegex = /include\s+([a-zA-Z0-9_/<>]+)/gi;
        const matches = code.match(includeRegex) || [];
        return matches.map(match => match.replace(/include\s+/i, '').trim());
    }

    private findClasses(code: string): any[] {
        const classRegex = /class\s+([a-zA-Z0-9_]+)\s+(definition|implementation)/gi;
        const classes: any[] = [];
        let match;
        
        while ((match = classRegex.exec(code)) !== null) {
            classes.push({
                name: match[1],
                type: match[2].toLowerCase(),
                position: match.index
            });
        }
        
        return classes;
    }

    private findMethods(code: string): any[] {
        const methodRegex = /methods?\s+([a-zA-Z0-9_]+)/gi;
        const methods: any[] = [];
        let match;
        
        while ((match = methodRegex.exec(code)) !== null) {
            methods.push({
                name: match[1],
                position: match.index
            });
        }
        
        return methods;
    }

    private findDataDeclarations(code: string): any[] {
        const dataRegex = /data:?\s+([a-zA-Z0-9_]+)/gi;
        const declarations: any[] = [];
        let match;
        
        while ((match = dataRegex.exec(code)) !== null) {
            declarations.push({
                name: match[1],
                position: match.index
            });
        }
        
        return declarations;
    }

    private findForms(code: string): any[] {
        const formRegex = /form\s+([a-zA-Z0-9_]+)/gi;
        const forms: any[] = [];
        let match;
        
        while ((match = formRegex.exec(code)) !== null) {
            forms.push({
                name: match[1],
                position: match.index
            });
        }
        
        return forms;
    }
}

export async function handleGetAbapAST(args: any) {
    try {
        if (!args?.code) {
            throw new McpError(ErrorCode.InvalidParams, 'ABAP code is required');
        }

        const astGenerator = new SimpleAbapASTGenerator();
        const ast = astGenerator.parseToAST(args.code);

        const result = {
            isError: false,
            content: [
                {
                    type: "text",
                    text: JSON.stringify(ast, null, 2)
                }
            ]
        };

        if (args.filePath) {
            writeResultToFile(JSON.stringify(ast, null, 2), args.filePath);
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
