import * as fsPath from 'path'
import * as t from 'babel-types'
import template from 'babel-template'

// Get all of the import declarations from a program
const extractProgramImports = (programNode) => {
  return programNode.body.filter(bodyNode => t.isImportDeclaration(bodyNode))
}

// Build up and inject an import statement for loading the decorator
const insertDecoratorImportIntoProgramBody = (programNode) => {
  // Build it up
  const buildImport = template(`const { IMPORT_NAME } = require(SOURCE)`)
  const decoratorImport = buildImport({
    IMPORT_NAME: t.identifier('injectAsyncComponent'),
    SOURCE: t.stringLiteral('babel-plugin-async-component/lib/AsyncComponentContainer')
  })

  // And inject it
  programNode.body = [ decoratorImport, ...programNode.body ]
}

// The ambient `asyncLoadingElement` decorator is used to provide a JSX element.
// Here we extract that argument for use in the decorator we eventually inject.
const extractLoadingElementFromDecorator = (decorator) => {
  const misuseErrorMessage = '`@asyncLoadingElement` decorator requires a '
    + 'single argument which must be a JSX tag'

  // Error out when no loading element is specified
  if (decorator.expression.arguments.length !== 1) {
    throw Error(misuseErrorMessage)
  }

  // Extract the loading element
  const [ loadingElement ] = decorator.expression.arguments

  // Validate the loading element
  if (!loadingElement || !t.isJSXElement(loadingElement)) {
    throw Error(misuseErrorMessage)
  }

  return loadingElement
}

// The ambient `asyncComponent` decorators are used to provide the identifiers
// of each component class we want to be loaded asynchronously. Here we extract
// that argument from a single decorator for use in the decorator we eventually
// inject.
const extractComponentNameFromDecorator = (decorator) => {
  const misuseErrorMessage = '`@asyncComponent` decorator requires a single '
    + 'argument which must be an identifier'

  // Error out if we don't have any arguments
  if (decorator.expression.arguments.length !== 1) {
    throw Error(misuseErrorMessage)
  }

  // Extract the identifier
  const [ asyncComponentIdentifier ] = decorator.expression.arguments

  // Validate the identifier
  if (!asyncComponentIdentifier || !t.isIdentifier(asyncComponentIdentifier)) {
    throw Error(misuseErrorMessage)
  }

  return asyncComponentIdentifier.name
}

// Extract useful arguments from an array of `asyncComponent` decorators
const extractComponentNamesFromDecorators = (decorators) => {
  return decorators.map(extractComponentNameFromDecorator)
}

// Get all of a program's import statements that are implicated by
// `asyncComponent` decorators
const filterAsyncImports = (programImports, asyncComponentNames) => {
  return programImports.filter((programImport) => {
    // TODO support more diverse specifiers like { Foo }, and { Foo, Bar }
    const [ firstSpecifier ] = programImport.specifiers
    return asyncComponentNames.indexOf(firstSpecifier.local.name) >= 0
  })
}

// Generates a lookup table of import name to source
// ```
// import Foo from '../Foo'
// import Bar from '../Bar'
// ```
// yields:
// ```
// {
//   Foo: '../Foo',
//   Bar: '../Bar',
// }
// ```
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

// Given a list of imports remove them from a given program
const deleteImportsFromProgram = (deletableImports, programNode) => {
  return programNode.body = programNode.body.filter(bodyNode => {
    return deletableImports.indexOf(bodyNode) === -1
  })
}

// Given all the appropriate metadata inject a `injectAsyncComponent` decorator
// around a given react component
const applyDecoratorToComponentClass = (componentClass, loadingElement, decoratorInfo) => {
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
  componentClass.decorators.push(decorator)
}

// This visitor modifies the render method so it properly destructures the
// component prop from `this.props` so the method will transparently use the
// component injected by the wrapping component.
const methodVisitor = {
  ClassMethod(classMethodPath) {
    const { asyncComponentNames } = this

    // Bail if we're not in `render()`
    if (classMethodPath.node.key.name !== 'render') {
      return
    }

    // Build up the fragment
    const extractInjectedComponent = asyncComponentNames.map((componentName) => {
      const extractInjectedComponentBuilder = template(`
        const { COMPONENT_NAME } = this.props
      `)

      const extractInjectedComponentExpression = extractInjectedComponentBuilder({
        COMPONENT_NAME: t.identifier(componentName)
      })

      return extractInjectedComponentExpression
    })

    // Inject the generated fragment
    classMethodPath.node.body.body = [
      ...extractInjectedComponent,
      ...classMethodPath.node.body.body,
    ]
  }
}

// This is where most of the business happens. In a nutshell we read many values
// from the AST and use them to replace the "ambient decorators" with the
// the appropriate webpack "code splitting" logic.
// See: https://webpack.github.io/docs/code-splitting.html
const classVisitor = {
  ClassDeclaration(classDeclarationPath) {
    // Destructure values we'll need
    const { node: classDeclarationNode } = classDeclarationPath
    const { decorators } = classDeclarationNode
    const { programPath } = this
    const { node: programNode } = programPath

    // Bail if there are no decorators
    if (!decorators) {
      return
    }

    // Collect the `asynComponent` decorators
    const componentDecorators = decorators.filter((decorator) => {
      return decorator.expression.callee.name === 'asyncComponent'
    })

    // Get the `asyncLoadingElement` decorator
    const loadingElementDecorator = decorators.find((decorator) => {
      return decorator.expression.callee.name === 'asyncLoadingElement'
    })

    // Bail if we don't have any relevant decorators
    if ( !loadingElementDecorator && !componentDecorators.length) {
      return
    }

    // Error out if we don't have one `asyncLoadingElement` decorator and at
    // least one `asyncComponent` decorator
    if (!loadingElementDecorator || !componentDecorators.length) {
      throw new Error(''
        + 'One `@asyncLoadingElement` decorator is needed when a class is '
        + 'decorated with one or more `@asyncComponent` decorators and '
        + 'vice-versa.'
      )
    }

    // Extract the info we need from the ambient decorators
    const loadingElement = extractLoadingElementFromDecorator(
      loadingElementDecorator
    )
    const asyncComponentNames = extractComponentNamesFromDecorators(
      componentDecorators
    )

    // Figure out which of the program imports are associated with the
    // ambient decorators
    const programImports = extractProgramImports(programPath.node)
    const asyncImports = filterAsyncImports(
      programImports,
      asyncComponentNames
    )

    // Get a lookup table of import name to source
    const importNameToSourceLookup = importNamesToSources(asyncImports)

    // Delete the ambient loading element decorator
    const loadingElementDecoratorIndex = decorators.indexOf(loadingElementDecorator)
    insertDecoratorImportIntoProgramBody(programNode)
    decorators.splice(loadingElementDecoratorIndex, 1)

    // Delete all of the ambient component decorators
    componentDecorators.forEach((decorator) => {
      const decoratorIndex = decorators.indexOf(decorator)
      decorators.splice(decoratorIndex, 1)
    })

    // Get rid of the real imports as these will be loaded on demand
    deleteImportsFromProgram(asyncImports, programNode)

    // Add the real decorator to the component class
    importNameToSourceLookup.forEach(applyDecoratorToComponentClass.bind(null,
      classDeclarationNode,
      loadingElement
    ))

    // Drop into render method for additional modifications
    // TODO make this more robust, i.e. component won't always be in `render()`
    classDeclarationPath.traverse(methodVisitor, {
      asyncComponentNames
    })
  }
}

// The main program visitor just makes sure we're in a module and shells out to
// the `classVisitor`
const programVisitor = {
  Program(programPath) {
    // Process ES6+ modules only
    if (programPath.node.sourceType !== 'module') {
      return
    }

    // Start by exploring the classes
    programPath.traverse(classVisitor, { programPath })
  }
}

export default function() {
  return { visitor: programVisitor }
}
