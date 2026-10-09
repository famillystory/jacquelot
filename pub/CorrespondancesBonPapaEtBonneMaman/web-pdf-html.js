'use strict'

const fs = require('fs-extra')
const path = require('path')

const {
  PdfOptions,
  processor,
} = require('asciidoctor-pdf/lib/cli.js')

const {
  Invoker,
} = require('@asciidoctor/cli')

const converter = require('asciidoctor-pdf/lib/converter.js')

async function main () {
  // We deliberately use the same CLI option parser as
  // asciidoctor-web-pdf.
  //
  // argv must look like:
  //
  //   node web-pdf-html.js
  //     --template-require ./template.js
  //     livre-demo.adoc
  //
  const options = new PdfOptions().parse(process.argv)

  const cliOptions = options.options
  const args = options.argv.slice(2)

  const {
    files,
    'template-require': templateRequireLib,
  } = options.args

  if (!files || files.length === 0) {
    throw new Error('No input AsciiDoc file specified')
  }

  // Same template loading as asciidoctor-web-pdf.
  let templates

  if (templateRequireLib) {
    templates = Invoker.requireLibrary(templateRequireLib)
  } else {
    templates = require(
      'asciidoctor-pdf/lib/document/document-converter.js'
    ).templates
  }

  // IMPORTANT:
  // This is the exact registration used by the real CLI.
  converter.registerTemplateConverter(processor, templates)

  // IMPORTANT:
  // This is also what the real CLI does.
  // It prepares base_dir, safe mode, attributes, extensions, etc.
  Invoker.prepareProcessor(options.args, processor)

  for (const input of files) {
    await convertToHtml(input, cliOptions)
  }
}

async function convertToHtml (input, options) {
  const inputFile = path.resolve(input)

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file not found: ${input}`)
  }

  /*
   * asciidoctor-web-pdf normally creates:
   *
   *   <input>.html
   *
   * in the same directory, then gives that HTML file to Puppeteer.
   *
   * We stop exactly here.
   */
  const outputFile = path.join(
    path.dirname(inputFile),
    `${path.basename(inputFile, path.extname(inputFile))}.html`
  )

  const instanceOptions = Object.assign({}, options, {
    to_file: outputFile,
  })

  /*
   * This is the same call made by converter.js immediately
   * BEFORE it launches Puppeteer.
   */
  processor.convertFile(inputFile, instanceOptions)

  console.log(`HTML written to ${outputFile}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})