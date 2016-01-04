import * as fsPath from 'path'
import * as t from 'babel-types'
import template from 'babel-template'

const programImports = (programNode) => {
  return programNode.body.filter(bodyNode => t.isImportDeclaration(bodyNode))
}

const insertDecoratorImportIntoProgramBody = (programNode) => {
  const buildImport = template(`const { IMPORT_NAME } = require(SOURCE)`)

  const decoratorImport = buildImport({
    IMPORT_NAME: t.identifier('injectAsyncComponent'),
    SOURCE: t.stringLiteral('babel-plugin-async-component/lib/AsyncComponentContainer')
  })

  programNode.body = [ decoratorImport, ...programNode.body ]
}

const extractLoadingElementFromDecorator = (decorator) => {
  const misuseErrorMessage = '`@asyncLoadingElement` decorator requires a '
    + 'single argument which must be a JSX tag'

  if (decorator.expression.arguments.length !== 1) {
    throw Error(misuseErrorMessage)
  }

  const [ loadingElement ] = decorator.expression.arguments
  if (!loadingElement || !t.isJSXElement(loadingElement)) {
    throw Error(misuseErrorMessage)
  }

  return loadingElement
}

const extractComponentNameFromDecorator = (decorator) => {
  const misuseErrorMessage = '`@asyncComponent` decorator requires a single '
    + 'argument which must be an identifier'

  if (decorator.expression.arguments.length !== 1) {
    throw Error(misuseErrorMessage)
  }

  const [ asyncComponentIdentifier ] = decorator.expression.arguments

  if (!asyncComponentIdentifier || !t.isIdentifier(asyncComponentIdentifier)) {
    throw Error(misuseErrorMessage)
  }

  return asyncComponentIdentifier.name
}

const extractComponentNamesFromDecorators = (decorators) => {
  return decorators.map(extractComponentNameFromDecorator)
}

const filterAsyncImports = (programImports, asyncComponentNames) => {
  return programImports.filter((programImport) => {
    // TODO support more diverse specifiers like { Foo }, and { Foo, Bar }
    const [ firstSpecifier ] = programImport.specifiers
    return asyncComponentNames.indexOf(firstSpecifier.local.name) >= 0
  })
}

const importNamesToSources = (asyncImports) => {
  return asyncImports.map(asyncImport => {
    // TODO support more diverse specifiers like { Foo }, and { Foo, Bar }
    const [ firstSpecifier ] = asyncImport.specifiers
    return {
      name: firstSpecifier.local.name,
      source: asyncImport.source.value,
    }
  })
}

const deleteImportsFromProgram = (deletableImports, programNode) => {
  return programNode.body = programNode.body.filter(bodyNode => {
    return deletableImports.indexOf(bodyNode) === -1
  })
}

const applyDecoratorToComponentClass = (decorators, loadingElement, decoratorInfo) => {
  const buildDecorator = template(`
    injectAsyncComponent(IMPORT_NAME_STRING, LOADING_ELEMENT, (onReady) => {
      require.ensure(SOURCE_PATH, (require) => {
        const IMPORT_NAME = require(SOURCE_PATH).default
        onReady(IMPORT_NAME)
      })
    })
  `)
  const decorator = buildDecorator({
    IMPORT_NAME: t.identifier(decoratorInfo.name),
    IMPORT_NAME_STRING: t.stringLiteral(decoratorInfo.name),
    SOURCE_PATH: t.stringLiteral(decoratorInfo.source),
    LOADING_ELEMENT: loadingElement
  })
  decorators.push(decorator)
}

const asyncComponentDecoratorVisitor = {
  ClassDeclaration(path) {
    const { programNode } = this
    const { node: classDeclarationNode } = path
    const decorators = classDeclarationNode.decorators || []

    if (!decorators.length) {
      return
    }

    // Collect the component decorators
    const asyncComponentDecorators = decorators.filter((decorator) => {
      return decorator.expression.callee.name === 'asyncComponent'
    })

    // Get the loading element decorator
    const asyncLoadingElementDecorator = decorators.find((decorator) => {
      return decorator.expression.callee.name === 'asyncLoadingElement'
    })

    // Skip out if we don't have any relavent decorators
    if ( !asyncLoadingElementDecorator && !asyncComponentDecorators.length) {
      return
    }

    // Error out if we don't have one load element decorator and at least one
    // component decorators
    if (!asyncLoadingElementDecorator || !asyncComponentDecorators.length) {
      throw new Error(''
        + 'One `@asyncLoadingElement` decorator is needed when a class is '
        + 'decorated with one or more `@asyncComponent` decorators and '
        + 'vice-versa.'
      )
    }

    insertDecoratorImportIntoProgramBody(programNode)

    const loadingElement = extractLoadingElementFromDecorator(asyncLoadingElementDecorator)
    const asyncComponentNames = extractComponentNamesFromDecorators(asyncComponentDecorators)

    const { allProgramImports } = this
    const asyncImports = filterAsyncImports(allProgramImports, asyncComponentNames)

    const importNameToSourceLookup = importNamesToSources(asyncImports)

    // Delete the ambient loading element decorator
    const loadingElementDecoratorIndex = decorators.indexOf(asyncLoadingElementDecorator)
    decorators.splice(loadingElementDecoratorIndex, 1)

    // Delete all of the ambient component decorators
    asyncComponentDecorators.forEach((decorator) => {
      const decoratorIndex = decorators.indexOf(decorator)
      decorators.splice(decoratorIndex, 1)
    })

    deleteImportsFromProgram(asyncImports, programNode)

    const applyDecorator = applyDecoratorToComponentClass.bind(
      null,
      decorators,
      loadingElement
    )

    importNameToSourceLookup.forEach(applyDecorator)

    path.traverse(componentRenderMethodVisitor, {
      asyncComponentNames
    })
  }
}

const componentRenderMethodVisitor = {
  ClassMethod(path) {
    if (path.node.key.name !== 'render') {
      return
    }

    const { asyncComponentNames } = this

    const extractValueExpressions = asyncComponentNames.map((componentName) => {
      const extractValueBuilder = template(`
        const { COMPONENT_NAME } = this.props
      `)

      const extractValueExpression = extractValueBuilder({
        COMPONENT_NAME: t.identifier(componentName)
      })

      return extractValueExpression
    })

    path.node.body.body = [ ...extractValueExpressions, ...path.node.body.body ]
  }
}

export default function() {
  return {
    visitor: {
      Program(path) {
        // Process ES6+ modules only
        if (path.node.sourceType !== 'module') {
          return
        }

        const allProgramImports = programImports(path.node)

        path.traverse(asyncComponentDecoratorVisitor, {
          programNode: path.node,
          allProgramImports,
        })
      }
    }
  }
}
