/**
 * @license
 * Copyright 2016 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as ts from "typescript";

import * as Lint from "../lint";

export class Rule extends Lint.Rules.AbstractRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "no-switch-case-comma-operator",
        description: "Disallows comma operator in case clauses",
        descriptionDetails: Lint.Utils.dedent`
            Comma operator is dissalowed in case clauses since it leads to unconvenient result.

            For example, the following is not allowed:

            \`\`\`ts
            switch(foo) {
                case 0, 1:
                    someFunc(foo);
                case 2:
                    someOtherFunc(foo);
            }
            \`\`\`

            In example above \`foo = 0\` will be never matches since comma operatorn return value of right expression.
            `,
        rationale: "Comma operator produce not desired behavior and skips all but last in case statements,",
        optionsDescription: "Not configurable.",
        options: null,
        optionExamples: ["true"],
        type: "functionality",
    };
    /* tslint:enable:object-literal-sort-keys */

    public static FAILURE_STRING = "Do not use comma operator in case clauses. Create case clause for each option instead.";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new NoSwitchCaseCommaOperator(sourceFile, this.getOptions()));
    }
}

export class NoSwitchCaseCommaOperator extends Lint.RuleWalker {
    public visitSwitchStatement(node: ts.SwitchStatement) {
        const switchClauses = node.caseBlock.clauses;

        switchClauses.forEach((child, i) => {
            if (child.kind === ts.SyntaxKind.CaseClause) {
                const caseClause = child as ts.CaseClause;
                const expression = caseClause.expression;

                if (this.isCommaExpression(expression)) {
                    const failure = this.createFailure(expression.getStart(), expression.getWidth(), Rule.FAILURE_STRING, this.fix(caseClause));
                    this.addFailure(failure);
                }
            }
        });
        super.visitSwitchStatement(node);
    }

    private isCommaExpression(node: ts.Node) {
        if (node.kind !== ts.SyntaxKind.BinaryExpression) {
            return false;
        }
        if ((node as ts.BinaryExpression).operatorToken.kind !== ts.SyntaxKind.CommaToken) {
            return false;
        }

        return true;
    }
    private fix(node: ts.CaseClause) {
        let expression = node.expression;
        let clausesList: ts.Node[] = [];

        while (this.isCommaExpression(expression)) {
            const commaExpression = expression as ts.BinaryExpression;
            clausesList = ([commaExpression.right] as ts.Node[]).concat(clausesList);
            expression = commaExpression.left;
        }
        clausesList = ([expression] as ts.Node[]).concat(clausesList);
        const padding = node.getFullText().substr(0, node.getStart() - node.getFullStart());

        return new Lint.Fix(Rule.metadata.ruleName, [
            this.deleteText(node.getStart(), node.statements.pos - node.getStart()),
            this.appendText(node.getStart(), clausesList.map(x => 'case ' + x.getFullText().trim() + ':').join(padding)),
        ]);
    }
}
