//  ABAP (subset) grammar — combined (parser + lexer)
//  Goal: parse majority of SAP standard includes; tolerate unknown
//  constructs by falling back to `unknownStatement`.
//  Case‑insensitive literals enabled.

grammar Abap;
options { caseInsensitive = true; }

// =========================================================
//  COMMENTS & WHITESPACE  (placed first to avoid masking by operators)
// =========================================================
LINE_COMMENT : [ \t]* '*' (~[\r\n])* -> skip; // ABAP full-line comment (з пробілами)
COMMENT      : '"' ~[\r\n]* -> skip; // ABAP inline comment
WS           : [ \t\r\n]+ -> skip;

// =========================================================
//  TOP‑LEVEL
// =========================================================
abapSource
    : ( reportDef
      | functionPoolDef
      | classDef
      | programDef
      | includeDef
      | functionModuleDef
      | topLevelDecl 
      | formDef
      | performStmt
      )* EOF
    ;

topLevelDecl
    : tablesDecl
    | dataDecl
    | typePoolsDecl
    | constantsDecl
    // … (додавайте решту за потреби)
    ;

functionPoolDef: FUNCTION_POOL ID messageIdClause? DOT;

// =========================================================
//  CLASS
// =========================================================
classDef
    : CLASS ID DEFINITION (INHERITING FROM ID)? classModifiers? DOT classBody? ENDCLASS DOT
    | CLASS ID IMPLEMENTATION DOT classImpl? ENDCLASS DOT
    ;

classModifiers     : (PUBLIC | PROTECTED | PRIVATE | FINAL | ABSTRACT | CREATE visibilityModifier)* ;
visibilityModifier : PUBLIC | PROTECTED | PRIVATE ;

classBody
    : ( classSection
      | interfacesDecl
      | aliasesDecl
      | typeDecl
      | dataDecl
      | constantsDecl
      | classMethodsDecl
      | methodDecl
      | methodImpl
      )*
    ;

classSection   : visibilityModifier SECTION DOT ;
interfacesDecl : INTERFACES ID DOT ;

aliasesDecl   : ALIASES aliasMapping (COMMA aliasMapping)* DOT ;
aliasMapping  : ID (FOR qualifiedName)? ;

classImpl     : (methodImpl | dataDecl | typeDecl | statement)* ;

// =========================================================
//  REPORT / PROGRAM / INCLUDE / FUNCTION MODULE
// =========================================================
reportDef         : REPORT ID DOT reportBody? ;
reportBody        : (statement | dataDecl | typeDecl | constantsDecl | methodImpl | formDef | includeDef | includeStmt | messageIdStmt | moduleStmt | tablesDecl | classDataDecl | staticsDecl | parametersDecl | selectOptionsDecl | unknownStatement)* ;
programDef        : PROGRAM ID DOT programBody? ENDPROGRAM? DOT? ;
programBody       : (statement | dataDecl | typeDecl | constantsDecl | methodImpl | formDef | includeDef | includeStmt | messageIdStmt | moduleStmt | tablesDecl | classDataDecl | staticsDecl | parametersDecl | selectOptionsDecl | unknownStatement)* ;
includeDef        : INCLUDE (COLON (ID | LT_ID) (COMMA (ID | LT_ID))*)? (ID | LT_ID)? (DOT | PRAGMA_DIRECTIVE)? ;
includeStmt       : INCLUDE (LT_ID | ID | SLASH_ID) DOT ;
functionModuleDef : FUNCTION ID DOT functionBody? ENDFUNCTION DOT ;
functionBody      : (statement | dataDecl | typeDecl | tablesDecl)* ;

messageIdClause : (MESSAGE ID | MESSAGE_ID) (ID | INT | LT_ID);
messageIdStmt   : messageIdClause DOT;
MESSAGE_ID      : 'MESSAGE-ID' ;

moduleStmt    : MODULE ID (INPUT | OUTPUT)? (DOT | PRAGMA_DIRECTIVE)? (statement | dataDecl | typeDecl | tablesDecl)* ENDMODULE (DOT | PRAGMA_DIRECTIVE)? ;
tablesDecl    : TABLES (COLON (ID | LT_ID) (COMMA (ID | LT_ID))*)? (ID | LT_ID)? (DOT | PRAGMA_DIRECTIVE)? ;
classDataDecl : CLASS_DATA COLON (dataItem | LT_ID) (COMMA (dataItem | LT_ID))* (DOT | PRAGMA_DIRECTIVE)? ;
staticsDecl   : STATICS COLON (dataItem | LT_ID) (COMMA (dataItem | LT_ID))* (DOT | PRAGMA_DIRECTIVE)? ;
parametersDecl : PARAMETERS (ID | LT_ID) typeSpecifier? (DOT | PRAGMA_DIRECTIVE)? ;
selectOptionsDecl : SELECT_OPTIONS (ID | LT_ID) FOR (ID | LT_ID) (DOT | PRAGMA_DIRECTIVE)? ;

// =========================================================
//  FORM / PERFORM
// =========================================================
formDef     : FORM ID (DOT | PRAGMA_DIRECTIVE)? (statement | dataDecl | typeDecl | tablesDecl)* ENDFORM (DOT | PRAGMA_DIRECTIVE)? ;
performStmt : PERFORM ID DOT ;

// =========================================================
//  METHODS
// =========================================================
methodDecl
    : (METHODS | CLASS_METHODS) ID methodParameters? DOT pragmaList?
    ;

methodParameters
    : (IMPORTING  methodParam+)?
      (EXPORTING  methodParam+)?
      (CHANGING   methodParam+)?
      (RETURNING  valueParam)?
      (RAISING    qualifiedName+)?
    ;

methodParam
    : (BANG? (ID | LT_ID) | valueParam) (typeSpecifier (DEFAULT expression)? (OPTIONAL)?)?
    ;

valueParam
    : VALUE LPAREN (ID | VALUE | DATA) RPAREN (typeSpecifier)?
    ;

methodImpl
    : METHOD qualifiedName DOT statement* ENDMETHOD DOT
    ;

classMethodsDecl
    : CLASS_METHODS ID methodParameters? DOT pragmaList?
    ;

qualifiedName
    : (builtInType | ID) ( (DOUBLEARROW | ARROW | TILDE | MINUS) (builtInType | ID) )*
    ;

// Вбудовані типи ABAP
builtInType
    : STRING_TYPE | I | C | N | P | F | D | T | X | XSTRING
    | DECFLOAT16 | DECFLOAT34 | STRING_TABLE
    | INT1 | INT2 | INT8 | UTCLONG
    ;

// =========================================================
//  DATA / TYPES / CONSTANTS
// =========================================================

dataDecl
    : DATA COLON dataItem (COMMA dataItem)* legacyDataOptions? (DOT | PRAGMA_DIRECTIVE)?
    | DATA (ID | LT_ID) (typeSpecifier | likeSpecifier)? (VALUE expression)? legacyDataOptions? (DOT | PRAGMA_DIRECTIVE)?
    | DATA LPAREN (ID | LT_ID) RPAREN (typeSpecifier | likeSpecifier)? (VALUE expression)? legacyDataOptions? (DOT | PRAGMA_DIRECTIVE)?
    ;

legacyDataOptions
    : (OCCURS INT)? (WITH HEADER LINE)? (LENGTH LPAREN INT RPAREN)?
    ;

dataItem
    : ID
      (typeSpecifier | likeSpecifier)?
      (OCCURS INT)?
      (WITH HEADER LINE)?
      (LENGTH INT)?
      (VALUE expression)?
      pragmaList?
    ;

typeDecl
    : TYPES ID typeSpecifier DOT pragmaList?
    ;

typeSpecifier
    : TYPE tableType
    | TYPE qualifiedName
    | TYPE REF TO qualifiedName
    | TYPE
    ;

tableType
    : (STANDARD | SORTED | HASHED)? TABLE OF qualifiedName tableOptions?
    ;

tableOptions
    : (WITH (UNIQUE | NON_UNIQUE)? (KEY (ID | LT_ID)+)?)?
    ;

likeSpecifier : LIKE ID ;

constantsDecl
    : CONSTANTS COLON dataItem (COMMA dataItem)* pragmaList? DOT
    | CONSTANTS ID (typeSpecifier | likeSpecifier)? (VALUE expression)? pragmaList? DOT
    ;

typePoolsDecl
    : TYPE_POOLS ID DOT
    ;

pragmaList : (PRAGMA)+ ;
PRAGMA      : '##' [A-Za-z_][A-Za-z0-9_]* -> channel(HIDDEN);
PRAGMA_DIRECTIVE : '"#' [A-Za-z_][A-Za-z0-9_]* (~[\r\n])* ;

// =========================================================
//  STATEMENTS (subset)
// =========================================================

statement
    : assignment
    | ifBlock
    | loopBlock
    | tryBlock
    | methodCall
    | callFunctionStmt
    | callMethodStmt
    | selectBlock
    | dataDecl
    | constantsDecl
    | includeStmt
    | unknownStatement
    ;

unknownStatement : (~DOT)+ (DOT | PRAGMA_DIRECTIVE)? ;

// — assignment
assignment : expression EQ expression DOT ;

assignStmt : ASSIGN expression TO (LT_ID | ID) DOT ;

// — IF / LOOP / TRY (very relaxed bodies)
ifBlock   : IF expression DOT .*? ENDIF DOT ;
loopBlock : LOOP AT? .*? ENDLOOP DOT ;
tryBlock  : TRY DOT .*? ENDTRY DOT ;

// — CALLS (minimal)
methodCall       : expression ARROW ID LPAREN callArgList? RPAREN DOT ;
callFunctionStmt : CALL FUNCTION STRING (callParameterList)? DOT ;
callMethodStmt   : CALL METHOD expression (callParameterList)? DOT ;

callArgList       : callArgument (COMMA callArgument)* ;
callArgument      : (ID EQ)? expression ;
callParameterList : callArgument* ;

// — SELECT block (stub)
selectBlock : SELECT .*? ENDSELECT DOT ;

// =========================================================
//  EXPRESSIONS (simplified)
// =========================================================
expression
    : literal
    | HASH (LPAREN callArgList? RPAREN)?
    | qualifiedName
    | ID
    | ID LPAREN callArgList? RPAREN
    | LPAREN expression RPAREN
    | expression (STAR|DIV|PLUS|MINUS|LT|GT|EQ|NE|LE|GE|AND|OR) expression
    | valueParam
    | BACKTICK_LITERAL
    | expression IS (INITIAL | NOT BOUND)
    | VALUE valuePredicate
    | valuePredicate
    ;

literal : INT | STRING | STRING_TEMPLATE | BACKTICK_STRING ;

valuePredicate : IS (INITIAL | NOT BOUND) ;

// =========================================================
//  KEYWORDS
// =========================================================
CLASS_METHODS : 'CLASS-METHODS' ;
CLASS         : 'CLASS' ; DEFINITION:'DEFINITION' ; INHERITING:'INHERITING' ; FROM:'FROM' ;
ENDCLASS:'ENDCLASS' ; IMPLEMENTATION:'IMPLEMENTATION' ; PUBLIC:'PUBLIC' ; PROTECTED:'PROTECTED' ; PRIVATE:'PRIVATE' ;
FINAL:'FINAL' ; ABSTRACT:'ABSTRACT' ; CREATE:'CREATE' ; SECTION:'SECTION' ; INTERFACES:'INTERFACES' ;
ALIASES:'ALIASES' ; FOR:'FOR' ; PROGRAM:'PROGRAM' ; ENDPROGRAM:'ENDPROGRAM' ; INCLUDE:'INCLUDE' ;
FUNCTION:'FUNCTION' ; ENDFUNCTION:'ENDFUNCTION' ; FORM:'FORM' ; ENDFORM:'ENDFORM' ; PERFORM:'PERFORM' ;
METHODS:'METHODS' ; METHOD:'METHOD' ; ENDMETHOD:'ENDMETHOD' ;
IMPORTING:'IMPORTING' ; EXPORTING:'EXPORTING' ; CHANGING:'CHANGING' ; RAISING:'RAISING' ;
DATA:'DATA' ; TYPES:'TYPES' ; TYPE:'TYPE' ; REF:'REF' ; TO:'TO' ; LIKE:'LIKE' ; VALUE:'VALUE' ;
RETURN:'RETURN' ; IF:'IF' ; ELSE:'ELSE' ; ENDIF:'ENDIF' ; LOOP:'LOOP' ; ENDLOOP:'ENDLOOP' ;
TRY:'TRY' ; ENDTRY:'ENDTRY' ; CATCH:'CATCH' ;
CONSTANTS:'CONSTANTS' ; FIELD_SYMBOLS:'FIELD-SYMBOLS' ; RETURNING:'RETURNING' ; DEFAULT:'DEFAULT' ;
AND:'AND' ; OR:'OR' ;

MESSAGE     : 'MESSAGE' ;
MODULE      : 'MODULE' ;
INPUT       : 'INPUT' ;
OUTPUT      : 'OUTPUT' ;
TABLES      : 'TABLES' ;
CLASS_DATA  : 'CLASS-DATA' ;
STATICS     : 'STATICS' ;
PARAMETERS  : 'PARAMETERS' ;
SELECT_OPTIONS : 'SELECT-OPTIONS' ;
FUNCTION_POOL : 'FUNCTION-POOL' ;
TYPE_POOLS : 'TYPE-POOLS';
REPORT : 'REPORT' ;
STANDARD : 'STANDARD' ;
SORTED   : 'SORTED' ;
HASHED   : 'HASHED' ;
TABLE    : 'TABLE' ;
OF       : 'OF' ;
OCCURS     : 'OCCURS';
WITH       : 'WITH';
UNIQUE    : 'UNIQUE';
NON_UNIQUE: 'NON-UNIQUE';
KEY       : 'KEY';
HEADER     : 'HEADER';
LINE       : 'LINE';
LENGTH     : 'LENGTH';

// Вбудовані типи ABAP
STRING_TYPE : 'STRING' ;
I           : 'I' ;
C           : 'C' ;
N           : 'N' ;
P           : 'P' ;
F           : 'F' ;
D           : 'D' ;
T           : 'T' ;
X           : 'X' ;
XSTRING     : 'XSTRING' ;
DECFLOAT16  : 'DECFLOAT16' ;
DECFLOAT34  : 'DECFLOAT34' ;
STRING_TABLE: 'STRING_TABLE' ;
INT1        : 'INT1' ;
INT2        : 'INT2' ;
INT8        : 'INT8' ;
UTCLONG     : 'UTCLONG' ;

IS      : 'IS' ;
INITIAL : 'INITIAL' ;
NOT     : 'NOT' ;
BOUND   : 'BOUND' ;

// =========================================================
//  OPERATORS & PUNCTUATION
// =========================================================
DOT:'.' ; COMMA:',' ; COLON:':' ; LPAREN:'(' ; RPAREN:')' ;
LBRACKET:'[' ; RBRACKET:']' ; LBRACE:'{' ; RBRACE:'}' ;
PIPE:'|' ; AMP:'&' ; QMARK:'?' ; BACKSLASH:'\\' ; BACKTICK:'`' ;
EQ:'=' ; NE:'<>' ; LE:'<=' ; GE:'>=' ; LT:'<' ; GT:'>' ;
STAR:'*' ; DIV:'/' ; PLUS:'+' ; MINUS:'-' ; PERCENT:'%';
BANG:'!' ; TILDE:'~' ; ARROW:'->' ; DOUBLEARROW:'=>' ; STATIC_ARROW:'->*' ; HASH:'#' ;

// =========================================================
//  IDENTIFIERS & LITERALS
// =========================================================
LT_ID           : '<' [A-Za-z0-9_%/$-]+ '>' ;
SLASH_ID        : '/' [A-Za-z0-9_%/$-]+ ( '/' [A-Za-z0-9_%/$-]+ )* ;
STRING_TEMPLATE : '|' (~'|' | '\\' '|')* '|' ;
STRING          : '\'' (~['\r\n] | '\'' '\'')* '\'' ;
INT             : [0-9]+ ;
ID              : [A-Za-z_%][A-Za-z0-9_%-]* ;
BACKTICK_STRING : '`' .*? '`';
BACKTICK_LITERAL : '`' (~'`')* '`' ;