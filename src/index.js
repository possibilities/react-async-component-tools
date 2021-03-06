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
    SOURCE: t.stringLiteral('react-async-component-tools/lib/AsyncComponentContainer')
  })

  // And inject it
  programNode.body = [ decoratorImport, ...programNode.body ]
}

// The ambient `asyncLoadingElement` decorator is used to provide a JSX element.
// Here we extract that argument for use in the decorator we eventually inject.
const extractLoadingElementFromDecorator = (decorator) => {
  // Error out when no loading element is specified
  if (decorator.expression.arguments.length !== 1) {
    throw new Error('`@asyncLoadingElement` decorator requires a single argument')
  }

  // Extract the loading element and return it
  const [ loadingElement ] = decorator.expression.arguments
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
    throw new Error(misuseErrorMessage)
  }

  // Extract the identifier
  const [ asyncComponentIdentifier ] = decorator.expression.arguments

  // Validate the identifier
  if (!t.isIdentifier(asyncComponentIdentifier)) {
    throw new Error(misuseErrorMessage)
  }

  return asyncComponentIdentifier.name
}

// Extract useful arguments from an array of `asyncComponent` decorators
const extractComponentNamesFromDecorators = (decorators) => {
  return decorators.map(extractComponentNameFromDecorator)
}

// Get all of a program's import statements that are implicated by
// `asyncComponent` decorators by iterating all of their specifiers
// and looking for matches in list of async component names that were
// previously extracted from the ambient decorators.
const filterAsyncImports = (programImports, asyncComponentNames) => {
  return programImports.filter((programImport) => {
    return programImport.specifiers.some((specifier) => {
      return asyncComponentNames.indexOf(specifier.local.name) >= 0
    })
  })
}

// Generates a lookup table of import name to source
// ```
// import Foo from '../Foo'
// import { Bar } from '../Bar'
// ```
// yields:
// ```
// {
//   { name: 'Foo', source: '../Foo', isDefaultImport: true },
//   { name: 'Bar', source: '../Bar', isDefaultImport: false }
// }
// ```
const importNamesToSources = (asyncComponentNames, asyncImports) => {
  // For each known import statement that brings in an async component
  return asyncImports.reduce((importsAcc, asyncImport) => {
    // For each specifier
    asyncImport.specifiers.forEach((specifier) => {
      // If it's in the whitelist of async component names push its info
      // into the accumulator
      if (asyncComponentNames.indexOf(specifier.local.name) >= 0) {
        importsAcc.push({
          name: specifier.local.name,
          source: asyncImport.source.value,
          isDefaultImport: t.isImportDefaultSpecifier(specifier),
        })
      }
    })
    return importsAcc
  }, [])
}

// Given a list of imports remove them from the program
const removeImportsFromProgram = (deletableSpecifierNames, deletableImports, programNode) => {

  // Reduce over the program's nodes
  programNode.body = programNode.body.reduce((bodyAcc, bodyNode) => {

    // If it's not deletable, keep it
    if (deletableImports.indexOf(bodyNode) === -1) {
      bodyAcc.push(bodyNode)
    } else {

      // Figure out if it's any of the specifiers are non-default (which I
      // believe means they all are?)
      const hasNonDefaultImportSpecifiers = bodyNode.specifiers.some((specifier) => {
        return t.isImportSpecifier(specifier)
      })

      // If any of the specifiers are non-default
      if (hasNonDefaultImportSpecifiers) {

        // Go ahead and edit the specifiers list removing any that represent
        // a component we want to load async
        bodyNode.specifiers = bodyNode.specifiers.filter((specifier) => {
          return deletableSpecifierNames.indexOf(specifier.local.name) === -1
        })

        // If there are any specifiers left after that go ahead and keep the
        // import statement
        if (bodyNode.specifiers.length) {
          bodyAcc.push(bodyNode)
        }
      }
    }
    return bodyAcc
  }, [])
}

// Given all the appropriate metadata inject a `injectAsyncComponent` decorator
// around a given react component
const applyDecoratorToComponentClass = (componentClass, loadingElement, decoratorInfo) => {

  // Appropriate templates for the parts of the decorator
  const buildDefaultImportDeclaration = template(`
    const IMPORT_NAME = require(SOURCE_PATH).default
  `)
  const buildNonDefaultImportDeclaration = template(`
    const { IMPORT_NAME } = require(SOURCE_PATH).default
  `)
  const buildDecorator = template(`
    injectAsyncComponent(IMPORT_NAME_STRING, LOADING_ELEMENT, (onReady) => {
      require.ensure(SOURCE_PATH, (require) => {
        IMPORT_DECLARATION
        onReady(IMPORT_NAME)
      })
    })
  `)

  // Generate the import declaration based on the type of import
  let importDeclaration
  if (decoratorInfo.isDefaultImport) {
    importDeclaration = buildDefaultImportDeclaration({
      IMPORT_NAME: t.identifier(decoratorInfo.name),
      SOURCE_PATH: t.stringLiteral(decoratorInfo.source),
    })
  } else {
    importDeclaration = buildNonDefaultImportDeclaration({
      IMPORT_NAME: t.identifier(decoratorInfo.name),
      SOURCE_PATH: t.stringLiteral(decoratorInfo.source),
    })
  }

  // Generate the decorator AST from template and add it to the class's decorators
  componentClass.decorators.push(buildDecorator({
    IMPORT_NAME: t.identifier(decoratorInfo.name),
    IMPORT_NAME_STRING: t.stringLiteral(decoratorInfo.name),
    SOURCE_PATH: t.stringLiteral(decoratorInfo.source),
    LOADING_ELEMENT: loadingElement,
    IMPORT_DECLARATION: importDeclaration,
  }))
}

const injectComponentReferenceIntoClassMethod = (name, classMethodPath, asyncComponentNames) => {
  // A place to keep track of references we've added so we don't add the
  // same one more than once.
  if (!classMethodPath.asyncComponentReferences) {
    classMethodPath.asyncComponentReferences = {}
  }
  // Bail if we've been here before for this reference
  if (classMethodPath.asyncComponentReferences[name]) {
    return
  }
  // Mark this path visited for this reference
  classMethodPath.asyncComponentReferences[name] = true

  if (asyncComponentNames.indexOf(name) >= 0) {
    // Build up the fragment
    const extractFromPropsBuilder = template(`
      const { COMPONENT_NAME } = this.props
    `)

    const extractFromProps = extractFromPropsBuilder({
      COMPONENT_NAME: t.identifier(name)
    })

    // Inject the generated fragment
    classMethodPath.node.body.body = [
      extractFromProps,
      ...classMethodPath.node.body.body,
    ]
  }
}

// This visitor looks for JSX tags and identifiers that reference async
// components and injects a destructuring of `this.props` to bring the injected
// async component into scope.
const referencesToAsyncComponentVisitor = {
  JSXElement(jsxElementPath) {
    const { name } = jsxElementPath.node.openingElement.name
    const { classMethodPath, asyncComponentNames } = this
    injectComponentReferenceIntoClassMethod(name, classMethodPath, asyncComponentNames)
  },
  Identifier(identifierPath) {
    const { name } = identifierPath.node
    const { classMethodPath, asyncComponentNames } = this
    injectComponentReferenceIntoClassMethod(name, classMethodPath, asyncComponentNames)
  }
}

// This visitor modifies the render method so it properly destructures the
// component prop from `this.props` so the method will transparently use the
// component injected by the wrapping component.
const methodVisitor = {
  ClassMethod(classMethodPath) {
    const { asyncComponentNames } = this

    classMethodPath.traverse(referencesToAsyncComponentVisitor, {
      classMethodPath,
      asyncComponentNames,
    })
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
    const importNameToSourceLookup = importNamesToSources(
      asyncComponentNames,
      asyncImports
    )

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
    removeImportsFromProgram(asyncComponentNames, asyncImports, programNode)

    // Add the real decorator to the component class
    importNameToSourceLookup.forEach(applyDecoratorToComponentClass.bind(null,
      classDeclarationNode,
      loadingElement
    ))

    // Drop into render method for additional modifications
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
