// This package assumes a site has already been built and the files exist in the current workspace
// If there's an artifact named `artifact.tar`, it can upload that to actions on its own,
// without the user having to do the tar process themselves.

const core = require('@actions/core')

const { Deployment } = require('./internal/deployment')
const getContext = require('./internal/context')
const fs = require('fs')

const deployment = new Deployment()

async function cancelHandler(evtOrExitCodeOrError) {
  await deployment.cancel()
  process.exit(isNaN(+evtOrExitCodeOrError) ? 1 : +evtOrExitCodeOrError)
}

async function main() {
  const { isPreview } = getContext()

  let idToken = ''
  try {
    idToken = await core.getIDToken()
  } catch (error) {
    console.log(error)
    core.setFailed(`Ensure GITHUB_TOKEN has permission "id-token: write".`)
    return
  }

  // Not sure why github.context isn't working.
  // just get the webhook payload from the filesystem
  const eventPath = process.env.GITHUB_EVENT_PATH
  const eventData = fs.readFileSync(eventPath, 'utf8')

  // Parse the JSON data
  const eventJson = JSON.parse(eventData)

  const { before, after } = eventJson

  if (before >= 0 || after < 1) {
    core.info(`This commit is the same or before the one that triggered it. May not want to deploy?`)
  } else {
    core.info(`This commit is after the one that triggere dit. Deploy should be ok...`)
  }

  try {
    const deploymentInfo = await deployment.create(idToken)

    // Output the deployed Pages URL
    let pageUrl = deploymentInfo?.['page_url'] || ''
    const previewUrl = deploymentInfo?.['preview_url'] || ''
    if (isPreview && previewUrl) {
      pageUrl = previewUrl
    }
    core.setOutput('page_url', pageUrl)

    await deployment.check()
  } catch (error) {
    core.setFailed(error)
  }
}

// Register signal handlers for workflow cancellation
process.on('SIGINT', cancelHandler)
process.on('SIGTERM', cancelHandler)

// Main
main()
