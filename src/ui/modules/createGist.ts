import { commands } from '@config/commands'
import { PluginMessage } from '@typings/pluginEvent'
import { urlExportSettings } from '@typings/urlExportData'

interface GistRequestBody {
  description: string;
  public: boolean;
  files: {
    [key: string]: {
      content: string;
    };
  };
}

interface GistResponse {
  success: boolean;
  message: string;
  data?: any;
}

const responseHandler = (request: XMLHttpRequest): GistResponse => {
  if (request.status === 401) {
    return { success: false, message: '🚨 401: Check your access token' }
  }
  if (request.status === 404) {
    return { success: false, message: '🚨 404: Check your GitHub access token' }
  }
  if (request.status > 399) {
    return { 
      success: false, 
      message: `🚨 ${request.status}: An error occurred creating gist, please check the console for details.`
    }
  }
  return { 
    success: true, 
    message: '🎉 Design tokens published as gist!',
    data: JSON.parse(request.responseText)
  }
}


const createSeparateTokensForFiles = (tokenData: Record<string, any>) => {
  const seperateFiles = {
    effect: 'effects',
    textstyles: 'textStyle'
  }
  const files = {}
  console.log('tokenData', tokenData)
  Object.keys(tokenData).forEach(key => {
    console.log('key', key)
    if(seperateFiles[key]) {
      files[`${seperateFiles[key]}-tokens.tokens.json`] = { [key]: tokenData[key] }
    } else {
      files['design-tokens.tokens.json'] = { ...files['design-tokens.tokens.json'], [key]: tokenData[key] }
    }
  })
  console.log('files', files)
  return files
}

export const createGist = async (
  parent: Window,
  settings: urlExportSettings,
  tokenData: Record<string, any>,
  description: string,
  isPublic = false
): Promise<{ rawUrls: Record<string, string>, gistId: string }> => {
  try {
    const response = await new Promise<GistResponse>(resolve => {
      const request = new XMLHttpRequest()
      request.open('POST', 'https://api.github.com/gists')

      // Set headers
      request.setRequestHeader('Accept', 'application/vnd.github+json')
      request.setRequestHeader('Content-Type', 'application/json')
      request.setRequestHeader('Authorization', `${settings.authType === 'bearer' ? 'Bearer' : 'token'} ${settings.accessToken}`)

      // Handle errors
      request.onerror = () => {
        const errorResponse = {
          success: false,
          message: '🚨 An error occurred while creating gist: check your settings & access token.'
        }
        resolve(errorResponse)
      }

      // Handle success
      request.onload = (progressEvent: ProgressEvent) => {
        const req = progressEvent.target as XMLHttpRequest
        const response = responseHandler(req)
        resolve(response)
      }

      console.log('tokenData', tokenData)

      const files = createSeparateTokensForFiles(tokenData)
      const filesBody = {}
      Object.keys(files).forEach(key => {
        filesBody[key] = {
          content: JSON.stringify(files[key])
        }
      })

      // Prepare request body
      const body: GistRequestBody = {
        description,
        public: isPublic,
        files: filesBody
      }

      // Send request
      request.send(JSON.stringify(body))
    })

    const rawUrls = {}
    Object.keys(response.data.files).forEach(key => {
      rawUrls[key] = response.data.files[key].raw_url
    })
    const gistId = response.data.id

    return { rawUrls, gistId }
  } catch (error) {
    if (error instanceof SyntaxError) {
      const syntaxErrorResponse = {
        success: false,
        message: '🚨 Invalid JSON data provided'
      }
      parent.postMessage(
        {
          pluginMessage: {
            command: commands.closePlugin,
            payload: {
              notification: syntaxErrorResponse.message
            }
          } as PluginMessage
        },
        '*'
      )
    //   return syntaxErrorResponse
    }
    throw error
  }
}

export const deleteGist = async (parent: Window, gistId: string, accessToken: string) => {
  try {
    await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${accessToken}`
      }
    })
    parent.postMessage(
        {
            pluginMessage: {
                payload: { notification: 'Gist deleted' }
            } as PluginMessage
        },
        '*'
    )
  } catch (error) {
    console.error('Error deleting gist', error)
    parent.postMessage(
        {
            pluginMessage: {
            payload: { notification: 'Error deleting gist' }
            } as PluginMessage
        },
        '*'
    )
  }
}