const micro = require('micro')
const { logger } = require('./logger')
const { Worker, SyntaxError } = require('./worker')
const Task = require('./task')
const instance = require('./browser-instance')

;(async () => {
  // QUESTION: should we create a pool of Chrome instances ?
  const browser = await instance.create()
  logger.info(`Chrome accepting connections on endpoint ${browser.wsEndpoint()}`)
  const worker = new Worker(browser)
  const server = micro(async (req, res) => {
    // TODO: add a /_status route (return mermaid version)
    // TODO: read the diagram source as plain text
    const outputType = req.url.match(/\/(png|svg)$/)?.[1]
    if (outputType) {
      const diagramSource = await micro.text(req, { limit: '1mb', encoding: 'utf8' })
      if (diagramSource) {
        try {
          const isPng = outputType === 'png'
          const output = await worker.convert(new Task(diagramSource, isPng))
          res.setHeader('Content-Type', isPng ? 'image/png' : 'image/svg+xml')
          return micro.send(res, 200, output)
        } catch (err) {
          if (err instanceof SyntaxError) {
            return micro.send(res, 400, err.message)
          } else {
            logger.warn({ err }, 'Exception during convert')
            return micro.send(res, 500, 'An error occurred while converting the diagram')
          }
        }
      }
      return micro.send(res, 400, 'Body must not be empty.')
    }
    return micro.send(res, 400, 'Available endpoints are /svg and /png.')
  })
  server.listen(8002)
})().catch(err => {
  logger.error({ err }, 'Unable to start the service')
  process.exit(1)
})
