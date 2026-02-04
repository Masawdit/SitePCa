import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      nextcloudUrl,
      username,
      password,
      folderPath,
      fileName,
      fileContent,  // Base64 encoded
      contentType
    } = await req.json()

    // Validate required fields
    if (!nextcloudUrl || !username || !password || !fileName || !fileContent) {
      throw new Error('Missing required fields')
    }

    // Decode base64 file content
    const binaryString = atob(fileContent)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Clean up the Nextcloud URL - remove trailing slash and any /remote.php path if user included it
    let baseUrl = nextcloudUrl.trim()
      .replace(/\/+$/, '')  // Remove trailing slashes
      .replace(/\/remote\.php\/dav\/files\/.*$/, '')  // Remove WebDAV path if included
      .replace(/\/remote\.php.*$/, '')  // Remove any remote.php path

    // Normalize folder path
    let normalizedFolder = (folderPath || '').trim()
    if (!normalizedFolder || normalizedFolder === '/') {
      normalizedFolder = ''
    } else {
      normalizedFolder = normalizedFolder.startsWith('/') ? normalizedFolder : `/${normalizedFolder}`
      normalizedFolder = normalizedFolder.replace(/\/+$/, '')  // Remove trailing slash
    }

    // Build WebDAV base path
    const webdavBase = `${baseUrl}/remote.php/dav/files/${username}`
    const authHeader = 'Basic ' + btoa(`${username}:${password}`)

    // Try to create the folder (MKCOL) - ignore errors if it already exists
    if (normalizedFolder) {
      const folderUrl = `${webdavBase}${normalizedFolder}`
      try {
        await fetch(folderUrl, {
          method: 'MKCOL',
          headers: { 'Authorization': authHeader }
        })
      } catch (e) {
        // Ignore folder creation errors
      }
    }

    // Build file URL
    const fileUrl = `${webdavBase}${normalizedFolder}/${fileName}`

    // Upload via WebDAV PUT
    const response = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': contentType || 'application/octet-stream',
      },
      body: bytes
    })

    if (!response.ok) {
      const errorText = await response.text()
      // Provide cleaner error message
      if (response.status === 401) {
        throw new Error('Authentication failed - check username and password')
      } else if (response.status === 404) {
        throw new Error(`Folder not found. Please create "${normalizedFolder || '/'}" in your Nextcloud first, or check the URL: ${baseUrl}`)
      } else if (response.status === 409) {
        throw new Error(`Conflict - the folder path may not exist: ${normalizedFolder}`)
      }
      throw new Error(`Upload failed (${response.status}): ${errorText.substring(0, 200)}`)
    }

    return new Response(
      JSON.stringify({ success: true, url: fileUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
